# Issue 治理索引

> 更新时间：2026-08-29  
> 适用范围：Moyang Reader，Windows x64、本地优先、轻量快速。  
> 本文件是 Issue 分类与维护入口；具体事实、验收和讨论以对应 Issue 为准。

## 1. 统一格式

每个可执行 Issue 使用以下字段：

- **状态**：保留 / Ready 候选 / 延后 / 需实机验证 / 已归档
- **MoSCoW**：Must / Should / Could / Won't
- **优先级**：P2 / P3；P0/P1 只用于真实阻塞或数据安全风险
- **类别**：性能、正确性、编辑器、体验、视觉、可访问性、测试、工程、安全、发布、文档或路线图
- **计划**：目标版本或明确的重新评估条件
- **用户价值**：解决谁的什么问题
- **本切片范围**：只写一个可交付的垂直切片
- **明确不做**：防止任务外溢
- **验收标准**：可逐项勾选、可复现
- **依赖、风险与回滚**：外部条件和失败处理
- **当前证据**：代码、测试、PR 或复现依据
- **交付规则**：分支、PR、测试、文档和发布边界

标题统一为：

`[MoSCoW][Priority][Category] 简洁问题/目标`

已归档条目使用 `[Archived]`，并必须在正文和评论中说明是已完成、重复、范围外还是当前不计划。

## 2. 当前可执行 backlog

### Must：核心阅读、编辑、稳定性与发布

