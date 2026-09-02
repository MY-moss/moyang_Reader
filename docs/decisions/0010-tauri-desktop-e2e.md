# ADR-0010：真实 Tauri 桌面 E2E

状态：已接受（2026-08-26）

## 背景

浏览器 Playwright smoke 运行在 `vite preview`，只能验证 `browser://` 降级路径，无法证明真实 Tauri 的启动参数、文件授权、Rust invoke、监听和磁盘写回。#88 因此不能只靠浏览器 E2E 关闭。

## 决策

采用 WebdriverIO + `@wdio/tauri-service` 的内嵌 WebDriver，并在 Rust 侧通过 `wdio` feature 注册 `tauri-plugin-wdio` 和 `tauri-plugin-wdio-webdriver`。内嵌方式不要求开发者或 CI 额外安装 `tauri-driver`，Windows 先覆盖最小真实链路；后续再按平台能力扩展。

官方参考：[Tauri WebDriver 测试](https://v2.tauri.app/develop/tests/webdriver/)、[WebdriverIO Tauri 插件配置](https://webdriver.io/docs/desktop-testing/tauri/plugin-setup)。

## 边界

- `scripts/test-desktop-e2e.mjs` 设置 `VITE_MOYANG_DESKTOP_E2E=1`，并传入 `src-tauri/tauri.wdio.conf.json`；普通构建不加载测试桥接。
- `src-tauri/tauri.conf.json` 只启用 `default` capability；测试配置以内联 capability 临时增加 `wdio:default` 和 `wdio-webdriver:default`，避免普通构建解析不存在的测试插件权限。
- `src/main.tsx` 只在测试环境动态加载 `@wdio/tauri-plugin`；生产启动不增加该桥接代码路径。
- smoke 夹具必须在 WDIO 配置主进程和 worker 之间复用同一个绝对路径。不能在模块加载时无条件创建两份临时文件，否则会出现“应用写入 A、测试读取 B”的假失败。

## 当前验收

`desktop-e2e/smoke.e2e.mjs` 已验证：启动参数打开 `desktop-e2e.md` → Markdown 默认 WYSIWYG → 切换源码 → 修改 CodeMirror 文本 → 点击保存 → 文件内容写回临时文件。

这只完成 #88 的最小纵向切片；watch/refresh、导出、更新和关闭确认继续作为后续桌面场景，不提前关闭 Issue。

## 失败处理

若桌面 smoke 失败，先区分三类问题：

1. 应用未启动或窗口未就绪：检查 Debug binary、WebDriver 端口和测试配置；
2. UI 未反映状态：检查选择器、编辑器公开 DOM 或 CodeMirror 哨兵；
3. 文件未写回：同时检查夹具路径是否在主进程/worker 一致、Rust AccessRegistry 是否登记、`write_text_file` 是否返回错误。

不得通过关闭路径授权或把测试权限加入生产 capability 来绕过失败。
