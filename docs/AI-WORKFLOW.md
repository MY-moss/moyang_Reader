# Moyang Reader AI 开发工作流

这套流程面向个人开发者 + AI 高频接力，目标是：**少上下文、少治理开销、每次只推进一个可验证小任务，同时避免旧审计、无关 PR 和外部条件制造假阻塞。**

不再使用 policy / plan / state 状态机、审批凭证、T0–T3、G01–G03 或 `NEXT.md`。

## 1. 当前事实入口

按以下顺序读取：

1. GitHub / `origin/main` 当前状态：最新 main、开放 PR/Issue、CI；
2. 根目录 [`AGENTS.md`](../AGENTS.md)；
3. [`AI-TASKS.md`](AI-TASKS.md)：当前可执行任务队列；
4. [`DEVELOPMENT-ARCHITECTURE-CONTRACT.md`](DEVELOPMENT-ARCHITECTURE-CONTRACT.md)：规范性工程边界；
5. [`AI-HANDOFF.md`](AI-HANDOFF.md)：稳定版本、外部阻塞和少量长期事实；
6. [`ROADMAP.md`](ROADMAP.md) 与 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)：产品阶段和 v1.x 长期候选，不是当前 TODO 清单。

本机 `.codex-cache/` 只保存现场上下文，不得覆盖 GitHub 或受版本控制文档。旧聊天、旧审计、旧 SHA、已关闭 PR/Issue 只能作为线索。

## 2. 本地 Agent 先同步

推荐第一条命令：

```powershell
npm run agent:bootstrap
```

它只读取、`git fetch`、查询远程状态并生成 `.codex-cache/agent-context.md`，不会自动 pull/rebase/reset/merge，也不会修改受版本控制的项目状态。

随后确认：

```powershell
git status --short --branch
git fetch origin --prune
```

Windows x64 的安装前置、`npm ci`、独立 worktree、浏览器/桌面测试和受管 Cargo 缓存只以 [`DEVELOPMENT-SETUP.md`](DEVELOPMENT-SETUP.md) 为准；本文件只定义 Agent 的接手顺序和边界。

并读取 `AGENTS.md`、`docs/AI-TASKS.md`、架构契约和本机 context/handoff。

如果远程查询失败或 `REMOTE_STATUS=UNKNOWN`：

- 可以继续已经存在的本地任务分支；
- 禁止自行开启新任务、后续任务或第二个 PR；
- 不得凭缓存声称“没有开放 PR”。

## 3. 严格单线，但不制造假阻塞

1. 找到 `AI-TASKS.md` 中最早未完成任务。
2. 如果更早任务是 `IN_PROGRESS` / `WAITING`，不得跳过。
3. 开放 PR 只有在**对应当前最早任务、修改同一范围或形成真实合并依赖**时才阻塞当前队列。
4. Dependabot、机器人依赖更新、纯维护或明显无关 PR 只检查冲突，不得冻结整个产品主线。
5. 已有对应 PR 时优先继续、修复、等待或清理它，不创建第二份实现。
6. 前序无真实阻塞且远程状态已确认后，才从最新 `origin/main` 建 `codex/<scope>-<date>` 分支或独立 worktree。

禁止用 stacked PR、多 Track 并行、第二套任务板或临时状态机绕过顺序。

用户明确改变优先级时可以调整 `AI-TASKS.md` 顺序；这是任务排序，不是恢复审批制度。

## 4. `BLOCKED_EXTERNAL` 的精确语义

`BLOCKED_EXTERNAL` 只能标记真正依赖以下条件的**具体子项**：

- GitHub 仓库设置；
- 证书/签名材料；
- 凭据或外部服务权限；
- 正式 Release/Tag 条件；
- 真实 Windows 安装、升级或其他无法由 CI 伪造的真机证据。

如果一个 Issue 同时包含仓库内可做事项和外部事项，必须拆开：代码、文档、测试、检查继续完成，只把真正外部部分保留为阻塞。不要因为一个外部开关让整票长期挂起。

## 5. 接手任务时读多少代码

不要无目的通读整仓，也不要只看一个文件就开始改。至少读取：

- 当前任务目标、非目标和验收；
- 相关 controller/service/interface；
- 相关测试；
- 一个相似实现；
- 涉及跨层、文件、IPC、权限、持久化、网络或未来 AI/扩展时，对应的架构契约章节。

修改架构边界前必须确认“谁拥有职责、谁允许调用、谁禁止调用”。

## 6. 任务格式与垂直切片

每个任务保持这些字段即可：ID/状态、目标、用户价值、非目标、主要文件、验收标准、推荐验证、依赖、风险/回滚。

执行规则：

- 一个任务、一个主要分支、一个 PR；
- Bug 先复现再修；
- UI 改动补相关 E2E；
- Rust / IPC / 文件行为改动补 Rust 测试或 desktop smoke；
- 权限/网络补正常路径和负向测试；
- 任务外发现先记录，不顺手扩张；
- 大重构拆成约 0.5–3 天可独立回滚的小切片；
- 新长期接口必须来自真实内置调用关系，不为“以后可能用”创建空 Provider/Manager/Service。

任务完成后把 `TODO` 改为 `DONE`，附 PR 号和一句结果；放弃则用 `CANCELLED` + 原因。

## 7. 验证强度

不再使用 T0–T3，按改动本身决定测试：

| 改动 | 最小建议验证 |
| --- | --- |
| 文档 / 开发脚本 | 目标检查、格式检查、`git diff --check` |
| TS / React 逻辑 | 相关单测、lint，必要时 build |
| UI / 交互 | 相关单测 + Playwright；语义变化加 a11y |
| IPC contract | bridge/contract test + build；关键路径 desktop smoke |
| Rust / 本地文件 / 文档会话 | 相关前端测试 + Rust test/clippy + 必要 desktop smoke |
| 权限 / 网络 | 正常路径 + 拒绝/越权/错误协议等负向测试 |
| settings migration | 正常、旧版本、损坏输入、失败 fallback |
| 更新器 / 安装 / 发布 | 完整 CI + 能获得的真实 Windows 验证 |

