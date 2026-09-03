# Moyang Reader 唯一下一步

> 此文件由 `npm run ai:render` 从 `docs/ai/plan-v1.json` 与 `docs/ai/state.json` 生成，禁止手工修改。

- 计划：moyang-v1
- 任务：G03
- 状态：AWAITING_APPROVAL
- 风险：T0 / 治理
- Issue：无
- 自动交付：禁止，必须人工确认

## 目标

配置独立 AI bot、CODEOWNERS 与治理文件审批，并完成两个探针 PR。

## 用户价值

在仓库外部形成 AI 不能自行放宽的权限边界。

## 非目标

- 不把仓库所有者凭据交给 AI
- 探针通过前不启用自动合并

## 验收标准

- 普通 T1 探针可零审批自动合并
- 治理文件探针必须由代码所有者批准

## 验证

- `manual: ordinary T1 probe`
- `manual: protected governance probe`

## 允许修改范围

- `.github/`
- `docs/ai/approvals/`
- `docs/ai/state.json`
- `docs/NEXT.md`

## 风险与回滚

关闭自动合并并恢复原分支保护；保留 Quality checks。

## 阻塞/确认点

- 原因：需要仓库所有者配置独立 AI bot、治理文件 Code Owner 审批，并完成两个探针 PR。
- 下一动作：人工审查并合并治理切片；完成 G03 设置和探针后，合入与 G03 任务摘要绑定的审批凭证。

完成当前任务后只能推进到计划中的下一项；不得增加、跳过或重排任务。
