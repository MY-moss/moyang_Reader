# Moyang Reader AI 接手提示词

复制下面这段即可；不要附带整仓源码、旧聊天记录或完整 CI 日志。

```text
继续开发 Moyang Reader。

如果你在本地仓库工作，第一步先运行：npm run agent:bootstrap。

然后读取 AGENTS.md、docs/AI-TASKS.md、docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md；本地还要读取 .codex-cache/agent-context.md，如存在再读取 .codex-cache/agent-handoff.md。检查最新 origin/main、开放 Issue/PR 和目标 CI，旧聊天/旧审计不能替代当前 GitHub 状态。

当前 v1.0 主线固定为：v0.11 收口 → v0.12 可靠性/性能/真实使用 → v0.13 Freeze/Compatibility/RC → v1.0。Reader+、Metadata/Knowledge、AI、RAG、MCP、RSS、声明式扩展等是 v1.x GATED 候选，不得提前实现。

严格按 AI-TASKS 从上到下推进：只要更早任务处于 IN_PROGRESS / WAITING，或存在与当前最早任务对应、修改同一范围、形成真实合并依赖的开放 PR，就禁止提前开启后续任务。Dependabot、机器人依赖更新、纯维护或明显无关 PR 只检查冲突，不得被误判为整个产品队列冻结。可以分析下一步，但不能提前编码、提交或创建 PR。REMOTE_STATUS=UNKNOWN 时，只允许继续已经存在的本地任务分支，不允许开启新任务。

BLOCKED_EXTERNAL 必须精确到真正依赖仓库设置、证书、凭据、正式 Release 或真机的子项；仓库内仍可完成的代码、文档、测试与检查继续拆开完成，不能整票长期挂起。

保护现有未提交改动。只有前序无真实阻塞且远程状态已确认时，才从最新 origin/main 建一个 codex/ 分支或独立 worktree。当前任务一次只完成一个小而完整的垂直切片，一个分支、一个 PR，不顺手扩大范围；已有对应 PR 时优先继续、清理或关闭，不重新写第二份实现。

修改代码前先确认职责所有者和依赖方向。不得绕过 bridge/ipc-contract 新写原始 Tauri invoke，不得让组件直接拥有文件/任意网络/process/updater 权限，不得静默覆盖用户文件，不得把当前 DocumentAdapter registry 当公开插件 ABI，也不得为未来功能堆没有当前调用方的空接口。详细边界以 DEVELOPMENT-ARCHITECTURE-CONTRACT 为准。

长期接口必须从真实内置用户动作提炼：先有真实动作与一个内置实现，再形成稳定业务边界；只有出现第二个真实调用方/实现并证明复用价值后，才提炼长期 provider/port/contract。不得为了未来 AI、插件或 MCP 做 provider/mock-first 架构工程。

Bug 先复现再修；UI 改动补相关 E2E；Rust/IPC/文件行为改动补对应 Rust 测试或 desktop smoke；权限/网络增加负向测试。按改动范围做最小充分验证。

桌面功能正确性和性能证据分开：npm run test:e2e:desktop 是确定性 correctness smoke；npm run test:e2e:desktop:benchmark 保留性能基准。不要因为共享 CI Runner 的单轮毫秒抖动把性能失败伪装成功能回归，也不要因此删除或放宽性能 benchmark；性能用固定 fixture、多轮和趋势解释。

更新链中 GitHub Release latest.json 是 updater metadata 权威源，Cloudflare Pages 仅作备用镜像。真实 Windows 旧版本→新版本升级、安装包 Authenticode 与正式 Release 证据不能用 CI 绿灯代替。

完成后在 PR 中写清：目标/用户价值、变更、非目标、实际测试、风险与回滚、后续。若任务来自 AI-TASKS，同一 PR 更新状态和 PR 号。本地尚未 push 的现场可以写入 .codex-cache/agent-handoff.md，但该文件不得提交。

不要恢复 T0–T3、审批队列、policy/plan/state.json、NEXT.md 或新的 AI 治理系统。不要提交密钥、用户文档或构建产物；不要伪造真机、签名、升级、外部服务或 Release 验证。
```