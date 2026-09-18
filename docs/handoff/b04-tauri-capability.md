# B04 — Tauri 权限库存与负向安全测试

## 结果

- `src/app/bridge.ts` 的唯一外部 URL 桥接入口是 `openExternalUrl`：桌面调用 `@tauri-apps/plugin-opener` 的 `openUrl`，浏览器预览调用 `window.open`。两条路径现在都只接受 `http:`、`https:`、`mailto:` 和 `tel:`，危险或未知协议在产生外部副作用前拒绝。
- `src/app/updater.ts` 的真实调用点只有 `check`、`Update.downloadAndInstall` 和 `@tauri-apps/plugin-process` 的 `relaunch`；应用没有调用 process `exit`、opener `openPath` 或 `revealItemInDir`。
- `src-tauri/src/commands.rs` 的资源管理器定位由应用自有 `reveal_workspace_entry` 命令完成，并在 Rust 边界检查已授权阅读库；读文件、工作区扫描和写入/导出命令继续通过 `AccessRegistry` 检查用户选择范围。
- `src-tauri/capabilities/default.json` 改为最小调用集合：`opener:allow-open-url` + `opener:allow-default-urls`、`process:allow-restart`、`updater:allow-check` + `updater:allow-download-and-install`；移除 `opener:default`、`process:default`、`updater:default` 以及未使用的 path/exit/split-update 权限。

## 威胁边界

- Markdown、阅读正文和编辑器产生的链接视为不可信输入；协议白名单在调用 Tauri opener 或浏览器前执行，不能依赖 UI 调用方先行过滤。
- 前端可调用的 Tauri command、启动参数和记住的本地路径视为不可信输入；Rust 侧以 `AccessRegistry` 的 canonical path 范围为准，未注册文件、工作区外路径、路径遍历和未授权新文件均拒绝。
- 更新器只允许配置的 HTTPS metadata endpoint，并只开放检查和完整下载/安装流程；不会因为生产 capability 的 `default` 集合而额外开放退出、任意本地路径打开或未使用的更新子命令。

## 负向覆盖

- Vitest 覆盖 `javascript:`、`data:`、`file:`、未知自定义协议和浏览器回退路径；同时确认 `http:`、`https:`、`mailto:`、`tel:` 与桌面更新调用不回归。
- Rust 单测覆盖已授权工作区和未注册 sibling、缺失路径、`..` 路径在读取、写入、新文件和导出判断上的拒绝。
- Node 配置测试固定 capability 白名单，并明确断言 opener path/reveal、process exit/default 和 updater split/default 权限不存在。

## 边界

- 本次不修改索引算法、拼音匹配、IPC command 名称或更新 endpoint；不生成版本、安装包、签名、`latest.json` 或 GitHub Release。
- Tauri 官方插件的运行时 scope 仍负责最终命令级拒绝；应用侧 URL 白名单和 Rust `AccessRegistry` 是更早的输入边界与文件范围边界。
