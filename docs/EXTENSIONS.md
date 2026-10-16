# 扩展使用与开发

0.12 的“插件市场”位于侧栏底部，与设置同级。日常笔记、AI 空间和扩展安装记录保持独立。安装记录不代表外部 Agent 已连接。

0.13 新增 `assistant` 聊天助手：精选提供书房聊天、共读伙伴与双语阅读，安装后点击「开始聊天」，在独立 API 服务页配置自己的模型。支持启停、版本回退与导入导出；卸载保留对话。详细格式与使用路径见 [聊天助手指南](CHAT-EXTENSIONS.md)。

## 安装与日常使用

1. 打开插件市场，在“发现”按名称或类型查找。选择条目查看用途、作者、来源、版本与代码。
2. 点击“安装扩展”。阅读插件在命令面板（Ctrl+Shift+P）出现；主题立即生效；技能显式加入 AI 技能库；MCP 服务进入连接定义管理。
3. 在“已安装”启停阅读插件与主题。多个主题只能启用一个，停用后恢复应用原配色；亮暗模式仍由设置决定。
4. “管理目录源 → 检查精选更新”访问本项目 GitHub 的精选目录；也可添加作者提供的目录 JSON 地址。目录仅在手动刷新时联网，下载失败保留上次目录与全部安装。
5. 在“更新”逐项查看新版并安装。阅读插件/主题更新保留上一版，可一键回退。最低应用版本不满足时显示要求并禁止安装，不隐藏其他可用条目。
6. 可导入 JSON 扩展包、带 manifest.json 的 ZIP，或标准 SKILL.md/技能 ZIP。详情里的“导出包”可用于备份或转移一个扩展。卸载阅读插件移除命令，卸载主题恢复原配色。

当前精选共八项：书房聊天、共读伙伴、双语阅读、阅读概览、段落留白整理、雾青书房、有据可查的记忆整理、Sequential Thinking MCP。用户可以添加其他目录与本地包；现有 Obsidian 插件不能直接运行，需要适配本应用接口。

目录失败时显示具体地址，可直接“重试目录更新”，已安装扩展仍可使用。需要排查时展开错误详情；这与读取本地安装状态是不同操作。

阅读插件只在调用时创建 Worker，完成、取消或 15 秒超时后释放。只读命令返回报告；修改命令先显示原文与建议，采用后经过既有撤销、草稿、自动保存和外部修改检查。运行期间文档发生变化时不能覆盖新内容。默认支持 Markdown/TXT；声明 docx 的只读命令可收到提取正文，PDF 和图片不进入文本插件。

## 技能更新和 MCP

技能沿用现有版本、资源与检索，不新增第二套技能库。作者新版会检查上次安装对应的修订号；你或 Agent 改进过的内容不会被覆盖，可选择保留原技能并安装副本。卸载扩展记录不会删除技能和历史，归档或删除在 AI 空间完成。整体迁移时同时备份 AI 空间。

直接导入没有版本字段的 SKILL.md 时，应用按本地修订递增版本，不要求手写扩展清单。中文技能名称使用稳定的独立 ID，重复导入同一名称可更新，不同中文名称不会互相覆盖。

MCP 条目安装后可编辑本地命令、参数、环境变量，或 HTTP 地址与请求头。保存定义后，选择 Codex/Claude Code，预览将写入的配置并点击安装。写入前备份，只管理 `moyang-ext-<扩展ID>`；其他服务、钩子与信任设置保持不变。后来改过的连接不会被静默覆盖或删除。卸载 MCP 扩展前先移除它在两个客户端中的连接。

需要其他客户端时复制通用配置。客户端自身负责下载启动程序、登录和信任，界面不会把“配置已写入”显示成“连接成功”。Sequential Thinking 固定 npm 1.0.0，需要本机 Node.js；Moyang 的长期记忆服务仍从 AI 空间的“接入与备份”管理。本轮没有替用户批准任何客户端工具或钩子。

## 扩展包协议

JSON 包必填 `format: moyang-extension`、稳定 `id`、`name`、三段数字 `version`、`minAppVersion`、`kind`、`author`、`description`；可带 `homepage`、`license`、`readme`。类型为 reader、theme、skill、mcp、assistant。同一 ID 不能改变类型；代码变化需增加版本。

阅读插件例子：

```json
{
  "format": "moyang-extension",
  "id": "example.reading-count",
  "name": "字符统计",
  "description": "统计当前文档的字符数。",
  "version": "1.0.0",
  "minAppVersion": "0.12.0",
  "kind": "reader",
  "author": "你的名字",
  "license": "MIT",
  "entry": "main.js",
  "formats": ["markdown", "text"],
  "commands": [{ "id": "count", "name": "统计当前文档" }],
  "files": { "main.js": "export default ({text}) => ({report: `共 ${text.length} 个字符`});" }
}
```

入口必须是已经打包成单文件的 ES 模块，默认导出函数，可返回 Promise。输入字段为 `command`、`text`、`path`、`title`、`format`。输出 `{report?: string, replacement?: string}`；返回 replacement 的命令必须声明 `modifiesDocument: true`。不要引用 Obsidian/Node/Tauri API；这里没有对应运行时。Worker 保持界面响应，不能把它当成可以运行不可信代码的强安全边界。

ZIP 包将清单放顶层 manifest.json，代码以相对文件名放入 ZIP；入口仍是单文件打包模块。单个包最多 16 MB。技能包可不带清单，遵循 SKILL.md + references/resources 的组织方式；资源保留原始字节。

主题提供 `theme.light` 与 `theme.dark`，支持 `--canvas`、`--surface`、`--surface-strong`、`--ink`、`--muted`、`--line`、`--line-strong`、`--accent`、`--accent-deep`、`--accent-soft`，值为六位十六进制颜色。不注入任意 CSS，也不隐藏恢复与导航控件。

技能提供 `skill: {body, assets}`，body 是包含 name/description 的完整 SKILL.md；assets 含 path、encoding（utf8/base64）、content。MCP 提供 `mcp: {command,args,env}` 或 `{url,headers}`。每个包应明确实际能力、依赖及许可证。

目录 JSON：`{"format":"moyang-extension-catalog","packages":[完整扩展包]}`。同一目录 ID 必须唯一。精选目录由 `node scripts/export-extension-catalog.mjs` 从源码生成，发布到 `public/extensions/catalog.json`。自定义目录拥有独立来源，检查更新不会自动跨来源替换安装。

## 数据与故障恢复

桌面安装存于应用配置目录的 `extensions/extensions.sqlite`，事务保存当前状态与上一次完整状态；包内另保留上一个扩展版本。浏览器预览使用独立 IndexedDB。两者都不把资源随每次编辑写入存储。关闭前等待已开始的安装操作。

安装失败时先查看错误，已安装版本仍可使用。多个窗口竞争修改时重新读取安装状态再操作。在线目录不可用时使用缓存，离线包仍可安装。需要完整复制桌面安装记录时，关闭程序后复制 extensions 目录（包括 SQLite 相关文件）；技能内容还需 AI 数据备份，客户端连接需在新机器重新预览安装。不要将含私人环境变量的安装数据库提交到仓库。
