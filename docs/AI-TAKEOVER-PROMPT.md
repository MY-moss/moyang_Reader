# Moyang Reader AI 接手提示词

只需复制下面这段；不要附带路线图、历史交接、源码或日志。

```text
继续开发 Moyang Reader。

先遵循根目录 AGENTS.md，再运行 npm run ai:context 和 npm run ai:start。结构化 policy/plan/state 是权限、队列和动态状态的唯一来源；NEXT.md 只能生成，不能手改。

保护现有未提交改动。一次只完成批准队列中的当前垂直切片，只读取相关源码、测试、类型和一个相似实现。按任务声明的风险级别验证，并通过 ai:finish 与 ai:check 更新交接。

T0–T2 只要依赖已完成或按计划取消、无治理文件变化且所有门禁通过即可自动交付；T3、治理策略、发布、凭据、权限或数据迁移必须进入 AWAITING_APPROVAL。已取消任务只可由计划中的取消记录跨过，不得由 AI 自行新增、跳过或重排任务。
```

当前任务不写在本文件；运行 `npm run ai:context` 获取紧凑上下文。
