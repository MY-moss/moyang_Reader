# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。执行前仍须只读核对最新 main、开放 PR 和对应 Issue；若事实变化，先修正本文件。

## 核验状态

- 最近核验：2026-08-31
- 上一切片：#190 首屏按需加载与大文档渐进挂载；PR #351 已合并，Issue #190 已以 completed 关闭
- 合并基线：main@e7a08d655d952201eeae58e77624284cdf52bf1d
- 稳定版本：v0.10.13
- 当前 milestone：v0.11.0
- 当前状态：READY

## 唯一下一步：#172 尊重 reduced-motion 的程序化滚动

- Issue：[在线查看 #172](https://github.com/MY-moss/moyang_Reader/issues/172)
- 优先级：Should / P3
- 风险级别：T2（滚动行为、可访问性和阅读位置回归）
- 版本分类：不单独发布；验收结果进入 v0.11.0

### 用户价值

让 Windows 用户关闭动画后，目录跳转、锚点定位和阅读边界滚动不再被强制平滑滚动打断。

### 本切片范围

- 抽取统一的滚动行为工具，读取 prefers-reduced-motion。
- 替换目录/锚点跳转与阅读区边界滚动中的显式 smooth。
- 补充 matchMedia 单测和 reduced-motion 浏览器路径。

### 非目标

- 不删除普通用户的平滑滚动，不重做阅读轨道。
- 不把所有滚动动画和 CSS 主题一起重构。
- 不改变 Markdown、搜索、编辑器、导出或更新器语义。

### 验收标准

- [ ] 系统减少动画时程序化滚动为 auto/瞬时，普通模式保持当前体验。
- [ ] 运行时切换偏好有合理行为，或在文档中明确需要重新打开窗口。
- [ ] 目录跳转、回顶/底和长文档阅读轨道不回归。
- [ ] 相关单测、lint、format、TypeScript 检查和一个浏览器 E2E 通过。

### 依赖、风险与回滚

- 依赖：#168 阅读轨道、#119 Windows 可访问性基线和现有滚动入口。
- 风险：不同 WebView 对 matchMedia 事件支持不同；提供初始读取和安全默认值。
- 回滚：回退本切片 PR；不改持久化格式，不触碰更新器和发布资产。

## 完成后

1. 把结果追加到 docs/handoff/v0.11.md，并更新 docs/AI-HANDOFF.md、docs/ISSUE-INDEX.md 和 docs/ROADMAP.md。
2. 更新 #172、PR 和 CI 单行记录；完成后停止，不自动开始下一项。
3. 除非本文件明确要求稳定发布，不创建安装包、Tag 或 Release。

## 快速触发

继续开发 Moyang Reader。严格读取并执行 docs/NEXT.md 中的唯一下一步，遵循 docs/AI-WORKFLOW.md，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
