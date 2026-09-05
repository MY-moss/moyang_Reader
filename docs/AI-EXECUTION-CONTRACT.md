# Moyang Reader — AI 执行与完成确认契约

> 目标：让任何 AI 在没有旧聊天上下文的情况下，1–2 分钟内判断“现在该做什么、什么已经在做、什么才算完成”，并避免重复开发或状态文件漂移。

## 1. 唯一接手顺序

任何 AI 只按下面顺序读取：

```text
AGENTS.md
  ↓
docs/AI-TASKS.md
  ↓
GitHub 当前 Issue / PR
  ↓
目标任务相关源码 + 测试 + 一个相似实现
```

只有任务明确属于 `#464 / MOD-XX` 时，再读：

```text
docs/MODERNIZATION-TASKS.md
docs/MODERNIZATION-CAMPAIGN.md
UI 任务再读 docs/UI-NEXT-SPEC.md
```

只有需要判断长期产品方向时才读 `FUTURE-DEVELOPMENT-PLAN.md` / `ROADMAP.md`。

**禁止把所有长期文档、旧聊天、完整 CI 日志一次性塞给下一个 AI。**

---

## 2. 两个真源，不再新增第三个状态机

### 2.1 GitHub 是“代码是否真的存在”的最终真源

判断开发状态时，优先级固定为：

```text
merged PR / target branch code
    > open PR
    > Issue
    > docs/AI-TASKS.md 中的缓存状态
    > 旧审计 / 旧聊天
```

如果文档写 `TODO`，但 GitHub 已存在同任务开放 PR：

1. **不要重复开发；**
2. 先把任务板同步为 `IN_PROGRESS — PR #...`；
3. 再选择下一个可执行任务。

如果文档写 `DONE`，但目标代码从未合入目标分支：

- 必须降回真实状态；
- 不允许仅凭“某个 AI 说做完了”确认完成。

### 2.2 `docs/AI-TASKS.md` 是普通任务的当前队列

它只回答：

- 当前有哪些近期任务；
- 哪些正在开发；
- 下一项应该做什么；
- 关联哪个 PR / Issue。

它不是完整历史档案；历史放在 Git / PR / Issue。

Modernization 使用 `docs/MODERNIZATION-TASKS.md` 作为当前波次队列，语义相同。

---

## 3. 状态语义

### `TODO`

满足全部条件才能写：

- 尚未开始；
- 没有同主题开放实现 PR；
- 依赖已满足或任务本身说明何时可开始。

### `IN_PROGRESS — PR #N`

一旦创建实现 PR 就必须使用。

它可以表示：

- 正在编码；
- 代码已写完、正在等 CI；
- CI 已通过、等待依赖 PR / 合并。

**PR 尚未合入目标 base 时，不写 `DONE`。**

如需说明可在下一行写：

```text
- 进度：实现完成，等待 #123 合并后 retarget。
```

### `DONE — PR #N`

只有同时满足：

1. PR 已合入声明的目标 base；
2. 验收标准满足；
3. 实际验证结果可从 PR / CI 查到；
4. 没有把关键失败伪装成通过。

才可写 `DONE`。

### `CANCELLED`

任务不再做，并用一句话说明原因。

### `BLOCKED_EXTERNAL`

代码无法解决的真实外部条件，例如证书、仓库设置、真实旧版本环境。

不要把普通依赖、等待另一个 PR 合并写成外部阻塞。

---

## 4. 90 秒接手检查

AI 开始编码前必须完成：

```powershell
git status --short --branch
git fetch origin
```

然后回答自己 8 个问题：

1. 目标 base 是 `main` 还是 `next`？
2. 当前任务 ID 是什么？
3. GitHub 是否已有同主题 Issue / PR？
4. 任务板状态和 GitHub 是否一致？
5. 依赖 PR 是否已经满足？
6. 本次 write-set 是哪些文件/目录？
7. 最小充分验证是什么？
8. 回滚方式是什么？

任何一项不清楚时，先缩小范围或修正任务板，不凭猜测开工。

