# Moyang Reader

一个 Windows 优先、阅读器优先的本地文档阅读工具。

## 当前状态

v0.4.0 关系增强版正在开发，并基于 v0.3.1 的稳定基础继续完善：

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

`src-tauri/target/release/bundle/nsis/Moyang Reader_0.4.0_x64-setup.exe`

运行安装程序后会注册 `.md`、`.markdown`、`.mdown`、`.mkd` 文件关联。DOCX/PDF 当前支持在应用内选择、拖放和通过启动参数打开，但不会抢占 Word/PDF 的系统默认关联。

后续版本建议按以下顺序推进：

1. v0.4：当前版本，关系图、标签筛选、标准本地链接和未解析链接创建。
2. v0.5：Markdown/DOCX/PDF 导出模板、页眉页脚、分页预览、直接保存 PDF 和批量导出。
3. v0.6：多工作区、大文件增量渲染、崩溃恢复、自动更新和可选插件系统。
