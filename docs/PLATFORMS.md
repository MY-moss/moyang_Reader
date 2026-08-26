# 跨平台前置验证

Moyang Reader 以 Windows 桌面版为稳定发布目标；macOS 和 Linux 在 v0.8 先建立构建、测试和路径行为的前置门禁，不把未完成的签名、公证或自动更新发布称为正式支持。

## CI 覆盖

`.github/workflows/ci.yml` 会在 Windows 之外对 `ubuntu-latest` 和 `macos-latest` 执行：

- 前端单元测试和 Vite 构建；
- Rust 格式检查、clippy 和命令层测试；
- Linux 安装 Tauri 2 所需的 WebKit、GTK、AppIndicator、图像和打包依赖。

## Windows 桌面窗口模型

Windows 的 Tauri 入口使用 GUI 子系统，Debug 和 Release 进程都不会额外创建控制台窗口。开发模式的 `beforeDevCommand` 通过 `scripts/tauri-dev-server.mjs` 启动带 `windowsHide` 的 Vite 子进程；`npm run desktop` 仍会把日志留在启动它的开发终端中，但不会再弹出一个独立 CMD 窗口。发布安装版不依赖 Vite，也不应出现命令行窗口；若安装版仍出现窗口，应优先核对实际启动的 exe 是否来自最新安装包，而不是旧的 `target/debug` 产物。

## 手动验收清单

在真实 macOS/Linux 桌面环境准备发布前，至少验证：

1. 打开 Markdown、纯文本、DOCX、PDF 和常见图片；
2. 添加整个文件夹、递归扫描、目录折叠、搜索和文件变更刷新；
3. 打印 / 保存 PDF、HTML 和 DOCX 导出；
4. 文件关联、单实例传入路径和关闭未保存修改提示；
5. 系统主题、字体、文件名包含非 ASCII 字符时的显示和读写；
6. 更新器的签名包格式与当前平台产物格式是否匹配。

## 明确延期

- macOS 公证、签名证书和正式 `.app` 更新通道；
- Linux AppImage/包管理器发布和自动更新；
- 各平台的 Release 安装包上传与镜像清单扩展。

这些事项需要真实平台凭据和人工验收，统一放到 v0.8 稳定发布前的发布批次处理。
