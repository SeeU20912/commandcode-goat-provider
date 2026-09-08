import * as vscode from "vscode";
import type {
    LanguageModelChatRequestMessage,
    LanguageModelChatTool,
    ProvideLanguageModelChatResponseOptions,
} from "vscode";
import type { OpenAIMessage, OpenAIToolCall, OpenAIToolDef } from "./openaiTypes.js";

/** Map a VS Code chat message role to an OpenAI role. */
export function mapRole(message: LanguageModelChatRequestMessage): "user" | "assistant" | "system" {
    const USER = vscode.LanguageModelChatMessageRole.User as unknown as number;
    const ASSISTANT = vscode.LanguageModelChatMessageRole.Assistant as unknown as number;
    const r = message.role as unknown as number;
    if (r === USER) {
        return "user";
    }
    if (r === ASSISTANT) {
        return "assistant";
    }
    return "system";
}

/** Tool result parts carry their content in an opaque `content` array. */
function isToolResultPart(part: unknown): part is { callId?: string; content?: readonly unknown[] } {
    const p = part as { content?: readonly unknown[] };
    return Array.isArray(p?.content);
}

/**
 * Duck-typed check for a thinking/reasoning part. The runtime VS Code provides
 * `LanguageModelThinkingPart` but the stable @types bundle may not declare it,
 * so we detect it structurally instead of via `instanceof`.
 */
interface ThinkingPartLike {
    readonly value: string | string[];
}
function getThinkingText(part: unknown): string | undefined {
    if (typeof part !== "object" || part === null) {
        return undefined;
    }
    const candidate = part as Partial<ThinkingPartLike> & { constructor?: { name?: string } };
    if (candidate && typeof candidate.value === "string") {
        return candidate.value;
    }
    if (candidate && Array.isArray(candidate.value) && candidate.value.every((v) => typeof v === "string")) {
        return candidate.value.join("");
    }
    return undefined;
}

/** Extract text from an array of unknown content parts. */
function textFromContent(content: readonly unknown[] | undefined): string {
    if (!content) {
        return "";
    }
    const texts: string[] = [];
    for (const inner of content) {
        if (typeof inner === "string") {
            texts.push(inner);
        } else if (inner instanceof vscode.LanguageModelTextPart) {
            texts.push(inner.value);
        }
    }
    return texts.join("\n").trim();
}

/**
 * Convert VS Code chat request messages into OpenAI-compatible messages.
 * Handles text, system, assistant tool calls, tool results and reasoning parts.
 * Images are represented as data-URL content parts for vision-capable models.
 */
export function convertMessagesToOpenAI(
    messages: readonly LanguageModelChatRequestMessage[],
    includeReasoningInRequest: boolean,
    modelSupportsVision: boolean
): OpenAIMessage[] {
    const out: OpenAIMessage[] = [];

    for (const m of messages) {
        const role = mapRole(m);
        const textParts: string[] = [];
        const imageParts: { url: string }[] = [];
        const toolCalls: OpenAIToolCall[] = [];
        const toolResults: { callId: string; content: string }[] = [];
        const reasoningParts: string[] = [];

        for (const part of m.content ?? []) {
            if (part instanceof vscode.LanguageModelTextPart) {
                textParts.push(part.value);
            } else if (part instanceof vscode.LanguageModelDataPart) {
                // Try to treat image MIME data parts as images (data URL).
                const mime = (part.mimeType || "").toLowerCase();
                if (modelSupportsVision && mime.startsWith("image/")) {
                    const dataUrl = `data:${part.mimeType};base64,${Buffer.from(part.data).toString("base64")}`;
                    imageParts.push({ url: dataUrl });
                } else {
                    // Non-image or model without vision: ignore binary payload.
                }
            } else if (part instanceof vscode.LanguageModelToolCallPart) {
                const id = part.callId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                let args = "{}";
                try {
                    args = JSON.stringify(part.input ?? {});
                } catch {
                    args = "{}";
                }
                toolCalls.push({ id, type: "function", function: { name: part.name, arguments: args } });
            } else if (isToolResultPart(part)) {
                const callId = part.callId ?? "";
                toolResults.push({ callId, content: textFromContent(part.content) });
            } else {
                const thinking = getThinkingText(part);
                if (thinking !== undefined) {
                    reasoningParts.push(thinking);
                }
            }
        }

        const joinedText = textParts.join("").trim();
        const joinedThinking = reasoningParts.join("").trim();

        if (role === "assistant") {
            const assistantMessage: OpenAIMessage = { role: "assistant", content: null };
            if (joinedText) {
                assistantMessage.content = joinedText;
            }
            // DeepSeek-style APIs require reasoning_content on assistant messages
            // that follow tool calls when thinking is enabled.
            if (includeReasoningInRequest && (reasoningParts.length > 0 || toolCalls.length > 0)) {
                (assistantMessage as unknown as Record<string, unknown>).reasoning_content = joinedThinking;
            }
            if (toolCalls.length > 0) {
                assistantMessage.tool_calls = toolCalls;
            }
            if (assistantMessage.content || assistantMessage.tool_calls) {
                out.push(assistantMessage);
            }
        }

        for (const tr of toolResults) {
            out.push({ role: "tool", tool_call_id: tr.callId, content: tr.content || "" });
        }

        if (role === "user") {
            if (imageParts.length > 0) {
                const contentArray: OpenAIMessage["content"] = [];
                if (joinedText) {
                    contentArray.push({ type: "text", text: joinedText });
                }
                for (const img of imageParts) {
                    contentArray.push({ type: "image_url", image_url: img });
                }
                out.push({ role, content: contentArray });
            } else if (joinedText) {
                out.push({ role, content: joinedText });
            }
        }

        if (role === "system" && joinedText) {
            out.push({ role, content: joinedText });
        }
    }

    return out;
}

function resolveToolMode(options?: ProvideLanguageModelChatResponseOptions): string | undefined {
    const officialToolMode = (options as unknown as { toolMode?: unknown })?.toolMode;
    const toolModeEnum = (vscode as typeof vscode & {
        LanguageModelChatToolMode?: { Auto?: unknown; Required?: unknown };
    }).LanguageModelChatToolMode;

    if (officialToolMode === toolModeEnum?.Required || officialToolMode === "required") {
        return "required";
    }
    if (officialToolMode === toolModeEnum?.Auto || officialToolMode === "auto") {
        return "auto";
    }
    const legacyToolMode = (options?.modelOptions as Record<string, unknown> | undefined)?.toolMode;
    return typeof legacyToolMode === "string" ? legacyToolMode : undefined;
}

/** Convert VS Code tool definitions to OpenAI function tools. */
export function convertToolsToOpenAI(
    options?: ProvideLanguageModelChatResponseOptions
): { tools?: OpenAIToolDef[]; tool_choice?: string } {
    if (!options?.tools || options.tools.length === 0) {
        return {};
    }

    const tools: OpenAIToolDef[] = options.tools.map((tool: LanguageModelChatTool) => {
        const def: OpenAIToolDef = {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
            },
        };
        def.function.parameters = tool.inputSchema ?? { type: "object", properties: {} };
        return def;
    });

    const toolMode = resolveToolMode(options);
    let toolChoice: string | undefined;
    if (toolMode === "required") {
        toolChoice = "required";
    } else if (toolMode === "none") {
        toolChoice = "none";
    } else if (toolMode === "auto") {
        toolChoice = "auto";
    }
    return { tools, tool_choice: toolChoice };
}
