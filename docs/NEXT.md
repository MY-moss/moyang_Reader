# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：M1101
- 状态：AWAITING_APPROVAL
- 风险：T1
- Issue：https://github.com/MY-moss/moyang_Reader/issues/194
- 自动交付：允许
- 已取消计划项：G03（按用户决定取消外部 GitHub App、Code Owner 和探针门禁；保留 G01/G02 的仓库内控制面。）

## 目标

统一前端 Windows 同路径或子路径谓词并迁移五个调用方。

## 用户价值

避免工作区切换、缓存失效、树操作和差量刷新使用不同路径规则。

## 非目标

- 不修改 Rust 路径授权
- 不重构 App.tsx
- 不改变 external-change 双向事件语义

## 验收标准

- 共享谓词复用 normalizePathKey
- 覆盖大小写、分隔符、UNC、扩展路径和前缀碰撞
- 五个调用方删除重复实现

## 验证

- `npm test -- --run path-key`
- `npm run lint`
- `npm run format:check`
- `npm run ai:check`
- `git diff --check`

## 允许修改范围

- `src/app/`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

回退共享谓词切片；不涉及文件格式或数据迁移。

## 阻塞/确认点

- 原因：G03 已按用户决定取消；需要合并本次计划和状态机修订后重新运行 ai:start。
- 下一动作：合并本次治理修订后运行 npm run ai:start，开始 M1101。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
