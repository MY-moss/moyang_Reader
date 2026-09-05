# Moyang Reader AI 开发工作流

这套流程面向个人开发者 + AI 高频接力，目标是：**少上下文、少治理开销、每次只推进一个可验证小任务，同时允许互不冲突的工作并行。**

不再使用 policy / plan / state 状态机、审批凭证、T0–T3 风险等级、批准队列或任务 digest。

## 1. 四个入口

- `AGENTS.md`：长期开发规则，尽量短。
- `docs/AI-TASKS.md`：当前可执行任务队列，后续 AI 默认从这里接手。
- `docs/AI-HANDOFF.md`：稳定版本、外部阻塞、发布限制等少量长期事实。
- `docs/FUTURE-DEVELOPMENT-PLAN.md`：插件、AI、MCP、数据与 v1.0 后扩展的长期方向；**不是当前 TODO 清单**。

`docs/ROADMAP.md` 只描述产品阶段，不作为当前任务状态机。

当 Issue / Task 明确属于 Modernization Campaign（#464 / MOD-XX）时，再额外阅读：

- `docs/MODERNIZATION-CAMPAIGN.md`
- `docs/UI-NEXT-SPEC.md`（涉及 UI 时）

不要让所有普通 bugfix 都被迫读取长期现代化文档。

## 2. 接手一个普通任务

```powershell
git status --short --branch
git fetch origin
```

然后：

1. 阅读 `docs/AI-TASKS.md`。
2. 查看目标任务关联 Issue / PR，确认没有重复工作。
3. 优先选择第一个 `TODO` 且没有开放 PR 的任务。
4. 从最新目标 base 建立 `codex/<scope>-<date>` 分支或独立 worktree。
5. 只读当前任务相关代码、测试、类型和一个相似实现。

如果当前任务已经有人做，就跳到下一个 TODO；不需要修改任何状态机文件。

只有在需要规划新阶段、插件、AI、格式或长期架构时才阅读 `FUTURE-DEVELOPMENT-PLAN.md`。其中的候选不能直接开工，必须先确认阶段和依赖，再拆成 `AI-TASKS.md` 中的小任务。

## 3. 普通任务格式

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

## 4. 一个 PR 只做一个 coherent slice

始终保留：

- 一个 PR 解决一个清晰问题。
- Bug 先复现再修。
- UI 改动补相关 E2E。
- Rust / IPC / 文件行为改动补 Rust 或 desktop smoke。
- 任务外发现只记录，不顺手扩张。
- 大重构拆成可独立验证和回滚的切片。
- “未来做插件 / AI / RAG”不能直接成为一个巨大实现任务；先完成真实前置边界并让内置功能使用。

**“一个 PR 一个任务”不等于“整个仓库全球一次只能有一个 PR”。**

普通 `AI-TASKS` 队列默认仍按顺序推进；Modernization Campaign 可以按第 5 节并行。

## 5. Modernization Fast Lane（#464 / MOD-XX）

Modernization 使用 **Track + Risk lane + Write-set**，而不是审批状态机。

### 5.1 Tracks

- **A — Runtime / State / Command**
- **B — Rust / IPC / Error**
- **C — UI / Design System / Shell**
- **D — CI / Developer Experience**
- **E — Ports / Adapters / Feature Contribution**

一个 MOD 任务必须在开始前写明：

```text
Track
Risk lane
Write-set
Depends on
Target base (main / next)
```

不同 Track 只有在 **Write-set 不冲突** 时才能并行。

### 5.2 Shared conflict zone

以下文件默认不允许多个并行 PR 无协调同时修改：

```text
src/app/App.tsx
src/app/styles.css
package.json
package-lock.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
vite.config.ts
.github/workflows/ci.yml
```

需要修改 shared file 时，一个活动 slice 获得该文件写权；其他 Track 等它合入目标 base 后 rebase/继续。

不要把“AI 并行”理解成“最后一次性解决几千行 merge conflict”。

### 5.3 Risk lanes

#### Green

普通 UI、内部 TS 重构、样式、测试、文档、无持久化格式变化的 service/store。

要求：相关定向验证 + CI green。**不需要额外人工审批。**

#### Yellow

Rust/IPC、向后兼容设置/sidecar 迁移、权限收口、可选网络能力、文件实现保持语义的重构。

要求：定向负向测试；适用时 Rust/desktop smoke；持久化变化有兼容 fixture。

**不恢复批准队列或审批票据。**

#### Red

只限真正高风险动作：

