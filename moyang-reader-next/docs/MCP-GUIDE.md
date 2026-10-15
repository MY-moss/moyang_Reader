# MCP 与任务沉淀接口

0.11.0 使用 stdio MCP。桌面“AI 空间 → 接入与备份”显示真实可执行文件、数据目录和客户端连接状态。`tools/list` 的 JSON Schema 是参数契约，类型定义位于 `crates/ai-core/src/types.rs` 与 `lifecycle.rs`；不要从示例猜测未列出的字段。

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
| record_history          | id；修订清单                                                                                               |
| revision_detail         | id/revision；指定修订正文与资源目录                                                                        |
| restore_revision        | id/expected_revision/revision；恢复会形成新修订                                                            |
| merge_memories          | ids/revisions/title/body；合并记忆并保留可追溯历史                                                         |
| memory_feedback         | 对实际使用结果提供反馈，以工具 schema 为准                                                                 |
| recall_context          | 按任务、项目与 Agent 范围召回，默认限制为 8000 Unicode 字符                                                |
| read_skill_resource     | 按条目和资源路径读取单个资源，不执行脚本                                                                   |
| library_status          | 查看条目、索引与当前模型状态                                                                               |
| index_semantic          | 补齐当前模型缺失向量；已有内容向量复用                                                                     |
| task_checkpoint         | client/session/turn，选填 project/agent；重复原始轮次返回同一检查点                                        |
| conclude_task           | checkpoint_id/reason/decisions；无新信息也要用空数组完成检查点                                             |
| recent_activity         | 读取近期沉淀、冲突和未完成检查点                                                                           |
| resolve_memory_conflict | 处理推测冲突，采用整理结果、保留原文或分别保留                                                             |
| undo_memory_activity    | 撤回或恢复一次沉淀，验证目标修订未被后续改写                                                               |

新内容显式选择 sharing="global" 或 "project"。project 范围必须提供项目；agent 记录来源。旧数据的 legacy 范围保留原语义，迁移不会自动扩大共享。检索时传项目范围；不要省略范围后假定结果只来自当前项目。

## 一轮任务

1. 使用 recall_context 找相关知识和偏好，需要时再读取完整正文、技能及资源。
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

版本冲突时重新读取最新正文，保留本轮拟稿，比较后合并或另存；禁止原样重试覆盖。失败通过 MCP isError 返回，stdout 只用于协议。完整备份恢复与旧版本迁移见 [迁移手册](MIGRATION.md)，本机真实客户端待验收项见 [验证报告](VALIDATION-WORKBENCH.md)。
