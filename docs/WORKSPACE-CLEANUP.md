# Moyang Reader 工作区清理规则

> 目的：降低开发目录和构建缓存膨胀，同时不误删用户代码、文档、笔记或未交付成果。

## 1. 可删除与不可删除

### 默认可再生

- `dist/`、`coverage/`、`test-results/`、`playwright-report/`；
- `.vite/`、`.vite-temp/`、`.turbo/`、`.cache/`、`.codex-cache/`；
- 已确认不再需要的工作树内 `src-tauri/target/`；
- 已合并、干净、没有 junction/符号链接的项目内 `.codex-worktrees/<name>/`。

它们不是用户文档，删除后可以由测试或构建重新生成。删除构建缓存会让下一次 Rust 构建变慢，但不会改变源代码或安装包。

### 必须保留

- 根目录当前未提交改动、未推送分支和未完成 PR；
- 含未提交改动、未合并分支、junction/符号链接或无法确认归属的工作树；
- `docs/handoff/`、Release 记录、Issue/PR 模板、用户笔记和工作区文件；
- 各工作树独立的 `node_modules/`；旧版 junction 只报告并保留，不自动解除或覆盖；
- 私钥、API Token、Windows 凭据和用户配置；清理器不会触碰这些内容。

## 2. 唯一清理流程

在项目内任一干净工作树执行：

```text
npm run cleanup:workspace
```

先看预览，确认路径和大小后再执行：

```text
npm run cleanup:workspace -- --apply
```

只有确认当前没有 Rust 构建、目标目录可重新生成，且磁盘空间确实需要回收时，才额外使用：

```text
npm run cleanup:workspace -- --apply --prune-targets
```

需要回收已合并且干净的项目内工作树时，再额外加入 `--prune-worktrees`。清理器会自动跳过脏工作树和含 junction/符号链接的工作树；禁止使用强制删除绕过保护。

### 构建缓存预算提示

清理器会在预览输出中检查受管的 Cargo target，并报告实际大小、最近一次文件/目录修改时间推算出的闲置时长，以及默认预算：4 GiB 或连续闲置 14 天。超过任一阈值时会输出完整路径、实际大小、超限原因和清理建议；该提示只读，不会自动删除缓存。

也可以显式使用 `--dry-run` 表达只读意图：

```text
npm run cleanup:workspace -- --dry-run
```

受保护或可能正在使用的 Cargo target 默认只报告不删除。只有确认没有活动 Rust 构建、并检查预览路径后，才允许显式使用 `npm run cleanup:workspace -- --apply --prune-targets`；清理器不会替用户自动加上这个参数，也不会改变 D 盘 `MOYANG_BUILD_CACHE_DIR` 目标路径。

## 3. 防止再次膨胀

1. 新工作树只放在项目内 `.codex-worktrees/`，通过 `npm run worktree:prepare -- <path>` 执行独立的 `npm ci --prefer-offline`；共享 npm 下载缓存，不共享 `node_modules`。
2. Tauri/Cargo 只通过仓库包装脚本运行，默认目标统一到 `%LOCALAPPDATA%\Moyang Reader\build-cache\cargo-target`；如需迁移磁盘，在用户级环境变量设置 `MOYANG_BUILD_CACHE_DIR`，不要把目标放进源码仓库或工作树。
3. 开发阶段不重复生成安装包；一个切片最多一次完整构建。
4. 每个新切片开始前先预览清理器；日常只清理非保护生成物，Cargo target 按空闲状态和磁盘阈值清理。
5. 资源管理器可能把 junction 目标重复计入目录大小；以清理器实际文件大小和 `git worktree list --porcelain` 为准。
6. 项目外的历史临时工作树不作为新流程；清理前必须单独确认路径、状态、分支和合并结果。

## 4. 本轮审计处理记录

- 审计前识别到：项目内 `.codex-worktrees` 约 5.60 GiB；其中已合并的 `export-reliability-2026-09-02/src-tauri/target` 约 4.81 GiB；用户缓存 Cargo target 约 11.12 GiB；明确生成物约 42.2 MiB。
- 已执行 `npm run cleanup:workspace -- --apply --prune-targets --prune-worktrees`：释放约 15.97 GiB（24 个可再生生成物/目标），回收 11 个已合并且干净的项目内工作树；随后单独回收了已合并的 `export-reliability-2026-09-02` 工作树和项目外的 `D:\AI-moyang\本地阅读工具-v0.11-roadmap-handoff`。
- 清理后再次预览：已识别生成物 0 个、可自动回收工作树 0 个；保留的 16 个临时工作树均因未提交改动、junction/符号链接或当前工作需要而跳过。根目录用户改动未触碰。
- 删除的 Cargo target、前端产物和测试报告不可恢复为原二进制，但可重新构建；被回收工作树的分支引用仍保留，可按分支重新创建。未删除远程分支、历史文档、用户笔记或唯一 `node_modules`。
