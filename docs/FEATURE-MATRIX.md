# 本轮能力与验收索引

0.15.2 修复 Windows 同一数据目录路径写法不同造成的客户端连接状态误报；本轮实际个人库、正式桌面与 MCP 读写、备份恢复和客户端边界见 [实测报告](VALIDATION-LIVE-AI.md)。

0.15.1 修复快速新建/切换对话时后续输入可能写入旧草稿的问题，补齐切换状态、失败恢复与关闭等待。见 [聊天修补验证](VALIDATION-CHAT-DRAFT-TRANSITION.md)。

0.15 增加 AI 资料检查：按项目、类型和 Agent 查看相同正文、到期、未填写来源与已删除关联；支持查看、归档和撤销，MCP 提供同一只读接口。召回在固定字数预算内分配多条证据，保留范围提示，缩短冗长来源。实现和验收见 [任务清单](../tasks/memory-maintenance.md) 与 [验证报告](VALIDATION-MEMORY-MAINTENANCE.md)。

0.14 新增待办提取、链接清单、表格导出、文档体检四个离线插件，论证审阅和复习教练两个聊天助手，以及来源核对技能；市场安装后可直接运行，阅读页更多操作也可访问。结果支持来源定位、复制、报告与文件导出。见 [扩展指南](EXTENSIONS.md) 和 [本轮验证](VALIDATION-PRACTICAL-EXTENSIONS.md)。

0.13 增加可选聊天助手、自己的多 API 配置与模型切换、流式会话、项目范围召回和明确的文档附件；更新功能接入独立签名通道，提供可选自动下载与保存后切换。见 [聊天指南](CHAT-EXTENSIONS.md)、[更新与恢复](ONLINE-UPDATES.md)。这些新增能力的最终验证结果以本轮报告为准。

0.12 新增统一扩展市场（阅读插件、主题、Agent Skills、MCP）、本地/远程目录、版本回退及配置精确合并，修复全局页面导航。新增范围、实现边界与实际验证见 [深度复查报告](VALIDATION-EXTENSIONS.md)、[扩展指南](EXTENSIONS.md) 和 [检查单](../tasks/extensions-and-audit.md)。Canvas/Dataview 属于原工程远期愿望，不列为本轮已实现；真实客户端自动沉淀仍按用户要求暂缓。

0.11.0 新工作台、固定双窗格、共享文档会话、多格式搜索与 PDF 定位、摘录收藏、链接维护和恢复中心已实现；AI 独立快照、任务检查点、记忆冲突、技能版本与资源、客户端配置与钩子已实现。逐项状态以 [本轮检查单](../tasks/workbench-upgrade.md) 和 [完成度复查报告](VALIDATION-COMPLETION-AUDIT.md) 为准。客户端信任和模型服务未验证完成前，不将真实 Agent 自动沉淀标为通过。

以下保留基线能力映射，阅读方式以本轮选择为准。

# 功能保留与验收矩阵

“保留”表示源代码迁移并保留入口，不自动等于所有系统环境都完成实机验证。实际结果见 [验证报告](VALIDATION.md)。

| 用户能力                           | 重构处理         | 主要模块                              | 验收场景                                             |
| ---------------------------------- | ---------------- | ------------------------------------- | ---------------------------------------------------- |
| Markdown/GFM/公式/安全 HTML        | 保留             | documents/rendering                   | 表格、公式、链接正常；脚本和危险资源被清洗           |
| TXT/TEXT/LOG                       | 保留，纯文本编辑 | documents、reader-mode                | 换行保留；默认纯文本编辑                             |
| DOCX                               | 保留             | document-adapters                     | 标题、段落、表格和图片转换                           |
| PDF、图片                          | 保留             | reader/components、commands/pdf       | 二进制预览；资源释放；Windows PDF 导出               |
| 文件/文件夹打开、拖放、多标签      | 保留             | useOpenEvents、useDocumentTabs        | 多文件、同名文件、标签切换与未保存确认               |
| 默认阅读                           | 改变             | reader-mode                           | Markdown 直接编辑；复杂结构回退源码；Ctrl+E 切换阅读 |
| 阅读库、多库切换                   | 保留             | workspace、useWorkspaceSession        | 挂载、切换、恢复、文件树与筛选状态                   |
| 文件新建/重命名/复制/删除/定位     | 保留             | useWorkspaceActions、commands/entries | 路径授权、非法名称与越界操作被拒绝                   |
| 全文搜索和快速打开                 | 保留             | workspace、commands/search            | 中文/英文搜索、缓存失效、Ctrl+P 选中打开             |
| 双链、嵌入、标签、反向链接、关系图 | 保留             | rendering、workspace、commands/index  | 同目录解析、章节跳转、未解析链接创建                 |
| 所见即所得与源文本                 | 保留             | editor                                | 往返语义、危险结构回退、撤销重做、选区               |
| 斜杠命令、双链补全、粘贴图片       | 保留             | editor                                | Markdown 插入、候选过滤、大小限制                    |
| 保存、外部修改冲突                 | 保留             | recovery、commands/files              | 原子写入；未确认不能覆盖外部修改                     |
| 草稿恢复                           | 保留             | recovery                              | 恢复/稍后/丢弃；关闭前提示                           |
| HTML/DOCX/PDF、批量导出            | 保留             | export、useWorkspaceExport            | 图片内联、跳过原因、取消、分卷                       |
| 阅读位置、缩放、栏宽、专注         | 保留             | reader、settings                      | 重开恢复、范围钳制、Esc 退出、键盘调整               |
| 主题、语言、设置迁移               | 保留             | settings、platform/storage            | 本机持久化、导入校验、浅深色可读                     |
| 自动更新                           | 独立签名便携通道 | platform/updater、online_update       | 检查、下载、保存后切换、失败回退                     |
| 原安装版文件关联                   | 开发版暂不注册   | Tauri 配置                            | 原版默认打开方式不被开发版抢占                       |

## 质量验收重点

1. 编辑中切换文档保留逐文档草稿与保存队列；有冲突时提供比较、合并和另存。
2. 文件被外部修改时不静默覆盖本地草稿。
3. 工作区读写不能逃离授权路径，符号链接和新文件路径也受约束。
4. 新工程所有运行时相对导入都留在 `src/` 内，不能引用父工程实现。
5. 欢迎页、阅读页、设置页和必要对话框在浅色/深色和紧凑窗口中可操作，键盘焦点可见。
6. 浏览器测试只证明 Web 侧行为，桌面读写由 Rust/桌面测试分别证明。
