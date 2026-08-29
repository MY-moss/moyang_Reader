# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。若它与远端 `main`、开放 PR 或 GitHub Issue 冲突，先修正本文件，不要按过时状态开发。

## 核验状态

- 最近核验：2026-08-30
- 远程主线：`main@0c83f80e552db67e9a6e68e758f9fccf588c854c`
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 开放 PR：规划切片开始时为 0；开始开发前必须重新查询一次
- 当前状态：READY

## 唯一下一步：#87 批量 DOCX 最终 Windows 矩阵

- Issue：[#87](https://github.com/MY-moss/moyang_Reader/issues/87)
- 优先级：Must / P2
- 风险级别：T3（真实 Windows 导出、取消和文件清理）
- 版本分类：不单独发布；验收结果进入 `v0.11.0`

### 用户价值

确认大量图片、长文本和复杂块组成的批量 Word 导出不会长期冻结窗口，取消能及时生效，失败不会留下可误用的半成品。

### 本切片范围

- 在现有真实 Tauri desktop smoke 上建立 96 篇文档矩阵。
- 覆盖大型重复图片、独立图片、超长文本、复杂表格和嵌套 HTML。
- 同一矩阵连续运行三轮，记录事件循环、上下文交互、取消延迟和 Working Set 趋势。
- 每轮验证已提交 DOCX 是有效 ZIP，包含 `word/document.xml`，且取消/失败后无 `.moyang-export-part-*.tmp`。
- 基线通过时只固化回归证据；只有指标失败时才对对应序列化/释放路径做最小修复。

### 非目标

- 不改 Markdown、HTML、Word 或 PDF 输出语义。
- 不重写导出器、Worker 协议或 Rust 文件授权。
- 不同时实现通知、拖放、类型门禁、更新器或右键菜单。
- 不创建安装包、Tag、Release 或 Cloudflare 部署。

### 验收标准

- [ ] 三轮事件循环最大间隔均不超过 250ms。
- [ ] 三轮上下文面板交互延迟均不超过 150ms。
- [ ] 三轮取消确认延迟均不超过 1 秒。
- [ ] 三轮结束后的 Working Set 不持续单调增长；记录趋势，不设置跨机器绝对上限。
- [ ] 成功分卷均可读取且包含 `word/document.xml`。
- [ ] 取消、异常和目标提交失败均不遗留隐藏临时文件。
- [ ] 定向导出测试、相关 lint/format、完整 Windows desktop smoke 和 PR Quality checks 通过。
- [ ] #87 留下矩阵证据；全部标准通过后关闭为 completed。

### 预计修改范围

- 主要：`desktop-e2e/smoke.e2e.mjs`
- 仅在复现失败时：`src/app/export.ts`、导出 Worker 或相关定向测试
- 同步：`docs/NEXT.md`、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、Issue #87

### 依赖、风险与回滚

- 依赖：Windows x64、Tauri desktop E2E、可写临时目录。
- 风险：runner 性能波动；交互采用宽松硬门槛，内存只判断连续趋势。
- 回滚：回退单一 #87 PR；无数据迁移，不改变用户文档。

## 完成后

1. 把本切片结果追加到 `docs/handoff/v0.11.md`。
2. 更新 `docs/AI-HANDOFF.md` 的最近完成和风险摘要。
3. 将本文件整体替换为 #234“统一通知层”的 READY 契约。
4. 更新 #87、PR 和 CI 单行记录，然后停止，不自动开始 #234。

## 快速触发

```text
继续开发 Moyang Reader。严格读取并执行 docs/NEXT.md 中的唯一下一步，遵循 docs/AI-WORKFLOW.md，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
```
