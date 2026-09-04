# 人工审批凭证

治理任务和 T3 任务必须在本目录提交一个与任务内容摘要绑定的审批凭证，并由 Code Owner 审批合并。运行 `node scripts/ai-state.mjs approval-template --task=<id>` 生成候选内容。

G03 已按 ADR 0013 取消，不应为它创建审批凭证；后续仅对仍在计划中的治理任务或 T3 任务使用本目录。

凭证合入 `main` 后，`npm run ai:start` 才允许对应任务进入实施。AI 不得把当前分支上尚未由 Code Owner 合并的凭证视为有效授权。
