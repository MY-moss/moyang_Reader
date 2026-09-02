# Moyang Reader 唯一下一步

- 当前状态：#416、#366 与 #370 步骤 1/2 均已合并；当前执行 #370 步骤 3（周统计与本机记录清理），分支为 `codex/reading-history-weekly-2026-09-02`，PR [#422](https://github.com/MY-moss/moyang_Reader/pull/422) 等待远程门禁。
- 发布代码主线基线：`main@0ae85fc930a8a8f41db8f197734f5f1ef5d7db5a`；PR #418、#419、#420、#421 已合并，Issue #363、#366、#416 以 `completed` 关闭，#370 待本步骤合并后收口。
- 当前稳定版本：`v0.10.14`；#370 属于 `v0.11.x` 高频体验批次，不单独发布。
- 全量审计、HTML 路线和未来任务卡见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)；执行计划见 [`../tasks/plan.md`](../tasks/plan.md)，待办排序见 [`../tasks/todo.md`](../tasks/todo.md)。这些文件不产生额外 Ready 事项。
- GitHub Release [v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开；安装包、`.sig` 和 `latest.json` 已在线核验。Release run `33555344560` 的质量门禁和 Windows 构建发布成功。
- 本轮镜像子任务未通过：`Publish updater mirror` 未执行部署步骤，仓库 Cloudflare Secrets 尚未对该工作流生效；公开 Cloudflare Pages 的 v0.10.14 manifest、安装包和签名已单独验证 HTTP 200、大小与 SHA-256 一致。

## 当前切片：#370 周统计与本机记录清理（步骤 3/3）

- 目标：在侧栏展示当前本地周一至周日的阅读时长柱状摘要、阅读文档数和累计时长，并提供清理本机阅读历史的确认入口。
- 用户价值：用户无需离开阅读器即可回顾“这周读了什么量级”，也能明确删除本机阅读时长；原文档和其他阅读状态不会被误删。
- 非目标：不做目标/提醒、云同步、匿名上报、图表库、分钟级精度、历史趋势或按文档排行；不涉及 HTML 源码编辑、脚本、插件或发布链路。
- 验收标准：现有 `reading-history.ts` 以本地周一至周日聚合 7 个日桶并按路径去重；侧栏使用纯 CSS 柱状条显示 7 天、文档数和累计时长；空状态、当前日和无效数据安全呈现；清理前使用应用内确认弹层，确认后只移除阅读历史键并刷新为零，不影响最近打开、阅读位置、草稿或文档；组件测试、真实浏览器 E2E、全量单测、构建、lint、格式和类型感知检查通过。
- 涉及文件：`src/app/reading-history.ts`、`src/app/reading-history.test.ts`、`src/app/App.tsx`、`src/app/components/WorkspacePanel.tsx`、`src/app/components/WorkspacePanel.test.tsx`、`src/app/components/ReadingHistoryPanel.tsx`、`src/app/components/ReadingHistoryPanel.test.tsx`、`src/app/components/ReadingHistoryClearConfirmationDialog.tsx`、对应测试、`src/app/styles.css`、`e2e/smoke.spec.ts`、本文件、`docs/UI-INTERACTION.md`、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`docs/DEVELOPMENT-AUDIT.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：步骤 2 已提供本机 `dailySeconds` 数据、现有 `documentState` 生命周期、`localStorage`、Windows 路径规范化、统一 modal 行为和 React 状态；不新增运行时依赖、外部凭据或数据迁移。
- 风险：周统计按本地时区计算，旧记录只有总秒数时不会臆测归入当前周；清理后当前打开文档仍可从新的阅读时长继续记录；localStorage 不可用时保持空状态，不阻塞阅读。
- 回滚：回退本切片 PR 即可移除周统计、清理入口及摘要刷新逻辑；步骤 2 的阅读历史记录可继续保留，用户文档、最近打开、阅读位置和草稿不受影响。
- 发布：本切片只做普通 UI/存储代码与针对性验证，不生成 Windows 安装包、GitHub Release、签名文件、`latest.json` 或 Cloudflare 镜像；稳定批次再统一打包。

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

- #370 步骤 3 是当前唯一执行切片；合并后 #370 完成，下一独立切片暂定为 #233 顶栏图标与操作密度，仍须重新检查 Issues 和开放 PR。
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
