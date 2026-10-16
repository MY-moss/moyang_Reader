# TencentDB Agent Memory 与 OpenViking 补充研究

2026-10-15 用户追加指定项目。本记录依据当前仓库文档和源文件，作为 AI 阶段的设计输入；不代表本项目已经实现或通过这些能力的验收。阅读器验收先行的顺序不变。

## 研究快照

- TencentDB-Agent-Memory：默认分支 `feat/server_team`，提交 `e9a82935b52741e0c798c75326e90b7144eb4d5f`。
- OpenViking：默认分支 `main`，提交 `84cc2b412a7ef9e89ba52f58bb90a53f284b0499`。
- 查阅日期如上；后续如采纳具体接口，以锁定版本的源文件和本机客户端实测为准。

## 采用与调整

| 观察                                                                                   | Moyang 的落地方式                                                                         | 验收                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Tencent 将对话记忆、技能和知识组织成可追溯、可复用的内容；技能包含版本、资源和适用边界 | AI 条目统一显示来源、范围、历史和使用记录；技能保留触发条件、步骤、验证与附件             | 一次任务产生技能改进后能看到依据、差异并恢复        |
| Tencent 去重先检索候选，再批量判断新增、更新、合并或跳过                               | MCP 返回同范围候选，由当前 Agent 判断；明确更正替代，推测冲突待处理；精确重复在存储层消除 | 重复回调不重复写入，跨项目候选不误合并              |
| Tencent 将读取注入与写入沉淀分别控制                                                   | 连接页区分 MCP 可读写、自动沉淀是否启用和最近成功记录                                     | 关闭自动沉淀仍可主动查询；配置错误不能显示为就绪    |
| OpenViking 用目录摘要、概览和正文逐层提供上下文                                        | 列表和召回返回简要说明、证据片段及资源目录；正文和附件按需读取                            | 技能有大附件时，普通检索不会传输附件正文            |
| OpenViking 检查点绑定原始轮次和来源消息，并区分累计与旧增量记录                        | 本地检查点绑定客户端、会话、原始轮次；记录待处理、完成、无新增内容；接入钩子最多补充一次  | Stop 重复触发、退出中断和恢复均不会循环或漏报待处理 |
| OpenViking 的 Codex 接入区分 MCP、钩子信任、启动/结束与恢复                            | 分别验证 MCP 调用和真实钩子收据；不自动跳过客户端信任                                     | 显示“等待客户端信任”时不能冒充自动沉淀就绪          |

Tencent 的层级中 L0 指原始会话；OpenViking 的 L0 指精简摘要。两者编号含义不同，本项目界面使用“摘要、正文、来源、历史”等明确名称，避免混用。

本项目保留个人使用的范围：采用设计思想，在现有 Rust / SQLite / MCP 上独立实现。不引入团队角色、云数据库、全量代码关系图、模型代理或额外总结/重排服务。总结、纠正与技能改写由正在执行任务的 Agent 完成；本地模型负责嵌入。普通笔记仍需显式导入才能进入 AI 库。

## 需要针对本项目验证的差异

1. 上游的效果数据和部署能力不能当成本产品结果；仍执行自己的 80 条中文检索评测。
2. 原方案限定项目范围，不能照搬跨项目宽泛召回默认值；迁移也不能扩大旧条目范围。
3. 去重或模型判断失败时保留候选和待处理原因，不静默制造多条彼此矛盾的“确定规则”。
4. 上游自动采集全会话与本项目“只沉淀有价值结论”的约定不同；这里保存来源引用和必要证据，不机械存储所有闲聊与工具日志。
5. 按需加载不得隐藏来源过期状态；更新快照仍需检查差异后采用。

## 查阅来源

- [Tencent 项目说明](https://github.com/TencentCloud/TencentDB-Agent-Memory/tree/e9a82935b52741e0c798c75326e90b7144eb4d5f)：内容分类、分层与部署组成。
- [Tencent 候选去重实现](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/e9a82935b52741e0c798c75326e90b7144eb4d5f/MemoryCore/src/core/record/l1-dedup.ts)：候选检索、批量判断与失败行为。
- [Tencent 沉淀开关](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/e9a82935b52741e0c798c75326e90b7144eb4d5f/MemoryProxy/src/extraction-gate.ts)：读写能力的独立控制。
- [OpenViking 上下文分层](https://github.com/volcengine/OpenViking/blob/84cc2b412a7ef9e89ba52f58bb90a53f284b0499/docs/zh/concepts/03-context-layers.md)：目录摘要、概览、正文与新鲜度。
- [OpenViking 检查点实现](https://github.com/volcengine/OpenViking/blob/84cc2b412a7ef9e89ba52f58bb90a53f284b0499/openviking/session/checkpoints.py)：轮次锚点、来源与累计检查点。
- [OpenViking Codex 接入说明](https://github.com/volcengine/OpenViking/blob/84cc2b412a7ef9e89ba52f58bb90a53f284b0499/examples/codex-memory-plugin/README.md)：生命周期、信任状态与项目识别。

本次仅研究设计，没有复制上述仓库源码。若未来直接复用代码或打包分发上游组件，须另行核对对应文件的许可证与分发要求。
