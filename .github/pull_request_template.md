## Slice

- Issue / Task：
- Track（Modernization 时）：A / B / C / D / E / 不适用
- Risk lane：Green / Yellow / Red / 不适用
- 开始时 base SHA：
- 分支 / worktree：
- Write-set（并行开发时）：
- 同主题开放 PR：无 / 有（说明依赖或冲突处理）

## 目标 / 用户价值

- 解决什么问题：
- 用户或维护者得到什么：

## 变更

- 主要改动：
- 关键接口 / 数据流：
- 用户可见变化：无 / 有（说明）

## 非目标

- 本 PR 明确不做：

## Compatibility

- 用户普通文件：unchanged / backward-compatible migration / 说明
- settings / `.moyang` / 批注 / 书签 / 草稿：unchanged / backward-compatible migration / 说明
- 默认离线 / 权限边界：unchanged / 说明

## 验证

只填写实际适用项，不为了模板跑无关完整门禁。

| 检查 | 结果 |
| --- | --- |
| unit / targeted tests | 未运行 / pass / fail（说明） |
| lint / type / build | 未运行 / pass / fail（说明） |
| browser E2E / a11y | 未运行 / pass / fail（说明） |
| Rust fmt / clippy / test | 未运行 / pass / fail（说明） |
| desktop smoke | 未运行 / pass / fail（说明） |
| release / updater / signing | 不适用 / 说明真实验证结果 |

CI：未运行 / `sha=<...> run_id=<...> conclusion=<...>`

## 风险 / 回滚

- 已知风险：
- 回滚方式：

如果是 **Red** 动作，只在这里写清真正需要维护者确认的事项，例如：真实用户数据不可逆操作、高风险权限扩大、密钥/签名、正式 Release/Tag。

## Integration / Handoff

- target：main / next
- 依赖 PR：无 / #...
- 与其他 active Track 的 shared-file 冲突：无 / 有（说明）
- `docs/AI-TASKS.md`：不适用 / 已同步
- 后续：无 / 说明下一独立 slice（本 PR 不顺手实现）

## Checklist

- [ ] 一个 coherent slice，没有顺手扩张到下一个任务
- [ ] 没有提交密钥、用户文件、构建产物或伪造的验证结果
- [ ] 相关测试 / 文案 / 文档已按实际改动同步
- [ ] 持久化或用户文件契约变化时有向后兼容或明确回滚
- [ ] UI 改动包含相关 E2E；Rust/IPC/文件边界包含对应定向验证（适用时）
- [ ] Modernization 并行开发时，Write-set 没有未经协调覆盖其他活动 Track
