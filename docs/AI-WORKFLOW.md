# Moyang Reader AI 开发工作流

这套流程面向个人开发者 + AI 高频接力，目标是：**少上下文、少治理开销、每次只推进一个可验证小任务。**

不再使用 policy / plan / state 状态机、审批凭证、风险等级或任务 digest。

## 1. 四个入口

- `AGENTS.md`：长期开发规则，尽量短。
- `docs/AI-TASKS.md`：当前可执行任务队列，后续 AI 默认从这里接手。
- `docs/AI-HANDOFF.md`：稳定版本、外部阻塞、发布限制等少量长期事实。
- `docs/FUTURE-DEVELOPMENT-PLAN.md`：插件、AI、MCP、格式、数据与 v1.0 后扩展的长期方向；**不是当前 TODO 清单**。

`docs/ROADMAP.md` 只描述产品阶段，不作为当前任务状态机。

## 2. 接手一个任务

```powershell
git status --short --branch
git fetch origin
```

然后：

1. 阅读 `docs/AI-TASKS.md`。
2. 查看目标任务关联 Issue / PR，确认没有重复工作。
3. 优先选择第一个 `TODO` 且没有开放 PR 的任务。
4. 从最新 `origin/main` 建立 `codex/<scope>-<date>` 分支或独立 worktree。
5. 只读当前任务相关代码、测试、类型和一个相似实现。

如果当前任务已经有人做，就跳到下一个 TODO；不需要修改任何状态机文件。

只有在需要规划新阶段、插件、AI、格式或长期架构时才阅读 `FUTURE-DEVELOPMENT-PLAN.md`。其中的候选不能直接开工，必须先确认阶段和依赖，再拆成 `AI-TASKS.md` 中的小任务。

## 3. 任务格式

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

## 4. 一次只做一个垂直切片

- 一个任务、一个主要分支、一个 PR。
- Bug 先复现再修。
- UI 改动补相关 E2E。
- Rust / IPC / 文件行为改动补 Rust 或 desktop smoke。
- 任务外发现只记录，不顺手扩张。
- 大重构拆成 0.5–3 天可独立回滚的小切片。
- “未来做插件 / AI / RAG”不能直接成为一个巨大实现任务；先完成它依赖的内部接口，并让现有内置功能实际使用。

## 5. 验证强度

不再用 T0–T3。按改动本身决定测试：

| 改动 | 最小建议验证 |
| --- | --- |
| 文档 / 开发脚本 | 目标检查、格式检查、`git diff --check` |
| TS / React 逻辑 | 相关单测、lint，必要时 build |
| UI / 交互 | 相关单测 + Playwright 场景 |
| Rust / IPC / 本地文件 | 相关前端测试 + Rust test/clippy 或 desktop smoke |
| 更新器 / 安装 / 发布 | 完整 CI + 能获得的真实 Windows 验证 |

GitHub `Quality checks` 是主线最终门禁；本地不需要为了一个小文档 PR 重跑所有桌面测试。

## 6. 哪些事情仍然不能随便自动做

仅保留真正有价值的限制：

- 不删除或覆盖用户真实文件来“验证”功能。
- 不提交密钥、令牌、证书私钥。
- 不把未来 AI API Key 存进普通设置导出、工作区文件或日志。
- 不让未来插件直接继承主窗口原始 Tauri / process / opener / updater 权限。
- 不伪造代码签名、旧版本升级、真机、外部服务或发布验证结果。
- 创建正式 Release / Tag 前必须确认版本和资产一致。
- 有持久化格式迁移时必须提供向后兼容或明确回滚路径。

普通 IPC、UI、重构、测试、文档、内部模块拆分不再要求额外人工审批票据。

## 7. 长期候选如何提升为任务

`FUTURE-DEVELOPMENT-PLAN.md` 中的候选只有满足以下条件才进入 `AI-TASKS.md`：

1. 当前版本阶段已经到达；
2. 前置接口 / 数据 / 权限边界已存在；
3. 在当前 main 重新验证后仍有真实用户或维护价值；
4. 没有重复 Issue / PR；
5. 能拆成 0.5–3 天、可独立测试和回滚的切片。

这只是工程依赖，不是恢复审批门禁。

## 8. PR 交接模板

PR 描述建议固定六段：

1. 目标 / 用户价值
2. 变更
3. 非目标
4. 验证
5. 风险与回滚
6. 后续

完成后同步 `docs/AI-TASKS.md`。历史细节留在 PR / Issue / Git，不复制进长期上下文。

## 9. Worktree 规则

- 根目录有用户改动时，不覆盖；使用独立 worktree。
- 每个活动实现任务一个 worktree 即可。
- 已合并且干净的 AI worktree 可以回收；脏目录只报告，不自动删除。
- 构建缓存继续使用现有受管缓存机制，不创建跨 worktree 的 `node_modules` junction。

## 10. 历史 ADR

- ADR 0011 / 0013 已废止，只用于解释旧的 policy/state/T0–T3/G01–G03 历史。
- ADR 0012 仍有效：v1.0 前先稳定内部能力接口，不提前发布不稳定第三方插件 ABI。
