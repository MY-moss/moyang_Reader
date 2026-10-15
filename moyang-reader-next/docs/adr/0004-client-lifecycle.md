# ADR 0004：客户端生命周期与配置所有权

状态：已实施，真实客户端结果见最终验证记录。

## 决定

MCP 可执行程序同时提供 stdin JSON 钩子入口，无需额外安装 Node 或 Python。Codex 使用 `commandWindows` 调用经过固定编码的 PowerShell 命令；Claude Code 使用直接执行形式的 `command` 和 `args`，路径不经过 shell 拆分。

SessionStart 带入简短的知识库约定和最多五个本会话待处理检查点。UserPromptSubmit 使用 Codex 的 turn_id 或 Claude Code 的 prompt_id 记录原始轮次。旧客户端缺少编号时，以会话、转录文件长度和提示摘要作为兼容锚点；不复制聊天全文。

Stop 只检查检查点是否完成。未完成且尚未补充时，以事务领取一次补充机会；新的 Codex 补充提示仍关联原检查点。重复回调、stop_hook_active 或已完成的检查点均不再次要求继续。中断和退出不制造虚假的结论，未完成任务留待下次恢复。

Agent 使用已有模型判断是否值得记忆；没有新结论可以明确完成空决策。应用不会另起总结模型，也不会从日常笔记中隐式提取。

## 配置与状态

安装前读取并解析原配置，精确合并名为 moyang-ai 的服务和本应用四项钩子。已有服务、钩子、注释及其他配置保留。文件旁创建带 UUID 的备份，再以同目录临时文件提交；提交前核对原内容，避免覆盖客户端同时写入的配置。

所有权清单只记录本应用写入的定义。卸载移除完全匹配的钩子和服务；用户后来增补的字段需要先检查，不能删除整个客户端配置。导入 AI 数据备份不会把另一台机器的安装所有权或连接回执当成本机状态。

配置状态、MCP 初始化回执、钩子运行回执、成功沉淀回执分别记录。Codex 的钩子信任必须在客户端 `/hooks` 中完成，本应用不伪造信任记录或使用跳过信任参数。

## 参考

- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)：信任、Windows 命令、原始 turn_id、Stop 补充回合。
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)：prompt_id、直接执行参数、Stop 状态。
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)：用户范围配置、服务合并与优先级。

协议已按本机 Codex 与 Claude Code 版本检查。通用 MCP 客户端具备读写与任务检查点能力，自动结束处理仍依赖客户端提供生命周期钩子。
