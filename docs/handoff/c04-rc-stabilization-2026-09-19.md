# C04 v1.0 RC 稳定化（当前阶段）

日期：2026-09-19

## 范围

C04 只处理 RC 验证矩阵中的阻断缺陷和证据缺口，不新增产品功能、不改索引算法、不改 IPC 或 Rust 运行时行为。

本阶段发现并修复了独立 Windows 性能基准工作流的报告路径缺陷：Rust 单元测试在 `src-tauri` 工作目录运行，`artifacts/workspace-benchmark.json` 会落到 `src-tauri/artifacts`，而上传步骤从仓库根目录寻找文件，造成“基准通过但工作流失败”的假失败。PR #503 将报告路径和上传路径统一为 `${{ github.workspace }}/artifacts/workspace-benchmark.json`，并加入静态回归测试。

## 可追溯性能证据

- GitHub Actions run：[`35393264851`](https://github.com/MY-moss/moyang_Reader/actions/runs/35393264851)；Windows desktop performance benchmark 全部步骤通过，工作区报告和大文档报告均上传成功。
- 工作区搜索基准：固定 2KB Markdown 文件，5,000 / 20,000 个文档，各 3 轮，每轮 10 次 warm search，查询命中 1 条。
  - 5,000 文档：扫描 median `122.40ms`，cold search median `2176.20ms`，warm search median `25.52ms`。
  - 20,000 文档：扫描 median `469.18ms`，cold search median `8762.96ms`，warm search median `103.97ms`。
- Windows 大文档基准：1MB 和 10MB 均可读、可保存、可搜索；编辑器在超过阈值时保持 source 模式，避免 rich-mode 阻塞桌面 runner。
  - 1MB：首次可读 `629ms`，搜索 `124.55ms`，保存 `633.55ms`，最大响应间隔 `273.1ms`，工作集峰值增量约 `5.3MiB`。
  - 10MB：首次可读 `1570.69ms`，搜索 `796.78ms`，保存 `2419.3ms`，最大响应间隔 `773.9ms`，工作集峰值增量约 `96.6MiB`。
- 这些是固定 Windows runner 的独立观测值，不把单次毫秒数当作功能正确性门禁；报告和运行链接保留用于后续趋势比较。

## RC 验证矩阵当前状态

- 前端：C03 合并前后的 GitHub Quality checks 通过；本阶段工作流回归测试已纳入 `test:workflow`。
- Rust：C02/C03 的 Rust 单元测试和 workspace benchmark 通过；本阶段未改变 Rust 产品行为。
- 浏览器 / a11y / desktop：C02/C03 的相关 Playwright、a11y、Windows desktop smoke 和 PR Quality checks 已通过。
- release：v0.11.0 的 release/status 校验、资产 URL/tag 一致性和文档门禁已通过；本阶段不升版本、不创建 Release。
- performance：run `35393264851` 完成独立工作区及大文档报告上传。
- 真实 Windows 安装/升级：已在 Windows x64 隔离临时目录完成 v0.10.14 安装后覆盖升级到 v0.11.0；两次安装退出码均为 0，应用文件版本和卸载注册信息均与目标版本一致。

## Windows x64 隔离升级证据

- 旧版安装包：GitHub Release `v0.10.14` 的 `Moyang.Reader_0.10.14_x64-setup.exe`，SHA-256 `293b3884f2e66659e7ce2ab4f333dc01dcd0bf0a48ddd0ed8bbff42d661cce59`。
- 新版安装包：GitHub Release `v0.11.0` 的 `Moyang.Reader_0.11.0_x64-setup.exe`，SHA-256 `836957cc37eab63f48e9b26ac8a5d467472b72549c6797dd28c515a2a3b6186a`，与 [`docs/release-status.json`](../release-status.json) 一致。
- 在 `%TEMP%\\moyang-c04-old-upgrade-20260919\\old-install` 先执行 v0.10.14 安装，再使用 v0.11.0 安装包覆盖同一目录；两次安装退出码均为 `0`。
- 覆盖后 `moyang-reader.exe` 的 `FileVersion` / `ProductVersion` 和卸载注册信息均为 `0.11.0`；应用启动后窗口保持响应。
- 以临时 PDF 文件作为命令行打开入口启动 v0.11.0，应用进程保持响应；临时 PDF 和测试进程已清理。当前仍缺少应用内 updater 的检查 → 下载 → 重启交互，以及 PDF 内容的可视化读取确认，因此不把该 smoke 扩大解释为完整 updater/PDF 验证。

## 外部边界

- #241：安装器覆盖升级的 Windows x64 smoke 已完成；仍需要真实桌面交互完成应用内 updater 的检查、下载、重启和 PDF 内容读取闭环，CI 不能替代这项实机证据。
- #51：当前无 Authenticode 证书；updater `.sig` 与 SHA-256 可核验，但不等于 Windows 代码签名。这不应在已披露限制的前提下无限期冻结 v1.0。
- #227：Private Vulnerability Reporting 的仓库设置开关仍需维护者在 GitHub UI 中确认；仓库内文案和安全边界已独立完成。

## 验证与回滚

- RED：旧相对路径下，`desktop-benchmark-workflow.test.mjs` 能稳定复现报告路径不一致。
- GREEN：回归测试、`npm run test:workflow`（36 项）、`npm run lint`、`npm run test:release`（25 项）、`npm run format:check`、Actions pin 检查和 `git diff --check` 通过。
- 回滚 PR #503 只会恢复性能报告上传路径，不影响应用运行时或已发布 v0.11.0 资产。

## 结论

C04 的仓库内性能证据和安装器覆盖升级 smoke 已收口，但 C04 不能仅凭 CI 或启动 smoke 标记 DONE；在 #241 的应用内 updater / PDF 真实交互闭环完成前，任务保持 `IN_PROGRESS`，不生成新版本或 Release。
