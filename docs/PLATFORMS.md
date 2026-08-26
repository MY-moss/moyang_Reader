# 平台支持边界

## 当前决策

Moyang Reader 当前只支持 Windows x64 桌面版。Windows 是唯一的产品、发布、安装包、文件关联、自动更新和真实桌面 E2E 平台。

浏览器版只用于本地开发预览和 Playwright UI 测试，不作为独立桌面产品发布；macOS、Linux、移动端和 Windows ARM 暂不承诺支持。

## Windows 交付范围

- Tauri Windows 桌面应用；
- x64 NSIS 安装包和更新签名；
- Markdown、TXT/LOG、DOCX、PDF、图片和整个文件夹打开；
- Windows 文件关联、单实例启动、原生文件对话框和目录监听；
- Windows Debug/Release 桌面 smoke、更新器和安装包验证；
- GitHub Release 与 Cloudflare Pages 镜像中的 Windows x64 资产。

## CI 与成本控制

`.github/workflows/ci.yml` 默认只运行 `windows-latest` 的完整质量门禁，包括前端、浏览器、真实 Tauri 桌面、Rust、依赖审计和发布元数据检查。这样可以避免每个 PR 重复运行 macOS/Linux 构建，降低时间和缓存消耗。

`.github/workflows/rust-audit.yml` 保留 Ubuntu runner 的 RustSec 依赖审计。它只检查供应链漏洞，不构建或发布 Linux 应用，也不代表 Linux 产品支持。

## 明确不做

- macOS `.app`、公证、签名和自动更新；
- Linux AppImage、包管理器发布和自动更新；
- macOS/Linux 文件关联、原生文件对话框和桌面 E2E；
- Windows ARM、移动端和跨平台同步；
- 为保持“跨平台”而新增抽象、适配器或构建矩阵。

现有代码中的跨平台抽象暂不主动删除：只要它们不增加 Windows 构建体积、启动时间或维护负担，就保留以降低破坏性清理的回归风险。未来只有在出现明确用户需求和维护预算时，才通过新的 ADR 重新开放平台范围。

## Windows 窗口模型

Windows Tauri 入口使用 GUI 子系统，Debug 和 Release 进程不会额外创建控制台窗口。开发模式通过隐藏的 Vite 辅助进程提供前端服务；发布安装版不依赖 Vite，也不应出现命令行窗口。
