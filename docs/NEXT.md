# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。执行前仍须只读核对最新 `origin/main`、开放 PR 和对应 Issue；若事实变化，先修正本文件。

## 核验状态

- 最近核验：2026-08-30
- 上一切片：#189 类型感知 TypeScript/ESLint 异步门禁；本切片完成后以 PR/CI 最终状态为准
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 当前状态：READY

## 唯一下一步：#301 文件拖放状态与失败反馈

- Issue：[在线查看 #301](https://github.com/MY-moss/moyang_Reader/issues/301)
- 优先级：Should / P3
- 风险级别：T2（根容器事件、通知状态、键盘/读屏和浏览器/Tauri 回归）
- 版本分类：不单独发布；验收结果进入 `v0.11.0`

### 用户价值

让用户知道窗口接受拖放、松手后会发生什么，以及不支持或部分失败的文件为何没有打开。

### 本切片范围

- 增加拖入、悬停、离开、落放后的稳定状态和轻量覆盖层反馈。
- 处理子元素触发的 dragleave 抖动，并在 drop、dragend、异常和取消后复位。
- 对不支持类型和部分失败给出可关闭、不推挤正文的通知。
- 保持现有 `handleBrowserFiles` 的格式识别、工作区导入和标签页打开规则不变。

### 非目标

- 不把系统文件拖放和文件树内部排序混为同一交互。
- 不改 Markdown、TXT、DOCX、PDF 的识别和编辑语义。
- 不与文件树 CRUD、更新器、镜像或安装包发布混合。

### 验收标准

- [ ] 拖入支持文件时显示明确高亮和文案，离开后高亮消失。
- [ ] 不支持类型、重复拖入和部分失败都有可理解、可关闭的反馈。
- [ ] 快速进出、drop、dragend、取消和异常路径不残留遮罩或监听状态。
- [ ] 键盘、读屏状态和既有文件打开路径不回归；浏览器和一次 Windows desktop 拖放路径通过。
- [ ] 补充根容器状态单测、通知契约回归和一条 E2E；相关 lint、format、build 与 Quality checks 全绿。

### 依赖、风险与回滚

- 依赖：#234 通知契约，以及当前 `handleBrowserFiles` 过滤行为。
- 风险：浏览器和 Windows WebView 的 dragleave 顺序不同；优先使用计数器或 `relatedTarget` 防抖，并记录真实事件路径。
- 回滚：回退单一 #301 PR，删除拖放状态层即可恢复原有 drop handler。

## 完成后

1. 把结果追加到 `docs/handoff/v0.11.md`，并更新 `docs/AI-HANDOFF.md`。
2. 更新 #301、PR 和 CI 单行记录；完成后停止，不自动开始下一项。
3. 除非本文件明确要求稳定发布，不创建安装包、Tag 或 Release。

## 快速触发

```text
继续开发 Moyang Reader。严格读取并执行 docs/NEXT.md 中的唯一下一步，遵循 docs/AI-WORKFLOW.md，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
```
