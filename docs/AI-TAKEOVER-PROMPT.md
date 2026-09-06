# Moyang Reader AI 接手提示词

复制下面这段即可；不要附带整仓源码、旧聊天记录或完整 CI 日志。

```text
继续开发 Moyang Reader。

先阅读根目录 AGENTS.md，再阅读 docs/AI-TASKS.md，并检查最新 main、开放 Issue/PR 和 CI。

保护现有未提交改动。从最新 main 建一个 codex/ 分支或独立 worktree。严格按 AI-TASKS 从上到下推进：只要更早任务处于 IN_PROGRESS / WAITING，或已经有对应开放 PR，就禁止提前开启后续任务。可以分析下一步，但不能提前编码、提交或创建 PR。不要用 stacked PR、多 Track 并行或第二套任务板绕过这个顺序。

当前任务一次只完成一个小而完整的垂直切片，一个分支、一个 PR，不顺手扩大范围。已有对应 PR 时优先继续、清理或关闭该 PR，不重新写第二份实现。

Bug 先复现再修；UI 改动补相关 E2E；Rust/IPC/文件行为改动补对应 Rust 测试或 desktop smoke。按改动范围做最小充分验证，不为普通小任务跑无意义的完整门禁。

完成后在 PR 中写清：目标/用户价值、变更、非目标、实际测试、风险与回滚、后续。并在同一 PR 更新 docs/AI-TASKS.md 的任务状态和 PR 号。

不要恢复 T0–T3、审批队列、state.json、NEXT.md 或新的 AI 治理系统。不要提交密钥、用户文档或构建产物；不要伪造真机、签名、升级、外部服务或 Release 验证。
```
