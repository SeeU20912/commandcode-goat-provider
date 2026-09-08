/**
 * Minimal OpenAI Chat Completions types used by the Command Code Provider API
 * (https://api.commandcode.ai/provider/v1). Only the subset we need.
 */

export interface OpenAIMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null | OpenAIContentPart[];
    tool_calls?: OpenAIToolCall[];
    tool_call_id?: string;
    name?: string;
}

export type OpenAIContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

export interface OpenAIToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
}

export interface OpenAIToolDef {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters?: unknown;
    };
}

export interface OpenAIRequestBody {
    model: string;
    messages: OpenAIMessage[];
    stream: true;
    stream_options?: { include_usage?: boolean };
    tools?: OpenAIToolDef[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    reasoning_effort?: string;
    store?: boolean;
    metadata?: Record<string, string>;
}

export interface OpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: { cached_tokens?: number };
}

export interface OpenAIStreamChunk {
    choices?: {
        index: number;
        delta: {
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: OpenAIToolCall[];
        };
        finish_reason?: string | null;
    }[];
    usage?: OpenAIUsage;
}
