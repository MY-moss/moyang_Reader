# Moyang Reader AI 接手提示词

普通任务和 Modernization 使用不同的最小入口；不要附带整仓源码、旧聊天记录或完整 CI 日志。

## 普通任务

```text
继续开发 Moyang Reader。

先阅读根目录 AGENTS.md，再阅读 docs/AI-TASKS.md，并检查目标任务是否已有开放 Issue/PR。

保护现有未提交改动。从目标 base 建一个 codex/ 分支或独立 worktree。默认选择 AI-TASKS 中第一个 TODO 且没有开放 PR 的任务；一个 PR 只完成一个 coherent slice，不顺手扩大范围。

Bug 先复现再修；UI 改动补相关 E2E；Rust/IPC/文件行为改动补对应 Rust 测试或 desktop smoke。按改动范围做最小充分验证，不为普通小任务跑无意义的完整门禁。

完成后在 PR 中写清：目标/用户价值、变更、非目标、Compatibility、实际测试、风险与回滚、后续。并在同一 PR 更新 docs/AI-TASKS.md 的任务状态和 PR 号。

不要提交密钥、用户文档或构建产物；不要伪造真机、签名、升级、外部服务或 Release 验证。普通代码、IPC、UI、重构和文档不需要额外审批凭证或状态机。
```

## Modernization Campaign（#464 / MOD-XX）

```text
继续执行 Moyang Reader Controlled Breaking Modernization。

仓库：MY-moss/moyang_Reader

必须先读：
1. AGENTS.md
2. docs/AI-WORKFLOW.md
3. docs/MODERNIZATION-CAMPAIGN.md
4. docs/UI-NEXT-SPEC.md（涉及 UI 时）
5. 目标 MOD-XX / Issue / 依赖 PR

开始前先执行 git status --short --branch 和 git fetch origin，并检查当前开放 PR。

只完成一个 MOD slice，但允许仓库中其他 AI 同时处理 Write-set 不冲突的 Track。开始前必须写明：Track、Risk lane、Write-set、Depends on、target base。

Internal API、React component boundary、TS/Rust module layout、CSS structure 在 Campaign 中允许 breaking；但是用户普通文件、settings、.moyang、批注、书签、草稿、恢复、外部修改保护和默认离线不能无迁移破坏。

不要复制整套 AppV2/ReaderV2 做 Big Bang。使用逐步替换：define boundary -> new implementation -> migrate caller -> remove legacy。

不要重新引入 T0–T3、AWAITING_APPROVAL、approval digest、批准队列或 ai:* 状态机。

Green：普通 UI/内部 TS/样式/测试/文档，相关验证通过即可 PR。
Yellow：Rust/IPC/兼容迁移/权限/可选网络，补定向负向/Rust/desktop/兼容测试，不需要旧审批票据。
Red：真实用户数据不可逆操作、高风险权限、密钥/签名、正式 Release/Tag，必须明确等待维护者确认。

严格遵守 Write-set。不要与其他 active Track 无协调同时修改 App.tsx、styles.css、package*.json、Cargo*.toml、vite.config.ts、ci.yml 等 shared conflict zone。

只跑与本 slice 匹配的最小充分验证；实际运行了什么就写什么，不能伪造 desktop、真机、签名或发布结果。

提交 PR 后停止，不顺手开始下一个 MOD 任务。
```