### Correctness 与 performance 必须分离

- `npm run test:e2e:desktop`：确定性的桌面功能正确性 smoke，可作为 PR required gate。
- `npm run test:e2e:desktop:benchmark`：性能 benchmark，保留固定 fixture、多轮和趋势证据。
- 共享 GitHub Runner 的单轮 renderer gap、冷启动抖动等不能直接等价成功能回归。
- 也不能因为有波动就删除 benchmark 或无限放宽阈值；只有指标在固定环境证明低波动后，才考虑升级为 required gate。

GitHub `Quality checks` 是主线代码合并门禁，但不能替代真实 Windows 安装、旧版升级、Authenticode 或正式 Release 证据。

## 8. 不能随便自动做的事

- 不删除或覆盖用户真实文件来验证功能；
- 不提交密钥、令牌、证书私钥；
- 不把 API key/token/证书放进普通设置、portable settings、`.moyang/`、日志或 Agent cache；
- 不在业务/组件中新写原始 Tauri `invoke`；
- 不让未来扩展直接继承主窗口 process/opener/updater/文件/任意网络权限；
- 不把当前 `DocumentAdapter` registry 当第三方插件 SDK；
- 不伪造代码签名、旧版本升级、真机、外部服务或发布验证；
- 创建正式 Release/Tag 前必须确认版本与资产一致；
- 有持久化格式迁移时必须提供兼容或明确回滚路径；
- 不为了未来 AI / 插件 / RAG / MCP 创建没有当前调用方的空接口。

普通 IPC、UI、重构、测试、文档和内部模块拆分不要求额外审批票据，但仍受架构契约和测试义务约束。

## 9. 长期接口：真实调用方优先

长期接口的默认形成顺序：

```text
真实用户动作
  → 一个内置实现
  → 稳定业务边界
  → 第二个真实调用方/实现证明复用价值
  → contract tests
  → 再考虑长期 provider/port/外部兼容
```

不得做 provider/mock-first 架构工程。原型如果确实需要，必须由当前 `AI-TASKS.md` 明确授权，并且不能伪装成冻结 ABI。

## 10. 长期候选如何进入任务队列

`FUTURE-DEVELOPMENT-PLAN.md` 中的候选只有同时满足以下条件才进入 `AI-TASKS.md`：

1. 当前版本阶段已到达；
2. 在 current main 重新验证仍有真实用户/维护价值；
3. 前置数据、权限或内部职责边界已由真实功能形成；
4. 没有重复 Issue / PR；
5. 能拆成 0.5–3 天、可独立测试和回滚的切片。

这是工程依赖，不是审批门禁。

## 11. 当前版本阶段

当前 v1.0 主线只有：

- **v0.11**：体验与职责收口——A08 上下文 Tab/a11y、A09 顶栏/DPI、A10 CSS/视觉基线、A11 Workspace Session、A12 稳定错误码、A13 RC/发布预检；
- **v0.12**：可靠性证明——大工作区与大文件 benchmark/降级、Resilient Reading Anchor、Tauri 权限库存与负向测试、真实主流程 UX、本地诊断；
- **v0.13**：Freeze / Compatibility / RC，不承载大型新功能；
- **v1.0**：可靠 Windows x64 基线与长期维护起点。

v1.0 后按 Gate 再评估：

- **v1.1 Reader+**：增强阅读与轻量 Inbox/捕获等；
- **v1.2 Metadata / Knowledge**：Properties、表格/保存视图等，写回必须先证明 frontmatter round-trip safety；
- **v1.3 AI**：从真实选区解释/翻译等低风险用户动作开始，再提炼 consent/secret/provider 边界；
- **v1.4+ Interop**：RAG、MCP、RSS、声明式扩展、更多格式等只在真实需求与前置边界成熟后评估。

长期候选不是开工许可。

## 12. 更新与发布稳定事实

- GitHub Release `latest.json` 是 updater metadata 权威源；Cloudflare Pages 仅作备用镜像/分发源。
- Tauri updater `.sig` 不等于 Windows Authenticode。
- 至少一次真实 Windows 旧版本 → 新版本自动升级闭环是 v1.0 前关键证据。
- CI 可以证明代码路径，不可以伪造证书、SmartScreen、安装器或正式分发链事实。

## 13. PR 与本地交接

PR 描述保持：目标/用户价值、变更、非目标、验证、风险与回滚、后续。任务来自 `AI-TASKS.md` 时，同一 PR 更新状态。

`.codex-cache/agent-context.md` 是 bootstrap 生成的只读现场摘要；`.codex-cache/agent-handoff.md` 是可选本机便签。未完成时至少记录 Task ID、branch、last commit、completed、tests run、unfinished、do-not-overwrite/do-not-regress。它们都不得提交。

## 14. Worktree 与历史 ADR

- 根目录有用户改动时不覆盖，使用独立 worktree；
- 每个活动实现任务一个 worktree；
- 已合并且干净的 AI worktree 可以回收，脏目录只报告不自动删除；
- 构建缓存继续使用受管缓存机制，不创建跨 worktree 的 `node_modules` junction。

ADR 0011 / 0013 只保留为旧治理历史。ADR 0012 继续提供一个窄原则：**没有真实内置调用关系前，不承诺第三方插件 ABI**；它不要求在 v1.0 前预先稳定 AiProvider、PermissionBroker、插件内核或其他未来端口。
