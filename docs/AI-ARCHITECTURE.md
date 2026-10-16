# AI 空间架构与开发流程

## 0.17 分层、整理与资源

读取边界、队列与额度见 [ADR 0005](adr/0005-layered-context-and-organizer.md)，去重资源和原生流式备份见 [ADR 0006](adr/0006-resources-and-portable-archive.md)，统一名词见 [领域术语](AI-DOMAIN.md)。`layers / recall / patch` 提供按需读写与短期上下文回执；`organizer / organization_queue / organization_usage` 共用单任务锁与账本；`services` 复用聊天服务配置，密钥不进入 AI 数据库。

数据库当前版本为 5，升级前完整快照，新增 `derived_context`、整理队列与账本、`memory_merges` 和不可变 `resources`。当前记录、历史、冲突提议只保存资源引用；旧资源接口读时还原。原生便携备份流式写入 SQLite 快照和 ZIP，导入同 ID 的异源历史时保留本地记录并跳过不匹配的撤回关系。历史版本说明保留在下方。

AI 草稿摘要与正文 / 资源分开；聊天草稿异步逐条写入，历史按 20 条游标分页。聊天上下文在发送前验证变化标记，保留排除选择，按正文指纹去重；同一无状态 API 请求保留必要证据，不因上一轮发过而盲目省略。

## 0.16 来源核对

`source_inventory` 通过 SQLite 投影已导入知识的来源信息，以 ID 游标分页，不反序列化正文、历史、来源位置数组和资源。项目及旧 Agent 范围沿用检索规则；MCP `list_knowledge_sources` 使用不触发索引维护的只读路径。

来源更新页按用户操作读取来源，每次最多两个；停止后不再调度新来源，迟到结果被丢弃。批量结果只存轻量状态，打开比较时重新读取这一条的当前修订和最新来源，更新复用 `save` 的版本核对及历史。检查不会产生数据库修订，也不新增模型链。网页提取和文件解析复用原有导入模块。

## 0.15 资料维护与召回

`ai-core/health.rs` 在一次 SQLite 只读快照中投影当前记录的正文和元数据，不把历史和资源反序列化到内存。正文换行归一后按 SHA-256 分组，分组键还包括类型、项目、共享方式和旧私有 Agent；摘要按页返回。入口按用户操作调用，不加入轮询或模型任务，MCP 使用不触发语义维护的调用路径。原始记录不变化，归档/撤销沿用 revision 检查。

`context_pack.rs` 接收已有混合检索与置顶结果，为每条内容设定预算，标明范围并缩短来源。在长片段中选择覆盖查询词较多的窗口，不重复相同片段；短条目剩余空间留给后续内容。仍遵守全局字数上限，完整正文保留原 ID 可补读。没有新嵌入请求、重排模型或持久数据迁移。

设计规范见 AI-SPEC.md，研究依据见 research/AI-RESEARCH.md，操作流程见 AI-USER-GUIDE.md。

## 模块和边界

| 模块                        | 职责                                                           |
| --------------------------- | -------------------------------------------------------------- |
| src/application/RootApp.tsx | 顶层空间切换；两个空间保留挂载，书房草稿不因切换丢失           |
| src/features/ai             | 分类、查询、详情、编辑、合并、技能包和接入页面                 |
| src/platform/ai-bridge.ts   | 桌面调用适配；浏览器预览单独按需加载                           |
| src-tauri/src/ai.rs         | 解析应用目录，将耗时内核调用放到阻塞线程                       |
| crates/ai-core              | 数据模型、事务、FTS5、上下文、备份、语义索引；无 Tauri/UI 依赖 |
| crates/ai-mcp               | 官方 rmcp 协议适配、工具描述、stdio；不依赖 Node/Python        |

根 Cargo 工作区包含两个 AI crate；src-tauri 保留独立锁文件和构建链。桌面与 MCP 使用同一内核。路径默认使用独立应用数据目录；MOYANG_AI_DATA_DIR 可供测试隔离，MCP 则必须明确传入 --data-dir。

## 数据及生命周期

SQLite user_version=2（v1 升级前自动完整快照）：records 保存当前版本及索引字段，revisions 保存不可变快照和原因；chunks/chunks_fts 保存正文片段和词索引；embeddings 保存按模型指纹区分的向量；feedback 保存有用度；settings 保存语义设置及本机连接状态；checkpoints、conflicts、activities 保存原任务、待处理矛盾与可撤回的沉淀依据。

WAL、8 秒 busy_timeout、写事务保证多个客户端共用数据。保存需要当前 revision，避免最后写入者覆盖他人的新内容。新增记录按类别、共享范围、正文和资源的指纹去重；legacy 范围保留 Agent 限制，全局和项目共享中的 Agent 表示来源，已过期记录不会阻止重新记住同一内容。合并写入新记录、归档原记录在同一事务完成。

历史恢复创建新的版本，不倒退 revision。永久删除按外键移除历史、分块、向量和反馈；其他条目中留下的来源编号不被篡改，读取已删编号会明确报告不存在。

## 召回与性能

保存时按自然换行附近切分正文，目标 1400 字符、120 字符重叠，按 Unicode 字符处理。FTS5 对标题加权，英文按词，连续中日韩文字按双字与单字建立索引；查询中的多字短语使用双字，避免仅凭常见单字命中。

