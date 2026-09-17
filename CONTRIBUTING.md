# 参与 Moyang Reader

感谢提交问题、修复和功能建议。Moyang Reader 是 Windows 优先的本地阅读器，改动应优先保持启动快、离线可用和原文件不被意外覆盖。

## 开始开发

AI 先遵循 [`AGENTS.md`](AGENTS.md)，再阅读 [`docs/AI-TASKS.md`](docs/AI-TASKS.md)。根目录已有未提交改动时不要直接覆盖；新切片可以放在项目内 `.codex-worktrees/`，通过 `npm run worktree:prepare -- <worktree-path>` 在目标工作树执行独立的 `npm ci --prefer-offline`。流程和路线分别见 [`docs/AI-WORKFLOW.md`](docs/AI-WORKFLOW.md) 与 [`docs/ROADMAP.md`](docs/ROADMAP.md)。

开始新任务前必须先检查最新 `main`、当前最早未完成任务和开放 PR。只有**对应当前最早任务、修改同一范围或形成真实合并依赖**的开放 PR 才阻塞产品队列；Dependabot、机器人依赖更新、纯维护或明显无关 PR 只需要检查冲突，不得被误判成“整个开发冻结”。

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

桌面正确性与性能证据分开：

```powershell
npm run test:e2e:desktop
npm run test:e2e:desktop:benchmark
```

`test:e2e:desktop` 是确定性的桌面功能正确性检查，可作为 PR 门禁；`test:e2e:desktop:benchmark` 保留性能场景，使用固定 fixture、多轮结果和趋势解释，不把共享 Runner 的单轮毫秒抖动直接当成功能回归。

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

- 开始新任务前先查看 [Issues](https://github.com/MY-moss/moyang_Reader/issues) 和开放 PR，避免重复修复；无关 Dependabot/维护 PR 不阻塞产品任务。
- 按改动范围做最小充分验证：普通逻辑跑相关单测 + lint；UI 加相关 E2E；Rust/IPC/文件路径加 Rust test/clippy 或 desktop smoke；发布相关才跑完整发布验证。
- 更新/opener/安全披露文档运行 `npm run check:docs`。
- 不提交私钥、签名私钥密码、`.sig` 文件、本地工作区内容或构建产物。
- 用户可见行为、发布流程或架构变更要同步更新 README、CHANGELOG 或架构文档。
- 本地 Tauri/Cargo 命令使用项目包装脚本。构建缓存位置、预算和安全清理参数只以 [`docs/WORKSPACE-CLEANUP.md`](docs/WORKSPACE-CLEANUP.md) 为准，不在多处复制。
- 一个任务一个 PR；完成后更新 `docs/AI-TASKS.md` 的状态和 PR 号，不维护额外状态机。
- `BLOCKED_EXTERNAL` 只标记真正依赖仓库设置、证书、凭据、正式 Release 或真机的子项；仓库内仍可完成的代码、文档和测试必须拆开继续完成。

## 安全问题

发现潜在漏洞时先阅读 [`SECURITY.md`](SECURITY.md)。如果仓库 `Security` 页面已经显示 GitHub Private Vulnerability Reporting 的 **Report a vulnerability**，请使用该私密入口。

如果私密入口尚未启用，不要在公开 Issue、PR、Discussion 或评论中发布 PoC、利用细节、用户内容、私有路径、令牌或证书。可以只创建一个不含漏洞细节的最小公开 Issue，请求维护者提供/开启私密报告渠道。

安全文档、披露说明可以在仓库内独立维护；“开启 GitHub Private Vulnerability Reporting”本身属于维护者仓库设置，不应让整个文档任务长期处于假阻塞状态。

## 提交与 Pull Request

提交标题使用简短的 Conventional Commits 风格，例如 `fix: prevent stale document refresh`。Pull Request 请说明：

1. 改动解决的问题和对应 Issue。
2. 影响的文件类型、平台和兼容性。
3. 实际运行过的检查命令及结果。
4. 风险、回滚方式，以及是否需要同步 Release/用户文档。

主分支不接受强制推送。发布版本通过版本标签触发，详见 [`docs/UPDATE.md`](docs/UPDATE.md) 和 [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)。

## AI 交接

后续 AI 只需要三步：读 `AGENTS.md` → 读 `docs/AI-TASKS.md` → 检查目标 Issue/PR。默认选择第一个可执行 TODO；只有与该任务存在真实范围/依赖关系的开放 PR 才阻塞，完成后在同一个 PR 更新任务状态。

普通代码、UI、IPC、重构、测试和文档不需要额外审批凭证。真正需要谨慎的是：用户真实文件删除/迁移、密钥与证书、正式 Release/Tag、以及不能伪造的真机/签名/外部服务验证。

可复制提示词见 [`docs/AI-TAKEOVER-PROMPT.md`](docs/AI-TAKEOVER-PROMPT.md)。