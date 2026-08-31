# Moyang Reader 唯一下一步

- 当前状态：等待从最新 `main` 创建 #360 的独立功能分支和 PR。
- 当前原则：一个垂直切片、一次主要 CI、一个 PR；完成交接后停止，不自动开始下一项。
- 不并行处理 Dependabot；没有用户功能变化的工程治理切片不创建安装包。

## 核验状态

- 最近核验：2026-08-31
- 当前主线：`main@5c039f75a8bd471e14ccacbeedf3ef8a233ea51c`；PR #381 已合并。
- 已完成切片：PR #381 完成构建缓存稳定性补强；Quality checks run `33354301746` 成功，合并后主线 run `33355176879` 成功。
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 当前实现分支：无；下一切片必须从最新 `main` 创建。
- 当前 PR：无。
- 本轮发布：不创建安装包、Tag、Release 或 Cloudflare 镜像；构建缓存修复纳入下一稳定 Windows x64 批次。

## 唯一下一步：#360 工作区树操作异步化

- 优先级：Must / P2
- 风险级别：T2（Rust 命令边界和长时文件 IO）
- 计划版本：v0.11.x
- Issue：[#360](https://github.com/MY-moss/moyang_Reader/issues/360)

### 用户价值

删除、复制、移动或新建大型文件夹时，窗口保持响应，不因递归文件 IO 和 fsync 长时间显示“未响应”。

### 本切片范围

- 将 `delete_workspace_entry`、`duplicate_workspace_entry`、`copy_workspace_entry`、`move_workspace_entry`、`create_markdown_file` 改为现有的 `async fn + run_blocking` 模式。
- 保持现有返回值、错误文案、文件监听和右键菜单语义；只把阻塞 IO 移出窗口事件循环。
- 为大目录失败、目标已存在、源目标相同和取消/中断边界补充 Rust 定向测试。
- 如果现有进度反馈边界足够稳定，再补最小进度状态；不在本切片引入新的任务系统。

### 非目标

- 不改 Markdown 编辑器、阅读渲染、导出、更新器、签名、用户数据或跨平台范围。
- 不顺手实现回收站、撤销历史、云同步或新的文件树功能。
- 不改变删除语义；回收站方案仍由独立 Issue 决定。

### 验收标准

- [ ] 五个命令不再在 Tauri 主线程执行递归文件 IO。
- [ ] 大目录操作期间窗口、取消和错误反馈保持可用。
- [ ] 现有成功路径和错误路径行为不回归。
- [ ] Rust 定向测试、lint、format 和相关 Windows desktop smoke 通过。
- [ ] 不生成项目内 `src-tauri/target`，继续使用应用级构建缓存。
- [ ] PR 包含测试结果、手动验证路径、回滚方式和下一项交接。

### 依赖、风险与回滚

- 依赖：现有 `run_blocking` helper、Tauri command 注册和 Windows 文件系统权限。
- 风险：跨线程错误转换、操作取消时的部分文件和监听事件顺序；失败时保留现有同步实现的可回滚提交。
- 回滚：回退 #360 PR；不删除用户文件，不需要数据迁移。

### 预计修改范围

- 代码：`src-tauri/src/commands.rs` 及其 Rust 测试/命令注册。
- 测试：相关 Rust 测试、必要的 Windows desktop smoke。
- 文档：`docs/NEXT.md`、`docs/AI-HANDOFF.md`、`docs/ROADMAP.md`、`CHANGELOG.md`（仅在行为完成后更新）。

## 开始前检查

1. 查看 Issues，确认 #360 没有新的重复反馈。
2. 从最新 `main` 创建 `codex/<scope>-2026-08-31` 分支和独立 worktree。
3. 只读取 `docs/AI-WORKFLOW.md`、本文件、#360、相关 Rust 命令、一个相似的 `run_blocking` 实现和对应测试。
4. 先写一页以内的 READY 上下文，再实现、验证、提交、推送和创建一个 PR。
5. 合并后更新本文件并停止，不自动开始 #369 或 #359。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 `docs/NEXT.md` 中的唯一下一步，遵循 `docs/AI-WORKFLOW.md`，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
