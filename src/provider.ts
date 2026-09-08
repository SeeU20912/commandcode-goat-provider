import * as vscode from "vscode";
import type {
    CancellationToken,
    LanguageModelChatInformation,
    LanguageModelChatProvider,
    LanguageModelChatRequestMessage,
    LanguageModelResponsePart,
    PrepareLanguageModelChatModelOptions,
    ProvideLanguageModelChatResponseOptions,
    Progress,
} from "vscode";
import * as crypto from "crypto";

import { GOAT_CATALOG, FALLBACK_BASE_URL, type GoatModelMeta } from "./catalog.js";
import { convertMessagesToOpenAI, convertToolsToOpenAI } from "./convert.js";
import { consumeSseStream, usageToStreamUsage, type StreamUsage } from "./sse.js";
import type { OpenAIMessage } from "./openaiTypes.js";
import { refreshStatusBarUsage, recordRequestUsage } from "./statusBar.js";

// Vendor id registered in package.json contributes.languageModelChatProviders.
export const VENDOR_ID = "commandcode";

/**
 * Report usage to Copilot Chat's native token indicator by emitting a
 * LanguageModelDataPart with MIME type 'usage' (same trick as GitHub Copilot).
 */
function reportNativeUsage(usage: StreamUsage, progress: Progress<LanguageModelResponsePart>): void {
    progress.report(
        new vscode.LanguageModelDataPart(
            new TextEncoder().encode(JSON.stringify({
                prompt_tokens: usage.promptTokens,
                completion_tokens: usage.completionTokens,
                total_tokens: usage.promptTokens + usage.completionTokens,
                prompt_tokens_details: { cached_tokens: usage.cacheHitTokens ?? 0 },
            })),
            "usage"
        )
    );
}

