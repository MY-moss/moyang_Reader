# AI 开发与交接流程

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

- 基线：`v0.8.1`；当前目标：`v0.9.0 UI 三栏 + Markdown WYSIWYG 最小垂直切片`。
- 已完成：三栏布局职责、右侧上下文面板（目录/关联/属性/关系图入口）、左右面板记忆、Milkdown 按需加载、Markdown 安全回退、`Ctrl+E`、`Ctrl+K`、`Ctrl+Shift+P`、命令面板和对应 E2E 迁移。
- 仍需继续：Milkdown 与复杂 Markdown 的 round-trip 细节、双链补全、外部修改时编辑器内容同步、真实 Tauri 桌面 E2E；这些属于 v0.9.0/v0.9.1 后续切片，不能在交接时误报为完成。
- 关键入口：`src/app/App.tsx` 负责组合；`src/app/components/ContextPanel.tsx` 负责右栏；`src/app/components/MarkdownWysiwygEditor.tsx` 负责懒加载编辑器；`src/app/markdown-editor-support.ts` 负责安全预检。
- 验证基线：`npm test -- --run`、`npm run lint`、`npm run format:check`、`npm run build`、`npm run test:e2e`。
- 发布影响：本切片不改版本号、不创建 Release、不生成安装包；合并前只推送功能分支和交接文档。稳定批次按 `docs/ROADMAP.md` 执行发布检查。
- 回滚方式：回滚本功能分支的 UI/编辑器提交即可；不需要迁移用户文档，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先检查 Issues 与当前 PR 状态，再为 v0.9.0 补 Markdown WYSIWYG round-trip/外部修改测试，不要重复搭建三栏布局。
