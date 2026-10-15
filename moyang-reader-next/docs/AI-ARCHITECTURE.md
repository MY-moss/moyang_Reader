# AI 空间架构与开发流程

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

内核复用正文未变化的 chunk ID 和向量，标题、标签变化只更新词索引。后台任务只启动已配置的本地模型，补齐缺失向量，不另行下载模型或替换用户选择。技能 get_record/history/revision_detail 返回资源清单，资源字节通过 read_skill_resource 单独读取。

AI 完整 JSON 备份版本 2 包括记录、历史、资源、任务、活动、冲突和可迁移设置；导入兼容版本 1。安装所有权和连接回执不会从其他机器导入。SQLite 日/周快照保留 7 个日版本、4 个周版本，重大迁移快照另存。
