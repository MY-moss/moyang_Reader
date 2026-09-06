# Moyang Reader AI 开发工作流

这套流程面向个人开发者 + AI 高频接力，目标是：**少上下文、少治理开销、每次只推进一个可验证小任务，同时让本地 Agent 不会因为没先看 GitHub 而重复开发。**

不再使用 policy / plan / state 状态机、审批凭证、风险等级或任务 digest。

## 1. 五个入口

- `AGENTS.md`：长期开发规则，优先读取。
- `docs/AI-TASKS.md`：当前可执行任务队列。
- `docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`：代码边界、接口、数据、安全和测试的规范性约束。
- `docs/AI-HANDOFF.md`：稳定版本、外部阻塞、发布限制等少量长期事实。
- `docs/FUTURE-DEVELOPMENT-PLAN.md`：插件、AI、MCP、格式、数据与 v1.0 后扩展方向；**不是当前 TODO 清单**。

`docs/ROADMAP.md` 只描述产品阶段，不作为当前任务状态机。`ARCHITECTURE.md` 描述当前实现；若“描述”与规范性开发约束产生歧义，以当前代码 + 本文列出的规范入口为准并修正文档。

## 2. 本地 Agent 先同步，再决定任务

推荐第一条命令：

```powershell
npm run agent:bootstrap
```

它只做读取、`git fetch`、远程状态查询和本机上下文生成，不自动 pull/rebase/reset/merge，也不修改受版本控制的项目状态。结果写入被忽略的 `.codex-cache/agent-context.md`。

随后至少执行/确认：

```powershell
git status --short --branch
git fetch origin --prune
```

并读取：

1. `AGENTS.md`
2. `docs/AI-TASKS.md`
3. `docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`
4. `.codex-cache/agent-context.md`
5. 若存在，`.codex-cache/agent-handoff.md`

共享事实优先级固定为：GitHub/`origin/main` > 受版本控制 Markdown > `.codex-cache` > 旧聊天/旧审计。

如果远程查询失败或 `REMOTE_STATUS=UNKNOWN`：

- 可以继续已经存在的本地任务分支；
- 禁止自行开启一个新任务、后续任务或第二个 PR；
- 不得凭本地缓存声称“没有 Open PR”。

## 3. 严格单线任务规则

1. 检查 Open PR 和 `AI-TASKS.md`。
2. 找到最早未完成任务。
3. 如果它是 `IN_PROGRESS` / `WAITING`，或已经有开放 PR：**不得跳到下一个 TODO**。
4. 优先继续、修复、等待或清理已有 PR。
5. 只有前序任务已结束且远程状态已确认，才从最新 `origin/main` 建 `codex/<scope>-<date>` 分支或独立 worktree。

禁止用 stacked PR、多 Track 并行、第二套任务板、临时 Issue 队列来绕过顺序。

用户明确改变当前优先级时可以调整 `AI-TASKS.md` 顺序；这是任务排序，不是重新引入审批系统。

## 4. 接手一个任务时读多少代码

不要无目的通读整仓，也不要只看一个文件就开始改。

必须最少读取：

- 当前任务的目标/非目标/验收；
- 相关 controller/service/interface；
- 相关测试；
- 一个相似实现；
- 涉及跨层、文件、IPC、权限、持久化、AI/plugin 时，对应阅读 `DEVELOPMENT-ARCHITECTURE-CONTRACT.md` 章节。

修改架构边界前必须确认“谁拥有这个职责、允许谁调用、禁止谁调用”。

## 5. 任务格式

每个任务只需要这些字段：

- ID / 状态
- 目标
- 用户价值
- 非目标
- 主要文件
- 验收标准
- 推荐验证
- 依赖（如有）
- 风险 / 回滚

任务完成后，把 `TODO` 改为 `DONE`，附 PR 号和一句结果。若任务被放弃，用 `CANCELLED` + 一句原因即可。

## 6. 一次只做一个垂直切片

