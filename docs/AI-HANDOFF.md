# Moyang Reader 当前交接摘要

本文件只保留稳定事实和外部阻塞。当前开发任务统一看 [`AI-TASKS.md`](AI-TASKS.md)，产品阶段看 [`ROADMAP.md`](ROADMAP.md)，插件、AI、MCP、数据与 v1.0 后扩展方向看 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)。

## 稳定基线

- 当前稳定版本：`v0.10.14`。
- 产品边界：Windows x64、本地优先；浏览器版仅用于开发预览和 UI 测试。
- 技术栈：Tauri 2 + Rust + React + TypeScript。
- `main` 受 GitHub `Quality checks` 保护。
- 当前工程主线正在收敛 TS↔Tauri 契约、App.tsx 职责、Rust commands、搜索入口、桌面交互与视觉系统。

## AI 接手方式

1. 阅读根目录 `AGENTS.md`。
2. 阅读 `docs/AI-TASKS.md`。
3. 检查目标任务是否已有开放 PR。
4. 选择第一个可执行 TODO，从最新 main 建一个 `codex/` 分支，只完成一个垂直切片。
5. PR 中写清测试、风险和回滚；完成后更新任务清单。
6. 只有需要决定未来产品/架构方向时才读 `FUTURE-DEVELOPMENT-PLAN.md`；其中长期候选不能跳过依赖直接开工。

不再使用 `docs/ai/policy.json`、`plan-v1.json`、`state.json`、审批凭证或 `docs/NEXT.md` 状态机。

## 外部阻塞

- #227：GitHub Private Vulnerability Reporting 需要维护者在仓库设置中开启。未开启前不要声称已有可用私密报告入口，也不要让安全研究者用公开 Issue 发送敏感细节。
- #241：完整旧版本自动更新回归需要真实 Windows x64 旧安装环境和发布条件；CI 不能替代这项实机证据。
- #51：Tauri updater `.sig` 不等于 Windows Authenticode。当前没有代码签名证书时，只能明确披露限制并提供 updater 签名 / SHA-256 核验。

精确发布资产、版本和哈希仍以 `docs/release-status.json` 为准。

## 架构历史说明

- ADR 0011 / 0013 只保留为历史记录，不能用于重新启用 T0–T3、G01–G03 或 policy/state 审批状态机。
- ADR 0012 仍然有效：v1.0 前先让内置功能使用稳定的 DocumentAdapter / IndexProvider / CommandContribution / AiProvider 等内部能力接口，不提前承诺第三方插件 ABI。

## 维护规则

- 本文件保持短小，不复制当前 PR、实时 SHA、完整任务验收或 CI 日志。
- 历史结果留在 Git、PR、Issue、Release 或 `docs/handoff/`。
- 根目录有未提交改动时不要覆盖；AI 优先使用独立 worktree/分支。