---

## 5. 开发过程必须更新的三个时间点

### 时间点 A — 开始

- 建 `codex/<scope>-<date>` 分支 / worktree；
- 普通任务确认 `AI-TASKS` 为 TODO；Modernization 确认任务为 READY；
- 检查 write-set 冲突。

### 时间点 B — PR 创建

同一个 PR 必须让状态变成：

```text
IN_PROGRESS — PR #N
```

并在 PR 说明：

- Task / Issue；
- target base；
- 目标 / 非目标；
- Compatibility；
- 实际验证；
- 风险 / 回滚；
- Modernization 时再写 Track / Risk / Write-set / Depends on。

### 时间点 C — 合并后

GitHub merged 状态即“代码已交付”的事实。

下一次维护任务板时将该项收口为：

```text
DONE — PR #N
```

并只留一句结果。完成项随后可以从近期队列移出；不要把 `AI-TASKS.md` 变成 changelog。

**如果 task board 暂时没来得及改，GitHub merged PR 仍然优先，后续 AI 必须先纠偏再继续。**

---

## 6. 完成定义（Definition of Done）

“代码写完”不等于完成。

一个 slice 至少满足：

```text
实现存在
+ 验收通过
+ 与风险匹配的测试
+ 用户数据/兼容边界没有被偷偷改变
+ PR 写清真实结果
+ 合入目标 base
```

UI：至少相关组件/逻辑测试 + 一个真实 Playwright 路径。

Rust / IPC / 文件：相关 Rust test/clippy 或 desktop smoke；高风险失败路径补负向测试。

持久化迁移：旧 fixture 必须能读取/迁移，不能用“清空重新开始”代替兼容。

Release / signing：不能用 CI 模拟结果冒充真实签名/旧版本升级证据。

---

## 7. 并行开发

普通 `AI-TASKS` 默认顺序推进。

Modernization 才使用 Track 并行：

```text
A Runtime / State / Command
B Rust / IPC / Error
C UI / Design System
D CI / Developer Experience
E Ports / Feature Contribution
```

并行条件：

- 任务 READY；
- Depends on 已满足；
- Write-set 不重叠；
- shared conflict zone 没被其他 PR 占用。

一个 PR 仍然只能有一个 coherent slice。

---

## 8. 安全与审批边界

Green / Yellow 不需要旧式人工审批票据。

只有 Red 动作需要维护者明确确认：

- 不可逆删除/覆盖真实用户数据；
- 不可逆持久化迁移；
- 扩大任意文件/进程/高风险网络权限；
- API Key / 证书 / 私钥；
- Release / Tag / signing；
- 主动取消已有恢复保护。

禁止重新引入：

```text
T0–T3
AWAITING_APPROVAL
approval digest
批准队列
ai:finish / ai:render
policy / plan / state JSON 状态机
```

---

## 9. 防止“AI 自称完成”

任何完成声明都至少能被下面之一独立验证：

- merged PR；
- target branch commit；
- GitHub check / CI；
- 可复现测试命令及输出；
- 对应文件和测试的实际 diff。

不能使用以下依据：

- “我已经实现了”；
- 旧聊天摘要；
- 没有代码的 Issue 勾选；
- 未运行却写成 pass 的测试。

---

## 10. 后续 AI 最短提示词

```text
继续开发 Moyang Reader。先读 AGENTS.md 和 docs/AI-TASKS.md，然后检查 GitHub 当前 Issue/PR。GitHub 当前状态优先于任务板；如果两者不一致，先同步任务板，绝对不要重复开发。选择第一个真实可执行任务，只完成一个 coherent slice。PR 创建时把任务标成 IN_PROGRESS — PR #N；只有 PR 合入目标 base 且验收/测试可验证后才算 DONE。按改动做最小充分验证，不恢复 T0–T3、审批队列或 ai:* 状态机。若是 #464/MOD-XX，再读 MODERNIZATION-TASKS/CAMPAIGN，并遵守 Track/Risk/Write-set。
```
