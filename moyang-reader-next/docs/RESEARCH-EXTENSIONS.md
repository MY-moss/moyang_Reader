# 扩展机制研究与取舍

研究日期：2026-10-16。此文是实现依据，完成情况以本轮检查单和验证结果为准。

| 来源                                                                                                                                 | 学习的能力                        | 本项目采用方式                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------- |
| [Obsidian Manifest](https://docs.obsidian.md/Reference/Manifest) 与 [官方示例](https://github.com/obsidianmd/obsidian-sample-plugin) | 稳定 ID、版本、最低应用版本和作者 | 包清单明确类型、版本与兼容性；同一 ID 更新，不按显示名称覆盖              |
| [VS Code 激活事件](https://code.visualstudio.com/api/references/activation-events)                                                   | 用户调用时才激活                  | 阅读命令按需创建 Worker，执行结束释放；不会随启动执行所有插件             |
| [Agent Skills](https://agentskills.io/specification)                                                                                 | SKILL.md 与独立参考资料、资源     | 安装技能到既有 AI 技能库，正文与资源沿用按需读取，不制造第二套技能存储    |
| [MCP Registry API](https://raw.githubusercontent.com/modelcontextprotocol/registry/main/docs/reference/api/generic-registry-api.md)  | 名称/版本身份、分页发现与标准目录 | 自定义目录与通用 MCP 配置保留来源、版本和传输方式，配置完成与实际连接分开 |

## 取舍

Obsidian 插件依赖其专用 API，不能仅复制文件便宣布兼容。Moyang 提供明确的小型阅读命令协议，输入为用户当前文档快照，输出为建议修改或阅读报告。采用 Worker 避免耗时命令阻塞编辑界面；修改经应用原有会话校验和撤销保存，插件不直接写笔记文件。

主题使用限定的颜色令牌，随应用明暗模式切换，不允许主题把导航按钮或恢复入口隐藏。下载、安装记录和回退通过平台层持久化，离线安装不依赖在线账号或市场服务。

技能更新面对本地改进时保留双方，使用既有 AI 版本/来源机制。MCP 配置仅在用户选定客户端后写入并备份；客户端仍自行确认信任与启动，不放宽 Codex/Claude 的权限。

已有 TencentDB-Agent-Memory、OpenViking、QMD、Graphiti 等记忆/检索研究见 `RESEARCH-AGENT-MEMORY-2026-10.md`；本轮继续沿用来源、版本和任务检查点，不额外引入服务链或独立总结模型。
