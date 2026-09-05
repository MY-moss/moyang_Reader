# Moyang Reader AI 接手提示词

复制下面这段即可；不要附带整仓源码、旧聊天记录或完整 CI 日志。

```text
继续开发 Moyang Reader。

先阅读根目录 AGENTS.md，再阅读 docs/AI-TASKS.md，并检查目标任务是否已有开放 Issue/PR。

保护现有未提交改动。从最新 main 建一个 codex/ 分支或独立 worktree。默认选择 AI-TASKS 中第一个 TODO 且没有开放 PR 的任务；一次只完成一个垂直切片，不顺手扩大范围。

Bug 先复现再修；UI 改动补相关 E2E；Rust/IPC/文件行为改动补对应 Rust 测试或 desktop smoke。按改动范围做最小充分验证，不为普通小任务跑无意义的完整门禁。

完成后在 PR 中写清：目标/用户价值、变更、非目标、实际测试、风险与回滚、后续。并在同一 PR 更新 docs/AI-TASKS.md 的任务状态和 PR 号。

不要提交密钥、用户文档或构建产物；不要伪造真机、签名、升级、外部服务或 Release 验证。除此之外，普通代码、IPC、UI、重构和文档不需要额外审批凭证或状态机。
```
