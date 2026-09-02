# Moyang Reader 唯一下一步

- 当前状态：#416、#366、#370 三步、#233 和 #191 快速打开子切片均已合并；当前执行 #191 的标签栏 roving tabindex 子切片，分支为 `codex/tabs-roving-2026-09-02`，PR [#425](https://github.com/MY-moss/moyang_Reader/pull/425)，Quality checks run `33640484585` 进行中。
- 发布代码主线基线：`main@a650f934429f8f19511dd6c72ef5b17541c694ff`；PR #418、#419、#420、#421、#422、#423、#424 已合并，Issue #233、#363、#366、#370、#416 以 `completed` 关闭，#191 保持开放以承载剩余子切片。
- 当前稳定版本：`v0.10.14`；#191 属于 `v0.11.x` 高频体验批次，不单独发布。
- 全量审计、HTML 路线和未来任务卡见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)；执行计划见 [`../tasks/plan.md`](../tasks/plan.md)，待办排序见 [`../tasks/todo.md`](../tasks/todo.md)。这些文件不产生额外 Ready 事项。
- GitHub Release [v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开；安装包、`.sig` 和 `latest.json` 已在线核验。Release run `33555344560` 的质量门禁和 Windows 构建发布成功。
- 本轮镜像子任务未通过：`Publish updater mirror` 未执行部署步骤，仓库 Cloudflare Secrets 尚未对该工作流生效；公开 Cloudflare Pages 的 v0.10.14 manifest、安装包和签名已单独验证 HTTP 200、大小与 SHA-256 一致。

## 当前切片：#191 标签栏 roving tabindex 与方向键导航（第 2 个子切片）

- 目标：让打开的文档标签形成可预测的单 Tab 停靠点，方向键移动焦点并同步选择，Home/End 可快速到达首尾。
- 用户价值：键盘和读屏用户在多个文档间切换时不必逐个经过关闭按钮，始终知道当前标签并能继续阅读。
- 非目标：不实现文件树/目录 roving tabindex、读屏播报、焦点模式 Esc 互斥或其他 #191 子切片；不改变鼠标、中键关闭、拖拽排序、右键菜单、文档内容、HTML、脚本、插件或发布链路。
- 验收标准：标签栏声明水平方向；仅当前 roving 标签进入 Tab 顺序；ArrowLeft/ArrowRight 循环移动焦点并选择文档，Home/End 定位首尾；`aria-pressed` 与当前文档同步；组件测试、双文档浏览器 E2E、构建、lint、格式和类型感知检查通过。
- 涉及文件：`src/app/components/Tabs.tsx`、`src/app/components/Tabs.test.tsx`、`e2e/smoke.spec.ts`、`docs/UI-INTERACTION.md`、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`docs/DEVELOPMENT-AUDIT.md`、`docs/ROADMAP.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：复用现有 `Tabs` 的受控 `activePath`、`onSelect`、右键菜单焦点契约和原生按钮焦点；不新增运行时依赖、外部凭据或数据迁移。
- 风险：异步切换或标签关闭可能暂时改变受控状态；本地 roving 路径在活动文档变化和条目移除时回退到有效标签，保留关闭/拖拽/菜单动作并以组件和浏览器回归锁定。
- 回滚：回退本 PR 即可移除方向键处理、roving 状态和新增测试；不需要数据迁移，也不影响 #424 已交付的快速打开语义。
- 发布：本切片只做普通 UI 代码与针对性验证，不生成 Windows 安装包、GitHub Release、签名文件、`latest.json` 或 Cloudflare 镜像；稳定批次再统一打包。

## 最近完成：#191 快速打开高亮跟随与读屏语义（第 1 个子切片）

- PR [#424](https://github.com/MY-moss/moyang_Reader/pull/424) 已 squash 合并为 `main@a650f934429f8f19511dd6c72ef5b17541c694ff`，Quality checks run `33634427700` 全绿；Issue #191 保持开放。
- 快速打开结果已具备稳定 option ID、`aria-controls`/`aria-activedescendant`、`aria-selected` 和活动项最近滚动；组件测试、长列表 E2E、构建、lint、类型感知和格式检查均通过。

## 最近完成：v0.10.14 / #363 DOCX 导出可靠性修复

- 目标：让批量 Word 导出在大文件场景减少逐块刷盘，并在 Worker 部分输出后失败时清理临时卷、回放当前卷；取消操作不误触发回退。
- 验收：前端 338 项、Rust 54 项、浏览器和 Windows 桌面 E2E、Release 检查、构建与远程 Quality checks 均通过；旧 Release 首次构建发现产物路径问题，已由 PR #414 修复并重新发布。
- 交付：PR [#413](https://github.com/MY-moss/moyang_Reader/pull/413) 完成 v0.10.14 版本元数据，PR [#414](https://github.com/MY-moss/moyang_Reader/pull/414) 修复 Release 构建产物发现；Issue [#363](https://github.com/MY-moss/moyang_Reader/issues/363) 已关闭。
- 回滚：回退 #363 代码和 #414 工作流修复均不需要数据迁移；如需撤回发布，保留 v0.10.14 资产并按发布政策准备新的 patch 版本，不覆盖用户安装状态。

## 最近完成：#365 插入浮层焦点与图片浏览体验

- 目标：让插入面板支持键盘导航、关闭后可靠归还编辑器焦点，并可从当前 Windows 工作区选择图片。
- 非目标：不改变 Markdown 插入语义、渲染协议或编辑器架构；不处理 DOCX/PDF 图片编辑；不在本切片生成安装包、Tag、Release 或 Cloudflare 镜像。
- 实现：插入类型 tab 使用 roving tabindex，支持方向键、Home/End；外部 pointerdown 关闭时阻止焦点漂移；图片选择器限定图片扩展名，并按当前文档计算工作区内相对路径，拒绝工作区外和不安全路径。
- 反馈：图片选择中的加载、取消、失败和桌面版限制均有明确状态；手动路径、截图粘贴和拖入提示保持可见。
- 验收：定向单测 2 文件/6 项、变更文件 ESLint/Prettier、一次前端生产构建、Rust fmt/test/clippy、浏览器插入面板 E2E 2/2、Windows 桌面烟测和远程 Quality checks run `33526998019` 均通过。
- 交付：分支 `codex/insert-popover-2026-09-01`、PR [#408](https://github.com/MY-moss/moyang_Reader/pull/408)、合并提交 `4544c926a9a0485c1f02b6ac20f9982f81877da3`；Issue #365 已以 `completed` 关闭。
- 风险与回滚：图片选择只允许当前已授权工作区，回退 PR #408 不需要数据迁移；未选择的工作区外文件不会被复制或写入。
- 发布边界：本切片不单独生成安装包；纳入 `v0.11.0` Windows x64 稳定批次。

## 下一次开发

- 当前分支只覆盖 #191 的标签栏子切片；合并后下一独立切片为 #191 的文件树 roving tabindex/方向键导航，必须重新检查 Issues 和开放 PR。
- 下一次必须从最新 `main` 重新检查 Issues、开放 PR 和 Ready backlog，再选择一个单一垂直切片。
- 不从历史上下文自动开启下一项；若没有 Ready 事项，先输出候选事项和选择理由。
- 合并后必须重新创建项目内 `.codex-worktrees/` 下的干净工作树；根目录已有的未提交改动不得覆盖。

## 开始前快速检查

1. 查看 Issues/PR，确认没有重复工作；记录提交 SHA、PR 和 CI run_id。
2. 读取 [`AI-WORKFLOW.md`](AI-WORKFLOW.md) 和本文件，只读取当前切片相关的源码、测试及一个相似实现。
3. 保持原始工作目录不动；新切片使用项目内 `.codex-worktrees/` 的独立工作树，并复用主工作区依赖。
4. 完成验证、提交、推送、PR 和交接后停止，不自动开始下一项。

## 快速触发

继续开发 Moyang Reader 时，只执行本文件唯一的 IN PROGRESS/READY 事项；若事项已完成，先更新本文件和交接，再从最新 `main` 重新检查 Issues，不得凭历史上下文猜测下一项。