/** Extract a stable per-conversation session id for prompt-cache optimization. */
function deriveSessionId(modelId: string, messages: readonly LanguageModelChatRequestMessage[]): string {
    for (const message of messages) {
        if (message.role !== vscode.LanguageModelChatMessageRole.User) {
            continue;
        }
        const anchor = message.content
            .map((p) => (typeof p === "string" ? p : p instanceof vscode.LanguageModelTextPart ? p.value : ""))
            .join("");
        if (!anchor.trim()) {
            continue;
        }
        const hash = crypto.createHash("sha256");
        hash.update(modelId);
        hash.update(anchor);
        const hex = hash.digest("hex").slice(0, 32);
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
    return crypto.randomUUID();
}

/** Normalize a catalog/API model id to the full form sent to the API. */
function fullModelId(id: string): string {
    return id;
}

/**
 * Chat model provider backed by the Command Code Provider API
 * (OpenAI-compatible endpoint).
 */
export class CommandCodeChatModelProvider implements LanguageModelChatProvider {
    constructor(
        private readonly secrets: vscode.SecretStorage,
        private readonly statusBarItem: vscode.StatusBarItem
    ) {}

    /** Create an undici fetch with a large body timeout for long streams. */
    private _createFetchWithTimeout(timeoutMs: number): typeof fetch {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require("path") as typeof import("path");
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const undici = require(path.join(vscode.env.appRoot, "node_modules", "undici")) as {
                Agent: new (opts: { bodyTimeout: number }) => unknown;
                fetch: typeof fetch;
            };
            const agent = new undici.Agent({ bodyTimeout: timeoutMs });
            return (url: RequestInfo | URL, init?: RequestInit) =>
                undici.fetch(url, { ...init, dispatcher: agent } as RequestInit);
        } catch {
            return fetch;
        }
    }

    /** Model metadata lookup by (possibly short) id. */
    private _findMeta(modelId: string): GoatModelMeta | undefined {
        return GOAT_CATALOG.find((m) => m.id === modelId || m.id.endsWith(`/${modelId}`));
    }

    async provideLanguageModelChatInformation(
        options: PrepareLanguageModelChatModelOptions,
        _token: CancellationToken
    ): Promise<LanguageModelChatInformation[]> {
        // Delegate model listing to the model manager (built-in catalog + optional live /models).
        const { buildModelList } = await import("./modelList.js");
        return buildModelList(options, this.secrets);
    }

    async provideTokenCount(
        _model: LanguageModelChatInformation,
        text: string | LanguageModelChatRequestMessage,
        _token: CancellationToken
    ): Promise<number> {
        // Rough estimate: ~4 chars per token. Good enough for the token indicator.
        const sample = typeof text === "string" ? text : text.content.map((p) => (typeof p === "string" ? p : p instanceof vscode.LanguageModelTextPart ? p.value : "")).join(" ");
        return Math.max(1, Math.ceil(sample.length / 4));
    }

    async provideLanguageModelChatResponse(
        model: LanguageModelChatInformation,
        messages: readonly LanguageModelChatRequestMessage[],
        options: ProvideLanguageModelChatResponseOptions,
        progress: Progress<LanguageModelResponsePart>,
        token: CancellationToken
    ): Promise<void> {
        const meta = this._findMeta(model.id);
        const requestStart = Date.now();

        // Timeout controller.
        const config = vscode.workspace.getConfiguration();
        const requestTimeoutMs = config.get<number>("commandcode.requestTimeout", 600000);
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), requestTimeoutMs);
        if (token.onCancellationRequested) {
            token.onCancellationRequested(() => {
                if (!abortController.signal.aborted) {
                    abortController.abort();
                }
            });
        }

        try {
            const apiKey = await this.secrets.get("commandcode.apiKey");
            if (!apiKey) {
                throw new Error("尚未配置 Command Code API Key，请先执行『Command Code: 设置 API Key』。");
            }

            const baseUrlSetting = config.get<string>("commandcode.apiBaseUrl", FALLBACK_BASE_URL);
            const baseUrl = (baseUrlSetting || FALLBACK_BASE_URL).replace(/\/+$/, "");

            // Include reasoning in request when the model supports it and the
            // user did not disable thinking.
            const effort = getRequestedReasoningEffort(options);
            const supportsThinking = meta?.reasoning !== false;
            const thinkingDisabled = effort === "disabled";
            const includeReasoningInRequest = supportsThinking && !thinkingDisabled;

            const converted = convertMessagesToOpenAI(messages, includeReasoningInRequest, meta?.vision === true);
            const { tools, tool_choice } = convertToolsToOpenAI(options);

            // Build the request body as a loose object (record) so optional,
            // model-specific fields (tool_choice, reasoning_effort, ...) can be
            // added without type gymnastics.
            const requestBody: Record<string, unknown> = {
                model: fullModelId(model.id),
                messages: converted as OpenAIMessage[],
                stream: true,
                stream_options: { include_usage: true },
            };
            if (tools && tools.length > 0) {
                requestBody.tools = tools;
            }
            if (tool_choice) {
                requestBody.tool_choice = tool_choice;
            }
            if (effort && effort !== "disabled" && effort !== "enabled" && supportsThinking) {
                requestBody.reasoning_effort = effort;
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "x-cmd-session": deriveSessionId(model.id, messages),
            };

            const dispatchFetch = this._createFetchWithTimeout(requestTimeoutMs);
            const response = await dispatchFetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers,
                body: JSON.stringify(requestBody),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => "");
                let detail = errText;
                try {
                    const parsed = JSON.parse(errText) as { error?: { message?: string; type?: string } };
                    detail = parsed.error?.message || parsed.error?.type || errText;
                } catch {
                    // keep raw text
                }
                throw new Error(`Command Code API 错误 ${response.status}: ${detail || response.statusText}`);
            }

            const contentType = response.headers.get("content-type") || "";
            const body = response.body;
            if (!body) {
                throw new Error("Command Code API returned an empty body.");
            }

            // Streaming (SSE) path.
            if (contentType.includes("text/event-stream") || contentType.includes("application/x-ndjson")) {
                await this._handleStreaming(model, body, requestStart, progress, meta?.reasoning !== false);
                return;
            }

            // Non-streaming fallback: parse whole JSON.
            const json = (await response.json()) as {
                choices?: { message?: { content?: string | null } }[];
                usage?: import("./openaiTypes").OpenAIUsage;
            };
            const text = json.choices?.[0]?.message?.content ?? "";
            if (text) {
                progress.report(new vscode.LanguageModelTextPart(text));
            }
            const usage = usageToStreamUsage(json.usage);
            if (usage) {
                reportNativeUsage(usage, progress);
                recordRequestUsage(usage);
                await refreshStatusBarUsage(this.statusBarItem);
            }
        } catch (err) {
            const aborted = abortController.signal.aborted;
            if (aborted) {
                // User cancelled or timeout — Copilot handles cancellation, so just return.
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Command Code 请求失败: ${message}`);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private async _handleStreaming(
        model: LanguageModelChatInformation,
        body: ReadableStream<Uint8Array>,
        requestStart: number,
        progress: Progress<LanguageModelResponsePart>,
        supportsThinking: boolean
    ): Promise<void> {
        const collectedToolCalls = new Map<number, { id: string; name: string; args: string }>();
        const textBuffer: string[] = [];

        let finalUsage: StreamUsage | undefined;

        const reportPart = (part: LanguageModelResponsePart) => {
            try {
                progress.report(part);
            } catch {
                // ignore report errors (e.g. after cancellation)
            }
        };

        await consumeSseStream(
            body,
            (chunk) => {
                const delta = chunk.choices?.[0]?.delta;
                if (delta?.content) {
                    textBuffer.push(delta.content);
                    reportPart(new vscode.LanguageModelTextPart(delta.content));
                }
                if (delta?.reasoning_content && supportsThinking) {
                    reportPart(createThinkingPart(delta.reasoning_content));
                }
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        const idx = (tc as unknown as { index?: number }).index ?? 0;
                        const cur = collectedToolCalls.get(idx) ?? { id: tc.id, name: "", args: "" };
                        if (tc.id) cur.id = tc.id;
                        if (tc.function?.name) cur.name += tc.function.name;
                        if (tc.function?.arguments) cur.args += tc.function.arguments;
                        collectedToolCalls.set(idx, cur);
                    }
                }
                if (chunk.usage) {
                    finalUsage = usageToStreamUsage(chunk.usage);
                }
            },
            undefined
        );

        // Emit completed tool calls.
        const finished = [...collectedToolCalls.entries()].sort((a, b) => a[0] - b[0]).map(([, tc]) => tc);
        if (finished.length > 0) {
            const callParts = finished.map((tc) =>
                new vscode.LanguageModelToolCallPart(tc.id || crypto.randomUUID(), tc.name, parseArgs(tc.args))
            );
            for (const p of callParts) {
                reportPart(p);
            }
        }

        // No text and no tools => still emit nothing (empty completion).
        // Report usage if present.
        if (finalUsage) {
            reportNativeUsage(finalUsage, progress);
            recordRequestUsage(finalUsage);
            await refreshStatusBarUsage(this.statusBarItem);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        void textBuffer;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        void requestStart;
        void model;
    }
}

function parseArgs(raw: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(raw || "{}");
        return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Create a thinking/reasoning response part without depending on the stable
 * type bundle declaring `LanguageModelThinkingPart`. The runtime VS Code
 * version provides the class; we construct it dynamically and cast.
 */
function createThinkingPart(text: string): LanguageModelResponsePart {
    const VscodeAny = vscode as unknown as {
        LanguageModelThinkingPart?: new (value: string | string[]) => LanguageModelResponsePart;
    };
    const ctor = VscodeAny.LanguageModelThinkingPart;
    if (ctor) {
        return new ctor(text) as LanguageModelResponsePart;
    }
    // Fallback: emit the reasoning text as a normal text part.
    return new vscode.LanguageModelTextPart(text);
}

/** Read the requested reasoning effort from model configuration / options. */
export function getRequestedReasoningEffort(options: ProvideLanguageModelChatResponseOptions): string | undefined {
    const opts = options as unknown as {
        modelConfiguration?: { reasoningEffort?: unknown };
        modelOptions?: Record<string, unknown>;
    };
    const modelConfigurationEffort = opts.modelConfiguration?.reasoningEffort;
    if (typeof modelConfigurationEffort === "string") {
        return modelConfigurationEffort;
    }
    const modelOptions = opts.modelOptions;
    const modelOptionsThinking = modelOptions?.thinking as { type?: unknown } | undefined;
    if (modelOptionsThinking?.type === false) {
        return "disabled";
    }
    const modelOptionsEffort = modelOptions?.reasoning_effort ?? modelOptions?.reasoningEffort;
    return typeof modelOptionsEffort === "string" ? modelOptionsEffort : undefined;
}
