# Moyang Reader 唯一下一步

- 开放 PR：以 GitHub 最新状态为准；不并行处理 Dependabot

## 核验状态

- 最近核验：2026-08-31
- 当前主线：`main@135d4da7c2225f1097bf288ef30763a82cf916ed`；#172、#357、#358、#375 与 #379 已合并
- 上一功能切片：[#380](https://github.com/MY-moss/moyang_Reader/pull/380) 完成 #358，Issue 已以 `completed` 关闭
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 当前状态：READY（构建缓存稳定性补强；合并后只转入 #360）
- 当前实现分支：`codex/build-cache-stability-2026-08-31`
- 当前 PR：待创建；这是 #379 合并后的工程补强，不创建安装包
- 开放 PR：#379 工程治理 PR；其余为 Dependabot，不并行处理

## 唯一下一步：构建缓存稳定性补强（PR #379 后续）

- 优先级：Must / P2
- 风险级别：T2（构建路径、工作树复用和清理脚本）
- 版本分类：不单独发布；合并后纳入下一稳定 Windows x64 批次

### 用户价值

让 Windows 开发、测试和发布不会把 Cargo/Tauri 的 `target` 重新写回项目目录，也不会因不同本地副本重复占用数 GB。

### 本切片范围

- 默认把 Cargo target 放入 `%LOCALAPPDATA%\\Moyang Reader\\build-cache\\cargo-target`；不同本地副本共用同一目录，误配置到仓库内时自动重定向。
- 清理器识别旧版按路径分组的 12 位缓存目录；仅在明确使用 `--prune-targets` 时纳入可清理列表。
- 只更新构建包装、清理器、对应测试和必要交接文档。

### 非目标

- 不改变 Markdown、编辑器、导出、更新器、签名或用户数据。
- 不删除用户目录中的非项目缓存，不生成安装包、Tag、Release 或镜像。

### 验收标准

- [ ] 包装命令始终使用项目外单一共享 target。
- [ ] `CARGO_TARGET_DIR` 指向仓库或 worktree 时被安全重定向，指向外部目录时可保留。
- [ ] 旧版按路径目标能被清理器识别且不跟随非受管目录。
- [ ] 定向测试、脚本 lint、format 和远程 Quality checks 通过。
- [ ] 项目内没有新增 `src-tauri/target` 或未忽略的生成物。

### 依赖、风险与回滚

- 依赖：Node、Cargo、Tauri CLI、Windows `LOCALAPPDATA` 和现有 CI 缓存。
- 风险：共享目标正在使用时不能强制删除；失败时先看实际 target 路径，不扩大清理范围。
- 回滚：回退本切片 PR；目标目录仅为可再生构建产物，不触碰源码或用户笔记。

### 预计修改范围

- 脚本：`scripts/shared-cargo-target.mjs`、`scripts/cleanup-workspace.mjs` 及对应测试。
- 文档：README、CONTRIBUTING、CHANGELOG、`docs/AI-WORKFLOW.md`、`docs/AI-HANDOFF.md`、本文件和 `docs/UPDATE.md`。

## 完成后

1. 记录 PR #379 的最终 head SHA、Quality checks `run_id`、结论和最后变化时间。
2. CI 全绿且无冲突后合并 PR；#375 已关闭，不重复关闭或重开 Issue。
3. 合并后从最新 `main` 创建新分支，把唯一下一步切换为 #360；本切片完成后停止，不自动开始 #360。
4. 本切片不创建安装包、Tag、Release 或镜像；稳定批次再统一发布。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 `docs/NEXT.md` 中的唯一下一步，遵循 `docs/AI-WORKFLOW.md`，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
