import * as vscode from "vscode";
import { CommandCodeChatModelProvider, VENDOR_ID } from "./provider.js";
import { initStatusBar, resetCumulativeCounters, getSessionUsageSnapshot } from "./statusBar.js";
import { resetModelDiscoveryCache } from "./modelList.js";
import { API_KEY_URL, USAGE_DASHBOARD_URL } from "./catalog.js";

const API_KEY_SECRET = "commandcode.apiKey";

export function activate(context: vscode.ExtensionContext): void {
    resetCumulativeCounters();

    const statusBarItem = initStatusBar(context);
    const provider = new CommandCodeChatModelProvider(context.secrets, statusBarItem);

    // Register the Command Code provider under the vendor id used in package.json.
    // This makes the models appear in the Copilot Chat model picker.
    context.subscriptions.push(vscode.lm.registerLanguageModelChatProvider(VENDOR_ID, provider));

    // --- Set API key ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.setApiKey", async () => {
            const existing = await context.secrets.get(API_KEY_SECRET);
            const apiKey = await vscode.window.showInputBox({
                title: "Command Code API Key",
                prompt: existing
                    ? "更新 Command Code API Key（留空保持不变）"
                    : "输入你的 Command Code API Key（在 https://commandcode.ai/settings/keys 创建）",
                ignoreFocusOut: true,
                password: true,
                value: existing ?? "",
            });
            if (apiKey === undefined) {
                return; // user cancelled
            }
            if (!apiKey.trim()) {
                if (existing) {
                    await context.secrets.store(API_KEY_SECRET, existing);
                    vscode.window.showInformationMessage("Command Code API Key 未修改。");
                }
                return;
            }
            await context.secrets.store(API_KEY_SECRET, apiKey.trim());
            resetModelDiscoveryCache();
            vscode.window.showInformationMessage("Command Code API Key 已保存。如模型列表未刷新，可执行『Command Code: 更新模型列表』。");
        })
    );

    // --- Clear API key ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.clearApiKey", async () => {
            await context.secrets.delete(API_KEY_SECRET);
            resetModelDiscoveryCache();
            vscode.window.showInformationMessage("Command Code API Key 已清除。");
        })
    );

    // --- Open web usage dashboard ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.openUsage", () => {
            vscode.env.openExternal(vscode.Uri.parse(USAGE_DASHBOARD_URL));
        })
    );

    // --- Check usage: show local session summary in Chinese ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.checkUsage", async () => {
            const apiKey = await context.secrets.get(API_KEY_SECRET);
            if (!apiKey) {
                vscode.window.showWarningMessage(
                    "尚未配置 API Key，请先执行『Command Code: 设置 API Key』。",
                    "打开 API Keys 页面"
                ).then((choice) => {
                    if (choice === "打开 API Keys 页面") {
                        vscode.env.openExternal(vscode.Uri.parse(API_KEY_URL));
                    }
                });
                return;
            }
            const snap = getSessionUsageSnapshot();
            const hit = snap.cacheHitPercent !== undefined ? `，缓存命中 ${snap.cacheHitPercent}%` : "";
            const lines = [
                "本次会话用量（本地统计）",
                `输入：${fmt(snap.inputTokens)}`,
                `输出：${fmt(snap.outputTokens)}`,
                `缓存命中：${fmt(snap.cacheHitTokens)}${hit}`,
                "",
                "准确的 5h / 周 / 月 额度请查看官网。",
            ].join("\n");
            const pick = await vscode.window.showInformationMessage(lines, "打开官网用量页");
            if (pick === "打开官网用量页") {
                vscode.env.openExternal(vscode.Uri.parse(USAGE_DASHBOARD_URL));
            }
        })
    );

    // --- Update (refresh) model list ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.updateModelList", async () => {
            resetModelDiscoveryCache();
            vscode.window.showInformationMessage("模型发现缓存已清除，模型列表将在下次打开时刷新。");
        })
    );

    // --- Open settings ---
    context.subscriptions.push(
        vscode.commands.registerCommand("commandcode.openSettings", () => {
            vscode.commands.executeCommand("workbench.action.openSettings", "@ext:local.commandcode-goat-bridge");
        })
    );
}

function fmt(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

export function deactivate(): void {
    // Nothing to clean up beyond subscriptions.
}
