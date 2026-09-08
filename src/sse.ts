import type { OpenAIStreamChunk, OpenAIUsage } from "./openaiTypes.js";

/** Token usage extracted from a streamed response (or non-stream fallback). */
export interface StreamUsage {
    promptTokens: number;
    completionTokens: number;
    cacheHitTokens?: number;
}

export function usageToStreamUsage(usage?: OpenAIUsage): StreamUsage | undefined {
    if (!usage) {
        return undefined;
    }
    return {
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        cacheHitTokens: usage.prompt_tokens_details?.cached_tokens,
    };
}

/**
 * Consume an SSE (Server-Sent Events) response body from an OpenAI-compatible
 * streaming endpoint, invoking callbacks for each parsed JSON chunk.
 *
 * Handles the common `data: {json}\n\n` framing, `data: [DONE]` terminator,
 * and lines that are not JSON (kept but ignored) for robustness.
 */
export async function consumeSseStream(
    responseBody: ReadableStream<Uint8Array>,
    onChunk: (chunk: OpenAIStreamChunk) => void,
    signal?: AbortSignal
): Promise<void> {
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            if (signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });

            // Process complete lines (SSE events separated by \n\n or \n).
            let sepIndex: number;
            // Split on double newline first (standard SSE event boundary).
            while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
                const rawEvent = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 2);
                handleSseEvent(rawEvent, onChunk);
            }
            // Also handle single \n separated frames (some providers use \n).
            while ((sepIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 1);
                if (line.trim() !== "") {
                    handleSseLine(line, onChunk);
                }
            }
        }
        // Final flush for any trailing data without newline.
        if (buffer.trim() !== "") {
            handleSseLine(buffer, onChunk);
        }
    } finally {
        reader.releaseLock();
    }
}

function handleSseEvent(rawEvent: string, onChunk: (chunk: OpenAIStreamChunk) => void): void {
    for (const line of rawEvent.split("\n")) {
        if (line.trim() !== "") {
            handleSseLine(line, onChunk);
        }
    }
}

function handleSseLine(line: string, onChunk: (chunk: OpenAIStreamChunk) => void): void {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
        return;
    }
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") {
        return;
    }
    try {
        const parsed = JSON.parse(payload) as OpenAIStreamChunk;
        onChunk(parsed);
    } catch {
        // Non-JSON SSE payload (e.g. keep-alive comments) — ignore.
    }
}