普通检索在数据库中筛选、计数和分页，避免只展示列表前几个条目。相关候选结合重要度、置顶和有用度调整排序。recall_context 最多带入四条符合范围的置顶记忆，再加入任务相关片段，默认 8000 Unicode 字符；技能仅放摘要。字符预算不是模型 token 数。

置顶记忆若也命中当前任务，复用本轮检索得到的相关片段，不能用通用的开头摘要替代。未命中任务的置顶偏好仍使用简短开头；同一条目只进入上下文一次。这不增加查询、模型调用或字符预算。

可选 Ollama 向量逐批生成，不在事务内等待网络。写入向量时复核分块和正文版本，避免并发编辑使旧向量污染新内容。余弦相似度与词覆盖率、具有区分度的标题词加权融合，避免弱词的排名抹平语义距离。多片段携带来源指纹、页码或段落；查询缓存按模型和正文规则区分，可取消进行中的嵌入请求。服务失败保留关键词召回，页面显示具体原因；模型变更后旧向量不参与召回。

前端按空间懒加载；AI 内容列表每页 30 条。桌面界面在激活时和定期刷新数据，编辑草稿独立保留。浏览器预览的简化检索不被当作原生 SQLite 检索验证依据。

## MCP 契约

search、get_record、save_record、set_record_state、delete_record、record_history、restore_revision、merge_memories、memory_feedback、recall_context、read_skill_resource、library_status、index_semantic，以及 task_checkpoint、conclude_task、recent_activity、resolve_memory_conflict、undo_memory_activity、revision_detail。

工具由 JsonSchema 类型生成输入结构。失败通过 isError 返回；stdout 仅传协议消息。工具发现包含行为提示。get_record 返回正文与资源清单，read_skill_resource 返回单个资源；save_record 返回简洁回执，更新时省略资源会保留已有资源。删除全部资源可在界面编辑完成。技能内容作为引用信息交由客户端使用，服务不执行脚本。

## 修改流程与检查

1. 改数据结构时先定义迁移和旧备份行为，保留旧 ID、历史、资源和原 Agent 范围。
2. 内核改动运行 npm run test:ai，包含官方 MCP 客户端的真实子进程测试。
3. UI/导入导出改动运行相关单元测试和 e2e/ai-space.spec.ts；同时检查浅深色与紧凑布局。
4. 原生桥接运行原桌面后端测试与真实桌面 E2E。测试使用 com.moyang.reader.next.tests 应用标识及独立临时 AI 数据目录，不清空正常桌面的设置、草稿或 AI 库。
5. npm run desktop 与正常桌面构建会自动构建 MCP 同伴程序；可单独运行 npm run build:mcp。
6. 桌面测试构建和生产前端构建顺序执行，避免覆盖 dist。交付必须重新生成不含 WDIO 的正常桌面版本，并把 MCP exe 放在同目录。

必要检查：npm run check；npm run test:ai；npm run test:e2e；npm run rust -- test --manifest-path src-tauri/Cargo.toml --lib；npm run test:e2e:desktop。最终结果统一记录在 VALIDATION.md。

## 新增领域与接口

任务、来源、记忆更正和技能改进定义见 [ADR 0003](adr/0003-ai-memory-checkpoints.md)。配置合并、原轮次、一次补充和信任回执见 [ADR 0004](adr/0004-client-lifecycle.md)。`--request OPERATION` 以 stdin JSON 调用内核；`--hook codex|claude` 读取客户端事件。stdout 只写结果或协议，诊断写 stderr。

正文与资源的草稿分开存入 IndexedDB，避免每次键入重复写入大资源；每个文档可单独恢复。编辑器关闭/手动保存时先同步尚未发出的编辑内容。原子 revision 检查失败时保留草稿，提供原文/最新/本地比较、合并和另存。

内核复用正文未变化的 chunk ID 和向量，标题、标签变化只更新词索引。后台任务只启动已配置的本地模型，补齐缺失向量，不另行下载模型或替换用户选择。数据库旁固定的操作系统文件锁协调桌面及多个 MCP 进程，一批缺失向量只计算一次；进程退出自动释放锁。暂停状态共用并持久保存，当前批结束后停止，显式继续才恢复。当前检索范围尚有缺失向量时，保留完整词法结果与分页，提示索引未就绪；该范围就绪后恢复语义补充，其他项目的待索引内容不影响本项目。

历史列表使用版本游标分页，只查询摘要字段；展开某个版本才加载正文及资源清单，展开某个资源才加载该资源的历史字节。MCP get_record/revision_detail 返回资源指纹清单，归档和恢复也不返回资源正文；read_skill_resource 支持可选 revision。指纹由编码标识、零分隔符和已存内容的 SHA-256 组成，既区分编码变化，也检测同长度内容变化。

AI 完整 JSON 备份版本 2 包括记录、历史、资源、学习反馈、任务、活动、冲突和可迁移设置；导入兼容版本 1。可选的 `feedback` 数组保存每条记录的 `id`、`score` 与 `uses`，旧备份缺省为空；反馈与新导入记录在同一事务内恢复，已有记录的反馈不变。全文索引和向量可由正文重建。安装所有权和连接回执不会从其他机器导入。SQLite 日/周快照保留 7 个日版本、4 个周版本，重大迁移快照另存。
