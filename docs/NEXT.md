# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。执行前仍须只读核对最新 main、开放 PR 和对应 Issue；若事实变化，先修正本文件。

## 核验状态

- 最近核验：2026-08-31
- 上一功能切片：#172 reduced-motion 程序化滚动；PR #374 已合并，Issue #172 已关闭
- 上一工程切片：#375 工作区空间治理；PR #375 已合并
- 合并基线：main@c3f5c8ce1967f2649a47337ca699aedca48fd1e8
- 稳定版本：v0.10.13
- 当前 milestone：v0.11.0
- 当前状态：READY
- 开放 PR：无产品功能 PR；仅有 Dependabot 依赖 PR，不阻塞本切片

## 唯一下一步：#357 右键菜单脱离 content-area 包含块

- Issue：[在线查看 #357](https://github.com/MY-moss/moyang_Reader/issues/357)
- 优先级：Must / P2
- 风险级别：T2（右键定位、裁剪、滚动和菜单交互）
- 版本分类：不单独发布；验收结果进入 v0.11.0

### 用户价值

让 Windows 用户在阅读区、所见即所得编辑器和源码编辑器中右键时，菜单贴近光标、不会被正文滚动容器裁剪，也不会随文档滚动漂移。

### 本切片范围

- 使共享右键菜单脱离 `.content-area` 的 CSS containing block，保留现有视口坐标和边缘翻转逻辑。
- 覆盖阅读区、WYSIWYG 和源码编辑器三个挂载入口。
- 增加右键位置与滚动稳定性的回归测试；与 #299 的焦点契约保持兼容。

### 非目标

- 不重做右键菜单的业务动作、视觉主题或文件管理功能。
- 不重构三栏布局、编辑器、滚动系统或 CSS 令牌。
- 不改变 Markdown、搜索、保存、导出、更新器和持久化语义。

### 验收标准

- [ ] 三个入口打开菜单后，菜单矩形与鼠标视口坐标误差不超过 4px。
- [ ] 菜单靠近内容区边缘时仍按视口边界翻转，不被内容区裁剪。
- [ ] 打开菜单后滚动文档，菜单不会随正文内容漂移。
- [ ] 现有菜单键盘导航、Escape 关闭和焦点归还不回归。
- [ ] 相关单测、lint、format、TypeScript 检查和一个浏览器 E2E 通过。

### 依赖、风险与回滚

- 依赖：现有 #299 焦点契约和三个右键挂载点。
- 风险：portal 改变事件冒泡或焦点上下文；测试需覆盖菜单选择、外点关闭和失效触发器。
- 回滚：回退本切片 PR；不改持久化格式，不触碰更新器和发布资产。

### 预计修改范围

- 源码：`src/app/components/ContextMenu.tsx`、`src/app/App.tsx`、`src/app/components/MarkdownWysiwygEditor.tsx`、`src/app/components/SourceEditor.tsx`、相关样式。
- 测试：共享 ContextMenu 定向测试、一个右键定位/滚动浏览器 E2E；必要时补 Windows desktop smoke。
- 文档：本文件、`docs/handoff/v0.11.md`、`docs/AI-HANDOFF.md`、`docs/ISSUE-INDEX.md`、`docs/ROADMAP.md`。

## 完成后

1. 把结果追加到 `docs/handoff/v0.11.md`，并更新 `docs/AI-HANDOFF.md`、`docs/ISSUE-INDEX.md` 和 `docs/ROADMAP.md`。
2. 更新 #357、PR 和 CI 单行记录；完成后停止，不自动开始下一项。
3. 除非本文件明确要求稳定发布，不创建安装包、Tag 或 Release。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 `docs/NEXT.md` 中的唯一下一步，遵循 `docs/AI-WORKFLOW.md`，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
