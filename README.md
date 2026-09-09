# Command Code GOAT Provider for Copilot

把 **Command Code GOAT** 订阅 ($10/月) 的模型直接接入 VS Code 的 GitHub Copilot Chat，
在模型下拉里即可选用 DeepSeek V4、Kimi K2.7、GLM-5.2、Qwen 3.8、Gemini Flash、GPT-5.6 等 30+ 个模型。

> 本扩展是把 Command Code 官方 **Provider API**（`https://api.commandcode.ai/provider/v1`，OpenAI 兼容）
> 接入 Copilot Chat 的非官方 bridge，非 Command Code 官方出品。
> 需要有效的 **GOAT / Pro / Max（或任意含 API 权限的套餐）** 订阅。

## 功能

- 🤖 **直接进模型选择器**：在 Copilot Chat 右下角模型下拉里看到 "Command Code GOAT" 分组，选模型即可用
- 🧠 **Thinking / Reasoning**：支持 reasoned 模型的思考过程透传与 `reasoning_effort` 配置
- 🛠️ **工具调用**：Agent 模式（Edit/Read 等）在 Copilot 里正常可用
- 📊 **会话用量**：状态栏实时显示本次会话 token 数；点击直达官方用量页看 5h/周/月额度
- 🔄 **模型自动发现**：可选的从 `/models` 拉取最新模型，或手动添加任意模型 ID
- 🔐 **密钥安全**：API Key 用 VS Code 秘钥库（SecretStorage）加密存储，不写进配置/文件
- 🖥️ 桌面终端同额度：通过 CLI `cmdc` 和 本扩展 共用同一份 GOAT 额度

## 安装

### 方式一：VSIX
在 [Releases](https://github.com/SeeU20912/commandcode-goat-provider/releases) 下载最新 `.vsix`，
在 VS Code 中 `Ctrl+Shift+P` → `Extensions: Install from VSIX...` 选择文件。

### 方式二：市场安装
在扩展市场搜索 **Command Code GOAT Provider**（发布后可用）。

> **⚠️ 安装 / 更新 / 替换扩展后，必须先重载窗口才能生效**
> （`Ctrl+Shift+P` → `Developer: Reload Window`，或直接重启 VS Code）。
>
> 从**其它扩展 ID 的旧版桥接扩展**切换过来时，还要**重新执行一次 Set API Key**——
> API Key 按扩展 ID 隔离存储（SecretStorage），不会自动迁移。

## 快速开始

> 刚安装 / 更新完，先 `Ctrl+Shift+P` → **Developer: Reload Window** 重载一次再继续。

1. 打开命令面板运行 **Command Code: Set API Key**
2. 粘贴你的 Command Code API Key（在 <https://commandcode.ai/settings/keys> 创建，与 `cmdc` 通用）
3. 打开 Copilot Chat → 模型下拉选择任意 `*@commandcode` 模型
4. 开聊！

> 💡 若设置 Key 后第一次对话报错（如 *Autopilot recovered from a request error*），
> 多半是扩展未重载导致 provider 未激活——重载窗口后再试即可。

## 配置项

| 设置 | 默认 | 说明 |
|---|---|---|
| `commandcode.apiBaseUrl` | `https://api.commandcode.ai/provider/v1` | Provider API 地址（一般不用改） |
| `commandcode.requestTimeout` | `600000` | 单次请求超时（毫秒） |
| `commandcode.showUsageInStatusBar` | `true` | 状态栏显示会话 token 数 |
| `commandcode.usageRefreshInterval` | `5` | 后台刷新用量间隔（分钟） |
| `commandcode.enableAutoModelDiscovery` | `true` | 启动时从 `/models` 拉取最新模型列表 |
| `commandcode.additionalModels` | `[]` | 手动追加模型 ID（如 `deepseek/deepseek-v4-pro`） |

## 命令

| 命令 | 说明 |
|---|---|
| Command Code: Set API Key | 设置/更新 API Key |
| Command Code: Clear API Key | 清除 API Key |
| Command Code: Check Usage / Refresh | 打开官方用量页 / 刷新 |
| Command Code: Update Model List | 重新拉取模型列表 |

## 用法量查看（5h / 周 / 月）

GOAT 套餐有 5小时 ($14)、每周 ($35)、月度 ($70) 三个滚动额度窗口。
这些额度统计在 **Command Code 服务端**，本地扩展无法直接读取可靠数据，请用：

- **Web 用量页**：<https://commandcode.ai/usage>（最准确，按请求、token、模型展示，实时更新）
- **CLI**：`cmdc` 会话里输入 `/usage`，显示 `5-hour / Weekly` 进度条与重置倒计时

状态栏的 token 数是**本地会话估算值**，仅作参考，不代表服务端额度。

## 常见问题

**Q: 和商店里其它 Command Code 桥接扩展（如 commandcode-copilot-provider）冲突怎么办？**
不要同时安装两个使用 `commandcode` vendor 的扩展，它们会互相覆盖模型列表。本扩展已内置完整 GOAT
模型目录 + 自动发现，无需装其它同类扩展。卸载旧桥接扩展即可。

**Q: 模型不显示？**
1) 确认已执行 Set API Key；2) 执行 `Command Code: Update Model List`；3) 重载窗口 / 重启 VS Code。

**Q: 安装 / 更新 / 替换扩展后不生效？**
扩展需重载窗口才激活（VS Code 机制）。`Ctrl+Shift+P` → `Developer: Reload Window`；
从旧 ID 版本替换过来时同时重设一次 API Key。

**Q: 报 403 upgrade_required？**
你的 Command Code 套餐不含 API 权限（Go 套餐不含）。需要 GOAT / Pro / Max / Provider 任一。

**Q: 会不会偷我的 Key / 代码？**
不会。Key 存在 VS Code SecretStorage（系统加密），仅用于请求头，不经第三方转发；
代码与隐私与官方 Command Code 服务约定一致。本扩展完全开源可审阅。

## 开发与自用

```bash
npm install
npm run compile      # tsc 编译
npm run build        # 打包 .vsix
code --install-extension commandcode-goat-bridge.vsix --force
```

发布到市场：见 [PUBLISH.md](PUBLISH.md)

## 免责声明

本扩展与 Command Code 官方、Anthropic、OpenAI 等无隶属关系。商标归其各自所有者所有。
请遵守所购买订阅的服务条款，合理使用额度。

## License

MIT