# Moyang Reader

一个 **Windows x64、阅读器优先、本地优先** 的文档阅读/编辑工具。

目标不是复制 Obsidian、Notion、VS Code 或 AI 客户端，而是把本地 Markdown 与常见文档的 **打开 → 阅读 → 查找 → 批注 → 编辑 → 保存 → 恢复 → 导出** 做得可靠、轻量，并保持普通文件始终是真源。

## 当前状态

当前稳定版本：`v0.11.0`，已发布 Windows x64 安装包和 updater metadata。

当前开发阶段是 v1.0 Freeze / 接手收口：先修正事实源、开发环境和架构边界，再进行最终 RC；v1.x 功能候选继续保持 GATED。

正式产品边界：只发布和维护 Windows x64 桌面版。浏览器构建仅用于本地开发预览和 UI 测试；macOS、Linux、Windows ARM、移动端、云同步、实时协作和任意第三方脚本插件不在 v1.0 范围。

当前开发主线已经收敛为：

```text
v0.11 体验/职责收口
    ↓
v0.12 可靠性、性能、安全与真实使用证明
    ↓
v0.13 Freeze / Compatibility / RC
    ↓
v1.0 可靠 Windows x64 基线
```

v1.0 不等待轻量知识库、AI provider、RAG、MCP 或插件内核完成。

## 核心能力

### 阅读与格式

- Markdown / GFM、YAML/TOML frontmatter、数学公式与安全 HTML 清洗；
- TXT / TEXT / LOG 纯文本；
- DOCX 转安全 HTML 阅读，覆盖常见标题、段落、列表、表格和内嵌图片；
- PDF 内嵌快速预览；
- PNG / JPG / GIF / WebP / SVG / AVIF 图片预览；
- UTF-8、UTF-8 BOM、UTF-16、GB18030 文本读取；
- Markdown、DOCX 等解析能力按需加载，避免空白启动页加载完整解析器。

### 本地阅读库

- 添加整个文件夹为阅读库，并支持同时挂载多个本地资料库；
- 目录树、最近打开、标签、出链、反向链接、未解析链接与一跳关系图；
- `[[文档]]` / `[[文档|别名]]`、同目录优先、工作区路径与 `#章节` 跳转；
- 工作区递归监听，外部文件增删改后增量刷新；
- 大工作区使用有界扫描、倒排索引、文件级缓存和安全回退；
- 文件类型/标签筛选与当前范围明确提示；
- Ctrl+P 快速打开用于“找文件”，Ctrl+F 用于“找当前文档文字”，Ctrl+Shift+F 用于“找当前阅读库内容”，三种语义保持分离。

### 阅读体验

- 多标签页、阅读历史、导航历史、章节目录和滚动位置；
- 书签、批注与本地阅读统计，不写回 Markdown 正文；
- 专注阅读、正文宽度/字号、75%–150% 阅读缩放；
- 浅色/深色/系统主题、Windows 高对比度与 reduced-motion 基线；
- 左右侧栏独立滚动和可调宽度；
- 720px 起的紧凑 Windows 窗口布局；
- 命令面板支持键盘搜索、活动项播报和高频动作入口。

### 编辑与文件安全

- Markdown 所见即所得与源码编辑；复杂语法会安全回退源码模式；
- 双链补全、`/` 块级命令、链接/图片/表格插入；
- 源码与所见即所得共享编辑历史；
- 外部修改冲突提示，避免覆盖未保存内容；
- 写回前使用临时文件/备份与安全替换策略；
- 草稿恢复中心、当前磁盘版本对比、上一保存版本恢复；
- Windows 工作区删除使用回收站语义；
- 文件/文件夹新建、重命名、复制、移动、剪切/粘贴等操作继续经过受控 Rust/Tauri 文件边界。

### 导出

- 当前文档导出 HTML、DOCX、源文件；
- 系统打印 / 保存 PDF 前提供应用内版式预览；
- 阅读库按当前筛选批量导出 HTML / Word / 打印-PDF；
- 批量导出支持进度、取消、失败清单、临时文件清理和分卷；
- 大批量 Word 导出保留独立 desktop performance benchmark，不把共享 CI Runner 的单轮毫秒抖动误判成功能回归。

### 本地隐私与恢复

- 核心阅读默认离线；
- 远程图片默认关闭，可由用户显式开启；
- 启动自动检查更新默认可关闭，手动更新入口不受影响；
- 最近文件、阅读位置、书签、批注和设置保存在本机；
- portable settings 不包含文档正文或秘密；
- AI、插件、RAG、MCP 尚不是 v1.0 核心依赖。

## 更新与发布

更新入口位于“更多 → 更新”。

- **GitHub Release `latest.json` 是 updater metadata 权威源**；
- **Cloudflare Pages 只作为备用镜像 / 分发源**；
- 配置和 release test 会阻止 endpoint 顺序退回到“镜像优先”；
- 下载完成停在“已更新”，用户确认保存状态后再手动重启；
- Tauri updater 的 `.sig` 不等于 Windows NSIS 安装包的 Authenticode；
- 真实 Windows 旧版本 → 新版本自动升级闭环不能由 CI 绿灯替代。

完整更新、签名、镜像和发布说明见 [`docs/UPDATE.md`](docs/UPDATE.md) 与 [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)。

## v1.0 前明确不做

为了避免项目再次跑偏，以下内容不进入 v1.0 阻塞链：

