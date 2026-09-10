/**
 * Command Code GOAT catalog: a curated, mostly-static list of models available
 * on the GOAT ($10/mo) plan, based on the official Command Code docs
 * (commandcode.ai/docs/plans/goat). Used as the base set shown in the Copilot
 * Chat model picker and merged with the live /models response when auto
 * discovery is enabled.
 *
 * The `id` is the full Command Code model id (e.g. "deepseek/deepseek-v4-flash")
 * which the provider API accepts verbatim. The short id after the "/" is also
 * accepted by the API, but we always send the full id for clarity.
 */

export interface GoatModelMeta {
    /** Full model id sent to the API, e.g. "deepseek/deepseek-v4-flash". */
    readonly id: string;
    /** Human friendly name shown in the picker, e.g. "DeepSeek V4 Flash". */
    readonly name: string;
    /** Vendor/company grouping label, e.g. "DeepSeek". */
    readonly vendor: string;
    /** Context window in tokens (informational). */
    readonly contextWindow: number;
    /** Model supports vision (image input). */
    readonly vision?: boolean;
    /** Model performs reasoning / supports thinking. */
    readonly reasoning?: boolean;
    /** Model supports tool calling. */
    readonly toolCall?: boolean;
}

export const GOAT_CATALOG: readonly GoatModelMeta[] = [
    // DeepSeek
    { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", vendor: "DeepSeek", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash (latest)", vendor: "DeepSeek", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    { id: "deepseek/deepseek-v4-flash-vision-exp", name: "DeepSeek V4 Flash Vision (exp)", vendor: "DeepSeek", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "deepseek/deepseek-v4-flash-fast", name: "DeepSeek V4 Flash Fast", vendor: "DeepSeek", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro (latest)", vendor: "DeepSeek", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    // Kimi (Moonshot AI)
    { id: "moonshotai/Kimi-K3", name: "Kimi K3", vendor: "Moonshot AI", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "moonshotai/Kimi-K2.7-Code", name: "Kimi K2.7 Code", vendor: "Moonshot AI", contextWindow: 256_000, vision: true, reasoning: true, toolCall: true },
    { id: "moonshotai/Kimi-K2.7-Code-Highspeed", name: "Kimi K2.7 Code HighSpeed", vendor: "Moonshot AI", contextWindow: 262_000, vision: true, reasoning: true, toolCall: true },
    { id: "moonshotai/Kimi-K2.6", name: "Kimi K2.6", vendor: "Moonshot AI", contextWindow: 256_000, vision: true, toolCall: true },
    { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", vendor: "Moonshot AI", contextWindow: 256_000, vision: true, toolCall: true },
    // Z.ai (GLM) — note: live /models reports the Flash variant as z-ai/glm-5.3-flash
    { id: "zai-org/GLM-5.3", name: "GLM-5.3", vendor: "Z.ai", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    { id: "z-ai/glm-5.3-flash", name: "GLM-5.3 Flash", vendor: "Z.ai", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "zai-org/GLM-5.2", name: "GLM-5.2", vendor: "Z.ai", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    { id: "zai-org/GLM-5.2-Fast", name: "GLM-5.2 Fast", vendor: "Z.ai", contextWindow: 1_000_000, toolCall: true },
    { id: "zai-org/GLM-5.1", name: "GLM-5.1", vendor: "Z.ai", contextWindow: 200_000, toolCall: true },
    { id: "zai-org/GLM-5", name: "GLM-5", vendor: "Z.ai", contextWindow: 200_000, toolCall: true },
    // Qwen (Alibaba)
    { id: "Qwen/Qwen3.8-27B", name: "Qwen 3.8 27B", vendor: "Alibaba", contextWindow: 262_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.8-Flash", name: "Qwen 3.8 Flash", vendor: "Alibaba", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.8-Max", name: "Qwen 3.8 Max", vendor: "Alibaba", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.8-Max-0902", name: "Qwen 3.8 Max 0902", vendor: "Alibaba", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.7-Max", name: "Qwen 3.7 Max", vendor: "Alibaba", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.7-Plus", name: "Qwen 3.7 Plus", vendor: "Alibaba", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.7-Flash", name: "Qwen 3.7 Flash", vendor: "Alibaba", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.6-Max-Preview", name: "Qwen 3.6 Max Preview", vendor: "Alibaba", contextWindow: 200_000, reasoning: true, toolCall: true },
    { id: "Qwen/Qwen3.6-Plus", name: "Qwen 3.6 Plus", vendor: "Alibaba", contextWindow: 200_000, vision: true, reasoning: true, toolCall: true },
    // Tencent
    { id: "tencent/hy3-paid", name: "Tencent Hy3", vendor: "Tencent", contextWindow: 262_000, reasoning: true, toolCall: true },
    { id: "tencent/hy4-preview", name: "Tencent Hy4 Preview", vendor: "Tencent", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    // Gemini (Google)
    { id: "google/gemini-3.8-flash", name: "Gemini 3.8 Flash", vendor: "Google", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "google/gemini-3.7-flash", name: "Gemini 3.7 Flash", vendor: "Google", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "google/gemini-3.6-flash", name: "Gemini 3.6 Flash", vendor: "Google", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash", vendor: "Google", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "google/gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite", vendor: "Google", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    // MiniMax
    { id: "MiniMaxAI/MiniMax-M3", name: "MiniMax M3", vendor: "MiniMax", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "MiniMaxAI/MiniMax-M2.7", name: "MiniMax M2.7", vendor: "MiniMax", contextWindow: 200_000, toolCall: true },
    { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5", vendor: "MiniMax", contextWindow: 200_000, toolCall: true },
    // StepFun
    { id: "stepfun/Step-3.7-Flash", name: "Step 3.7 Flash", vendor: "StepFun", contextWindow: 256_000, vision: true, reasoning: true, toolCall: true },
    { id: "stepfun/Step-3.5-Flash", name: "Step 3.5 Flash", vendor: "StepFun", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    // xAI
    { id: "xai/grok-4.6", name: "Grok 4.6", vendor: "xAI", contextWindow: 500_000, vision: true, reasoning: true, toolCall: true },
    { id: "xai/grok-4.5", name: "Grok 4.5", vendor: "xAI", contextWindow: 500_000, vision: true, reasoning: true, toolCall: true },
    // Thinking Machines
    { id: "thinkingmachines/inkling", name: "Inkling", vendor: "Thinking Machines", contextWindow: 256_000, vision: true, reasoning: true, toolCall: true },
    { id: "thinkingmachines/inkling-small", name: "Inkling Small", vendor: "Thinking Machines", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    // NVIDIA
    { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra", vendor: "NVIDIA", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    // Meta (Muse Spark family)
    { id: "meta/muse-spark-1.3", name: "Muse Spark 1.3", vendor: "Meta", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "meta/muse-spark-1.3-contributor", name: "Muse Spark 1.3 Contributor", vendor: "Meta", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "meta/muse-spark-1.2", name: "Muse Spark 1.2", vendor: "Meta", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "meta/muse-spark-1.2-contributor", name: "Muse Spark 1.2 Contributor", vendor: "Meta", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    { id: "meta/muse-spark-1.1", name: "Muse Spark 1.1", vendor: "Meta", contextWindow: 1_000_000, vision: true, reasoning: true, toolCall: true },
    // Poolside (free while capacity lasts)
    { id: "poolside/laguna-s-2.1-free", name: "Laguna S 2.1 (free)", vendor: "Poolside", contextWindow: 256_000, reasoning: true, toolCall: true },
    // Meituan (free while it lasts)
    { id: "meituan/LongCat-2.0:free", name: "LongCat 2.0 (free)", vendor: "Meituan", contextWindow: 1_000_000, reasoning: true, toolCall: true },
    // InclusionAI (partner deal)
    { id: "inclusionai/ling-3.0-flash-sante:free", name: "Ling 3.0 Flash Sante (free)", vendor: "InclusionAI", contextWindow: 262_144, reasoning: true, toolCall: true },
    // Xiaomi
    { id: "xiaomi/mimo-v2.5", name: "MiMo V2.5", vendor: "Xiaomi", contextWindow: 1_000_000, vision: true, toolCall: true },
    { id: "xiaomi/mimo-v2.5-pro", name: "MiMo V2.5 Pro", vendor: "Xiaomi", contextWindow: 1_000_000, toolCall: true },
];

export const FALLBACK_BASE_URL = "https://api.commandcode.ai/provider/v1";
export const USAGE_DASHBOARD_URL = "https://commandcode.ai/usage";
export const API_KEY_URL = "https://commandcode.ai/settings/keys";
