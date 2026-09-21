# Moyang Reader 当前交接摘要

本文件只保留稳定事实和外部阻塞。当前开发任务统一看 [`AI-TASKS.md`](AI-TASKS.md)，工程硬边界看 [`DEVELOPMENT-ARCHITECTURE-CONTRACT.md`](DEVELOPMENT-ARCHITECTURE-CONTRACT.md)，产品阶段看 [`ROADMAP.md`](ROADMAP.md)，v1.0 后扩展方向看 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)。

## 稳定基线

- 当前稳定版本：`v0.11.0`。
- `v0.11.0` 已创建 tag 并发布 GitHub Release；安装包、updater 签名和 `latest.json` 的在线事实见 [`docs/release-status.json`](release-status.json)。
- 产品边界：Windows x64、本地优先；浏览器版仅用于开发预览和 UI 测试。
- 技术栈：Tauri 2 + Rust + React + TypeScript。
- `main` 以 GitHub `Quality checks` 作为代码合并门禁；真实 Windows 安装、升级、签名和发布证据不能由 CI 代替。
- 当前工程主线是：A14 v0.11.0 已发布 → B01–B06 v0.12 可靠性/真实使用切片完成 → C01–C04 v1.0 Freeze/Compatibility/RC 收口完成 → D00–D14 事实源、开发环境、架构预算与 App 编排提取完成 → D15 v1.0 重设计 P1 质量清障进行中 → Figma 设计真源 → 分片生产 UI 迁移 → v1.0 RC；总票为 #534。
- Reading Inbox、Knowledge、AI、RAG、MCP、RSS、第三方插件等均为 v1.x GATED 候选，不属于当前可执行队列。

## AI 接手方式

1. 本地 Agent 先运行 `npm run agent:bootstrap`；远程 Agent 至少检查最新 main、Open PR/Issue 和 CI。
2. 阅读根目录 `AGENTS.md`、`docs/AI-TASKS.md` 和 `docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`。
3. 严格处理最早未完成任务。只有与该任务对应、或明确修改同一范围的开放 PR 才构成队列阻塞；Dependabot/机器人依赖更新、纯维护 PR 或其他不相干 PR 不得被误判为“整个产品队列冻结”。
4. `BLOCKED_EXTERNAL` 必须精确到真正依赖外部条件的子项。能在仓库内完成的代码、文档、测试或检查仍应单独完成，不能因为一个设置/证书/真机条件把整项长期挂起。
5. 只有远程状态已确认且前序无真实阻塞时，才从最新 main 建一个 `codex/` 分支，只完成一个垂直切片；当前最早可执行任务是 `D15` v1.0 重设计 P1 质量清障，不要跳过任务顺序。
6. PR 中写清测试、风险和回滚；任务来自 AI-TASKS 时完成后更新任务清单。
7. 只有需要决定未来产品/架构方向时才读 `FUTURE-DEVELOPMENT-PLAN.md`；长期候选不能跳过 Gate 直接开工。

不再使用 `docs/ai/policy.json`、`plan-v1.json`、`state.json`、审批凭证或 `docs/NEXT.md` 状态机。

## 发布与更新器稳定事实

- GitHub Release 是 updater metadata 的权威来源；Cloudflare Pages 只作为镜像/备用分发源。配置必须优先检查 GitHub，再检查镜像，避免“镜像返回 200 但内容陈旧”时遮蔽更新版本。
- 性能 benchmark 与功能正确性 smoke 是两种不同证据：正确性 smoke 可以作为 PR 阻断门禁；共享 GitHub Runner 上的单次毫秒级性能抖动不得直接等价为产品正确性失败。性能应保留独立、可追踪的 scheduled/manual benchmark，并以多轮/趋势/固定环境结果解释。
- `latest.json`、安装包、updater `.sig`、Release tag/version 与镜像必须在发布流程中核对一致；镜像不是版本真源。

## 外部阻塞

- #227：仓库内 `SECURITY.md`、披露说明和安全联系方式可以独立完成；只有 GitHub Private Vulnerability Reporting 的“开启设置”本身依赖维护者在仓库设置中操作。未开启前不要声称已有可用私密报告入口，也不要让研究者通过公开 Issue 发送敏感细节。
- #241：已在隔离 Windows x64 环境完成 v0.10.14 → v0.11.0 安装器覆盖升级，以及应用内 updater 的检查、下载、安装、重启 smoke；升级后的正式构建通过真实 Edge PDF viewer 完成页面可视化读取，显示单页 `1 / 1` 和 `C04 PDF visual check`，无打开错误。
- #51：Tauri updater `.sig` 不等于 Windows Authenticode。当前没有代码签名证书时，只能明确披露限制并提供 updater 签名 / SHA-256 核验；这不是无限期冻结 v1.0 的理由。

精确发布资产、版本和哈希仍以 `docs/release-status.json` 为准。

## 架构历史说明

- ADR 0011 / 0013 只保留为历史记录，不能用于重新启用 T0–T3、G01–G03 或 policy/state 审批状态机。
- 旧 ADR 中任何“v1.0 前必须先稳定 AiProvider / PermissionBroker / 插件内核”的描述均已被 2026-09-17 收敛路线覆盖；现在只允许从真实内置用户路径提炼接口。
- 当前 `DocumentAdapter` registry 仍主要是内部 metadata/capability 注册，不是第三方插件 SDK；只有真实内置调用关系出现后才演进行为接口。
- 不做 provider/mock-first 架构：真实用户动作 → 一个内置实现 → 稳定业务边界 → 第二个真实调用方验证 → contract tests → 再讨论外部兼容。

## 维护规则

- 本文件保持短小，不复制当前 PR、实时 SHA、完整任务验收或 CI 日志。
- 历史结果留在 Git、PR、Issue、Release 或 `docs/handoff/`。
- `.codex-cache` 只保存本机 Agent 上下文/未 push 便签，不提交、不覆盖 GitHub 事实。
- 根目录有未提交改动时不要覆盖；AI 优先使用独立 worktree/分支。
