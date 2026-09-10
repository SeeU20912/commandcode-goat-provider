# 发布到 VS Code 扩展市场（Marketplace）

把 `Command Code GOAT Provider for Copilot` 发布到 Visual Studio Marketplace 的完整步骤。
全程约 15 分钟，只需做一次；之后每次升级运行一条命令即可。

---

## 一、前置信息（本项目已配置好）

| 项 | 值 |
|---|---|
| 扩展名 | `commandcode-goat-bridge` |
| Publisher ID | `seeu-studio`（已写入 package.json，**市场要求全小写**） |
| 扩展显示名 | Command Code GOAT Provider for Copilot |
| 版本 | 0.1.2 |
| 目标仓库 | `https://github.com/SeeU-studio/commandcode-goat-provider` |

> 若实际注册的 Publisher 或仓库名与此不同，先改 `package.json` 里的
> `publisher` / `repository.url` 再发布。
>
> ⚠️ **GitHub 仓库真实账号是 `SeeU20912`**（不是 `SeeU-studio`）。下方所有
> GitHub 路径均已改为 `https://github.com/SeeU20912/commandcode-goat-provider`。
> 而 **Publisher ID（`seeu-studio`）是 VS Code 市场后台的唯一标识**，
> 与 GitHub 账号无关，独立保留；请确认你创建 Publisher 时用的市场账号
> 是否也叫 `SeeU Studio`（display name 可随意，ID 必须一致）。

---

## 二、一次性准备

### 1. 创建 Azure DevOps 组织 + Publisher（免费）

1. 用微软账号登录 **<https://marketplace.visualstudio.com/manage/>**
2. 首次进入会让你**创建 Publisher**：填
   - **Name**：`seeu-studio`（ID 自动由 Name 派生，只能小写字母/数字/连字符，全局唯一）
   - **Display name**：`SeeU Studio`（对外展示名，可含大小写/空格）
   - **Description**：如 `Command Code GOAT provider for Copilot &amp; more extensions`
3. 创建完成后记住 Publisher ID（应为 `seeu-studio`）

### 2. 创建 GitHub 仓库（公开，用于开源 + Releases）

1. 到 **<https://github.com/new>** 新建仓库
2. 仓库名：`commandcode-goat-provider`
3. 选 **Public**（若私有，市场页将无法展示仓库，README 里的链接会 404）
4. 创建后把本目录推上去：

```bash
cd c:\Users\hongs\Desktop\commandcode-goat-copilot
git init
git add -A
git commit -m "feat: Command Code GOAT provider for Copilot"
git branch -M main
git remote add origin https://github.com/SeeU20912/commandcode-goat-provider.git
git push -u origin main
```

### 3. 生成 Personal Access Token (PAT)

1. 进入 **<https://dev.azure.com>** → 右上角头像 → **Personal Access Tokens**
2. **New Token**，填：
   - Name：`vsce-publish`
   - Organization：`All accessible organizations`（或你的组织）
   - Expiration：建议 90 天或 1 年
   - Scopes：**Show all scopes** → 只勾选 **Marketplace → Manage**
3. 生成后**立即复制保存**（只显示一次），形如 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`（无前缀）

> ⚠️ PAT 相当于密码，不要提交进 git、不要发到聊天里。
> 泄露后到同一页面 **Revoke** 即可作废。

---

## 三、发布（只需一次命令）

在项目目录执行（用 cmd，避免 PowerShell 下 npx 缓冲问题）：

```bat
set VSCE_PAT=你的PAT
npx @vscode/vsce publish --allow-missing-repository
```

或使用本项目脚本（同样先设好环境变量）：

```bat
set VSCE_PAT=你的PAT
npm run publish
```

看到 `DONE  Published xxx` 即成功。几分钟后可在
**<https://marketplace.visualstudio.com/items?itemName=seeu-studio.commandcode-goat-bridge>** 查看。

### 常见发布错误

| 报错 | 原因 | 解决 |
|---|---|---|
| `Publisher 'seeu-studio' is not known` | 未创建 Publisher 或 ID 不一致 | 回到第二步 1，确认创建 |
| `403 ... access denied` | PAT scope 不对 | PAT 必须含 `Marketplace → Manage` |
| `name should be all lowercase` | 扩展名/Publisher 含大写 | package.json 的 `name`/`publisher` 全小写 |
| `Repository not found` | `--allow-missing-repository` 未加，或仓库私有 | 加该 flag 或改公开 |

---

## 四、网页上传（备选，无需 PAT）

若不想用命令行/PAT，也可以：

1. 本地打包：`npx @vscode/vsce package --allow-missing-repository`
   （生成 `commandcode-goat-bridge.vsix`）
2. 到 **<https://marketplace.visualstudio.com/manage/>** → 你的 Publisher → **New extension → Visual Studio Code**
3. 上传 `.vsix` 并填写市场信息（描述、分类、图标自动读取）

---

## 五、升级版本

每次修改代码后发布新版本：

```bat
rem 1) 手动把 package.json 的 "version" 改成 0.1.1 / 0.2.0 ...
rem 2) 编译 + 打包验证
npm run compile
npx @vscode/vsce package --allow-missing-repository

rem 3) 发布
set VSCE_PAT=你的PAT
npx @vscode/vsce publish --allow-missing-repository
```

版本号遵循语义化版本（`major.minor.patch`），市场不允许重复发布同一版本号。

---

## 六、发布后清单

- [ ] <https://marketplace.visualstudio.com/manage/> 能看到扩展
- [ ] 市场页图标、README 正常渲染
- [ ] 本地卸载旧版，从市场重新安装一次，验证 `Command Code: Set API Key` 可用
- [ ] 把 `.vsix` 上传到 GitHub Releases（可选，方便自用分发）
- [ ] 在仓库 README 的徽章区加 marketplace 下载量徽章（可选）
