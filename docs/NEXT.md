# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY/Checkpoint 切片。执行前必须核对最新 `main`、开放 PR 和对应 Issue；事实变化时先修正本文件。

## 核验状态

- 最近核验：2026-08-31
- 当前主线：`main@52acd223d7ca0fb251f143bfc02820eecc88337e`；#172、#357、#358 与 #375 已合并
- 上一功能切片：[#380](https://github.com/MY-moss/moyang_Reader/pull/380) 完成 #358，Issue 已以 `completed` 关闭
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 当前状态：CHECKPOINT（PR #379 修复中，等待重新运行 CI）
- 当前实现分支：`codex/build-cache-guard-2026-08-31`
- 当前 PR：[#379](https://github.com/MY-moss/moyang_Reader/pull/379)；上一轮失败根因为 13 个文件格式不通过，未发现功能测试根因
- 开放 PR：#379 工程治理 PR；其余为 Dependabot，不并行处理

## 唯一下一步：PR #379 构建缓存防膨胀修复

- 优先级：Must / P2
- 风险级别：T2（构建路径、工作树复用和 CI/发布脚本）
- 版本分类：不单独发布；合并后纳入下一稳定 Windows x64 批次

### 用户价值

让 Windows 开发、测试和发布不会把 Cargo/Tauri 的 `target` 重新写回项目目录，也不会在多个 worktree 中重复占用数 GB，避免本地目录再次异常膨胀。

### 本切片范围

- `npm run desktop`、`npm run tauri -- <args>` 和 `npm run rust -- <args>` 统一通过包装层执行。
- 默认把 Cargo target 放入 `%LOCALAPPDATA%\\Moyang Reader\\build-cache\\<repository-key>\\cargo-target`；误配置到仓库内时自动重定向。
- CI、Windows desktop smoke 和发布前 Rust 检查复用同一缓存边界；测试验证路径不会生成项目内 `src-tauri/target`。
- 修复 PR 与最新 `main@52acd223d7ca0fb251f143bfc02820eecc88337e` 的格式和主线偏差。

### 非目标

- 不改变 Markdown、编辑器、导出、更新器、签名或用户数据。
- 不删除用户目录中的缓存，不把缓存目录加入仓库，不生成安装包、Tag、Release 或镜像。
- 不顺手处理 #360、#359 或其他产品 Issue。

### 验收标准

- [ ] 包装命令能透传 Cargo/Tauri 参数，并始终使用项目外共享 target。
- [ ] `CARGO_TARGET_DIR` 指向仓库或 worktree 时被安全重定向，指向外部目录时可保留。
- [ ] 工作树路径测试、包装器测试、lint、format、TypeScript/build、Rust fmt/clippy/tests 和 Quality checks 全部通过。
- [ ] 构建/测试后项目内没有新增 `src-tauri/target`、重复 Cargo target 或未忽略的生成物。
- [ ] 文档、CHANGELOG、PR 和回滚说明与最终提交 SHA 一致。

### 依赖、风险与回滚

- 依赖：Node、Cargo、Tauri CLI、Windows `LOCALAPPDATA` 和现有 CI 缓存。
- 风险：外部缓存权限、环境变量覆盖、旧脚本绕过包装层；失败时优先看实际 target 路径，不扩大重试范围。
- 回滚：回退 PR #379；仓库内 target 仅为可再生构建产物，不触碰源码或用户笔记。

### 预计修改范围

- 源码/脚本：`package.json`、`scripts/run-cargo.mjs`、`scripts/run-tauri.mjs`、`scripts/shared-cargo-target.mjs` 及测试。
- CI/发布：`.github/workflows/ci.yml`、`.github/workflows/release.yml`、desktop smoke 脚本。
- 文档：README、CONTRIBUTING、CHANGELOG、`docs/AI-HANDOFF.md`、本文件、`docs/RELEASE-POLICY.md`、`docs/UPDATE.md`、`docs/handoff/v0.11.md`。

## 完成后

1. 记录 PR #379 的最终 head SHA、Quality checks `run_id`、结论和最后变化时间。
2. CI 全绿且无冲突后合并 PR；#375 已关闭，不重复关闭或重开 Issue。
3. 合并后从最新 `main` 创建新分支，把唯一下一步切换为 #360；本切片完成后停止，不自动开始 #360。
4. 本切片不创建安装包、Tag、Release 或镜像；稳定批次再统一发布。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 `docs/NEXT.md` 中的唯一下一步，遵循 `docs/AI-WORKFLOW.md`，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
