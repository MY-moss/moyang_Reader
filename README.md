# Moyang Reader

一个 Windows 优先、阅读器优先的本地文档阅读工具。

## 当前状态

v0.5.0 关系与发布增强版，继续基于轻量本地阅读核心完善：

- Tauri 2 + Rust + React/TypeScript 工程骨架
- 双击传入文件路径、单实例接收后续打开请求
- Markdown、GFM、YAML/TOML frontmatter、数学公式和安全 HTML 清洗
- TXT、TEXT、LOG 纯文本保留换行阅读
- DOCX 转安全 HTML 阅读，保留常见标题、段落、列表、表格和内嵌图片
- PDF 内嵌快速预览，并可在新窗口继续使用系统 PDF 能力
- PNG/JPG/GIF/WebP/SVG/AVIF 图片附件可在工作区中直接打开预览
- Obsidian 风格 `[[文档]]` / `[[文档|别名]]` 链接，并支持同目录优先、工作区路径和 `#章节` 跳转
- 工作区目录扫描、最近打开、全局全文搜索（最多返回 100 条）
- 添加整个文件夹作为单一阅读库，递归扫描支持的文档类型
- 侧栏按真实目录层级展示工作区，文件夹可折叠并显示文件数量
- 工作区递归文件监听，文件增删改后自动刷新目录
- 外部修改提示，避免覆盖当前未保存内容；失效最近文件自动清理
- Markdown 工作区索引、标签、出链、未解析链接和当前文档反向链接
- 标签筛选、标准 Markdown 本地链接、章节锚点、未解析链接一键创建
- 当前文档一跳关系图，可点击节点打开关联文档
- 多标签页切换，未保存修改在切换/关闭前确认
- Tauri 下支持文档相对图片和 `![[图片]]` 资源路径
- 文档目录、阅读统计、源文本切换、当前文档搜索
- 系统/浅色/深色主题切换，并记住选择
- 浏览器开发模式的文件选择和拖放
- UTF-8、UTF-8 BOM、UTF-16、GB18030 文本读取
- 写回前创建隐藏备份和临时文件
- 打印样式，可通过系统打印对话框保存为 PDF
- Windows Markdown 文件关联配置和应用图标
- Markdown、纯文本和 DOCX 内容可另存为 HTML（桌面版会尝试内嵌本地图片）；Markdown/纯文本也可另存为源文件
- 工作区可按当前筛选批量导出为带目录的单文件 HTML，支持 Markdown、纯文本和 DOCX
- 启动后静默检查 GitHub Release，顶部按钮可手动检查，签名更新包安装后自动重启

生产构建会把 Markdown、DOCX 适配器拆成按需加载的 chunk：空白启动页不需要加载完整文档解析器，打开对应类型时才加载。

## 开发

```powershell
npm install
npm run test
npm run build
npm run tauri dev
```

`npm run tauri -- build --no-bundle` 已在 Windows 上成功生成：

`src-tauri/target/release/moyang-reader.exe`

完整 NSIS 安装包也已生成：

`src-tauri/target/release/bundle/nsis/Moyang Reader_0.5.0_x64-setup.exe`

运行安装程序后会注册 `.md`、`.markdown`、`.mdown`、`.mkd` 文件关联。DOCX/PDF 当前支持在应用内选择、拖放和通过启动参数打开，但不会抢占 Word/PDF 的系统默认关联。

更新链路、GitHub Secrets 配置和发布检查清单见 [`docs/UPDATE.md`](docs/UPDATE.md)。当前版本的 PDF 交付方式是系统打印对话框中的“保存为 PDF”；真正的 PDF 模板和批量导出列入后续版本。

## 后续版本路线

1. v0.5：当前版本，关系图、标签筛选、整个文件夹阅读库、Markdown/HTML 导出和签名自动更新。
2. v0.6：PDF/Word 导出模板、页眉页脚、分页预览、批量导出和导出附件处理。
3. v0.7：多工作区、超大文档增量渲染、索引缓存、崩溃恢复和更完整的打印设置。
4. v0.8：插件/适配器机制、可选同步、版本回滚提示和跨平台打包。
