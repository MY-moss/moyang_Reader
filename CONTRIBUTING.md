# 参与 Moyang Reader

感谢提交问题、修复和功能建议。Moyang Reader 是 Windows 优先的本地阅读器，改动应优先保持启动快、离线可用和原文件不被意外覆盖。

## 开始开发

AI 先遵循 [`AGENTS.md`](AGENTS.md)，再运行 `npm run ai:context` 和 `npm run ai:start`。根目录已有未提交改动时不要直接开发；新切片放在项目内 `.codex-worktrees/`，通过 `npm run worktree:prepare -- <worktree-path>` 在目标工作树执行独立的 `npm ci --prefer-offline`。流程和路线分别见 [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md) 与 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

```powershell
npm install
npm run test
npm run build
npm run desktop
```

Rust 命令层测试：

```powershell
npm run rust -- test --manifest-path src-tauri/Cargo.toml
npm run rust -- fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run rust -- clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

前端静态检查：

```powershell
npm run lint
npm run format:check
```

界面无障碍冒烟检查：

```powershell
npx playwright test e2e/a11y.spec.ts
```

检查应覆盖启动页、打开文档后的阅读界面、快速打开对话框和设置面板。新增按钮或对话框时，请补充可读的名称、键盘操作路径和对应的冒烟断言；视觉动画结束后再执行对比度检查，避免把过渡帧误判为最终状态。

依赖审计需要 npm 官方 registry：

```powershell
$env:NPM_CONFIG_REGISTRY = "https://registry.npmjs.org"
npm audit --audit-level=high
```

Rust 依赖审计在 CI 中由 RustSec `audit-check` 门禁执行；本地可先安装 `cargo-audit`，再在 `src-tauri` 目录运行：

```powershell
cargo install cargo-audit --locked
Push-Location src-tauri
cargo audit
Pop-Location
```

首次运行需要从 RustSec Advisory Database 下载公告库。

## 提交前检查

- 开始新任务前先查看 [Issues](https://github.com/MY-moss/moyang_Reader/issues)，避免重复修复。
- 按 `AGENTS.md` 的 T0–T3 风险级别运行最小充分验证；T3 才默认要求完整前端、Rust、浏览器和 Windows 桌面门禁。
- AI/交接文档改动运行 `npm run ai:check`；更新/opener 文档运行 `npm run check:docs`。
- 不提交私钥、签名私钥密码、`.sig` 文件、本地工作区内容或构建产物。
- 用户可见行为、发布流程或架构变更要同步更新 README、CHANGELOG 或架构文档。
- 本地 Tauri/Cargo 命令使用项目包装脚本。构建缓存位置、预算和安全清理参数只以 [`docs/WORKSPACE-CLEANUP.md`](docs/WORKSPACE-CLEANUP.md) 为准，不在多处复制。
- 每个功能切片必须通过 `npm run ai:finish` 更新结构化状态；没有目标、验收、测试结果和下一队列位置的 PR 不算完成。
- 开始阅读代码前先运行 `npm run ai:context`；只在需要版本背景时读取交接摘要，不要把完整仓库、历史归档或整段流水线日志复制进 AI 上下文。

## 提交与 Pull Request

提交标题使用简短的 Conventional Commits 风格，例如 `fix: prevent stale document refresh`。Pull Request 请说明：

1. 改动解决的问题和对应 Issue。
2. 影响的文件类型、平台和兼容性。
3. 实际运行过的检查命令及结果。
4. 是否需要同步更新 Release、更新清单或用户文档。

主分支不接受强制推送。发布版本通过版本标签触发，详见 [`docs/UPDATE.md`](docs/UPDATE.md) 和 [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)。

## AI 交接

批准队列内的 T0–T2 在 G03 保护探针通过、无治理文件变化且 Quality checks 全绿时可以自动交付。T3、治理策略、权限、安全、更新器、发布工作流、凭据和数据迁移必须人工确认。代码、测试、必要文档和结构化状态应在同一个 PR 中提交。完整流程见 [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md)，当前任务使用 `npm run ai:context`，可复制提示词见 [`docs/AI-TAKEOVER-PROMPT.md`](docs/AI-TAKEOVER-PROMPT.md)。
