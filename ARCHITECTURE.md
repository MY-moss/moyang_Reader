# Moyang Reader 架构说明

## 目标

Moyang Reader 以“本地文件快速阅读”为第一目标：启动时不加载完整文档解析器，打开文件或文件夹后才按需读取和索引；文档内容默认留在本机，不需要账号或云端数据库。

## 分层

```text
React UI
  ├─ App.tsx：窗口状态、打开文档、标签页、工作区生命周期
  ├─ components/：顶部栏、空状态、目录、目录树、关系图、预览
  └─ styles.css：主题、打印样式和阅读布局

应用服务
  ├─ bridge.ts：Tauri 调用与浏览器开发模式适配
  ├─ markdown.ts：Markdown/GFM/公式/Obsidian 链接渲染
  ├─ document-adapters.ts：DOCX/HTML 适配和统一统计、TOC
  ├─ workspace-index.ts：工作区索引、搜索和标签关系
  └─ export.ts：HTML、DOCX 和打印导出

Tauri/Rust
  ├─ commands.rs：路径、文本解码、目录扫描、索引和安全边界
  └─ capabilities/：插件权限和文件监听权限
```

## 关键决策

- 使用 Tauri 2 + Rust + React：Windows 文件关联和轻量桌面窗口由 Tauri 负责，阅读界面保留 Web 技术的迭代速度。
- 文件夹是工作区：工作区只保存本地路径，索引在后台建立，用户可以继续先浏览目录。
- Markdown 目录从最终 HAST 渲染树提取：TOC 使用实际渲染后的 heading id，避免目录锚点与页面不一致。
- 更新使用 GitHub Releases + Tauri 签名 updater：公钥随应用发布，私钥只放在本地安全存储和 GitHub Actions Secret 中。
- HTML 是通用导出中间层：HTML 可打印为 PDF；DOCX 导出只处理安全 HTML 的常用块，不引入服务端转换依赖。

更详细的发布决策见 [`docs/UPDATE.md`](docs/UPDATE.md)；后续重大架构变化应新增 ADR，而不是覆盖历史说明。

## 当前边界与下一步

原生打开/添加文件夹/保存对话框在 Rust 侧登记用户实际选择的路径；读取和写入使用独立的会话级授权范围。单独打开文档时，读取范围包含其所在目录以支持相对图片和附件，但写入范围仍只包含用户明确选择的文件；选择工作区文件夹后才授予该工作区的读写范围。写入使用临时文件替换，避免先删除原文件造成空窗。asset 协议的全局 `**` 作用域和工作区监听权限仍需继续收紧；超大文档和增量索引也会在后续版本继续推进。不要把完整 `App.tsx` 拆分或跨平台安装包当作已完成能力。
