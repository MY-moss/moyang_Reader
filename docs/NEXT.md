# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：M1105
- 状态：PENDING_INTAKE
- 风险：T3
- Issue：https://github.com/MY-moss/moyang_Reader/issues/194
- 自动交付：禁止，必须人工确认
- 已取消计划项：G03（按用户决定取消外部 GitHub App、Code Owner 和探针门禁；保留 G01/G02 的仓库内控制面。）

## 目标

为首批只读命令增加运行时响应验证并保持旧返回兼容。

## 用户价值

让只读 IPC 返回结构变化在边界处可诊断。

## 非目标

- 不修改写入命令
- 不批量迁移全部 IPC

## 验收标准

- 无效响应产生稳定错误
- 有效旧响应继续通过
- 真实桌面只读路径通过

## 验证

- `npm test -- --run bridge`
- `npm run test:e2e:desktop`
- `npm run build`
- `npm run ai:check`

## 允许修改范围

- `src/`
- `src-tauri/`
- `desktop-e2e/`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

移除运行时验证并恢复静态桥接。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
