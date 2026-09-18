# C01 — 设置 / IPC / 快捷键兼容矩阵

日期：2026-09-19

## 结论

C01 冻结 v1.0 前需要保持稳定的用户可观察标识和主要保存行为。本次只集中已有标识、补契约测试和交接矩阵，不改变 IPC 运行时协议、持久化数据含义、Rust command 行为或版本号。

## 设置与持久化格式

| 范围 | 稳定标识 | 当前版本 | 兼容规则 |
| --- | --- | ---: | --- |
| 应用设置快照 | `moyang-reader-app-settings` / format `moyang-reader-app-settings` | 1 | 版本或 format 不匹配时丢弃快照，回退到本地旧 key 与默认值 |
| 便携设置备份 | format `moyang-reader-settings` | 2 | 接受 v1/v2；v1 没有阅读位置和书签，v2 保留并归一化它们 |
| 阅读偏好 | `moyang-reader-preferences` | — | 字段逐项校验，未知或损坏字段使用安全默认值 |
| 主题/语言 | `moyang-reader-theme` / `moyang-reader-locale` | — | 仅接受已支持枚举，其他值回退 `system` / `zh-CN` |

所有浏览器持久化 key 集中在 `src/app/compatibility-contract.ts` 的 `PERSISTED_STORAGE_KEYS`；旧应用设置 key 的升级探测集中在 `LEGACY_APP_SETTINGS_KEYS`。key 本身不因重构改名。

## IPC 命令

`src/app/ipc-contract.ts` 的 `IPC_COMMANDS` 是 TS 侧唯一命令名来源，`src/app/ipc-contract.test.ts` 固定完整名称集合、唯一性和未知名称拒绝。当前命令按用途分组如下：

- 启动与选择：`initial_paths`、`resolve_open_paths`、`choose_document_paths`、`choose_image_paths`、`choose_workspace_path`、`authorize_stored_path`、`choose_save_path`、`close_window`
- 设置与批注：`read_app_settings`、`write_app_settings`、`read_annotations`、`write_annotations`
- 文件读写：`read_text_file`、`read_previous_version`、`read_binary_file`、`path_exists`、`file_size`、`file_metadata`、`write_text_file`、`write_binary_file`、`write_binary_file_chunk`、`write_binary_file_raw`、`write_binary_file_chunk_raw`、`commit_binary_file`、`discard_binary_file`、`export_pdf_file`
- 工作区生命周期：`watch_workspace`、`unwatch_workspace`、`list_workspace_files`、`list_workspace_entries`、`list_workspace_directories`、`search_workspace`、`index_workspace`、`refresh_workspace`
- 工作区文件操作：`create_markdown_file`、`create_workspace_note`、`create_workspace_folder`、`rename_workspace_entry`、`delete_workspace_entry`、`duplicate_workspace_entry`、`copy_workspace_entry`、`move_workspace_entry`、`reveal_workspace_entry`

本次不修改上述命令名、参数类型、返回类型或 Rust 注册顺序。

## 命令 ID 与核心快捷键

`READER_COMMAND_IDS` 和 `CORE_SHORTCUTS` 位于 `src/app/compatibility-contract.ts`，命令面板和全局键盘入口都复用这些值。

| 动作 | 命令 ID | 快捷键 |
| --- | --- | --- |
| 打开文档 | `open` | Ctrl+O |
| 添加阅读库 | `workspace` | Ctrl+Shift+O |
| 快速打开文件 | `quick-open` | Ctrl+P |
| 查找当前文档文字 | `document-search` | Ctrl+F |
| 搜索当前阅读库 | `workspace-search` | Ctrl+Shift+F |
| 命令面板 | — | Ctrl+Shift+P |
| 保存当前文档 | `save` | Ctrl+S |
| 撤销/重做 | `undo` / `redo` | Ctrl+Z / Ctrl+Y；Ctrl+Shift+Z 为重做替代键 |
| 插入链接 | `link` | Ctrl+K |
| 显示/隐藏侧栏 | `toggle-sidebar` | Ctrl+Shift+B |
| 显示/隐藏上下文面板 | `context` | Ctrl+Shift+R |
| 专注阅读 | `focus` | Ctrl+Shift+Enter；Esc 退出 |
| 返回上一文档 | `navigate-back` | Ctrl+Alt+← |

源码编辑器的 Ctrl+F 仍由 CodeMirror 原生查找处理；应用级处理只在编辑器没有消费事件时接管。

## 保存行为不变量

- Markdown/文本源文件仍是唯一正文真源；Ctrl+S 写入当前编辑草稿，不创建第二份正文。
- 原生保存先核对磁盘版本；检测到外部修改时阻止静默覆盖，进入冲突处理。
- 保存成功后清理当前文档草稿、清除外部修改标记并提交新的文档状态；大文件源文本模式不强制重新执行昂贵渲染。
- 切换文档、切换阅读库、重新载入或关闭前，若有未保存修改，先保留本机草稿；草稿无法保存时阻止替换。
- 浏览器预览沿用下载/本地存储回退，不能假装已经写回本机文件。

## 兼容性证据

- `src/app/compatibility-contract.test.ts`：设置 schema、全部持久化 key、命令 ID、快捷键匹配和 Ctrl+F/Ctrl+Shift+F 区分。
- `src/app/app-settings.test.ts`、`preferences.test.ts`、`settings-controller.test.ts`：旧 key、坏 JSON、坏字段、旧快照、新快照和 native 写入失败回退。
- `src/app/portable-settings.test.ts`：v1 便携备份兼容、v2 阅读位置/书签和 malformed metadata。
- `src/app/document-session-controller.test.ts`、`draft-recovery.test.ts`：外部修改保护、保存提交、草稿保留、切换阻断和大文件保存。
- `src/app/ipc-contract.test.ts`：完整 IPC 名称集合和唯一性。

## 变更边界

- 不升版本、不生成 Release、不改索引算法、拼音匹配、IPC/Rust 文件行为。
- 后续若要改变 key、schema、command ID、快捷键或保存语义，必须新增迁移/兼容说明和对应回归证据，不在普通重构中静默修改。
