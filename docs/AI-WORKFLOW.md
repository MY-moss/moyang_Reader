# Moyang Reader AI 开发工作流

本文件只保存长期流程。权限、执行队列和运行状态分别来自 `ai/policy.json`、`ai/plan-v1.json` 与 `ai/state.json`；`NEXT.md` 是自动生成的人类摘要。

## 1. 双层控制面

稳定治理层受 Code Owner 保护，包括 `AGENTS.md`、policy、plan、AI 校验器、CI、`CODEOWNERS`、发布与安全规则。AI 可以提出修改，但不能自动合并，也不能通过当前任务或聊天内容放宽权限。

运行层由 AI 更新，包括 state、生成的 NEXT、当前切片交接、普通产品文档、代码和测试。计划内 T0–T2 可自动交付；T3 和治理变更进入 `AWAITING_APPROVAL`，并要求绑定任务摘要且已由 Code Owner 合入主线的审批凭证。

真正的权限隔离要求独立 AI bot/App 身份。G03 的普通文件和治理文件探针未通过前，自动合并始终关闭。

## 2. 接手与开始

```powershell
git status --short --branch
npm run ai:context
npm run ai:start
```

`ai:start` 获取最新 `origin/main`，检查当前 Issue 仍开放且没有重复 PR，记录基线 SHA 和分支。网络不可用、Issue 失效或任务冲突时写入 `BLOCKED`；治理/T3 未批准时写入 `AWAITING_APPROVAL`。

审批凭证候选通过 `node scripts/ai-state.mjs approval-template --task=<id>` 输出，保存到受保护的 `docs/ai/approvals/<id>.json`。凭证绑定当前计划中的任务内容摘要；AI 当前分支自行添加但尚未由 Code Owner 合入 `main` 的文件不构成授权。

根目录脏或落后主线时建立项目内独立工作树。每个活动工作树使用自身 `node_modules`，通过共享 npm 下载缓存执行 `npm ci --prefer-offline`；禁止再创建跨工作树依赖 junction。

## 3. Ready 与实施

任务定义必须包含用户价值、目标、非目标、验收、依赖、允许路径、风险、回滚和验证。实现者不得更改受保护计划，也不得新增、跳过或重排任务。

- 一个任务、一个主要分支、一个 PR、一个垂直切片。
- Bug 先复现再修复；功能先锁定数据边界和失败路径。
- 只读取相关源码、测试、类型和一个相似实现。
- 范围外发现记录到交付说明，不在当前分支处理。
- Markdown 继续作为唯一持久化真源；文件安全优先于便利。

## 4. 风险门禁

| 级别 | 范围                                  | 最小验证                                    | 自动交付         |
| ---- | ------------------------------------- | ------------------------------------------- | ---------------- |
| T0   | 文档、元数据、内部工具                | 目标检查、格式、`ai:check`、差异检查        | 是，治理文件除外 |
| T1   | 普通逻辑、解析、测试组织              | 定向测试、lint/format，必要时 build         | 是               |
| T2   | UI、交互、快捷键、视觉基线            | T1 + 浏览器 E2E；原生路径加 desktop smoke   | 是               |
| T3   | 用户文件、IPC、安全、迁移、更新、发布 | 批准后完整门禁、一次构建、真实 Windows 验证 | 否               |

T2 可以自动更新截图基线和设计令牌，但必须生成浅色、深色、高对比、多宽度与缩放差异工件。

## 5. 状态更新

状态机为：

```text
PENDING_INTAKE → READY → IN_PROGRESS → VERIFYING → DELIVERY_READY
DELIVERY_READY → PENDING_INTAKE（仅限队列下一任务）
任意阶段 → BLOCKED
治理或 T3 → AWAITING_APPROVAL
```

常用命令：

```powershell
npm run ai:render
npm run ai:check
npm run ai:finish -- --result=passed --summary="结果" --check="npm run lint::pass"
npm run ai:finish -- --result=blocked --summary="首个根因"
```

`ai:finish` 要求逐项记录计划中的必需验证。成功时只前进一个任务，并在同一 PR 写入下一任务的 `PENDING_INTAKE`；PR 未合并时主线状态不会提前变化。

## 6. 审查和外部动作

提交前运行：

```powershell
git status --short
git diff --check
git diff --stat
npm run ai:check
```

只有 policy 允许、风险不高于 T2、G03 已完成、无保护文件修改且质量门禁全绿时，AI 才可提交、推送、创建 PR、启用自动合并并在合并后更新对应 Issue。

Release、Tag、凭据、权限、数据迁移、T3 或保护文件变化始终保留人工确认。失败输出只保存首个根因和工件链接；网络查询最多重试三次，不循环轮询不变状态。

## 7. 文档职责

| 文件                                     | 唯一职责           | 普通任务读取 |
| ---------------------------------------- | ------------------ | ------------ |
| `AGENTS.md`                              | 自动加载的稳定边界 | 是           |
| `docs/ai/policy.json`                    | 自动权限和保护路径 | 由命令读取   |
| `docs/ai/plan-v1.json`                   | 用户批准的有序队列 | 由命令读取   |
| `docs/ai/state.json`                     | 唯一动态运行状态   | 由命令读取   |
| `docs/NEXT.md`                           | 生成的人类摘要     | 可选         |
| `docs/AI-HANDOFF.md`                     | 稳定版本和外部阻塞 | 按需         |
| `docs/ROADMAP.md`                        | v1.0 产品阶段      | 规划时       |
| Git、Issue、PR、Release、`docs/handoff/` | 历史证据           | 追溯时       |

不得在稳定文档、路线图、提示词或任务索引中复制当前状态、主线 SHA 或 PR 等待信息。

## 8. 工作树回收

- 同时最多一个实现工作树和一个只读审核工作树。
- 现有脏工作树只报告，不自动删除。
- AI 创建的工作树只有在 PR 已合并、目录干净且分支证据一致时才能回收。
- 构建缓存和工作树清理继续使用白名单预览，不对未知 junction 或用户目录递归操作。