- macOS / Linux / Windows ARM / 移动端；
- 账号、云同步、实时协作；
- 任意第三方 JavaScript 插件市场；
- Reading Inbox 完整实现；
- Knowledge/数据库化工作区替代普通文件真源；
- AiProvider / PermissionBroker / RAG / MCP 先行架构；
- bundled local LLM；
- 把 SQLite/向量库变成用户正文唯一真源。

长期接口只从**真实内置用户动作**提炼，不做 provider/mock-first 架构工程。

## 路线图

1. **v0.11.0**：当前稳定 Windows x64 版本，已完成桌面体验、职责边界、RC 预检和发布。
2. **v0.12**：可靠性证明——5k/20k 工作区 benchmark、1MB/10MB Markdown 降级、Resilient Reading Anchor、Tauri 权限库存与负向测试、真实主流程、本地诊断。
3. **v0.13**：Freeze / Compatibility / RC——兼容、恢复、发布、安全披露和真实 Windows 验证已完成，不承载大型新功能。
4. **v1.0**：当前收口目标；先完成 D00 起的接手/运行防跑偏工作，再制作最终 RC 和正式发布。

v1.0 后的候选顺序：

- **v1.1 Reader+**：增强阅读、轻量捕获/Inbox 等；
- **v1.2 Metadata / Knowledge**：Properties、表格/保存视图等；frontmatter 写回必须先通过 round-trip safety spike；
- **v1.3 AI**：从真实“解释选区 / 翻译选区”等低风险动作开始，再根据第二个真实调用方提炼 provider/consent/secret 边界；
- **v1.4+ Interop**：RAG、MCP、RSS、声明式扩展、更多格式等按 Gate 评估。

详细阶段以 [`docs/ROADMAP.md`](docs/ROADMAP.md) 和 [`docs/AI-TASKS.md`](docs/AI-TASKS.md) 为准；[`docs/FUTURE-DEVELOPMENT-PLAN.md`](docs/FUTURE-DEVELOPMENT-PLAN.md) 只保存长期候选，不是开工许可。

## 开发

完整的 Windows x64 前置条件、依赖恢复、浏览器/桌面边界、测试分层和构建缓存规则见 [`docs/DEVELOPMENT-SETUP.md`](docs/DEVELOPMENT-SETUP.md)。日常开发按 lockfile 使用 `npm ci`，不要用 `npm install` 代替可复现安装。

```powershell
npm ci
npm run test
npm run test:coverage
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:desktop
npm run desktop
```

桌面正确性 smoke 与性能 benchmark 分开：

```powershell
# 确定性桌面功能正确性，PR gate 使用这一条
npm run test:e2e:desktop

# 96 文档批量 Word 等性能场景，scheduled/manual 趋势证据
npm run test:e2e:desktop:benchmark
```

`npm run dev` 只启动浏览器版 Vite 开发预览；桌面调试请使用 `npm run desktop`。普通生产构建不加载 WebdriverIO 测试桥接。

本地 Tauri/Cargo 构建通过项目脚本使用受管缓存，默认位于 `%LOCALAPPDATA%\Moyang Reader\build-cache\cargo-target`，避免多个 worktree 在项目目录重复生成数 GB Rust 构建物。详细清理规则见 [`docs/WORKSPACE-CLEANUP.md`](docs/WORKSPACE-CLEANUP.md)。

## 文档

- 第一次使用：[`docs/USER-GUIDE.md`](docs/USER-GUIDE.md)
- 产品需求：[`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- UI 交互：[`docs/UI-INTERACTION.md`](docs/UI-INTERACTION.md)
- 当前架构：[`ARCHITECTURE.md`](ARCHITECTURE.md)
- 开发架构契约：[`docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`](docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md)
- 隐私：[`PRIVACY.md`](PRIVACY.md)
- 安全披露：[`SECURITY.md`](SECURITY.md)
- 贡献：[`CONTRIBUTING.md`](CONTRIBUTING.md)
- 更新/发布：[`docs/UPDATE.md`](docs/UPDATE.md) / [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)
- 版本变化：[`CHANGELOG.md`](CHANGELOG.md)

## 安全报告

潜在漏洞请先阅读 [`SECURITY.md`](SECURITY.md)。如果仓库 `Security` 页面已经显示 GitHub Private Vulnerability Reporting 的 **Report a vulnerability**，请使用该私密入口。

如果私密入口暂未启用，不要在公开 Issue / PR / Discussion 中粘贴 PoC、利用细节、用户内容、私有路径、令牌或证书。可以只创建一个不含漏洞细节的最小公开 Issue，请求维护者提供私密渠道。

## AI 快速接手

当前执行真源：[`AGENTS.md`](AGENTS.md) + [`docs/AI-TASKS.md`](docs/AI-TASKS.md) + [`docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`](docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md)。完整工作流见 [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md)。

```text
继续开发 Moyang Reader。先同步最新 main，读 AGENTS.md、docs/AI-TASKS.md 和架构契约；找到最早未完成任务。只有对应该任务、修改同一范围或形成真实依赖的开放 PR 才阻塞；Dependabot/无关维护 PR 不冻结主线。BLOCKED_EXTERNAL 只标真正外部子项。一次只做一个垂直切片，并按改动范围测试。
```

需要转交到不自动读取仓库规则的 AI 时，使用 [`docs/AI-TAKEOVER-PROMPT.md`](docs/AI-TAKEOVER-PROMPT.md)。
