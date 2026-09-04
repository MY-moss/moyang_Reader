# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：M1102
- 状态：PENDING_INTAKE
- 风险：T1
- Issue：无
- 自动交付：允许
- 已取消计划项：G03（按用户决定取消外部 GitHub App、Code Owner 和探针门禁；保留 G01/G02 的仓库内控制面。）

## 目标

配置显式覆盖范围、冻结真实基线并为关键纯逻辑模块设置 90% 行与 80% 分支阈值。

## 用户价值

让覆盖率门禁真实反映 App 与组件风险。

## 非目标

- 不为追求数字编写无行为价值测试
- 不修改产品行为

## 验收标准

- App 与组件不再被隐式排除
- 全局阈值不低于首次真实测量值且只能提高

## 验证

- `npm run test:coverage`
- `npm run lint`
- `npm run format:check`
- `npm run ai:check`

## 允许修改范围

- `src/`
- `vite.config.ts`
- `package.json`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

回退覆盖配置与新增测试。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
