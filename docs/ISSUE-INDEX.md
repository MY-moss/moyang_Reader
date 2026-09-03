# Issue 治理索引

> 快照：2026-09-03。实时 GitHub 状态优先；本文件不授权执行，当前任务运行 `npm run ai:context` 获取。

## 开放 Issue

| Issue                                                       | 分类              | 状态/处理                                                      |
| ----------------------------------------------------------- | ----------------- | -------------------------------------------------------------- |
| [#241](https://github.com/MY-moss/moyang_Reader/issues/241) | Must / 发布       | 外部条件项：静态镜像 Secrets 与旧版本 Windows 更新环境         |
| [#51](https://github.com/MY-moss/moyang_Reader/issues/51)   | Must / 发布安全   | 外部条件项：Authenticode 证书；手动 SemVer 校验已完成          |
| [#227](https://github.com/MY-moss/moyang_Reader/issues/227) | Should / 安全文档 | Private Vulnerability Reporting 未启用；等待维护者确认私密渠道 |
| [#194](https://github.com/MY-moss/moyang_Reader/issues/194) | Should / 工程     | 下一候选：共享前端单向路径包含谓词并迁移重复实现               |
| [#171](https://github.com/MY-moss/moyang_Reader/issues/171) | Should / 视觉维护 | 多批令牌治理已完成；剩余范围需重新量化                         |
| [#16](https://github.com/MY-moss/moyang_Reader/issues/16)   | Should / 重构     | 依状态/服务边界渐进拆分，不追求一次减行数                      |
| [#111](https://github.com/MY-moss/moyang_Reader/issues/111) | Could / i18n      | 核心稳定且 #194 契约明确后再分批                               |
| [#373](https://github.com/MY-moss/moyang_Reader/issues/373) | Tracking          | 历史审计跟踪；不单独实现                                       |

审计时开放 PR 共 6 个，均为 Dependabot；没有产品功能 PR。Issue [#112](https://github.com/MY-moss/moyang_Reader/issues/112) 已由 PR [#443](https://github.com/MY-moss/moyang_Reader/pull/443) 完成并关闭，不得继续作为 Ready 任务。

## 状态规则

- `READY`：目标、非目标、验收、风险、回滚和验证级别齐全，且无重复 PR/外部阻塞。
- `候选`：值得做，但开始前仍需 Discovery 和实时核验。
- `条件项`：缺真实环境、凭据或证书；条件不足时不反复尝试。
- `Tracking`：仅汇总历史，不创建实现分支。

## 维护方式

1. 任务选择时用 `gh issue list` / `gh pr list` 刷新本表。
2. 已关闭 Issue 从开放表删除；历史由 GitHub、CHANGELOG 和 `docs/handoff/` 保存。
3. 选定任务由维护者写入受保护的 `ai/plan-v1.json`；运行状态只写入 `ai/state.json`，本表不记录当前分支、SHA、CI 等短期状态。
4. 新规划先进入 [`ROADMAP.md`](ROADMAP.md)；具备独立验收后再创建 Issue。
