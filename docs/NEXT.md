# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：M1103
- 状态：PENDING_INTAKE
- 风险：T1
- Issue：无
- 自动交付：允许
- 已取消计划项：G03（按用户决定取消外部 GitHub App、Code Owner 和探针门禁；保留 G01/G02 的仓库内控制面。）

## 目标

拆分打开编辑保存、工作区、导出与无障碍浏览器测试。

## 用户价值

让浏览器失败可按用户旅程快速定位。

## 非目标

- 不重写产品交互
- 不删除现有覆盖场景

## 验收标准

- 各旅程可独立运行
- 原有场景数量与断言能力不下降

## 验证

- `npm run test:e2e`
- `npm run lint`
- `npm run format:check`
- `npm run ai:check`

## 允许修改范围

- `e2e/`
- `playwright.config.ts`
- `package.json`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

恢复原测试组织；不影响应用。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
