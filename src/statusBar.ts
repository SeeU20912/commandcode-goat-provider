import * as vscode from "vscode";
import type { StreamUsage } from "./sse.js";
import { USAGE_DASHBOARD_URL } from "./catalog.js";

/**
 * 会话累计 token 计数器（VS Code 重启后清零）。
 * 这些是扩展实际观测到的真实用量，而非服务端配额。
 */
let cumulativeInputTokens = 0;
let cumulativeOutputTokens = 0;
let cumulativeCacheHitTokens = 0;
let cumulativeCacheMissTokens = 0;

let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * 记录一次请求的真实 token 用量（由 provider 调用）。
 */
export function recordRequestUsage(usage: StreamUsage): void {
    cumulativeInputTokens += usage.promptTokens || 0;
    cumulativeOutputTokens += usage.completionTokens || 0;
    cumulativeCacheHitTokens += usage.cacheHitTokens || 0;
    // cache miss = 输入总 token 中未被缓存命中的部分（近似）
    const input = usage.promptTokens || 0;
    const hit = usage.cacheHitTokens || 0;
    cumulativeCacheMissTokens += Math.max(0, input - hit);
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

function cacheHitPercent(): number | undefined {
    const total = cumulativeCacheHitTokens + cumulativeCacheMissTokens;
    if (total <= 0) {
        return undefined;
    }
    return Math.round((cumulativeCacheHitTokens / total) * 100);
}

/**
 * 渲染状态栏主文本与中文悬停面板。
 */
export async function refreshStatusBarUsage(item: vscode.StatusBarItem): Promise<void> {
    const enabled = vscode.workspace.getConfiguration("commandcode").get<boolean>("showUsageInStatusBar", true);
    if (!enabled) {
        return;
    }
    if (!statusBarItem) {
        statusBarItem = item;
    }
    const hitPct = cacheHitPercent();
    item.text = hitPct !== undefined
        ? `$(symbol-numeric) CC 缓存${hitPct}%`
        : "$(symbol-numeric) CC --";
    item.tooltip = buildTooltip();
}

function buildTooltip(): string {
    const hitPct = cacheHitPercent();

    const lines: string[] = [];
    lines.push("Command Code GOAT — 本次会话用量");
    lines.push("──────────────────────────");
    lines.push(`↑ 输入      ${formatTokens(cumulativeInputTokens)}`);
    lines.push(`↓ 输出      ${formatTokens(cumulativeOutputTokens)}`);
    if (cumulativeCacheHitTokens > 0) {
        lines.push(`缓存命中    ${formatTokens(cumulativeCacheHitTokens)}${hitPct !== undefined ? `（${hitPct}%）` : ""}`);
    }
    lines.push("──────────────────────────");
    lines.push(`准确的 5h / 周 / 月 额度请看官网：`);
    lines.push(USAGE_DASHBOARD_URL);
    lines.push("点击状态栏打开官网用量页。");
    return lines.join("\n");
}

export function initStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
    item.name = "Command Code GOAT";
    item.text = "$(symbol-numeric) CC --";
    item.tooltip = "Command Code GOAT 会话用量。点击打开官网用量页。";
    item.command = "commandcode.openUsage";
    context.subscriptions.push(item);
    item.show();
    statusBarItem = item;
    void refreshStatusBarUsage(item);
    return item;
}

export function resetCumulativeCounters(): void {
    cumulativeInputTokens = 0;
    cumulativeOutputTokens = 0;
    cumulativeCacheHitTokens = 0;
    cumulativeCacheMissTokens = 0;
}

/** 会话统计快照（供命令面板展示中文用量摘要）。 */
export interface SessionUsageSnapshot {
    inputTokens: number;
    outputTokens: number;
    cacheHitTokens: number;
    cacheHitPercent?: number;
}

export function getSessionUsageSnapshot(): SessionUsageSnapshot {
    return {
        inputTokens: cumulativeInputTokens,
        outputTokens: cumulativeOutputTokens,
        cacheHitTokens: cumulativeCacheHitTokens,
        cacheHitPercent: cacheHitPercent(),
    };
}
