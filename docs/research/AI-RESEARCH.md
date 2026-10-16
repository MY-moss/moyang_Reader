# AI 空间开源研究与设计取舍

2026-10-15，第一阶段正常桌面版本构建通过后开始。提交标识和候选源码路径保存在本目录 JSON。下述为独立实现的设计参考，不复制项目业务代码，也不沿用其宣传性能数字。

| 项目                                                                                        | 已核对源码/文档                                                                      | 观察与吸收                                                                                        | 本项目取舍                                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Basic Memory](https://github.com/basicmachines-co/basic-memory)                            | NOTE-FORMAT.md、sqlite_search_query.py、search_service.py；54b8d94；AGPL-3.0         | Markdown、来源和关联使知识可检查；检索把连续文字 n-gram 与词语合并排名                            | 可导出 Markdown、来源、关联；中文字符索引。使用独立 SQLite 真源，避免多进程双向文本同步                        |
| [Mem0](https://github.com/mem0ai/mem0)                                                      | memory/main.py 的 add/update/delete/history、storage.py；0724291；Apache-2.0         | 当前推断新增采用 ADD-only；显式 update 仍保存历史、更新向量和元数据。按 user/agent/run 区分上下文 | 借鉴作用范围、稳定 ID、版本和来源；外部 Agent 提炼事实，应用保存可撤回变更；不把旧版自动增删改介绍当成当前实现 |
| [MCP Memory Service](https://github.com/doobidoo/mcp-memory-service)                        | consolidation/decay.py、forgetting.py、SQLite 入口和官方 Wiki；a2e53c6；Apache-2.0   | 重要度、时间、访问与关系影响记忆；低价值内容归档可恢复                                            | 重要度、置顶、有效期、归档和反馈；不因时间衰减自动删除长期偏好，不部署云同步/OAuth/多数据库                    |
| [QMD](https://github.com/tobi/qmd)                                                          | store.ts 分块、FTS5、向量和 RRF；86d2365；MIT                                        | 分块靠近自然边界，先摘要后全文，关键词/向量排名融合                                               | 段落分块和出处；可选 Ollama 增强；默认不下载多个大模型，关键词无需外部服务                                     |
| [Agent Skills](https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx) | name/description、目录资源、渐进加载；69ef37e；根目录 Apache-2.0，文档另有目录许可证 | 先发现摘要，需要时读取 SKILL.md 和资源                                                            | 标准 SKILL.md 和 ZIP 技能包，MCP 按需读取资源；应用不自动执行脚本                                              |
| [官方 MCP Rust SDK](https://github.com/modelcontextprotocol/rust-sdk)                       | calculator/counter stdio、工具路由和 Cargo features；8d226f4；MIT OR Apache-2.0      | 官方协议协商、工具 schema 和 stdio 生命周期                                                       | rmcp 3.5.1；独立可执行文件与桌面共用内核，不手写协议，不依赖 Python/Node 运行                                  |

知识保存可引用资料；记忆保存长期事实、偏好、决策和经验；技能保存使用时机、步骤及资源。三者共享检索和来源，在 UI 分开管理，不扫描日常阅读库。长期可用性来自持续读取、纠正、反馈和整理，不是无限追加聊天后全部塞回上下文。

默认离线使用 FTS5，标题/摘要/标签加权，中文双字与单字补充索引；只在匹配候选中考虑重要度、置顶和反馈。知识分块后返回命中片段。项目/Agent 查询可包含通用记录；未指定范围表示查看所有，范围是组织机制而非访问控制。

可选语义接入 [Ollama embed](https://docs.ollama.com/api/embed)，向量按模型和内容版本缓存；修订或模型变更后重建。失败时报告并继续关键词结果。融合依据是排名，分数不表示事实可信度。

实现依据：[SQLite FTS5](https://www.sqlite.org/fts5.html)、[rmcp 发布文档](https://docs.rs/rmcp/3.5.1/rmcp/)。源码下载仅供本地研究，不参与运行、构建和发布。比较以记录的提交为准。
