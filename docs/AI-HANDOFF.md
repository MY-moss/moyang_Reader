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
- 下一位 AI 的唯一下一步；
- 关联 Issue、PR 和是否需要 Release。

## PR 规则

PR 说明必须包含目标、非目标、测试、手动 UI 路径、文档同步情况、截图（如有 UI 改动）、发布影响和回滚方式。没有文档交接说明的代码 PR 不算完成。

功能分支与 `main` 无冲突且 Quality checks 全绿时可以自动合并。遇到真实冲突、失败检查、权限/安全/更新器/发布工作流/数据迁移等高风险变更时暂停并说明原因；禁止强制推送覆盖他人提交。

## Release 规则

合并 PR 不等于发布安装包，但用户功能 minor 版本达到验收后必须及时发布；重要 Bug、保存、更新、签名或安全修复可以直接发布 patch。每个 PR 必须标记无 Release、minor 或 patch，并写出目标版本和理由。稳定发布时必须同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、CHANGELOG、Git tag、GitHub Release、NSIS 安装包、`.sig`、`latest.json` 和 Cloudflare 镜像；发布后必须做在线 HTTP、哈希、签名、manifest 和旧版本自动更新验证。纯文档、测试、CI 和内部重构可以不发布，但交接中必须明确写出原因。完整规则见 `docs/RELEASE-POLICY.md`。

## Token 预算规则

- 先给出短上下文包，再按需读取文件。
- 每轮只汇报新增事实、失败根因和下一步。
- 测试失败只粘贴首个根因和相关文件，不粘贴整段流水线日志。
- 一个 PR 保持一个清晰目标；无关重构另开 Issue。
- 代码、文档和验证结果一起提交，减少下一位 AI 的重复探索。

## 当前功能切片快照

- 基线：`v0.8.2`；已合并 PR #153（阅读工作台）、#154（外部修改同步）、#155（双链补全与 round-trip 样例）、#159（`/` 块级命令菜单）、#160（序列化规范化固化与文档化，关闭 #157）、#204（外部修改保护与低价值入口收敛，关闭 #178）、#208（#177 WYSIWYG 渲染防抖，关闭 #177）、#209（交接文档同步）、#210（#180 阅读位置竞态修复，关闭 #180，合并提交 `50c4f56`）。分支 `codex/heading-downgrade-156` 收尾 #156 调查。
- 已完成（历史切片）：三栏布局、上下文面板、Milkdown 按需加载与挂载修复、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步、`[[` 双链补全（两模式）、`/` 块级命令菜单（两模式，含 Enter 响应修复）、序列化规范化逐字节断言 + 决策文档 0004。
- 本切片新增（#158）：`e2e/smoke.spec.ts` 的 `readEditorText` 保留 CodeMirror 内部 view state 读取以绕过视口虚拟化，但路径失效时不再静默回退到可视区 DOM，而是抛出 `CodeMirror internal view state path changed — update readEditorText`。现有 round-trip e2e 继续验证完整文档读取；后续若升级 CodeMirror，必须先处理该显式失败，再评估通过公开实例引用替代内部路径。
- #156 已关闭：新增 e2e `downgrades a heading one level per Backspace at its start` 固化 Milkdown heading keymap 的降级语义（H2 起始 Backspace→H1，H1→段落，与 Obsidian/Typora 一致）。调查结论是该 keymap 属于预期 UX；原始 `<br />` 损坏在 #159 的竞态修复后无法复现。
- 历史关键根因（避免复发，详见 git 历史与本文件旧版）：
  1. CodeMirror 补全对中文标签做模糊匹配——补全源需返回 `filter: false` 由应用侧预过滤。
  2. Milkdown `markdownUpdated` 200ms debounce 销毁时被 cancel——cleanup 里需显式 `serializer(view.state.doc)` flush 差量。
  3. CodeMirror `acceptCompletion` 在菜单更新后 75ms 内拒绝 Enter——`autocompletion({ interactionDelay: 0 })`。
