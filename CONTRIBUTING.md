# 参与 Moyang Reader

感谢提交问题、修复和功能建议。Moyang Reader 是 Windows 优先的本地阅读器，改动应优先保持启动快、离线可用和原文件不被意外覆盖。

## 开始开发

AI 先遵循 [`AGENTS.md`](AGENTS.md)，再阅读 [`docs/AI-TASKS.md`](docs/AI-TASKS.md)。根目录已有未提交改动时不要直接覆盖；新切片可以放在项目内 `.codex-worktrees/`，通过 `npm run worktree:prepare -- <worktree-path>` 在目标工作树执行独立的 `npm ci --prefer-offline`。流程和路线分别见 [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md) 与 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

如果明确参与 #464 Modernization Campaign，再额外阅读 [`docs/MODERNIZATION-CAMPAIGN.md`](docs/MODERNIZATION-CAMPAIGN.md) 和 [`docs/MODERNIZATION-TASKS.md`](docs/MODERNIZATION-TASKS.md)；UI 任务再读 [`docs/UI-NEXT-SPEC.md`](docs/UI-NEXT-SPEC.md)。普通 bugfix 不需要加载这些长期上下文。

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

- 开始新任务前先查看 [Issues](https://github.com/MY-moss/moyang_Reader/issues) 和开放 PR，避免重复修复。
- 一个 PR 一个 coherent slice；普通任务默认按 `AI-TASKS.md` 顺序推进。
- Modernization 允许不同 Track 并行，但每个 slice 必须声明 Track / Risk lane / Write-set / Depends on；shared conflict files 不允许多个 PR 无协调同时修改。
- 按改动范围做最小充分验证：普通逻辑跑相关单测 + lint；UI 加相关 E2E；Rust/IPC/文件路径加 Rust test/clippy 或 desktop smoke；持久化迁移增加旧 fixture 兼容测试；发布相关才跑完整发布验证。
- 更新/opener 文档运行 `npm run check:docs`。
- 不提交私钥、签名私钥密码、`.sig` 文件、本地工作区内容或构建产物。
- 用户可见行为、发布流程或架构变更要同步更新 README、CHANGELOG 或架构文档。
- 本地 Tauri/Cargo 命令使用项目包装脚本。构建缓存位置、预算和安全清理参数只以 [`docs/WORKSPACE-CLEANUP.md`](docs/WORKSPACE-CLEANUP.md) 为准，不在多处复制。
- 普通任务完成后更新 `docs/AI-TASKS.md`；Modernization task 更新 `docs/MODERNIZATION-TASKS.md`，不维护额外状态机。

## 提交与 Pull Request

提交标题使用简短的 Conventional Commits 风格，例如 `fix: prevent stale document refresh`。Pull Request 请说明：

1. Slice / Track / Risk / Write-set（适用时）。
2. 改动解决的问题和用户/维护价值。
3. Compatibility：用户文件、settings/sidecar、默认离线/权限是否变化。
4. 实际运行过的检查命令及结果。
5. 风险、回滚方式，以及是否需要同步 Release/用户文档。

不使用 T0–T3、`AWAITING_APPROVAL`、approval digest、批准队列或 `ai:*` 状态机。

- Green/普通代码、UI、内部 TS 重构、样式、测试、文档：相关验证通过即可 PR，不要求人工审批凭证。
- Yellow/Rust、IPC、兼容迁移、权限、可选网络：补对应负向/Rust/desktop/兼容测试，不恢复审批票据。
- Red/真实用户数据不可逆操作、高风险权限、密钥/签名、正式 Release/Tag：明确风险并由维护者确认。

主分支不接受强制推送。发布版本通过版本标签触发，详见 [`docs/UPDATE.md`](docs/UPDATE.md) 和 [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)。

## AI 交接

普通 AI：读 `AGENTS.md` → `docs/AI-TASKS.md` → 检查目标 Issue/PR。

Modernization AI：读 `AGENTS.md` → `docs/AI-WORKFLOW.md` → `docs/MODERNIZATION-CAMPAIGN.md` → `docs/MODERNIZATION-TASKS.md` → 检查目标 Issue/PR；UI 时再读 `UI-NEXT-SPEC.md`。

可复制提示词见 [`docs/AI-TAKEOVER-PROMPT.md`](docs/AI-TAKEOVER-PROMPT.md)。
