# Moyang Reader 唯一下一步

- 当前状态：#416 已完成实现与本地 Windows 验收；PR [#418](https://github.com/MY-moss/moyang_Reader/pull/418) 的 CI run `33591347377` 已全绿，等待人工审查/合并。
- 发布代码主线基线：`main@b11539ea85bc816dbb9f002021084755d7c826b2`；PR #415 已合并，Issue #363 已以 `completed` 关闭。
- 当前稳定版本：`v0.10.14`；#416 完成后如需发布，候选版本为 `v0.10.15` Windows x64 patch。
- 全量审计、HTML 路线和未来任务卡见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)；执行计划见 [`../tasks/plan.md`](../tasks/plan.md)，待办排序见 [`../tasks/todo.md`](../tasks/todo.md)。这些文件不产生额外 Ready 事项。
- GitHub Release [v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开；安装包、`.sig` 和 `latest.json` 已在线核验。Release run `33555344560` 的质量门禁和 Windows 构建发布成功。
- 本轮镜像子任务未通过：`Publish updater mirror` 未执行部署步骤，仓库 Cloudflare Secrets 尚未对该工作流生效；公开 Cloudflare Pages 的 v0.10.14 manifest、安装包和签名已单独验证 HTTP 200、大小与 SHA-256 一致。

## 当前切片：#416 Windows 外部图标、快捷方式与文件关联图标一致性

- 目标：让应用内部 Logo、Windows 可执行文件/安装包、桌面快捷方式、开始菜单、任务栏和 Markdown/TXT 文件关联使用同一套已确认 Logo。
- 用户价值：安装、升级或打开 Markdown/TXT 文档时不再看到旧字母 M 或默认图标，用户能确认桌面入口与应用本体属于同一版本。
- 非目标：不重新设计 Logo；不做 macOS/Linux/移动端图标；不清理用户工作区；不把删除 Windows 系统缓存作为唯一修复。
- 现象边界：v0.10.14 远程源码已包含新的 `src/assets/moyang-reader-logo.png` 和 `src-tauri/icons/*`；旧本地工作树仍可能是字母 M，Windows 也可能缓存旧快捷方式或文件关联图标。
- 依赖：现有已确认的 Windows PNG/ICO 资源、Tauri NSIS 打包链和 Windows x64 验证环境；不新增运行时依赖。
- 验收标准：资源存在且非空、尺寸/格式/哈希与确认 Logo 一致；`bundle.icon` 显式覆盖全部 Windows 资源；Release preflight 能拦截缺失、旧资源、旧 M 图标和不安全路径；全新安装、覆盖升级、桌面/开始菜单快捷方式、`.md/.txt` 关联均指向新可执行文件；Windows Shell 缓存边界有记录。
- 风险：固定哈希会要求未来有意换 Logo 时同步更新测试；Windows 图标缓存不受应用完全控制；资源门禁过严时会在发布前暴露配置遗漏。
- 回滚：回退本切片提交即可恢复原配置和校验逻辑，不涉及用户数据迁移；如需撤回已安装版本，按发布政策使用上一稳定版重新安装，不删除用户缓存。
- 实现范围：从最新 `main` 建立项目内 `.codex-worktrees/` 的干净工作树；显式声明 `bundle.icon` 的 Windows 图标路径；删除未被引用且仍含旧字母 M 的 `src-tauri/icons/icon.svg`；增加资源完整性检查、单测和 Windows 安装/升级/关联验证记录。
- 本地验收：release-check 11/11、Prettier、Tauri Windows x64 无安装包构建、NSIS 本地安装包、可执行文件图标提取、全新安装和覆盖升级均通过；验证环境已清理，原本机安装引用已恢复。
- 发布：本切片只生成本地验收用 NSIS 包，不创建 GitHub Release、签名文件、`latest.json` 或 Cloudflare 镜像；若维护者将 #416 纳入 `v0.10.15` 稳定批次，再按发布政策统一生成并核验全部资产。
- 涉及文件：`src-tauri/tauri.conf.json`、`src-tauri/icons/icon.svg`、`scripts/release-check.mjs`、`scripts/release-check.test.mjs`、`docs/UPDATE.md`、`docs/AI-HANDOFF.md`、`docs/handoff/v0.10.md`、本文件和任务清单。

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

- #416 已完成代码和本地验收，PR [#418](https://github.com/MY-moss/moyang_Reader/pull/418) CI 已全绿；人工审查/合并后必须停止，不自动开始下一切片。
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
