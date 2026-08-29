# Moyang Reader 当前交接摘要

本文件只保留当前稳定事实、正在推进的版本和外部阻塞。下一位 AI 的可执行任务只以 [`NEXT.md`](NEXT.md) 为准；完整流程见 [`AI-WORKFLOW.md`](AI-WORKFLOW.md)，历史记录见 [`handoff/`](handoff/)。

## 当前基线（2026-08-30）

- 远程主线：`main@0c83f80e552db67e9a6e68e758f9fccf588c854c`。
- 稳定版本：`v0.10.13`；Windows x64 Release、NSIS 安装包、Tauri 更新签名和公开镜像资产已核验。
- 开放 PR：规划切片开始时为 0。
- 当前 milestone：`v0.11.0`，采用稳定性与用户体验双轨交替。
- 当前唯一下一步：完成 Issue #87 的最终 Windows 批量 DOCX 三轮矩阵；详细 READY 契约见 [`NEXT.md`](NEXT.md)。

## v0.11.0 顺序

1. #87：批量导出最终矩阵与 Issue 闭环。
2. #234：统一右上角通知栈。
3. #189：类型感知 TypeScript/ESLint 门禁。
4. #301：文件拖放状态与失败反馈。
5. #241/#51：更新实机验证、镜像与 Authenticode 条件项。
6. #299：右键菜单键盘导航和焦点归还。

每个切片必须使用独立分支和 PR，合并后更新 `NEXT.md` 指向下一项并停止。中间切片不生成安装包；全部完成后统一准备 `v0.11.0`。

## 最近完成

- PR #339 已合并为 `main@0c83f80`：复杂 DOCX 段落、列表、表格、引用和链接改为增量序列化；#87 仍需最终大图片、长文本和重复矩阵验收。
- PR #338 已合并为 `main@7ca9961`：超长文本分块和重复图片媒体复用。
- PR #337 已完成 GitHub Actions SHA 固定和前端定时依赖审计。
- PR #336 已完成 #189 首个门禁切片：显式 `any`、未使用变量、TypeScript 基础严格项和 Rust 1.88。
- v0.10.13 已发布，草稿差异预览、编辑工具栏、窄窗口体验和相关稳定性切片已交付。

更早的 v0.10 记录见 [`handoff/v0.10.md`](handoff/v0.10.md)，v0.9 及更早记录见 [`handoff/v0.9-and-earlier.md`](handoff/v0.9-and-earlier.md)。

## 已知条件与风险

- #241：Cloudflare 静态自动部署仍缺仓库 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，旧版本安装升级闭环仍需真实 Windows 环境。凭据不得进入仓库、Issue、PR 或聊天。
- #51：Tauri 更新包已有签名，NSIS Authenticode 仍取决于可用证书；无证书时必须保留 SmartScreen 限制和哈希核验说明。
- 当前原始开发目录存在大量未提交修改且落后主线；所有新切片必须从最新 `origin/main` 建独立 worktree，不得重置或覆盖原目录。
- 产品边界继续是 Windows x64、本地优先、Markdown 真源；不增加跨平台、云同步、脚本插件或 DOCX/PDF 原格式编辑。

## 文档职责

- `docs/NEXT.md`：唯一当前任务，最多 120 行，无历史。
- `docs/AI-HANDOFF.md`：当前版本状态和外部风险摘要，最多约 150 行。
- `docs/handoff/v0.11.md`：v0.11 已完成切片的短记录。
- `docs/handoff/v0.10.md`、`v0.9-and-earlier.md`：只读历史摘要。
- `docs/ROADMAP.md`：版本目标和跨切片顺序。
- `docs/ISSUE-INDEX.md`：Issue 分类、Ready 状态与治理规则。

## 本轮交接治理切片（2026-08-30）

- 分支：`codex/v0.11-roadmap-handoff-2026-08-29`。
- 风险：T0，纯文档、模板和 GitHub 规划同步；不改产品代码、不升版本、不发布。
- 回滚：回滚该规划 PR；不会影响文档内容、用户设置或导出文件。
- 完成条件：`v0.11.0` milestone 与 7 个 Issues 同步；文档格式和链接检查通过；PR 合并后由新聊天按 `NEXT.md` 执行 #87。
