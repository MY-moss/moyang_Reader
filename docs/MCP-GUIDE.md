# MCP 与任务沉淀接口

## 0.15 资料检查与上下文预算

`library_health` / 桌面 `health` 为只读检查。输入 `project`（省略表示全部，空字符串表示仅全局）、`agent`、`kind`、`include_global`（默认 false）、`issue`（duplicate / expired / missing_source / broken_links）、`offset` 和 `limit`（默认 30，最多 100）。返回 `scanned`、各类 `counts`、当前条件下的 `total`、`checked_at` 和分页 `items`；每条含 ID、当前 revision、范围、摘要、问题类别、最多 3 条重复候选和已删除的关联 ID。不返回附件正文，也不触发索引维护。

候选不是自动清理指令。正文相同可能用途不同；先 `get_record` 查看完整来源和资源，再按原有更新、合并或归档工具整理，并保留范围和历史。旧私有 Agent 之间不合并分组，归档关联不算删除。

`recall_context` 的 `max_chars` 仍为 Unicode 字符上限（1,000–30,000），不是 token 数。现在分配条目预算、标明范围、缩短冗长来源并围绕查询保留证据；`truncated=true` 表示条目、元数据或片段有省略。返回 ID 可供按需补读。检索和模型调用次数不因排版增加；技能资源继续按需读取。

0.12.0 继续使用 stdio MCP。桌面“AI 空间 → 接入与备份”显示真实可执行文件、数据目录和客户端连接状态。`tools/list` 的 JSON Schema 是参数契约，类型定义位于 `crates/ai-core/src/types.rs` 与 `lifecycle.rs`；不要从示例猜测未列出的字段。

插件市场另可安装外部 MCP 连接，使用独立的 `moyang-ext-<扩展 ID>` 名称；预览、备份、精确合并和移除流程见 [扩展指南](EXTENSIONS.md)。这些外部服务与本应用的记忆工具分别管理，配置成功不等同于完成客户端信任或启动验证。

## 接入

程序启动参数是 `--data-dir <AI目录>`。Codex 和 Claude Code 可在接入页合并配置；先备份，再只修改 moyang-ai 和它的四个生命周期处理器。安装不会改变模型提供商或替客户端批准工具。卸载保留其他服务和钩子，同名配置被用户扩展时先提示。

通用客户端可复制页面生成的 JSON。普通笔记未显式导入时不在 MCP 可读取范围内。MCP 无需阅读器一直运行，客户端会启动同目录的服务程序。

## 工具

| 工具                    | 用途及关键参数                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| search                  | query、kind、project、agent、include_global、limit、offset、semantic；返回摘要、多片段与位置，不附全部资源 |
| get_record              | id；读取正文、当前 revision 和资源目录                                                                     |
| save_record             | 新建需 kind/title/body；更新还需 id/expected_revision；source/reason 记录依据                              |
| set_record_state        | id/expected_revision/state；active 或 archived                                                             |
| delete_record           | id/expected_revision；永久删除前优先考虑归档                                                               |
| record_history          | id、limit（默认 20，最多 50）、before_revision；返回 items 摘要与 next_before 分页游标                     |
| revision_detail         | id/revision；指定修订正文与资源目录                                                                        |
| restore_revision        | id/expected_revision/revision；恢复会形成新修订                                                            |
| merge_memories          | ids/revisions/title/body；合并记忆并保留可追溯历史                                                         |
| memory_feedback         | 对实际使用结果提供反馈，以工具 schema 为准                                                                 |
| recall_context          | 按任务、项目与 Agent 范围召回，默认限制为 8000 Unicode 字符                                                |
| read_skill_resource     | id、path，选填 revision；按需读取当前或历史资源，不执行脚本                                                |
| library_status          | 查看条目、索引与当前模型状态                                                                               |
| index_semantic          | 补齐当前模型缺失向量；已有内容向量复用                                                                     |
| task_checkpoint         | client/session/turn，选填 project/agent；重复原始轮次返回同一检查点                                        |
| conclude_task           | checkpoint_id/reason/decisions；无新信息也要用空数组完成检查点                                             |
| recent_activity         | 读取近期沉淀、冲突和未完成检查点                                                                           |
| resolve_memory_conflict | 处理推测冲突，采用整理结果、保留原文或分别保留                                                             |
| undo_memory_activity    | 撤回或恢复一次沉淀，验证目标修订未被后续改写                                                               |

