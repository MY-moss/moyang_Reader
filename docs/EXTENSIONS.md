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

0.14 精选共十五项。在原有八项基础上，增加四个离线阅读插件、两个聊天助手和一项 AI 技能。所有扩展仍由你选择安装；现有 Obsidian 插件不能直接运行，需要适配本应用接口。

| 新增扩展           | 实际用途                                                                       |
| ------------------ | ------------------------------------------------------------------------------ |
| 待办提取           | 将 Markdown 复选任务按未完成和已完成整理，导出清单                             |
| 链接清单           | 列出 Markdown 链接、图片和引用式链接，附原文位置；不包含双链，也不自动联网检查 |
| 表格导出           | 每张 Markdown 表格单独下载为 UTF-8 CSV，保留中文、转义竖线和引号               |
| 文档体检           | 核对标题跳级、重复标题、空链接和图片说明；属于结构建议，不是事实核查           |
| 论证审阅           | 使用所选 API，围绕明确附加的材料分析主张、证据和隐含前提                       |
| 复习教练           | 一次一个问题，等待回答后按资料反馈；没有自动提醒或跨会话复习排程               |
| 来源核对与知识整理 | 向外部 Agent 提供有来源的核对流程和清单，按已有授权使用工具                    |

打开 Markdown 文档后，可在已安装插件详情直接点击「运行」，或在阅读页「更多操作 → 阅读插件」选择命令；原有命令面板继续可用。不适用当前格式或尚未打开文档时按钮不可用。停用后命令随即移除。

报告支持复制和导出；点击条目会切到源码并选中原文。文档在插件运行后发生变化时，要求重新运行，避免跳到错误位置。表格和待办清单可以分别预览、下载，原文保持不变。CSV 使用带 BOM 的 UTF-8；以公式符号开头的单元格加单引号按文本保存，避免电子表格执行原文。最多一次导出前 32 张表格，超出时明确提示拆分。

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

0.14 新增可选 `documentAnalysis: true`（最低宿主版本必须设为 `0.14.0`）。处理 Markdown 时，宿主在 Worker 内提供 `input.analysis`：`headings`、`tasks`、`links`、`tables`。使用正式 Markdown/GFM 解析，忽略代码块和 frontmatter；每项含 `line`（从 1 开始）、`from`/`to`（原始文字的 UTF-16 起止偏移）。标题另含 `depth,text`，任务含 `checked,text`，链接含 `text,url,image`，表格含二维 `rows`。其他格式不提供该字段，插件应声明适用格式。

新增输出：`findings?: {label,detail?,line,from,to}[]` 与 `files?: {name,content}[]`。前者由宿主定位原文，后者仅在用户选择后保存；支持 Markdown、TXT、CSV，同次最多 32 个、合计 16 MiB 的文本文件。文件名必须唯一且不带路径。无效位置或文件格式会显示错误，不执行文件写入。旧的 report/replacement 插件保持兼容。

内置阅读工具源码位于 `builtin-readers.ts`。修改后运行 `node scripts/export-extension-catalog.mjs` 同时生成固定代码包与公开目录；检查流程验证两者一致。宿主直接使用生成包，避免开发、压缩构建和线上目录产生不同的同版本代码。

ZIP 包将清单放顶层 manifest.json，代码以相对文件名放入 ZIP；入口仍是单文件打包模块。单个包最多 16 MB。技能包可不带清单，遵循 SKILL.md + references/resources 的组织方式；资源保留原始字节。

主题提供 `theme.light` 与 `theme.dark`，支持 `--canvas`、`--surface`、`--surface-strong`、`--ink`、`--muted`、`--line`、`--line-strong`、`--accent`、`--accent-deep`、`--accent-soft`，值为六位十六进制颜色。不注入任意 CSS，也不隐藏恢复与导航控件。

技能提供 `skill: {body, assets}`，body 是包含 name/description 的完整 SKILL.md；assets 含 path、encoding（utf8/base64）、content。MCP 提供 `mcp: {command,args,env}` 或 `{url,headers}`。每个包应明确实际能力、依赖及许可证。

目录 JSON：`{"format":"moyang-extension-catalog","packages":[完整扩展包]}`。同一目录 ID 必须唯一。精选目录由 `node scripts/export-extension-catalog.mjs` 从源码生成，发布到 `public/extensions/catalog.json`。自定义目录拥有独立来源，检查更新不会自动跨来源替换安装。

## 数据与故障恢复

桌面安装存于应用配置目录的 `extensions/extensions.sqlite`，事务保存当前状态与上一次完整状态；包内另保留上一个扩展版本。浏览器预览使用独立 IndexedDB。两者都不把资源随每次编辑写入存储。关闭前等待已开始的安装操作。

安装失败时先查看错误，已安装版本仍可使用。多个窗口竞争修改时重新读取安装状态再操作。在线目录不可用时使用缓存，离线包仍可安装。需要完整复制桌面安装记录时，关闭程序后复制 extensions 目录（包括 SQLite 相关文件）；技能内容还需 AI 数据备份，客户端连接需在新机器重新预览安装。不要将含私人环境变量的安装数据库提交到仓库。
