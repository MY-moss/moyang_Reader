# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。执行前仍须只读核对最新 main、开放 PR 和对应 Issue；若事实变化，先修正本文件。

## 核验状态

- 最近核验：2026-08-31
- 上一功能切片：#357 右键菜单 viewport 定位；PR #377 已合并，Issue #357 已关闭
- 上一工程切片：#375 工作区空间治理；PR #375 已合并
- 合并基线：main@999b2254c259e1145eabc94374772e1e135913f1
- 稳定版本：v0.10.13
- 当前 milestone：v0.11.0
- 当前状态：READY
- 开放 PR：无产品功能 PR；仅有 Dependabot 依赖 PR，不阻塞本切片

## 唯一下一步：#358 插入浮层跟随光标/视口

- Issue：[在线查看 #358](https://github.com/MY-moss/moyang_Reader/issues/358)
- 优先级：Must / P2
- 风险级别：T2（插入定位、焦点和阅读位置回归）
- 版本分类：不单独发布；验收结果进入 v0.11.0

### 用户价值

让 Windows 用户在长文档中部插入链接、图片或表格时，浮层出现在当前编辑位置附近，焦点不会把正文滚回文首，提交后仍能继续编辑原位置。

### 本切片范围

- 将插入浮层改为视口内定位，使用 Milkdown 和 CodeMirror 的当前光标/选区坐标，并复用 #357 的 portal 浮层边界。
- 打开输入框时使用 `focus({ preventScroll: true })`；编辑器滚动时关闭浮层，避免显示过期锚点。
- 覆盖工具栏、快捷键和右键插入入口，保留当前插入内容与选择恢复语义。

### 非目标

- 不重做浮层视觉主题、右键菜单或三栏布局。
- 不引入编辑器插件、自动保存、版本历史或新的持久化格式。
- 不改变 Markdown 真源、插入语义、搜索、保存、导出或更新器。

### 验收标准

- [ ] 长文档滚动到中部打开链接、图片和表格插入，浮层完整位于视口内。
- [ ] 打开浮层不会改变 `.content-area` 的 scrollTop，输入框获得焦点也不触发滚动回文首。
- [ ] 编辑器滚动后浮层关闭或重新定位，不残留过期锚点；Escape/外点关闭可继续编辑。
- [ ] 提交后原编辑器选区/光标恢复，既有 Markdown 输出和右键菜单焦点契约不回归。
- [ ] 相关单测、lint、format、TypeScript 检查和一个浏览器 E2E 通过。

### 依赖、风险与回滚

- 依赖：#357 的 portal 浮层基座、Milkdown/CodeMirror 光标坐标和现有选区恢复逻辑。
- 风险：不同编辑器坐标 API 在滚动/未挂载时可能返回空值；需安全关闭或回退到视口边界，不能劫持滚动。
- 回滚：回退本切片 PR；不改持久化格式，不触碰更新器和发布资产。

### 预计修改范围

- 源码：`src/app/components/EditorInsertPopover.tsx`、`src/app/components/MarkdownWysiwygEditor.tsx`、`src/app/components/SourceEditor.tsx`、相关样式。
- 测试：插入浮层/选区定向单测、一个长文档中部插入浏览器 E2E；必要时补 Windows desktop smoke。
- 文档：本文件、`docs/handoff/v0.11.md`、`docs/AI-HANDOFF.md`、`docs/ISSUE-INDEX.md`、`docs/ROADMAP.md`。

## 完成后

1. 把结果追加到 `docs/handoff/v0.11.md`，并更新 `docs/AI-HANDOFF.md`、`docs/ISSUE-INDEX.md` 和 `docs/ROADMAP.md`。
2. 更新 #358、PR 和 CI 单行记录；完成后停止，不自动开始下一项。
3. 除非本文件明确要求稳定发布，不创建安装包、Tag 或 Release。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 `docs/NEXT.md` 中的唯一下一步，遵循 `docs/AI-WORKFLOW.md`，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。

