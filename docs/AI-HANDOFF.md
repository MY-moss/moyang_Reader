# Moyang Reader 当前交接摘要

本文件只保留当前稳定事实、正在推进的版本和外部阻塞。下一位 AI 的可执行任务只以 [`NEXT.md`](NEXT.md) 为准；完整流程见 [`AI-WORKFLOW.md`](AI-WORKFLOW.md)，历史记录见 [`handoff/`](handoff/)。

## 当前基线（2026-08-30）

- 本轮开发基线：`main@33c798cbf34df74b9e0a46f324c4303226f8b36f0`。
- 稳定版本：`v0.10.13`；此前 Windows x64 Release、NSIS 安装包、Tauri 更新签名和公开镜像资产已核验。
- 上一切片 PR：[#341](https://github.com/MY-moss/moyang_Reader/pull/341)，用于关闭 #87；已完成，最终状态以 GitHub 为准。
- 当前 milestone：`v0.11.0`，采用稳定性与用户体验双轨交替。
- 当前唯一下一步：#234 统一通知层；详细 READY 契约见 [`NEXT.md`](NEXT.md)。

## v0.11.0 顺序

1. #87：批量导出最终矩阵与 Issue 闭环（本轮 PR #341）。
2. #234：统一右上角通知栈。
3. #189：类型感知 TypeScript/ESLint 门禁。
4. #301：文件拖放状态与失败反馈。
5. #241/#51：更新实机验证、镜像与 Authenticode 条件项。
6. #299：右键菜单键盘导航和焦点归还。

每个切片使用独立分支和 PR；中间切片不生成安装包，全部完成后统一准备 `v0.11.0`。

## 最近完成

- #87 最终 Windows 矩阵已在 PR #341 实施：96 篇文档（重复图片 24、独立图片 20、长文本 20、复杂表格 16、嵌套 HTML 16），成功导出连续 3 轮。
- 三轮 renderer 最大间隔为 77/80/76ms，上下文交互为 3/6/6ms；三轮各生成 5 个可解析 DOCX，Working Set 均非单调增长。
- 取消路径确认延迟 50ms、renderer 最大间隔 78ms、生成 2 个可解析 DOCX；取消和目标目录失败后临时文件均为 0。
- 本地门禁通过：定向导出 37、全量单测 265、覆盖率、lint、format、build、浏览器 E2E 48、Windows desktop E2E 12、release checks、Actions 固定检查、npm audit 0 vulnerabilities、Rust fmt/clippy/tests 51。
- PR #339 的合并提交为 `0c83f80`：复杂 DOCX 段落、列表、表格、引用和链接改为增量序列化。
- PR #338 已合并为 `main@7ca9961`：超长文本分块和重复图片媒体复用。
- PR #337 已完成 GitHub Actions SHA 固定和前端定时依赖审计；PR #336 已完成 #189 首个门禁切片。

## 已知条件与风险

- #241：Cloudflare 静态自动部署仍缺仓库 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，旧版本安装升级闭环仍需真实 Windows 环境；凭据不得进入仓库、Issue、PR 或聊天。
- #51：Tauri 更新包已有签名，NSIS Authenticode 仍取决于可用证书；无证书时必须保留 SmartScreen 限制和哈希核验说明。
- 原始开发目录存在大量未提交修改且落后主线；所有新切片必须从最新 `origin/main` 建独立 worktree，不得重置或覆盖原目录。
- 产品边界继续是 Windows x64、本地优先、Markdown 真源；不增加跨平台、云同步、脚本插件或 DOCX/PDF 原格式编辑。

## 本轮 #87 交接

- 分支：`codex/batch-export-final-matrix-2026-08-30`；独立 worktree，基于 `origin/main@628e5c3`。
- 风险：T3；只补真实 Windows 矩阵与回归证据，未修改生产导出语义、未做数据迁移、未发布安装包/Tag/Release。
- 回滚：回退 PR #341；不会影响用户设置或已有导出文件。
- 外部记录：PR #341、Issue #87；CI 最终结论以 PR required checks 为准。
- 完成后：按 [`NEXT.md`](NEXT.md) 执行 #234，不自动开始。

## 文档职责

- `docs/NEXT.md`：唯一当前任务，最多 120 行，无历史。
- `docs/AI-HANDOFF.md`：当前版本状态和外部风险摘要，最多约 150 行。
- `docs/handoff/v0.11.md`：v0.11 已完成切片的短记录。
- `docs/handoff/v0.10.md`、`v0.9-and-earlier.md`：只读历史摘要。
- `docs/ROADMAP.md`：版本目标和跨切片顺序。
- `docs/ISSUE-INDEX.md`：Issue 分类、Ready 状态与治理规则。
