# AI 开发与交接流程

## 快速启动模板（交给任何 AI 时直接粘贴）

> 你是 moyang_Reader 仓库的协作开发 AI。启动步骤：
>
> 1. 按顺序读取：`CONTEXT.md` → `docs/REQUIREMENTS.md` → `docs/ROADMAP.md` → 本文件（只读“当前功能切片快照”和“下一位 AI 的唯一下一步”）。
> 2. 用 `git status`、`git log --oneline -5` 和 GitHub Issues 确认没有重复工作。
> 3. 不要通读仓库；用 `rg` 定位符号后只读相关文件的局部范围。
> 4. 只做“唯一下一步”，完成后按本文件“完成功能切片”清单交接并推送功能分支。
> 5. 汇报只写新增事实、失败根因、下一步；不粘贴完整日志。

## 标准读取顺序

1. `CONTEXT.md`
2. `docs/REQUIREMENTS.md`
3. `docs/ROADMAP.md`
4. `docs/UI-INTERACTION.md` 或 `ARCHITECTURE.md`
5. 本任务关联的 Issue、测试和入口文件

不要先读取整个仓库。先用 `rg` 定位符号，再读取相关文件的局部范围；不要在聊天中重复粘贴完整日志。

## 开始任务

1. 查看 GitHub Issues，确认没有重复工作或新的反馈。
2. 检查 `git status`、当前分支和 `origin/main`。
3. 创建 `codex/<scope>-<date>` 分支，或在明确的未完成功能分支上继续。
4. 写下目标、非目标、关联 Issue、验收标准和预计影响文件。

## 完成功能切片

代码、测试、用户文案和相关文档必须在同一个功能分支中完成。交接包至少包含：

- 当前分支和最新提交；
- 已完成内容和未完成内容；
- 修改文件和行为变化；
- 已运行命令及结果；
- 已知限制、风险和回滚方式；
- 当前切片（#104 搜索索引预算回退，PR #235）：已合并到 `main`（合并提交 `7ff67dbf`）；本地和 GitHub 正式 Quality checks 均已通过，Issue #104 保持 open，已纳入 `v0.9.1` patch。
- 在线下一步：发布分支 `codex/release-v0.9.1-2026-08-27` 已从 `7ff67dbf` 创建，正在同步版本元数据和 CHANGELOG；合并后由 Release workflow 生成 Windows x64 安装包、`.sig`、`latest.json`，再同步 Cloudflare 镜像并验证旧版本更新链路。
- 已知限制：之前的应用 API 提交没有产生 Actions run；本次不绕过分支保护、不强制覆盖远程，只使用快进更新现有功能分支。
- 关联 Issue、PR 和是否需要 Release。

## PR 规则

PR 说明必须包含目标、非目标、测试、手动 UI 路径、文档同步情况、截图（如有 UI 改动）、发布影响和回滚方式。没有文档交接说明的代码 PR 不算完成。

功能分支与 `main` 无冲突且 Quality checks 全绿时可以自动合并。遇到真实冲突、失败检查、权限/安全/更新器/发布工作流/数据迁移等高风险变更时暂停并说明原因；禁止强制推送覆盖他人提交。

## Release 规则

合并 PR 不等于发布安装包，但用户功能 minor 版本达到验收后必须及时发布；重要 Bug、保存、更新、签名或安全修复可以直接发布 patch。每个 PR 必须标记无 Release、minor 或 patch，并写出目标版本和理由。稳定发布时必须同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、CHANGELOG、Git tag、GitHub Release、NSIS 安装包、`.sig`、`latest.json` 和 Cloudflare 镜像；发布后必须做在线 HTTP、哈希、签名、manifest 和旧版本自动更新验证。纯文档、测试、CI 和内部重构可以不发布，但交接中必须明确写出原因。完整规则见 `docs/RELEASE-POLICY.md`。

## 当前平台边界（Windows x64）

