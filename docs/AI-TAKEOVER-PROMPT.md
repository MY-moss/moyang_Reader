# Moyang Reader AI 接手提示词

复制下面这段即可；不要附带整仓源码、旧聊天记录或完整 CI 日志。

```text
继续开发 Moyang Reader。

如果你在本地仓库工作，第一步先运行：npm run agent:bootstrap。

然后读取 AGENTS.md、docs/AI-TASKS.md、docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md；本地还要读取 .codex-cache/agent-context.md，如存在再读取 .codex-cache/agent-handoff.md。检查最新 origin/main、开放 Issue/PR 和目标 CI，旧聊天/旧审计不能替代当前 GitHub 状态。

严格按 AI-TASKS 从上到下推进：只要更早任务处于 IN_PROGRESS / WAITING，或已经有对应开放 PR，就禁止提前开启后续任务。可以分析下一步，但不能提前编码、提交或创建 PR。不要用 stacked PR、多 Track 并行或第二套任务板绕过这个顺序。REMOTE_STATUS=UNKNOWN 时，只允许继续已经存在的本地任务分支，不允许开启新任务。

保护现有未提交改动。只有前序无阻塞且远程状态已确认时，才从最新 origin/main 建一个 codex/ 分支或独立 worktree。当前任务一次只完成一个小而完整的垂直切片，一个分支、一个 PR，不顺手扩大范围；已有对应 PR 时优先继续、清理或关闭，不重新写第二份实现。

修改代码前先确认职责所有者和依赖方向。不得绕过 bridge/ipc-contract 新写原始 Tauri invoke，不得让组件直接拥有文件/任意网络/process/updater 权限，不得静默覆盖用户文件，不得把当前 DocumentAdapter registry 当公开插件 ABI，也不得为未来功能堆没有当前调用方的空接口。详细边界以 DEVELOPMENT-ARCHITECTURE-CONTRACT 为准。

Bug 先复现再修；UI 改动补相关 E2E；Rust/IPC/文件行为改动补对应 Rust 测试或 desktop smoke；权限/网络增加负向测试。按改动范围做最小充分验证。

完成后在 PR 中写清：目标/用户价值、变更、非目标、实际测试、风险与回滚、后续。若任务来自 AI-TASKS，同一 PR 更新状态和 PR 号。本地尚未 push 的现场可以写入 .codex-cache/agent-handoff.md，但该文件不得提交。

不要恢复 T0–T3、审批队列、state.json、NEXT.md 或新的 AI 治理系统。不要提交密钥、用户文档或构建产物；不要伪造真机、签名、升级、外部服务或 Release 验证。
```