新内容显式选择 sharing="global" 或 "project"。project 范围必须提供项目；agent 记录来源。旧数据的 legacy 范围保留原语义，迁移不会自动扩大共享。检索时传项目范围；不要省略范围后假定结果只来自当前项目。

历史列表只返回版本、标题、时间、原因、正文字数与资源数量。需要比较时再调用 `revision_detail`；资源清单提供 `fingerprint`，同路径、同长度的内容修改也能识别。需要旧资源正文时，把该版本号传给 `read_skill_resource`。归档、恢复和合并的响应也不会附带全部资源。`record_history` 的输出现为分页对象，客户端应使用 `items`，并将 `next_before` 传入下一页的 `before_revision`；`null` 表示结束。

## 一轮任务

1. 使用 recall_context 找相关知识和偏好，需要时再读取完整正文、技能及资源。
   命中本轮任务的置顶记忆保留相关片段，不以开头摘要替换；不会重复带入同一条目，也不增加默认字符预算。
2. 优先使用生命周期钩子提供的原始 checkpoint_id。没有钩子时，使用稳定的 client/session/turn 调用 task_checkpoint。
3. 任务结束选择有证据的事实、偏好、决定、经验。进度与重复内容不保存。
4. 调用 conclude_task。action=save 保存新结论；correct 必须明确更正并提供当前 revision；conflict 提交推测矛盾；improve_skill 必须附任务结果与证据。
5. 同一检查点已经完成时重复回调返回现有结果，不再写一次。需要继续补充新结论时使用新的真实任务轮次。

下面是新偏好的示例；checkpoint_id 必须替换为工具真实返回值：

```json
{
  "checkpoint_id": "工具返回的检查点编号",
  "reason": "用户明确说明了长期表达偏好",
  "decisions": [
    {
      "action": "save",
      "evidence": "用户说：以后请用简洁中文回答",
      "record": {
        "kind": "memory",
        "title": "回答语言与篇幅",
        "body": "默认使用简洁中文回答。",
        "memory_type": "preference",
        "sharing": "global",
        "source": "本轮用户明确说明"
      }
    }
  ]
}
```

没有长期信息时提交 `{"checkpoint_id":"实际编号","reason":"本轮只核对进度，没有新结论","decisions":[]}`。不要为了显示有记录而制造无意义记忆。

## 生命周期与恢复

SessionStart 提供约定与未完成任务；UserPromptSubmit 登记原始轮次；Stop 检查沉淀结果，最多请求一次补充；SessionEnd 保留未完成状态。补充轮次继续沿用原检查点，不能把补充提示登记为新任务导致循环。

Codex 的钩子需要客户端信任；MCP 写入也可能需要批准。Claude Code 需要可用的模型服务。应用分别显示配置、MCP 初始化、钩子运行和最近完成回执。这些状态不相互替代。通用 MCP 能调用工具，但自动结束依赖客户端生命周期支持。

Codex 可以在 `/hooks` 检查并信任应用安装的四项钩子；新钩子或定义变化后需要重新检查，这是 [Codex 的钩子信任机制](https://learn.chatgpt.com/docs/hooks)。配置写入完成不代表已经获准运行。Claude Code 的事件和执行形式依据[官方钩子说明](https://code.claude.com/docs/en/hooks)。

版本冲突时重新读取最新正文，保留本轮拟稿，比较后合并或另存；禁止原样重试覆盖。失败通过 MCP isError 返回，stdout 只用于协议。完整备份恢复与旧版本迁移见 [迁移手册](MIGRATION.md)，本机真实客户端待验收项见 [验证报告](VALIDATION-WORKBENCH.md)。