- 删除/覆盖真实用户数据；
- 不可逆迁移或丢弃旧兼容读取；
- 扩大任意文件/进程/高风险网络权限；
- API Key、证书、签名私钥；
- 正式 Release / Tag；
- installer/updater signing；
- 主动关闭已有恢复/文件安全保护。

Red 需要维护者明确确认，但仍不建立 T0–T3 / `AWAITING_APPROVAL` / digest / policy state machine。

### 5.4 Target branch

Campaign 正式进入多 Track 实现后，推荐使用临时 `next` 集成线；`main` 保持稳定。

- 纯独立 Fast-Lane 清理可直接 target main；
- breaking architecture slice 优先 target next；
- next checkpoint 通过 full lane 后再合回 main。

具体以目标 Issue/PR 写明的 base 为准，不自行新建永久双主线。

## 6. 验证强度

按改动本身决定测试，不再用 T0–T3。

| 改动 | 最小建议验证 |
| --- | --- |
| 文档 / 开发脚本 | 目标检查、格式检查、`git diff --check` |
| TS / React 逻辑 | 相关单测、lint，必要时 build |
| UI / 交互 | 相关单测 + Playwright 场景 |
| Rust / IPC / 本地文件 | 相关前端测试 + Rust test/clippy 或 desktop smoke |
| 持久化兼容迁移 | 上述相关测试 + 旧 fixture → 新模型兼容测试 |
| 更新器 / 安装 / 发布 | 完整 CI + 能获得的真实 Windows 验证 |

GitHub full checks 是稳定主线最终门禁；本地和 PR fast lane 不需要为了一个小文档/纯 UI 切片反复跑所有桌面与 release 测试。

当 scope-aware CI 落地后，以 CI 自动判定 scope 为默认；shared config / workflow /无法安全判断的变更回退 full lane。

## 7. 哪些事情仍然不能随便自动做

仅保留真正有价值的限制：

- 不删除或覆盖用户真实文件来“验证”功能。
- 不提交密钥、令牌、证书私钥。
- 不把未来 AI API Key 存进普通设置导出、工作区文件或日志。
- 不让未来插件直接继承主窗口原始 Tauri / process / opener / updater 权限。
- 不伪造代码签名、旧版本升级、真机、外部服务或发布验证结果。
- 创建正式 Release / Tag 前必须确认版本和资产一致。
- 有持久化格式迁移时必须提供向后兼容或明确回滚路径。

普通 IPC、UI、内部重构、测试、文档、模块拆分不要求额外人工审批凭证。

## 8. 长期候选如何提升为任务

`FUTURE-DEVELOPMENT-PLAN.md` 中的候选只有满足以下条件才进入普通 `AI-TASKS.md`：

1. 当前版本阶段已经到达；
2. 前置接口 / 数据 / 权限边界已存在；
3. 在当前目标 base 重新验证后仍有真实用户或维护价值；
4. 没有重复 Issue / PR；
5. 能拆成独立测试和回滚的 coherent slice。

Modernization 的 MOD-XX 切片按 `MODERNIZATION-CAMPAIGN.md` 的依赖顺序提升，不需要再复制一套审批流程。

## 9. PR 交接模板

PR 描述建议包含：

1. Slice（Track / Risk / Write-set，普通任务可不填 Track）
2. 目标 / 用户价值
3. 变更
4. 非目标
5. Compatibility
6. 实际验证
7. 风险 / 回滚
8. Integration / 后续

历史细节留在 PR / Issue / Git，不复制进长期上下文。

不要再填写：

```text
T0/T1/T2/T3
AWAITING_APPROVAL
approval digest
ai:finish
ai:render
批准队列
```

## 10. Worktree 规则

- 根目录有用户改动时，不覆盖；使用独立 worktree。
- 每个活动实现任务一个 worktree。
- Modernization 并行 Track 每个 slice 使用独立 worktree。
- 已合并且干净的 AI worktree 可以回收；脏目录只报告，不自动删除。
- 构建缓存继续使用现有受管缓存机制，不创建跨 worktree 的 `node_modules` junction。

## 11. 历史 ADR

- ADR 0011 / 0013 已废止，只用于解释旧的 policy/state/T0–T3/G01–G03 历史。
- ADR 0012 仍有效：v1.0 前先稳定内部能力接口，不提前发布不稳定第三方插件 ABI。
- ADR 0015 定义 Modernization 的 Internal Breaking / User-Safe、Track 并行和 risk lane 边界。