- 本切片（#177）为源码、rendered 和 WYSIWYG 模式统一接入 180ms 可取消渲染防抖；`sourceRenderRequestRef` 继续丢弃过期异步结果。`src/app/source-render-scheduler.ts` 是计时契约的唯一入口，单测覆盖延迟与取消；不要把防抖改成不可取消的全局队列，也不要在没有基准的情况下引入更重的解析器。
- 本切片（#180）修复阅读位置持久化竞态：`src/app/reading-position.ts` 维护每个文档最后一次已知的滚动值，旧文档 effect 清理时不会重新读取已切换文档的共享 DOM；位置恢复只在真正进入阅读模式并完成布局后执行，最多重试 6 个动画帧，并监听渲染内容/模式变化，避免 WYSIWYG 首次打开后切到阅读模式时漏恢复。无效和负值归一化为 0，单测覆盖清理时写入最新值与边界值，真实桌面 smoke 覆盖慢布局路径。
- 本切片（#88）新增真实 Tauri Windows desktop smoke：启动参数打开工作区和 Markdown、默认 WYSIWYG、切换源码、CodeMirror 编辑、Rust 保存写回、外部追加修改后的无冲突自动刷新、本地未保存编辑下的冲突提示、HTML/Word 工作区导出真实写盘、外部新增/删除文件和目录后的文件树刷新，以及应用内未保存退出确认的真实取消路径均已通过；退出确认组件单测覆盖 Escape、焦点归还和显式确认回调。确认后会销毁主窗口，WebDriver 会话随之断开，因此烟测不再在销毁窗口后继续发命令。导出保存位置在桌面测试中使用确定的临时目录，正式构建仍使用系统保存对话框；二进制写入优先走原始 IPC，旧 WebView 无法传递原始字节时回退到已有授权写入命令。PDF 目前仍是打印预览链路，未完成真实桌面文件落盘验证。前端路径键补齐 Windows `\\?\\`/UNC 扩展路径归一化，测试夹具主进程/worker 路径已统一，普通构建不加载测试 capability。仍需继续：更新、双链补全与 `/` 触发器的桌面端回归（浏览器 e2e 无法挂载工作区，见 `src/app/bridge.ts` 的 `chooseWorkspacePath`）、a11y 自动化扩展和 i18n 分批迁移；不能把 #88 误报为完成。
- 本切片（UX 简化）继续保持低价值“打开列表”入口的移除，并进一步移除文件树任意前 80 项的“显示全部 / 收起列表”门槛：完整筛选树负责浏览，`Ctrl+P` 负责快速定位，系统多选负责一次打开多个文档，批量导出保持不变；#169 继续负责超大工作区虚拟化与规模保护。
- 本切片继续收敛低收益入口：移除右侧只放“打开关系图”按钮的重复页签，关系图入口统一归入“关联”视图；无阅读库或当前筛选无 Markdown/纯文本/Word 时隐藏批量导出菜单；上下文状态卡片会明确标记外部修改而不是显示“已保存”。旧版持久化的 `graph` 页签值会安全回退到“目录”。
- 本切片（#192）更新提示允许在下载进行中隐藏，下载继续运行，顶部“下载中…”入口可恢复进度；“启动时检查更新”改为只读取初始启动快照，运行期间切换设置不会立即触发检查。由于 Tauri updater 当前没有可靠取消信号，不提供伪造的取消下载按钮。
- 本切片（#178）修复外部修改保护：冲突提示“稍后处理”只隐藏提示，`OpenDocument.externallyModified` 持续标记并在标题、标签、正文信息和状态栏呈现；普通保存被拦截，处理选项提供重新载入、覆盖保存和另存为，覆盖保存使用应用内确认并在写入前复核磁盘内容。自身写入增加 in-flight 集合，写入完成后才开始 watcher 抑制窗口；决策细节见 `docs/decisions/0006-external-change-safety.md`。
- 关键入口：`docs/decisions/0004-serialization-normalization.md` 是规范化清单唯一事实源；`e2e/smoke.spec.ts` 的序列化测试与它必须同步修改，且 `readEditorText` 是 CodeMirror 依赖升级的显式哨兵；`src/app/slash-command-menu.ts` 是 slash 命令纯逻辑；`src/app/wiki-link-completion.ts` 是双链补全纯逻辑。
- 相关测试：`e2e/smoke.spec.ts` 的 heading 降级与 round-trip 场景；`src/app/reading-position.test.ts` 覆盖阅读位置 tracker 的最新值和边界值；`src/app/components/CloseConfirmationDialog.test.tsx` 覆盖 Escape、焦点归还和确认回调；`src/app/components/ExternalChangeNotice.test.tsx` 与 `ExternalOverwriteDialog.test.tsx` 覆盖冲突处理动作和焦点；`src/app/components/WorkspaceTree.test.tsx` 防止工作区文件树重新引入任意 80 项截断；`desktop-e2e/smoke.e2e.mjs` 的真实桌面启动/编辑/保存/HTML+Word 导出/外部新增删除/外部刷新/真实文件阅读位置切换/冲突标记/覆盖保护/关闭确认取消。批量导出仍存在；合并前以实际门禁输出为准，不要沿用旧的场景计数。
- 已运行：#177 定向单测 2/2；#180 定向单测 2/2；完整前端单测 154/154、lint、format、构建、浏览器 e2e 32/32、真实 Tauri 桌面 smoke 8/8；此前 Rust 单测 35/35、Rust fmt、clippy、release:check 和 release 测试也已通过。构建仍可能有既有的大入口包体积提示，Milkdown 保持独立懒加载分包；WebdriverIO embedded provider 的 `tauri-driver`/mock store 诊断噪声不影响测试结果，但若它们变成失败必须单独定位。
- 本切片按重要数据安全修复发布 `v0.8.2` patch；版本号、CHANGELOG、安装包、签名、`latest.json` 和镜像已完成发布核验。纯文档、测试、CI 和内部重构仍可不发布。
- 发布结果：PR #204、#205 已合并；Release workflow [32900250651](https://github.com/MY-moss/moyang_Reader/actions/runs/32900250651) 全部通过，公开 Release 为 [v0.8.2](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.8.2)。GitHub 与 Cloudflare 的 `latest.json` 均为 `0.8.2`、HTTP 200；两边安装包均为 4,862,485 字节，SHA-256 为 `4eed2a25b81c7cb148e80fdf242afc89f4162f4ac24a79787d16fb9f2c592a23`；签名文件均为 424 字节，SHA-256 为 `19d7d860f395d67e3861b729d252f4ccf4ad6c18f628804718d1ef08fb1fed24`。镜像工作流 [32902095328](https://github.com/MY-moss/moyang_Reader/actions/runs/32902095328) 通过；当前未配置 Cloudflare Secret，因此跳过静态资产重新上传，使用已部署的轻量代理并验证成功。
- 更新验证边界：本机检测到已安装 `v0.8.1`，GitHub/镜像 manifest、安装包、签名和 HTTPS 下载链路均已验证；本次未自动点击旧版本的“下载并安装”并重启，不能将其记录为完整旧版本实机升级回归。下一次 Windows 实机回归需验证旧版本点击更新、签名校验、替换安装和重启后的版本号。
- 回滚方式：回滚本功能分支即可；无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先补旧版本 `v0.8.1` 到 `v0.8.2` 的真实更新安装/重启回归，再选择 #88 的 PDF 文件落盘、更新/双链与 `/` 真实桌面回归，或 #169 的工作区规模基线。#180 已由 PR #210 合并并关闭；#177 的防抖实现已由 PR #208 合并并关闭。不要重复实现当前的阅读位置、外部修改保护、WYSIWYG 渲染防抖、启动/编辑/保存/无冲突外部刷新/外部新增删除/HTML+Word 导出/关闭确认 smoke，也不要把 #174（React 错误边界）混入本切片。

