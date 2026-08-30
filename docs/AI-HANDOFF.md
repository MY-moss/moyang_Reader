# Moyang Reader 当前交接摘要

本文件只保留当前稳定事实、正在推进的版本和外部阻塞。下一位 AI 的可执行任务只以 [`NEXT.md`](NEXT.md) 为准；完整流程见 [`AI-WORKFLOW.md`](AI-WORKFLOW.md)，历史记录见 [`handoff/`](handoff/)。

## 当前基线（2026-08-30）

- 本轮开发基线：`main@0e85cbc0d9f6507f8dc0fcf08f748cac77d7b9cd`；#299 分支从该等价文件树继续。
- 稳定版本：`v0.10.13`；此前 Windows x64 Release、NSIS 安装包、Tauri 更新签名和公开镜像资产已核验。
- 上一切片 PR：[#344](https://github.com/MY-moss/moyang_Reader/pull/344)，用于完成 #301；已合并，Issue 已按 completed 关闭。
- 当前 milestone：`v0.11.0`，采用稳定性与用户体验双轨交替。
- 本轮 #299 右键菜单焦点循环、关闭归还和稳定导航已完成代码与本地验收；合并并关闭 Issue 后，唯一下一步为 #119 axe/WCAG AA Windows UI 基线，详细 READY 契约见 [`NEXT.md`](NEXT.md)。

## v0.11.0 顺序

1. #87：批量导出最终矩阵与 Issue 闭环（本轮 PR #341）。
2. #234：统一右上角通知栈。
3. #189：类型感知 TypeScript/ESLint 门禁。
4. #301：文件拖放状态与失败反馈（已完成，PR #344）。
5. #241/#51：更新实机验证、镜像与 Authenticode 条件项。
6. #346：草稿恢复前核对当前磁盘版本（已完成，PR #347）。
7. #299：右键菜单键盘导航和焦点归还（本轮已完成）。
8. #119：axe/WCAG AA Windows UI 基线（下一 READY）。

每个切片使用独立分支和 PR；中间切片不生成安装包，全部完成后统一准备 `v0.11.0`。

## 最近完成

- #234 已在 PR #342 实施统一固定通知视口：设置/更新反馈最多三条 FIFO，支持独立关闭，info/success 六秒自动关闭，error/action 常驻；正文无布局位移。
- #234 本地门禁通过：270 个单测、50 条浏览器 E2E、Windows desktop E2E 12/12、lint、format、build；CI 已通过：`sha=c37627628bf9916b00a31961a672b68827a6139e workflow=CI/Quality checks run_id=33290796215 conclusion=success last_changed_at=2026-08-30T03:49:37Z next_action=merge PR #342`。
- #189 本轮已完成类型感知 ESLint 异步门禁：`src` 启用 `no-floating-promises`、`await-thenable`、`no-misused-promises`，脚本和 desktop-e2e 保持非类型感知边界；13 处测试 fallout 已修复，3/3 规则探针通过。
- #189 本地门禁通过：全量单测 270、TypeScript build、lint、format、Rust fmt/clippy/tests 51、发布预检和 Actions 固定检查；远程 PR/Quality checks 结果以 GitHub 为准。
- #87 最终 Windows 矩阵已在 PR #341 实施：96 篇文档（重复图片 24、独立图片 20、长文本 20、复杂表格 16、嵌套 HTML 16），成功导出连续 3 轮。
- 三轮 renderer 最大间隔为 77/80/76ms，上下文交互为 3/6/6ms；三轮各生成 5 个可解析 DOCX，Working Set 均非单调增长。
- 取消路径确认延迟 50ms、renderer 最大间隔 78ms、生成 2 个可解析 DOCX；取消和目标目录失败后临时文件均为 0。
- 本地门禁通过：定向导出 37、全量单测 265、覆盖率、lint、format、build、浏览器 E2E 48、Windows desktop E2E 12、release checks、Actions 固定检查、npm audit 0 vulnerabilities、Rust fmt/clippy/tests 51。
- PR #339 的合并提交为 `0c83f80`：复杂 DOCX 段落、列表、表格、引用和链接改为增量序列化。
- PR #338 已合并为 `main@7ca9961`：超长文本分块和重复图片媒体复用。
- PR #337 已完成 GitHub Actions SHA 固定和前端定时依赖审计；PR #336 已完成 #189 首个门禁切片。

## 本轮 #234 交接

- 分支：`codex/notification-layer-2026-08-30`；独立 worktree，基于 `origin/main@33c798c`。
- PR：[#342](https://github.com/MY-moss/moyang_Reader/pull/342)；Issue：[#234](https://github.com/MY-moss/moyang_Reader/issues/234)。
- 风险：T2；无安全、权限、数据迁移、发布资产或持久化语义变化。回滚为回退 PR #342。
- 变更：`src/app/notification-queue.ts`、`src/app/components/NotificationViewport.tsx`、`src/app/App.tsx` 与样式、单测和窄窗口 E2E；UpdateNotice 共用固定视口。
- 完成后唯一下一步：#189；不自动开始。

## 本轮 #189 交接

- 分支：`codex/typescript-eslint-gates-2026-08-30`；独立 worktree，基于远程 `main@4ca46c5` 的等价文件树。
- 范围：仅收紧 `src` 的类型感知异步规则；补充规则探针和 CI 步骤；清理同步 `act` 测试中的真实未处理 Promise。未改变用户功能、持久化、导出、更新器或发布资产。
- 回滚：回退本切片 PR；不需要数据迁移，不生成安装包、Tag、Release 或镜像。
- 验证：`npm test -- --run` 270/270、`npm run lint`、`npm run check:type-aware` 3/3、`npm run format:check`、TypeScript build、Rust fmt/clippy/tests 51、发布预检和 Actions 固定检查通过。
- 交接：PR/CI 合并完成后将 #189 标记 completed；下一位 AI 只执行 [`NEXT.md`](NEXT.md) 中的 #301，不自动扩展范围。

## 本轮 #301 交接

- 基线：远程 `main@89b812af8b331e909a744686628b9abb6b3a4ee3`；分支：`codex/drag-drop-feedback-2026-08-30`；独立 worktree。
- PR：[#344](https://github.com/MY-moss/moyang_Reader/pull/344)；Issue：[#301](https://github.com/MY-moss/moyang_Reader/issues/301)。
- 结果：合并提交 `2ae4836895f314ef40d65e0e29d5aa194e0d1000`；Issue 已以 completed 关闭。
- 范围：浏览器和 Windows Tauri 原生拖放覆盖 enter/over/leave/drop 生命周期；支持、混合、不支持和未知类型有轻量反馈；重复、跳过和失败有可关闭通知；未改变文件识别、工作区导入、标签页或编辑语义。
- 验证：本地全量单测 70 文件/275 项、Lint、format、TypeScript build、前端 build、浏览器拖放 E2E 和 Windows desktop 原生拖放 E2E 1/1 通过；Quality `run_id=33303742441` 第 2 次运行全步骤成功。第 1 次失败为既有 #87 批量导出第 3 轮基准抖动，未修改该无关功能。
- 变更：新增 `FileDropOverlay`、拖放分类 helper 和 Tauri 生命周期映射；补充需求、CHANGELOG、浏览器与桌面 smoke。
- 发布：本切片不生成 Windows 安装包、Tag、Release 或镜像，结果并入 `v0.11.0` 稳定批次。
- 下一唯一任务：#119 axe/WCAG AA Windows UI 基线；不自动开始。

## 本轮 #346 交接

- 基线：远程 `main@55c09e94db26ed41aeb418dc3926ef012beb1b42`；分支：`codex/draft-compare-2026-08-30`；独立 worktree。
- PR：[#347](https://github.com/MY-moss/moyang_Reader/pull/347)；Issue：[#346](https://github.com/MY-moss/moyang_Reader/issues/346)；本轮目标是恢复前明确比较“当前文件”和“本机草稿”，不是引入版本历史或三方合并。
- 变更：桌面端恢复中心和当前文档提示读取当前磁盘版本；异步加载/失败禁止恢复；浏览器回退明确标注为草稿保存时的原文；增加来源卡片、差异统计、换行等价判断、重试和过期请求保护；恢复仍只进入编辑区，显式保存后才写盘。
- 验证：定向前端单测 4 文件/13 项、TypeScript build、format、git diff 检查、生产构建、浏览器恢复中心 E2E 1/1、Windows desktop targeted smoke 1/1 均通过。
- 风险与回滚：T2；只读当前文件并改变恢复前确认 UI，无数据迁移、更新器、签名、发布或镜像影响；回退本切片 PR 即可恢复旧行为。
- 发布：本轮不生成安装包、Tag、Release 或镜像；纳入后续稳定 `v0.11.0` 批次。
- 当前唯一下一步：执行 [`NEXT.md`](NEXT.md) 中的 #119；不自动开始下一项。

## 本轮 #299 交接

- 分支：`codex/context-menu-focus-2026-08-30`；基于远程 `main@0e85cbc0d9f6507f8dc0fcf08f748cac77d7b9cd` 的等价文件树；独立 worktree。
- Issue：[#299](https://github.com/MY-moss/moyang_Reader/issues/299)。共享右键菜单现已统一支持 Tab/Shift+Tab 循环、Arrow/Home/End 导航、Escape/外点/菜单选择后的焦点归还，以及触发元素失效时的安全回退。
- 入口：文件树、标签页、阅读区、WYSIWYG 和源码编辑器共用同一焦点契约；鼠标、Context Menu 键和 Shift+F10 保持同一业务菜单。
- 验证：共享菜单单测、浏览器键盘 E2E、Windows desktop 文件树 targeted smoke、全量单测、lint、format、TypeScript build 和生产 build 已通过；桌面 driver/mock-store 的既有环境警告不影响测试结果。
- 发布：不创建安装包、Tag、Release 或镜像；本切片不涉及数据迁移、更新器、签名或跨平台范围。
- 回滚：回退本切片 PR；下一位 AI 只执行 [`NEXT.md`](NEXT.md) 中的 #119，不自动开始下一项。

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