| Issue                                                       | 主题                               | 计划                      | 备注                                                                |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| [#87](https://github.com/MY-moss/moyang_Reader/issues/87)   | 批量导出单卷驻留内存与可取消归档   | v0.11.0 稳定批次          | 已完成分块写入/取消清理；剩余 Worker/原生归档和单卷峰值             |
| [#164](https://github.com/MY-moss/moyang_Reader/issues/164) | GFM 与 WYSIWYG 往返保真            | v0.11.0                   | 防止脚注、任务列表等内容静默丢失                                    |
| [#165](https://github.com/MY-moss/moyang_Reader/issues/165) | WYSIWYG 补全、同步、保存行为测试   | v0.11.0                   | 本轮验收已完成，PR 合并后关闭；与 #164 保持独立                     |
| [#321](https://github.com/MY-moss/moyang_Reader/issues/321) | 原生格式工具栏与链接/图片/表格插入 | v0.10.13 稳定批次         | 已完成；PR #322 已合并，后续资源管理另行切片                        |
| [#323](https://github.com/MY-moss/moyang_Reader/issues/323) | 草稿恢复前显示当前版本与草稿差异   | v0.10.13 稳定批次         | 基础差异预览已由 PR #324 完成；多段统计与恢复决策提示继续纳入本批次 |
| [#187](https://github.com/MY-moss/moyang_Reader/issues/187) | Windows 窄窗口与工具栏溢出         | v0.11.0                   | 本轮按 720px 最小窗口完成全档布局验收，合并后关闭       |
| [#189](https://github.com/MY-moss/moyang_Reader/issues/189) | TypeScript/ESLint/Rust 质量门禁    | v0.11.0 发布前            | 先量化 fallout，再分批收紧                                          |
| [#226](https://github.com/MY-moss/moyang_Reader/issues/226) | Actions SHA 固定与前端定时审计     | v0.11.0 发布前            | 发布/镜像工作流优先                                                 |
| [#241](https://github.com/MY-moss/moyang_Reader/issues/241) | PDF 落盘与旧版本自动更新实机回归   | 下一稳定 Windows x64 发布 | 依赖真实安装环境和发布条件                                          |
| [#51](https://github.com/MY-moss/moyang_Reader/issues/51)   | 安装包代码签名与手动发布版本校验   | v0.11.0 发布前            | 两个验收块，必要时拆两个 PR                                         |

### Should：明显改善高频体验和可维护性

| Issue                                                       | 主题                             | 计划         | 备注                                     |
| ----------------------------------------------------------- | -------------------------------- | ------------ | ---------------------------------------- |
| [#190](https://github.com/MY-moss/moyang_Reader/issues/190) | 首屏按需加载与真实渐进挂载       | v0.11.x      | 不重复 #168 的阅读轨道优化               |
| [#171](https://github.com/MY-moss/moyang_Reader/issues/171) | CSS 令牌与主题规则治理           | v0.11.x–v1.0 | 分阶段，先令牌后拆文件                   |
| [#301](https://github.com/MY-moss/moyang_Reader/issues/301) | 系统文件拖放反馈与失败提示       | v0.11.x      | 低成本、高感知 UX                        |
| [#234](https://github.com/MY-moss/moyang_Reader/issues/234) | 设置通知可关闭、堆叠且不挤布局   | v0.11.x      | 与通知契约统一                           |
| [#299](https://github.com/MY-moss/moyang_Reader/issues/299) | 右键菜单焦点循环与关闭归还       | v0.11.x      | 共享菜单基座                             |
| [#191](https://github.com/MY-moss/moyang_Reader/issues/191) | 键盘与读屏导航细节               | v0.11.x      | 按子问题独立切片                         |
| [#119](https://github.com/MY-moss/moyang_Reader/issues/119) | axe/WCAG AA Windows UI 基线      | v0.11.x      | 基线不替代具体缺陷                       |
| [#172](https://github.com/MY-moss/moyang_Reader/issues/172) | reduced-motion 下的程序化滚动    | v0.11.x      | 低风险可独立交付                         |
| [#193](https://github.com/MY-moss/moyang_Reader/issues/193) | 焦点环、主按钮、页签和令牌细节   | v0.11.x      | 不与 #171 的大范围拆分混做               |
| [#233](https://github.com/MY-moss/moyang_Reader/issues/233) | 顶栏图标体系和操作密度           | v0.11.x      | 与 #187/#171 协同                        |
| [#227](https://github.com/MY-moss/moyang_Reader/issues/227) | SECURITY.md 与私密披露入口       | v0.11.x      | 文档成本低，独立交付                     |
| [#112](https://github.com/MY-moss/moyang_Reader/issues/112) | opener、镜像巡检和更新限制文档   | v0.11.x      | 清单中部分已完成，不能重复实现           |
| [#194](https://github.com/MY-moss/moyang_Reader/issues/194) | TS↔Rust 契约、路径谓词和重复实现 | v1.0 前      | 只有明确子切片才进入 Ready               |
| [#16](https://github.com/MY-moss/moyang_Reader/issues/16)   | 渐进拆分 App.tsx                 | v1.0 前      | 以职责和测试边界为准，不以行数为唯一目标 |

### Could：保留记录，当前不占用快速迭代资源

| Issue                                                       | 主题                       | 计划      | 重新进入条件                 |
| ----------------------------------------------------------- | -------------------------- | --------- | ---------------------------- |
| [#111](https://github.com/MY-moss/moyang_Reader/issues/111) | 轻量中英双语 i18n 与错误码 | v1.0 后段 | 核心功能稳定且有真实语言需求 |

## 3. 已归档 Issue

| Issue                                                       | 归档原因                                | 状态        |
| ----------------------------------------------------------- | --------------------------------------- | ----------- |
| [#33](https://github.com/MY-moss/moyang_Reader/issues/33)   | Windows-only，不再维护跨平台 manifest   | not planned |
| [#52](https://github.com/MY-moss/moyang_Reader/issues/52)   | v0.6–v0.8 历史路线图被当前路线图取代    | not planned |
| [#58](https://github.com/MY-moss/moyang_Reader/issues/58)   | 第二轮历史审计汇总，子项已拆分/重新分类 | not planned |
| [#109](https://github.com/MY-moss/moyang_Reader/issues/109) | v1.0 前不执行外部 JavaScript 插件       | not planned |
| [#162](https://github.com/MY-moss/moyang_Reader/issues/162) | 低概率路径边界，当前无稳定复现          | not planned |
| [#163](https://github.com/MY-moss/moyang_Reader/issues/163) | 低概率区域大小写边界，当前无用户案例    | not planned |
| [#166](https://github.com/MY-moss/moyang_Reader/issues/166) | 测试总览已拆至 #119/#164/#165           | duplicate   |
| [#173](https://github.com/MY-moss/moyang_Reader/issues/173) | 第十轮历史审计汇总已过时                | not planned |
| [#195](https://github.com/MY-moss/moyang_Reader/issues/195) | 第十一轮历史审计汇总已过时              | not planned |

归档不等于所有相关工作完成：

- `duplicate` 表示后续工作在专项 Issue 中继续；
- `not planned` 表示当前产品范围或资源规划不做；
- 有新的用户案例、平台范围变化或可复现证据时，可以重新打开或创建新 Issue。

## 4. 选择与维护规则

1. 每个功能切片只允许一个主要分支和一个 PR。
2. 开发前先检查开放 Issue，避免重复立项；开发后更新对应 Issue 的状态和证据。
3. 只有具备目标、非目标、验收、依赖、风险和回滚方式的事项才算 Ready。
4. 用户说“继续开发”时，只从 Must/Should 中选择最高优先级 Ready 项；没有 Ready 项先整理，不自行扩展。
5. 普通逻辑改动跑定向测试；UI 改动加一个 E2E；安全、更新器、签名和发布改动跑完整门禁。
6. 一个功能切片最多一次完整构建；稳定批次才生成 Windows 安装包、Release、签名、manifest 和镜像。
7. 合并后从最新 `main` 创建新分支；完成一个切片后停止并更新 `docs/AI-HANDOFF.md`。
8. 不关闭未完成的 P2/P3 问题，不用关闭数量代替修复质量。

## 5. 维护记录

- 2026-08-29：盘点 32 个开放 Issue。
- 2026-08-29：统一 32 个 Issue 的标题、正文结构和标签。
- 2026-08-29：归档 9 个历史汇总、重复、范围外或当前不计划事项。
- 当前结果：25 个可执行 Issue，9 个已归档，开放 PR 需单独复核；#321 已完成，#323 是本轮新增 Ready 切片。
