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

- 基线：`v0.8.1`；已合并 PR #153（阅读工作台）、#154（外部修改同步）、#155（双链补全与 round-trip 样例）、#159（`/` 块级命令菜单）、#160（序列化规范化固化与文档化，关闭 #157）。分支 `codex/heading-downgrade-156` 收尾 #156 调查。
- 已完成（历史切片）：三栏布局、上下文面板、Milkdown 按需加载与挂载修复、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步、`[[` 双链补全（两模式）、`/` 块级命令菜单（两模式，含 Enter 响应修复）、序列化规范化逐字节断言 + 决策文档 0004。
- 本切片新增（#158）：`e2e/smoke.spec.ts` 的 `readEditorText` 保留 CodeMirror 内部 view state 读取以绕过视口虚拟化，但路径失效时不再静默回退到可视区 DOM，而是抛出 `CodeMirror internal view state path changed — update readEditorText`。现有 round-trip e2e 继续验证完整文档读取；后续若升级 CodeMirror，必须先处理该显式失败，再评估通过公开实例引用替代内部路径。
- #156 已关闭：新增 e2e `downgrades a heading one level per Backspace at its start` 固化 Milkdown heading keymap 的降级语义（H2 起始 Backspace→H1，H1→段落，与 Obsidian/Typora 一致）。调查结论是该 keymap 属于预期 UX；原始 `<br />` 损坏在 #159 的竞态修复后无法复现。
- 历史关键根因（避免复发，详见 git 历史与本文件旧版）：
  1. CodeMirror 补全对中文标签做模糊匹配——补全源需返回 `filter: false` 由应用侧预过滤。
  2. Milkdown `markdownUpdated` 200ms debounce 销毁时被 cancel——cleanup 里需显式 `serializer(view.state.doc)` flush 差量。
  3. CodeMirror `acceptCompletion` 在菜单更新后 75ms 内拒绝 Enter——`autocompletion({ interactionDelay: 0 })`。
- 本切片（#88）新增真实 Tauri Windows desktop smoke：启动参数打开工作区和 Markdown、默认 WYSIWYG、切换源码、CodeMirror 编辑、Rust 保存写回、外部追加修改后的无冲突自动刷新、本地未保存编辑下的冲突提示、HTML/Word 工作区导出真实写盘，以及外部新增/删除文件和目录后的文件树刷新均已通过；导出保存位置在桌面测试中使用确定的临时目录，正式构建仍使用系统保存对话框；二进制写入优先走原始 IPC，旧 WebView 无法传递原始字节时回退到已有授权写入命令。PDF 目前仍是打印预览链路，未完成真实桌面文件落盘验证。前端路径键补齐 Windows `\\?\\`/UNC 扩展路径归一化，测试夹具主进程/worker 路径已统一，普通构建不加载测试 capability。仍需继续：更新、关闭确认，以及双链补全与 `/` 触发器的桌面端回归（浏览器 e2e 无法挂载工作区，见 `src/app/bridge.ts` 的 `chooseWorkspacePath`）、a11y 自动化扩展和 i18n 分批迁移；不能把 #88 误报为完成。
- 本切片（UX 简化）移除低价值的“打开列表”入口及其批量开标签页状态/计划模块：它没有逐项选择，会把最多 40 个筛选结果直接塞进标签页；单击文件、`Ctrl+P` 快速打开和系统多选打开已覆盖真实需求，批量导出保持不变。
- 关键入口：`docs/decisions/0004-serialization-normalization.md` 是规范化清单唯一事实源；`e2e/smoke.spec.ts` 的序列化测试与它必须同步修改，且 `readEditorText` 是 CodeMirror 依赖升级的显式哨兵；`src/app/slash-command-menu.ts` 是 slash 命令纯逻辑；`src/app/wiki-link-completion.ts` 是双链补全纯逻辑。
- 相关测试：`e2e/smoke.spec.ts` 的 "downgrades a heading one level per Backspace at its start"；"serializes equivalent markdown styles to canonical forms"（#160 引入）；`desktop-e2e/smoke.e2e.mjs` 的真实桌面启动/编辑/保存/HTML+Word 导出/外部新增删除/外部刷新/冲突提示，以及“打开列表”已移除、批量导出仍存在的回归断言；本切片新增真实桌面新增删除场景。合并前以实际门禁输出为准，不要沿用旧的 139/32/3/4 场景计数。
- 已运行：前端单测、Rust 单测、lint、格式检查、普通构建、Tauri Debug 构建、桌面 smoke 和全量浏览器 e2e 均应在本切片合并前重新记录；桌面 smoke 当前为 5 个场景，包含真实 HTML/Word 写盘与外部新增删除刷新。构建仍可能有既有的大入口包体积提示，Milkdown 保持独立懒加载分包；WebdriverIO embedded provider 的 `tauri-driver`/mock store 诊断噪声不影响测试结果，但若它们变成失败必须单独定位。
- 本切片新增版本与发布政策文档：用户功能 minor 版本必须有公开 Release 和安装包，重要 Bug/更新/安全修复可直接发布 patch；纯文档、测试、CI 和内部重构可以不发布。本次仅同步流程文档，不改应用版本、不创建空 Release。
- 发布影响：本切片不改版本号、不创建 Release、不生成安装包；合并前只推送功能分支和交接文档。稳定批次按 `docs/ROADMAP.md` 执行发布检查。
- 回滚方式：回滚本功能分支即可；无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先检查 Issues、PR 和 `origin/main`，确认本切片已合并后继续 #88 的更新器或未保存关闭确认真实桌面场景，并优先选择一个可独立验收的切片；不要重复实现当前的启动/编辑/保存/无冲突外部刷新/外部新增删除/HTML+Word 导出 smoke，也不要把 #169（工作区规模上限）或 #174（React 错误边界）混入本切片。
