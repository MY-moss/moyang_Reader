# Windows 开发环境

本文是 Moyang Reader 开发环境的唯一入口。产品只支持 Windows x64；浏览器构建用于本地预览和 Playwright，不能替代真实 Tauri 桌面验证。

## 前置条件

| 组件                      | 本仓库要求/约定                                                        | 验证                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Windows                   | Windows x64 开发环境                                                   | `Get-CimInstance Win32_OperatingSystem \| Select-Object Caption, OSArchitecture`                             |
| Node.js                   | 本仓库 CI 使用 Node.js 22；本地优先使用同一主版本                      | `node --version`                                                                                             |
| npm                       | 随 Node.js 安装；依赖必须按 `package-lock.json` 恢复                   | `npm --version`                                                                                              |
| Rust/Cargo                | `src-tauri/Cargo.toml` 的最低版本为 Rust 1.88；使用 stable MSVC 工具链 | `rustc --version`、`rustup show active-toolchain`                                                            |
| Microsoft C++ Build Tools | 安装“Desktop development with C++”工作负载和 Windows SDK               | Visual Studio Installer                                                                                      |
| WebView2                  | Tauri Windows 桌面开发和运行时需要 Microsoft Edge WebView2             | `Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*' -ErrorAction SilentlyContinue` |
| Git、PowerShell           | 用于获取仓库、切换 worktree 和执行脚本                                 | `git --version`、`$PSVersionTable.PSVersion`                                                                 |

Tauri 的 Windows 前置条件以[官方 Prerequisites](https://v2.tauri.app/start/prerequisites/)为准；如果 C++ 构建工具或 WebView2 缺失，浏览器预览仍可能正常，但 `npm run desktop` 不能据此判定可用。只做 NSIS/浏览器开发时不需要额外安装 MSI 专用的 VBSCRIPT；只有构建 MSI 时才按 Tauri 文档处理该可选组件。

Rust 建议通过 rustup 安装并确认默认目标为 `x86_64-pc-windows-msvc`：

```powershell
rustup default stable-msvc
rustup show active-toolchain
```

不要在没有实际需要时全局安装 Tauri CLI。仓库脚本会统一调用本地依赖和受管 Cargo 构建缓存。

## 首次获取与依赖恢复

在干净 checkout 或新 worktree 中执行：

```powershell
git fetch origin --prune
npm run agent:bootstrap
npm ci
npm run doctor
```

`agent:bootstrap` 只读取 Git/远程状态并生成被忽略的 `.codex-cache/agent-context.md`，不会自动 pull、rebase、reset 或 merge。阅读输出中的 `REMOTE_STATUS`、最早未完成任务和阻塞 PR；Dependabot/机器人维护 PR 不等同于产品任务阻塞。

`doctor` 只读检查当前机器和工作树：Windows x64、Node/npm、Rust/Cargo、MSVC、Windows SDK、WebView2、依赖和 Git 状态。它不会安装工具、修改系统设置、执行 `npm install` 或覆盖未提交改动。失败项表示当前不能可靠进行对应的桌面开发；Git 未提交改动只显示为警告。

如果在项目内创建独立 worktree，先从最新 `origin/main` 创建目录，再从仓库根目录为该目录恢复独立依赖：

```powershell
git worktree add .codex-worktrees/<task-name> origin/main
npm run worktree:prepare -- .codex-worktrees/<task-name>
```

`worktree:prepare` 只接受项目内 `.codex-worktrees/<task-name>` 的单层目录，并执行 `npm ci --prefer-offline`；它拒绝覆盖共享 `node_modules` junction。Codex 管理的项目外 worktree 不能使用这个路径校验脚本，应在该 worktree 内直接执行 `npm ci --prefer-offline`，不要复制或链接其他工作树的 `node_modules`。

初始化和依赖升级的语义不同：日常开发使用 `npm ci`；只有明确修改依赖并准备审阅 lockfile 时才使用 `npm install`。

## 开发与验证命令

先跑与改动范围匹配的最小检查，再按需要扩大：

```powershell
# 浏览器预览；不启动 Tauri/Rust
npm run dev

# 检查当前机器是否具备桌面开发前置条件；只读，不会自动修复
npm run doctor

# 真实 Windows 桌面调试
npm run desktop

# 前端单测、覆盖率、静态检查和生产构建
npm run test
npm run test:coverage
npm run lint
npm run build

# 浏览器 E2E 与无障碍
npm run test:e2e
npm run test:e2e:a11y

# 确定性的桌面正确性 smoke；PR gate 使用这一条
npm run test:e2e:desktop

# Rust 通过仓库包装脚本运行，自动使用受管 Cargo target
npm run rust -- fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run rust -- clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run rust -- test --manifest-path src-tauri/Cargo.toml
```

性能 benchmark 与功能正确性分开：`npm run test:e2e:desktop:benchmark` 只用于固定 fixture、多轮结果和趋势证据，不用共享 Runner 的一次毫秒抖动替代正确性结论。

文档、工作流和发布相关改动还应按范围运行：

```powershell
npm run test:workflow
npm run check:docs
npm run test:release
npm run format:check
```

## 构建缓存与清理

Rust/Cargo 默认使用 `%LOCALAPPDATA%\Moyang Reader\build-cache\cargo-target`，不要在工作树内手动生成或提交 `src-tauri/target`。磁盘空间紧张时可把受管缓存迁移到有空间的磁盘：

```powershell
$env:MOYANG_BUILD_CACHE_DIR = "D:\Moyang Reader-build-cache"
```

清理前先只读预览：

```powershell
npm run cleanup:workspace -- --dry-run
```

确认路径、归属和没有活动构建后，才按 [`WORKSPACE-CLEANUP.md`](WORKSPACE-CLEANUP.md) 的规则执行清理。不要使用递归删除绕过保护，也不要清理根目录未提交改动、未合并 worktree、用户文件或凭据。

## 常见问题

- `npm` 或 `node` 找不到：安装 Node.js 22 LTS，重启 PowerShell 后再次检查 `node --version` 和 `npm --version`。
- `npm run doctor` 报错：按失败项补齐对应工具后重新运行；doctor 不会替你安装或修改系统配置。
- `cargo` 找不到或 linker 报错：确认 rustup 使用 `stable-msvc`，并安装 C++ Build Tools 的“Desktop development with C++”工作负载。
- 浏览器预览正常但桌面启动失败：先检查 WebView2、C++ Build Tools 和 Windows SDK；`npm run dev` 不能证明 Tauri 桌面可用。
- 依赖缺失或 lockfile 不一致：删除仅限当前工作树的 `node_modules` 后重新执行 `npm ci`；不要覆盖其他 worktree。
- Cargo 构建占满源码目录或磁盘：停止活动构建，检查 `MOYANG_BUILD_CACHE_DIR` 和清理器 dry-run 输出，再按规则处理受管缓存。

## 不应提交的内容

不要提交 `.codex-cache/`、`node_modules/`、`dist/`、`coverage/`、Playwright 报告、Cargo target、安装包、用户文档、API token、签名私钥或 `.sig` 私密材料。遇到真实文件删除、凭据、正式 Release 或 Windows 签名问题，先阅读 `AGENTS.md`、`SECURITY.md` 和发布文档。
