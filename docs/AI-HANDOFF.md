# Moyang Reader 当前交接摘要

本文件只记录稳定事实和外部阻塞。执行任务运行 `npm run ai:context`；发布资产只看 [`release-status.json`](release-status.json)；历史从 [`handoff/`](handoff/) 或 Git/Release 查询。

## 稳定基线（核验于 2026-09-03）

- 审计时主线：`2a90448a065c2f5e98792106c93df2a3752bd79d`。
- 最新稳定版本：`v0.10.14`，Windows x64 Release、安装包、Tauri updater 签名和 `latest.json` 已发布。
- 产品边界：Windows x64、本地优先、Markdown 真源；浏览器版仅用于开发与 UI 测试。
- 最近完成：PR [#442](https://github.com/MY-moss/moyang_Reader/pull/442) 已合并构建缓存预算提示；PR [#443](https://github.com/MY-moss/moyang_Reader/pull/443) 已完成更新与 opener 文档收口并关闭 Issue [#112](https://github.com/MY-moss/moyang_Reader/issues/112)。

## 外部阻塞

- [#227](https://github.com/MY-moss/moyang_Reader/issues/227)：GitHub Private Vulnerability Reporting 经 API 核验为未启用。启用前不能声称仓库已有可用私密报告入口，也不要用公开 Issue 代替。
- [#241](https://github.com/MY-moss/moyang_Reader/issues/241)：公开镜像可用，但 Cloudflare 静态上传仍依赖仓库 Secrets；旧版本更新只在具备真实旧安装环境时复验。不得把代理可用写成静态工作流全绿。
- [#51](https://github.com/MY-moss/moyang_Reader/issues/51)：Tauri updater 的 `.sig` 不等于 NSIS Authenticode。当前缺少代码签名证书，只能记录限制和哈希核验方式。
- 精确状态、证据、资产名与哈希见 `release-status.json`；不要从历史交接复制旧版本数据。

## 开放工作概况

- 审计时共有 8 个开放 Issue：4 个可执行/候选项、3 个外部条件项、1 个历史跟踪项。
- 开放 PR 均为 Dependabot 依赖更新，没有产品功能 PR。
- 执行权限、批准队列和运行状态分别由 `ai/policy.json`、`ai/plan-v1.json` 与 `ai/state.json` 管理；[`NEXT.md`](NEXT.md) 仅为生成摘要。
- G03 外部 GitHub App、Code Owner 探针和强制身份隔离已取消；G01/G02 控制面保留，M1101 不再依赖 G03。取消原因与状态迁移以结构化计划和 ADR 0013 为准。

## 本地工作区提示

仓库根目录可能停留在旧分支并含用户未提交改动。任何新切片都先运行 `git status`；不要覆盖根目录，优先从最新 `origin/main` 建立 `.codex-worktrees/` 独立工作树。

## 维护规则

- 本文件控制在 100 行内；只保留一个稳定基线、外部阻塞和最近一次结果。
- 完成记录进入当前版本 `docs/handoff/`、CHANGELOG、Issue 或 PR，不在这里累计流水账。
- 不在此处复制当前任务、候选任务验收、固定“下一步”或完整 CI 日志。