- 产品、发布、文件关联、自动更新和真实桌面 E2E 只覆盖 Windows x64。
- 浏览器版只用于本地开发预览和 Playwright UI 测试，不作为独立桌面平台发布。
- macOS、Linux、Windows ARM、移动端和跨平台自动更新在 v1.0 前不进入主线；不要为它们新增构建矩阵、安装包或桌面回归。
- `.github/workflows/ci.yml` 只保留 Windows 质量门禁；独立 RustSec 审计可以使用 Ubuntu runner，但不代表支持 Linux 产品。
- 现有跨平台抽象不主动删除，除非它们增加 Windows 构建/启动/维护成本；未来重新开放平台必须先写新的 ADR。

## Token 预算规则

- 先给出短上下文包，再按需读取文件。
- 每轮只汇报新增事实、失败根因和下一步。
- 测试失败只粘贴首个根因和相关文件，不粘贴整段流水线日志。
- 一个 PR 保持一个清晰目标；无关重构另开 Issue。
- 代码、文档和验证结果一起提交，减少下一位 AI 的重复探索。

## 当前功能切片快照

> **最新检查点（2026-08-27，优先于下方历史条目）**
>
> - 稳定基线：`v0.9.1`；`main` 当前合并提交为 `6682aa06bd0b38c6c6300b2b693696b955833607`（已包含 PR #238 的 #231 修复）。
> - GitHub Release 已发布：[`v0.9.1`](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.1)，Release workflow [`32996354493`](https://github.com/MY-moss/moyang_Reader/actions/runs/32996354493) 成功；安装包 4,861,912 字节，SHA-256 `bf511b08459d78023055fecd9605579dae23cf883826203309460f4f1d36a35f`；`.sig` 424 字节，SHA-256 `47d9185a297e4839f7d33ac5db68572a9fae323e1c6a82a724187ccf4df04bef`。
> - Cloudflare 根 manifest、`/v0.9.1/` 安装包和 `.sig` 均 HTTP 200，镜像安装包与 GitHub Release SHA-256 一致；镜像 workflow [`32998515986`](https://github.com/MY-moss/moyang_Reader/actions/runs/32998515986) 在凭据预检失败，仓库当前没有 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` Secret。不要把该失败记录为部署成功，也不要在聊天中传递 token。
> - PR #237 已将两项流程修复合并到 `main`：CI 并发组按事件隔离；Release 工作流直接调用镜像工作流，避免 `GITHUB_TOKEN` 创建 Release 后不触发 `release` 事件。该流程切片只改 CI/发布/文档，不生成新安装包。
> - 镜像自动部署的唯一外部前置是维护者在 GitHub Actions Secrets 中配置 Cloudflare API Token（仅 Pages 编辑权限）和账户 ID；流程修复合并后应先补齐 Secrets，再在下一次稳定 Release 验证端到端镜像部署。

- 已完成切片（#231，PR #238）：顶栏“更多 / 设置 / 导出”菜单新增捕获阶段的外点 `pointerdown` 与 `Escape` 关闭；菜单内部控件不受影响，关闭时会一并收起嵌套菜单。`e2e/smoke.spec.ts` 新增外点和 Esc 回归，本地单测 168/168、lint、构建及顶栏 E2E 2/2 已通过；PR #238 已合并到 `main`，Issue #231 已标记 completed；本切片不单独生成安装包，纳入 v0.9.2 稳定批次。

- 已完成切片（#174，PR #239）：在 `src/main.tsx` 根节点接入独立 `ErrorBoundary`，捕获渲染期异常并显示可重新加载的恢复页；错误详情仅在本地折叠显示并写入开发者控制台，不上传或覆盖用户文件。新增 `ErrorBoundary.test.tsx` 覆盖恢复页和重载回调；PR #239 已合并为 `99cb59701a71b05cd8da81047b1ec9fe90eb04da`，Issue #174 已标记 completed；本切片不单独生成安装包，纳入 v0.9.2 稳定批次。

- 当前切片（#188，`codex/typography-hierarchy-2026-08-27`）：统一阅读模式、Milkdown WYSIWYG 和 HTML 导出的 h4/h5/h6 层级与列表排版节奏；h4 使用 19px，列表提供缩进、嵌套间距、列表标记色和多段列表项收束规则。新增 HTML 导出回归与真实浏览器样式 E2E；本切片不单独生成安装包，纳入 v0.9.2 稳定批次。

- 历史基线：`v0.9.0`（详细历史合并记录保留在本文件中）；当前状态以“最新检查点”为准。
- 历史切片（Cloudflare 静态镜像发布链路）：该阶段已确认静态资产映射、重试校验和缺少凭据时失败的行为；v0.9.1 的真实资产与自动同步状态以最新检查点为准。
- 镜像健康巡检：`.github/workflows/mirror-health.yml` 每 6 小时和手动触发，读取 GitHub 最新 Release，对比 Cloudflare 根 manifest 的版本、版本目录、下载地址、安装包和 `.sig`；它不上传资产，不增加提交或 Release 的耗时，失败时作为发布链路告警。
- 历史切片（v0.9.1 编辑历史与恢复）：编辑历史、编辑器保真与相关稳定化内容已包含在 v0.9.1；具体 Release 和验证结果以最新检查点为准。
- 已完成（历史切片）：三栏布局、上下文面板、Milkdown 按需加载与挂载修复、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步、`[[` 双链补全（两模式）、`/` 块级命令菜单（两模式，含 Enter 响应修复）、序列化规范化逐字节断言 + 决策文档 0004。
- 本切片新增（#158）：`e2e/smoke.spec.ts` 的 `readEditorText` 保留 CodeMirror 内部 view state 读取以绕过视口虚拟化，但路径失效时不再静默回退到可视区 DOM，而是抛出 `CodeMirror internal view state path changed — update readEditorText`。现有 round-trip e2e 继续验证完整文档读取；后续若升级 CodeMirror，必须先处理该显式失败，再评估通过公开实例引用替代内部路径。
- #156 已关闭：新增 e2e `downgrades a heading one level per Backspace at its start` 固化 Milkdown heading keymap 的降级语义（H2 起始 Backspace→H1，H1→段落，与 Obsidian/Typora 一致）。调查结论是该 keymap 属于预期 UX；原始 `<br />` 损坏在 #159 的竞态修复后无法复现。
- 历史关键根因（避免复发，详见 git 历史与本文件旧版）：
  1. CodeMirror 补全对中文标签做模糊匹配——补全源需返回 `filter: false` 由应用侧预过滤。
  2. Milkdown `markdownUpdated` 200ms debounce 销毁时被 cancel——cleanup 里需显式 `serializer(view.state.doc)` flush 差量。
  3. CodeMirror `acceptCompletion` 在菜单更新后 75ms 内拒绝 Enter——`autocompletion({ interactionDelay: 0 })`。
- 本切片（#177）为源码、rendered 和 WYSIWYG 模式统一接入 180ms 可取消渲染防抖；`sourceRenderRequestRef` 继续丢弃过期异步结果。`src/app/source-render-scheduler.ts` 是计时契约的唯一入口，单测覆盖延迟与取消；不要把防抖改成不可取消的全局队列，也不要在没有基准的情况下引入更重的解析器。
- 本切片（#180）修复阅读位置持久化竞态：`src/app/reading-position.ts` 维护每个文档最后一次已知的滚动值，旧文档 effect 清理时不会重新读取已切换文档的共享 DOM；位置恢复只在真正进入阅读模式并完成布局后执行，最多重试 6 个动画帧，并监听渲染内容/模式变化，避免 WYSIWYG 首次打开后切到阅读模式时漏恢复。无效和负值归一化为 0，单测覆盖清理时写入最新值与边界值，真实桌面 smoke 覆盖慢布局路径。
- 本切片（#170）将文档内搜索普通命中和当前命中收敛为 `--search-hit` / `--search-hit-active` 主题令牌，系统暗色（无 `data-theme`）和显式深色共用暗色值；新增浏览器 E2E 验证系统暗色下的两个计算背景色。版本文件已统一到 `0.8.3`，PR #212 已合并，Issue #170 已标记 completed；GitHub Release、安装包、签名、`latest.json` 和 Cloudflare 镜像均已在线核验，GitHub 与镜像安装包及签名 SHA-256 一致。
- 本切片（#186）已由 PR #214 合并（提交 `ca0cb8214bb287e681e5e30a8f40e5bfe2c7b67a`），Issue #186 已标记 completed。所有 `aria-modal="true"` 弹层接入 `useModalBehavior`：统一初始焦点、Escape 关闭、Tab/Shift+Tab 焦点循环和卸载后焦点归还；命令面板、快速打开的上下键/Enter 行为不变。单元测试覆盖边界循环、Esc 和焦点恢复，浏览器 E2E 覆盖草稿恢复、快速打开和命令面板的初始焦点/触发器恢复；该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#185）已由 PR #216 合并（提交 `7a35036d75ce7bda4908f3b41c978e2d9e74fbfb`），Issue #185 已标记 completed。在切换文档、关闭标签、打开文件、创建笔记或切换阅读库前同步冲刷当前本地草稿；桌面文件写入失败会阻止切换，成功后确认文案说明可在“草稿”中心恢复。浏览器临时预览仍使用未保存警告；真实 Tauri smoke 新增立即切页、确认文案、草稿存储和恢复清理场景。该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#184）已由 PR #224 合并（提交 `c131d9f122705328e6e475dddf9a3e7391b01ca7`），Issue #184 已标记 completed。草稿恢复中心的逐条“丢弃”先进入可取消确认对话框，取消会恢复中心且不修改本地存储；当前文档的草稿提示新增“稍后处理”，只隐藏提示、不删除草稿。新增确认模态的 Escape/焦点/显式确认单测和浏览器 E2E 取消/确认路径；该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#88）已由 PR #218 合并（提交 `bfc480d33d462e9a462501f822feb059db91bf44`），Issue #88 继续保持 open。真实 Tauri Windows desktop smoke 已覆盖：启动参数打开工作区和 Markdown、默认 WYSIWYG、切换源码、CodeMirror 编辑、Rust 保存写回、外部追加修改后的无冲突自动刷新、本地未保存编辑下的冲突提示、HTML/Word 工作区导出真实写盘、外部新增/删除文件和目录后的文件树刷新、应用内未保存退出确认的真实取消路径，以及桌面端 `[[` 双链候选/接受/序列化和源码 `/ul` 块级命令筛选/接受/写回；退出确认组件单测覆盖 Escape、焦点归还和显式确认回调。确认后会销毁主窗口，WebDriver 会话随之断开，因此烟测不再在销毁窗口后继续发命令。导出保存位置在桌面测试中使用确定的临时目录，正式构建仍使用系统保存对话框；二进制写入优先走原始 IPC，旧 WebView 无法传递原始字节时回退到已有授权写入命令。测试专用编辑器桥只在 `__MOYANG_DESKTOP_E2E__` 构建开关下注册，普通构建不加载测试 capability 或全局入口。PDF 目前仍是打印预览链路，未完成真实桌面文件落盘验证。前端路径键补齐 Windows `\\?\\`/UNC 扩展路径归一化，测试夹具主进程/worker 路径已统一。仍需继续：PDF 文件落盘、更新器桌面回归、a11y 自动化扩展和 i18n 分批迁移；不能把 #88 误报为完成。
- 本切片（UX 简化）继续保持低价值“打开列表”入口的移除，并进一步移除文件树任意前 80 项的“显示全部 / 收起列表”门槛：完整筛选树负责浏览，`Ctrl+P` 负责快速定位，系统多选负责一次打开多个文档，批量导出保持不变；#169 继续负责超大工作区虚拟化与规模保护。
- 本切片继续收敛低收益入口：移除右侧只放“打开关系图”按钮的重复页签，关系图入口统一归入“关联”视图；无阅读库或当前筛选无 Markdown/纯文本/Word 时隐藏批量导出菜单；上下文状态卡片会明确标记外部修改而不是显示“已保存”。旧版持久化的 `graph` 页签值会安全回退到“目录”。
- 本切片（UX 入口审查）已由 PR #219 合并（提交 `6816a7477952725b1e929ea4ce4d59285cccc47f`），Issue #195 保持 open。继续保持“打开列表”和任意“显示全部 / 收起列表”门槛移除；进一步让“添加整个文件夹”在同一界面只保留一个可见入口：侧栏展开时由空白主区或阅读库侧栏承接，侧栏收起后由顶部按钮承接；已有阅读库的空白主区改为引导从文件树或 `Ctrl+P` 开始阅读，根目录文件不再渲染空路径副行。快捷键、命令面板、快速打开、最近记录和批量导出职责不变。本切片不创建 Release 或安装包，纳入下一稳定 v0.9 minor 批次。
- 本切片（多阅读库与直接编辑入口）保留现有最多 5 个阅读库的缓存/持久化模型，但将已打开阅读库的按钮改为“添加阅读库”，切换菜单继续只负责激活另一个库；达到上限时明确禁用并提示先移除，不再让 `rememberMountedWorkspace` 静默挤掉最旧库。顶部新增直接“编辑 / 阅读”主动作，`Ctrl+E` 与它采用读写二态语义，“更多”菜单仍保留源码/WYSIWYG 循环以兼容高级路径。普通 Markdown 输入先更新草稿并经过 180ms 可取消渲染防抖，磁盘仍由明确保存动作写回。
- 本切片（Windows 窗口生命周期）修复 `src-tauri/src/main.rs` 缺少 `windows_subsystem = "windows"` 导致 Debug/Release 进程创建 CMD 宿主的问题；`tauri.conf.json` 改用 `scripts/tauri-dev-server.mjs`，其 Vite 子进程设置 `windowsHide: true`。开发终端仍可能保留日志，这是启动器本身，不是应用额外窗口；安装版不依赖 Vite。该切片已纳入并发布于 v0.9.0；仍需用旧版实机验证更新、替换安装和重启。
- 本切片（#192）更新提示允许在下载进行中隐藏，下载继续运行，顶部“下载中…”入口可恢复进度；“启动时检查更新”改为只读取初始启动快照，运行期间切换设置不会立即触发检查。由于 Tauri updater 当前没有可靠取消信号，不提供伪造的取消下载按钮。
- 本切片（#178）修复外部修改保护：冲突提示“稍后处理”只隐藏提示，`OpenDocument.externallyModified` 持续标记并在标题、标签、正文信息和状态栏呈现；普通保存被拦截，处理选项提供重新载入、覆盖保存和另存为，覆盖保存使用应用内确认并在写入前复核磁盘内容。自身写入增加 in-flight 集合，写入完成后才开始 watcher 抑制窗口；决策细节见 `docs/decisions/0006-external-change-safety.md`。
- 关键入口：`docs/decisions/0004-serialization-normalization.md` 是规范化清单唯一事实源；`e2e/smoke.spec.ts` 的序列化测试与它必须同步修改，且 `readEditorText` 是 CodeMirror 依赖升级的显式哨兵；`src/app/slash-command-menu.ts` 是 slash 命令纯逻辑；`src/app/wiki-link-completion.ts` 是双链补全纯逻辑。
- 相关测试：`e2e/smoke.spec.ts` 的 heading 降级、round-trip、直接“编辑 / 阅读”主动作和草稿丢弃确认场景；`src/app/reading-position.test.ts` 覆盖阅读位置 tracker 的最新值和边界值；`src/app/components/CloseConfirmationDialog.test.tsx` 与 `DraftDiscardConfirmationDialog.test.tsx` 覆盖 Escape、焦点归还和显式确认；`DraftRecoveryNotice.test.tsx` 覆盖“稍后处理”；`src/app/components/ExternalChangeNotice.test.tsx` 与 `ExternalOverwriteDialog.test.tsx` 覆盖冲突处理动作和焦点；`src/app/components/WorkspacePanel.test.tsx` 覆盖多阅读库添加、切换和上限保护；`src/app/components/WorkspaceTree.test.tsx` 防止工作区文件树重新引入任意 80 项截断；`src/app/document-transition.test.ts` 与 `src/app/draft-recovery.test.ts` 覆盖切换文案和草稿存储；`desktop-e2e/smoke.e2e.mjs` 的真实桌面启动/编辑/保存/双链补全/源码 slash 命令/HTML+Word 导出/外部新增删除/外部刷新/真实文件阅读位置切换/切换前草稿冲刷与恢复/冲突标记/覆盖保护/关闭确认取消。批量导出仍存在；合并前以实际门禁输出为准，不要沿用旧的场景计数。
- 已运行：完整前端单测 165/165、lint、format、构建、浏览器 e2e 35/35、真实 Tauri 桌面 smoke 10/10、Rust 单测 35/35、Rust fmt、release:check 和 release 测试均通过；Debug/Release exe 的 PE Subsystem 均为 `Windows GUI`。v0.9.0 Release workflow 的质量门禁和 Windows 签名构建均通过；构建仍可能有既有的大入口包体积提示，Milkdown 保持独立懒加载分包；WebdriverIO embedded provider 的 `tauri-driver`/mock store 诊断噪声不影响测试结果，但若它们变成失败必须单独定位。
- 本切片按重要数据安全修复发布 `v0.8.2` patch；版本号、CHANGELOG、安装包、签名、`latest.json` 和镜像已完成发布核验。纯文档、测试、CI 和内部重构仍可不发布。
- 发布结果：PR #204、#205 已合并；Release workflow [32900250651](https://github.com/MY-moss/moyang_Reader/actions/runs/32900250651) 全部通过，公开 Release 为 [v0.8.2](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.8.2)。GitHub 与 Cloudflare 的 `latest.json` 均为 `0.8.2`、HTTP 200；两边安装包均为 4,862,485 字节，SHA-256 为 `4eed2a25b81c7cb148e80fdf242afc89f4162f4ac24a79787d16fb9f2c592a23`；签名文件均为 424 字节，SHA-256 为 `19d7d860f395d67e3861b729d252f4ccf4ad6c18f628804718d1ef08fb1fed24`。镜像工作流 [32902095328](https://github.com/MY-moss/moyang_Reader/actions/runs/32902095328) 通过；当前未配置 Cloudflare Secret，因此跳过静态资产重新上传，使用已部署的轻量代理并验证成功。
- v0.9.0 发布结果：PR #222 已合并；Release workflow [32933116043](https://github.com/MY-moss/moyang_Reader/actions/runs/32933116043) 和镜像 workflow [32934449872](https://github.com/MY-moss/moyang_Reader/actions/runs/32934449872) 均通过，公开 Release 为 [v0.9.0](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.0)。GitHub 与 Cloudflare 的 `latest.json` 均为 `0.9.0`、HTTP 200；两边 Windows 安装包均为 4,862,669 字节，SHA-256 为 `063a075e50a39d013725eb25a5eb5f38dbf70f4dd39b201b17f99daf6bec497d`；GitHub 与镜像安装包均 HTTP 200，签名文件均 HTTP 200、424 字节，manifest 均带签名字段。
- 更新验证边界：本机检测到已安装 `v0.8.1`，v0.9.0 的 GitHub/镜像 manifest、安装包、签名和 HTTPS 下载链路均已验证；本次仍未自动点击旧版本的“下载并安装”并重启，不能将其记录为完整旧版本实机升级回归。下一次 Windows 实机回归需验证旧版本点击更新、签名校验、替换安装和重启后的版本号。
- 回滚方式：回滚本功能分支即可；无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先查看“最新检查点”、Issues 和当前 PR；确认 #188 的质量检查、合并和 Issue 状态，合并后从最新 `main` 选择下一个 Ready 切片；v0.9.2 稳定验收时统一生成安装包。维护者仍需在 GitHub Actions Secrets 配置 `CLOUDFLARE_API_TOKEN`（仅 Pages 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`，再手动重跑 v0.9.1 镜像工作流；不要把 token 放入聊天、仓库或文档。镜像资产目前已在线且与 GitHub Release 哈希一致；不要重复实现已完成的编辑、搜索、阅读位置、外部修改保护和工作区入口功能。
- CI 触发记录：PR #236 的 head `e364648fe703c4689a148f894525a68d25452a1b` 的 push `Quality checks` 曾被并发重跑取消，恢复后的 job `98264563669` 已成功；PR #236 已合并为 `c08987ac6d5b7b778b0f4814937714c7f302e55b`。Release workflow `32996354493` 已成功，镜像 workflow `32998515986` 仅因 Cloudflare Secrets 缺失失败。
