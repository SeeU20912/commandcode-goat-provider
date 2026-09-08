import * as vscode from "vscode";
import type {
    CancellationToken,
    LanguageModelChatInformation,
    PrepareLanguageModelChatModelOptions,
} from "vscode";
import { GOAT_CATALOG, FALLBACK_BASE_URL, type GoatModelMeta } from "./catalog.js";

// Module-level cache of the live /models response (id set).
let cachedLiveIds: Set<string> | null = null;
let cachedLiveAt = 0;
const LIVE_CACHE_TTL_MS = 60 * 1000;

function findMeta(modelId: string): GoatModelMeta | undefined {
    return GOAT_CATALOG.find((m) => m.id === modelId || m.id.endsWith(`/${modelId}`));
}

/** Build a LanguageModelChatInformation entry from our catalog metadata. */
export function buildModelInfo(meta: GoatModelMeta): LanguageModelChatInformation {
    return {
        id: meta.id,
        name: meta.name,
        detail: meta.vendor,
        family: "Command Code GOAT",
        version: "1.0.0",
        maxInputTokens: meta.contextWindow,
        maxOutputTokens: 32768,
        capabilities: {
            toolCalling: meta.toolCall !== false,
            imageInput: meta.vision === true,
        },
        configurationSchema: {
            properties: {
                reasoningEffort: {
                    type: "string",
                    title: "Reasoning Effort",
                    enum: meta.reasoning ? ["disabled", "enabled", "high", "max"] : ["enabled"],
                    enumItemLabels: meta.reasoning ? ["Disabled", "Enabled", "High", "Max"] : ["Enabled"],
                    enumDescriptions: meta.reasoning
                        ? ["Turn off thinking", "Default thinking", "Higher effort", "Maximum effort"]
                        : ["Default"],
                    default: meta.reasoning ? "enabled" : "enabled",
                    group: "navigation",
                },
            },
        },
    } satisfies LanguageModelChatInformation;
}

async function fetchLiveModelIds(apiKey: string | undefined, baseUrl: string): Promise<Set<string>> {
    const now = Date.now();
    if (cachedLiveIds && now - cachedLiveAt < LIVE_CACHE_TTL_MS) {
        return cachedLiveIds;
    }
    const ids = new Set<string>();
    if (!apiKey) {
        return ids;
    }
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: controller.signal,
        });
        clearTimeout(t);
        if (res.ok) {
            const json = (await res.json()) as { data?: { id?: string }[] } | string[];
            if (Array.isArray(json)) {
                for (const id of json) {
                    if (typeof id === "string") ids.add(id);
                }
            } else if (Array.isArray(json.data)) {
                for (const m of json.data) {
                    if (m?.id) ids.add(m.id);
                }
            }
        }
    } catch {
        // Live discovery is best-effort; fall back to catalog only.
    }
    cachedLiveIds = ids;
    cachedLiveAt = Date.now();
    return ids;
}

/**
 * Build the list of models to show in the Copilot Chat model picker.
 * Merges the built-in GOAT catalog with (optional) live /models results and
 * any user-configured additional models.
 */
export async function buildModelList(
    options: PrepareLanguageModelChatModelOptions,
    secrets: vscode.SecretStorage
): Promise<LanguageModelChatInformation[]> {
    const config = vscode.workspace.getConfiguration();
    const showDeprecated = config.get<boolean>("commandcode.showDeprecatedModels", false);
    const enableAuto = config.get<boolean>("commandcode.enableAutoModelDiscovery", true);
    const baseUrlSetting = config.get<string>("commandcode.apiBaseUrl", FALLBACK_BASE_URL);
    const baseUrl = (baseUrlSetting || FALLBACK_BASE_URL).replace(/\/+$/, "");
    const extraModels = config.get<string[]>("commandcode.additionalModels", []);

    let liveIds: Set<string> | null = null;
    if (enableAuto) {
        const apiKey = await secrets.get("commandcode.apiKey");
        liveIds = await fetchLiveModelIds(apiKey, baseUrl);
    }

    const seen = new Set<string>();
    const infos: LanguageModelChatInformation[] = [];

    const add = (meta: GoatModelMeta) => {
        if (seen.has(meta.id)) return;
        seen.add(meta.id);
        // If live discovery succeeded and the model is missing, drop it unless
        // the user opted in to show all.
        if (liveIds && liveIds.size > 0 && !liveIds.has(meta.id) && !showDeprecated && !extraModels.includes(meta.id)) {
            return;
        }
        infos.push(buildModelInfo(meta));
    };

    for (const meta of GOAT_CATALOG) {
        add(meta);
    }

    // Extra user-configured models not in the catalog.
    for (const id of extraModels) {
        if (seen.has(id)) continue;
        seen.add(id);
        const meta = findMeta(id);
        if (meta) {
            add(meta);
        } else {
            infos.push(buildModelInfo({
                id,
                name: id.split("/").pop() ?? id,
                vendor: "Custom",
                contextWindow: 128_000,
                reasoning: true,
                toolCall: true,
            }));
        }
    }

    // NOTE: live /models results are used ONLY as a filter to drop models that
    // the server no longer serves. Models found live but absent from the catalog
    // are intentionally NOT added here: the live list includes premium models
    // (Claude / GPT-5.5+ etc.) that the GOAT plan cannot actually use, which
    // would only add noise to the picker. Users who explicitly want extra models
    // can add them via the `commandcode.additionalModels` setting instead.

    void options;
    return infos;
}

/** Reset any cached live model state (used by the refresh command). */
export function resetModelDiscoveryCache(): void {
    cachedLiveIds = null;
    cachedLiveAt = 0;
}
