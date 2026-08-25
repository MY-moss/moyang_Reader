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

- 基线：`v0.8.1`；已合并 PR #153（阅读工作台）、#154（外部修改同步）、#155（双链补全与 round-trip 样例），分支 `codex/slash-menu-2026-08-25` 推进 v0.9.2 编辑器交互深化的 `/` 块级触发器切片。
- 已完成（历史切片）：三栏布局、上下文面板、Milkdown 按需加载与挂载修复、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步、`[[` 双链补全（两模式）。
- 本切片新增：`/` 块级命令菜单在两种编辑模式下落地。源码模式走 CodeMirror autocompletion（`slashCommandSource` 与 wiki 补全并列 override）；WYSIWYG 模式复用 caret 触发浮层，命令通过 `slashCommandAction` 映射到 Milkdown 块级命令（标题 1–3、无序/有序列表、引用、代码块、3×3 表格、分隔线）。纯逻辑收敛在 `src/app/slash-command-menu.ts`（命令表、块首触发匹配、拼音/英文关键字过滤排序、源码插入光标落点）。
- **本切片两个关键根因（避免复发）**：
  1. CodeMirror 补全对中文标签做模糊匹配——ASCII 查询（如 `ul`）会把“无序列表”等中文标签全部滤掉。修复：两个补全源都返回 `filter: false`，由我们自己的 `filterSlashCommands` 预过滤；斜杠源不设 `validFor` 以保证每个按键都重跑过滤。
  2. Milkdown `markdownUpdated` 是 200ms debounce，销毁时被 cancel——快速切换模式会丢掉最后 200ms 内的编辑。修复：`MarkdownWysiwygEditor` 的 effect cleanup 里直接用 `serializer(view.state.doc)` 序列化并 flush 未同步的差量（`lastSyncedMarkdownRef` 对账）。
- 仍需继续：双链补全与 `/` 触发器的桌面端手动验证（浏览器 e2e 无法挂载工作区，见 `src/app/bridge.ts` 的 `chooseWorkspacePath`）、序列化风格偏好（#157）、e2e 防御性回退（#158）、#156 间歇性标题损坏观察、真实 Tauri 桌面 E2E（#88）、a11y 自动化扩展和 i18n 分批迁移；不能把这些未完成项误报为完成。
- 关键入口：`src/app/slash-command-menu.ts` 是命令纯逻辑；`src/app/components/SourceEditor.tsx` 接 CodeMirror 补全（wiki + slash 两个 override 源）；`src/app/components/MarkdownWysiwygEditor.tsx` 用原生 capture 监听接管浮层键盘（wiki/slash 共用浮层与键位处理）；`src/app/wiki-link-completion.ts` 是双链补全纯逻辑。
- 相关测试：`src/app/slash-command-menu.test.ts`（命令过滤/触发匹配/光标落点单测）；`src/app/wiki-link-completion.test.ts`；`src/app/components/wysiwyg-editor-setup.test.ts`；`e2e/smoke.spec.ts` 的 "inserts a heading from the wysiwyg slash menu" 和 "inserts a list from the source mode slash menu"（含模式切换后源码对账）。
- 已运行：`npm test` 29 个文件 140 个测试通过；`npm run lint`、`npm run format:check`、`npm run build`（含 `tsc -b`）、`npx playwright test`（30 个 e2e）全部通过。构建仍有既有的大入口包体积提示，Milkdown 保持独立懒加载分包。
- 发布影响：本切片不改版本号、不创建 Release、不生成安装包；合并前只推送功能分支和交接文档。稳定批次按 `docs/ROADMAP.md` 执行发布检查。
- 回滚方式：回滚本功能分支即可；无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先检查 Issues 与当前 PR 状态，然后在 Tauri 桌面运行 `npm run desktop` 手动验证 `[[` 补全和 `/` 触发器（含 IME 输入、代码块内不触发），再推进 #157 序列化风格偏好或 #88 桌面 E2E；不要重复实现 `/` 触发器。