- 一个任务、一个主要分支、一个 PR。
- Bug 先复现再修。
- UI 改动补相关 E2E。
- Rust / IPC / 文件行为改动补 Rust 或 desktop smoke。
- 任务外发现只记录，不顺手扩张。
- 大重构拆成 0.5–3 天可独立回滚的小切片。
- 新长期 interface/provider 必须有真实内置调用方，除非任务明确是 prototype。
- “未来做插件 / AI / RAG”不能直接成为巨大实现任务；先完成依赖的内部边界，并让内置功能真实使用。

## 7. 验证强度

不再用 T0–T3。按改动本身决定测试：

| 改动 | 最小建议验证 |
| --- | --- |
| 文档 / 开发脚本 | 目标检查、格式检查、`git diff --check` |
| TS / React 逻辑 | 相关单测、lint，必要时 build |
| UI / 交互 | 相关单测 + Playwright 场景；语义变化加 a11y |
| IPC contract | bridge/contract test + build；关键路径 desktop smoke |
| Rust / 本地文件 / 文档会话 | 相关前端测试 + Rust test/clippy + 必要 desktop smoke |
| 权限 / 网络 | 正常路径 + 拒绝/越权/错误协议等负向测试 |
| settings migration | 正常、旧版本、损坏输入、失败 fallback |
| 更新器 / 安装 / 发布 | 完整 CI + 能获得的真实 Windows 验证 |

GitHub `Quality checks` 是主线最终门禁；它不能替代真实 Windows 安装、旧版升级和 Authenticode 证据。

## 8. 哪些事情不能随便自动做

- 不删除或覆盖用户真实文件来“验证”功能。
- 不提交密钥、令牌、证书私钥。
- 不把未来 AI API Key 存进普通设置导出、工作区文件、`.moyang`、日志或 Agent cache。
- 不在业务/组件里新写原始 Tauri `invoke`。
- 不让未来插件直接继承主窗口原始 Tauri/process/opener/updater 权限。
- 不把当前 DocumentAdapter registry 当作第三方插件 SDK。
- 不伪造代码签名、旧版本升级、真机、外部服务或发布验证结果。
- 创建正式 Release / Tag 前必须确认版本和资产一致。
- 有持久化格式迁移时必须提供向后兼容或明确回滚路径。
- 不为了“未来可能用”创建一批没有内置调用方的空抽象。

普通 IPC、UI、重构、测试、文档、内部模块拆分不要求额外人工审批票据，但仍受架构契约和测试义务约束。

## 9. 长期候选如何提升为任务

`FUTURE-DEVELOPMENT-PLAN.md` 中的候选只有满足以下条件才进入 `AI-TASKS.md`：

1. 当前版本阶段已经到达；
2. 前置接口 / 数据 / 权限边界已存在；
3. 在当前 main 重新验证后仍有真实用户或维护价值；
4. 没有重复 Issue / PR；
5. 能拆成 0.5–3 天、可独立测试和回滚的切片。

这只是工程依赖，不是恢复审批门禁。

## 10. PR 交接

PR 描述固定保持：

1. 目标 / 用户价值
2. 变更
3. 非目标
4. 验证
5. 风险与回滚
6. 后续

如果任务来自 `AI-TASKS.md`，完成后同步其状态。历史细节留在 PR / Issue / Git，不复制进长期上下文。

## 11. 本地 Agent 交接

`.codex-cache/agent-context.md` 是 bootstrap 生成的只读现场摘要；`.codex-cache/agent-handoff.md` 是可选本机便签。

Agent 停止但尚未完成/提交时，handoff 至少写：

- Task ID
- branch
- last commit
- completed
- tests run
- unfinished
- do-not-overwrite / do-not-regress

这两个文件都不得提交，也不得作为共享事实覆盖 GitHub。

## 12. Worktree 规则

- 根目录有用户改动时，不覆盖；使用独立 worktree。
- 每个活动实现任务一个 worktree 即可。
- 已合并且干净的 AI worktree 可以回收；脏目录只报告，不自动删除。
- 构建缓存继续使用现有受管缓存机制，不创建跨 worktree 的 `node_modules` junction。

## 13. 历史 ADR

- ADR 0011 / 0013 已废止，只用于解释旧 policy/state/T0–T3/G01–G03 历史。
- ADR 0012 仍有效：v1.0 前先稳定内部能力接口，不提前发布不稳定第三方插件 ABI。
