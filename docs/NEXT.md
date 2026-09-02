# Moyang Reader 唯一下一步

- 当前状态：#416、#366 与 #370 步骤 1 均已合并；当前执行 #370 步骤 2（前台阅读可见性心跳），分支为 `codex/reading-heartbeat-2026-09-02`，尚未创建新的产品 PR。
- 发布代码主线基线：`main@a75ff75e6600d82bb0223741b91a0b1309d9a07a`；PR #418、#419、#420 已合并，Issue #363、#366、#416 以 `completed` 关闭，#370 保留为后续步骤跟踪 Issue。
- 当前稳定版本：`v0.10.14`；#370 属于 `v0.11.x` 高频体验批次，不单独发布。
- 全量审计、HTML 路线和未来任务卡见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)；执行计划见 [`../tasks/plan.md`](../tasks/plan.md)，待办排序见 [`../tasks/todo.md`](../tasks/todo.md)。这些文件不产生额外 Ready 事项。
- GitHub Release [v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开；安装包、`.sig` 和 `latest.json` 已在线核验。Release run `33555344560` 的质量门禁和 Windows 构建发布成功。
- 本轮镜像子任务未通过：`Publish updater mirror` 未执行部署步骤，仓库 Cloudflare Secrets 尚未对该工作流生效；公开 Cloudflare Pages 的 v0.10.14 manifest、安装包和签名已单独验证 HTTP 200、大小与 SHA-256 一致。

## 当前切片：#370 前台阅读可见性心跳（步骤 2/3）

- 目标：为当前打开的本机文档增加前台可见性心跳，累计整数阅读秒数，并把总时长和近一年按本地日期的时长保存在本机。
- 用户价值：应用能可靠回答“我实际在这篇文档上读了多久”，切换文档、失焦、最小化、锁屏或关闭窗口时不把后台时间算进去；下一步骤可直接据此生成周统计。
- 非目标：不做周统计侧栏、清理入口、目标/提醒、图表库、联网/匿名上报或分钟级精度；不涉及 HTML 源码编辑、脚本、插件或发布链路。
- 验收标准：新增 `src/app/reading-history.ts`；只在文档可见且窗口有焦点时按 60 秒心跳累计；隐藏、失焦、页面离开和锁屏后的时间不计入；切换/关闭时刷出已累计整数秒；非法 localStorage、临时 `browser://` 文档和无效时钟值安全忽略；时钟可注入的单测覆盖合并、过滤、心跳、暂停和恢复。
- 涉及文件：`src/app/reading-history.ts`、`src/app/reading-history.test.ts`、`src/app/App.tsx`、`vitest.config.ts`、`docs/UI-INTERACTION.md`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`docs/DEVELOPMENT-AUDIT.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 `documentState` 打开生命周期、`localStorage`、Windows 路径规范化和 React 清理机制；不新增运行时依赖、外部凭据或文档迁移。
- 风险：窗口事件或系统锁屏通知可能延迟，故心跳再次检查可见性/焦点并采取保守暂停；localStorage 配额不足时保留当前追踪器的未写入秒数，不阻塞阅读。
- 回滚：回退本切片提交即可停止阅读时长记录；已有最近打开时间、阅读位置和用户文档不受影响，新增的本机历史键可保留为休眠数据。
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

- #370 步骤 2 是当前唯一执行切片；本 PR 只实现前台阅读时长记录。合并后下一独立切片为 #370 步骤 3 的周统计/清理入口，仍须重新检查 Issues 和开放 PR。
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
