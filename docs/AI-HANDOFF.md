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

合并 PR 不等于发布安装包。稳定批次才更新版本号、CHANGELOG、Release、`.sig`、`latest.json` 和 Cloudflare 镜像；发布后必须做在线 HTTP、哈希、签名、manifest 和旧版本自动更新验证。

## Token 预算规则

- 先给出短上下文包，再按需读取文件。
- 每轮只汇报新增事实、失败根因和下一步。
- 测试失败只粘贴首个根因和相关文件，不粘贴整段流水线日志。
- 一个 PR 保持一个清晰目标；无关重构另开 Issue。
- 代码、文档和验证结果一起提交，减少下一位 AI 的重复探索。

## 当前功能切片快照

- 基线：`v0.8.1`；已合并基础切片 PR #153 和外部修改同步 PR #154，分支 `codex/wiki-completion-2026-08-25` 推进 v0.9.1 编辑稳定化的双链补全切片。
- 已完成：三栏布局职责、右侧上下文面板、左右面板记忆、Milkdown 按需加载、Markdown 安全回退、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步。
- 本切片新增：源码模式（CodeMirror autocompletion）和 WYSIWYG 模式（caret 触发浮层）的 `[[` 双链补全，候选来自工作区 Markdown 文档并排除当前文档；Milkdown 支持语法 round-trip 样例 e2e（标题/行内样式/双链/嵌套与任务列表/引用/代码块/表格/图片/分隔线全部保真）。
- **关键修复**：WYSIWYG 编辑器自 v0.9.0 起从未真正挂载——`@milkdown/preset-gfm` 7.22.x 的 `gfm` 导出不再内含 commonmark 基础预设，ProseMirror schema 缺 `doc` 顶层节点导致创建失败且 UI 静默空白。修复：`src/app/components/wysiwyg-editor-setup.ts` 显式注册 `[commonmark, gfm]`；新增挂载回归单测 `wysiwyg-editor-setup.test.ts`；smoke round-trip e2e 现在会等待 contenteditable 真正出现并在编辑后校验序列化结果；编辑面挂载失败时显示可见错误提示（`.wysiwyg-error`）。round-trip 探针结论：脚注、autolink、转义、有序列表完全保真；setext 标题规范化为 ATX、嵌套引用加空行、链接引用定义内联化——语义均无损。
- **e2e 读取缺陷澄清（重要，避免误诊）**：round-trip e2e 曾稳定“复现”末段丢失，经插桩验证序列化链路（markdownUpdated → updateSource → SourceEditor 挂载值）始终包含末段——真凶是 CodeMirror 视口虚拟化：`.cm-line` 只渲染可视区，长文档尾部不在 DOM 中。`e2e/smoke.spec.ts` 的 `readEditorText` 现通过 `.cm-content` → `cmTile` → `root` → `view` → `state.doc` 读取完整文本（CM 6.43 内部路径，升级 CM 需复查，见 #158）。调试中曾一次性观察到标题被替换为 `<br />` 的间歇性损坏（约 1/8 概率，无法稳定复现），已记录为 #156 待观察；序列化本身经单测 + 插桩双重验证无损，已知样式规范化清单见 #157。
- 仍需继续：双链补全的桌面端手动验证（浏览器 e2e 无法挂载工作区，见 `src/app/bridge.ts` 的 `chooseWorkspacePath`）、编辑器内 `/` 触发器、真实 Tauri 桌面 E2E（#88）、a11y 自动化扩展和 i18n 分批迁移；不能把这些未完成项误报为完成。
- 关键入口：`src/app/wiki-link-completion.ts` 是补全纯逻辑（候选构建、触发匹配、过滤排序、键盘映射）；`src/app/components/SourceEditor.tsx` 接 CodeMirror 补全；`src/app/components/MarkdownWysiwygEditor.tsx` 用原生 capture 监听接管浮层键盘；`src/app/App.tsx` 的 `wikiLinkCandidates` memo 负责喂数据。
- 相关测试：`src/app/wiki-link-completion.test.ts`（12 个单测）；`src/app/components/wysiwyg-editor-setup.test.ts`（编辑器挂载回归）；`e2e/smoke.spec.ts` 的 "keeps supported markdown syntax through the wysiwyg editor"（含真实编辑后序列化校验）。
- 已运行：`npm test -- --run` 27 个文件 129 个测试通过；`npm run lint`、`npm run format:check`、`npx tsc -b --pretty false`、`npm run build`、`npx playwright test`（28 个 e2e）全部通过。构建仍有既有的大入口包体积提示，Milkdown 保持独立懒加载分包。
- 发布影响：本切片不改版本号、不创建 Release、不生成安装包；合并前只推送功能分支和交接文档。稳定批次按 `docs/ROADMAP.md` 执行发布检查。
- 回滚方式：回滚本功能分支即可；`@codemirror/autocomplete` 是既有传递依赖的显式声明，无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先检查 Issues 与当前 PR 状态，然后在 Tauri 桌面运行 `npm run desktop` 手动验证 `[[` 补全（含同名文档、IME 输入、代码块内不触发），再推进 `/` 触发器或 #88 桌面 E2E；不要重复实现双链补全。
