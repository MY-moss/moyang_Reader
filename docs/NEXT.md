# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：M1104
- 状态：PENDING_INTAKE
- 风险：T1
- Issue：https://github.com/MY-moss/moyang_Reader/issues/194
- 自动交付：允许
- 已取消计划项：G03（按用户决定取消外部 GitHub App、Code Owner 和探针门禁；保留 G01/G02 的仓库内控制面。）

## 目标

建立命令名称与静态类型单一目录，不改变运行时 IPC。

## 用户价值

降低 TypeScript 与 Rust 命令名称和静态类型漂移。

## 非目标

- 不增加运行时响应验证
- 不修改 Rust 命令行为

## 验收标准

- 前端 invoke 不再散落手写命令字符串
- 现有桥接测试通过

## 验证

- `npm test -- --run bridge`
- `npm run lint`
- `npm run build`
- `npm run ai:check`

## 允许修改范围

- `src/`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

恢复原桥接常量；不影响持久化格式。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。

