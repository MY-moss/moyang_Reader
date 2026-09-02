# Issue 治理索引

> 更新时间：2026-09-02
>
> 适用范围：Moyang Reader，Windows x64、本地优先、轻量快速。
> 当前数据：GitHub 12 个 OPEN Issue；11 个可执行事项、1 个历史跟踪事项；7 个开放 PR 中 6 个为 Dependabot，另 1 个为当前功能切片。

本文件只负责分类和状态入口，具体事实、验收和讨论以对应 GitHub Issue/PR 为准。当前唯一执行授权以 [`NEXT.md`](NEXT.md) 为准；全量产品任务与 HTML 路线见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md) 和 [`../tasks/plan.md`](../tasks/plan.md)。

## 1. 统一格式

每个可执行 Issue 使用以下字段：

- **状态**：Ready / 候选 / 条件项 / 延后 / 已完成 / 已归档
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

已归档条目使用 `[Archived]`，并必须在正文和评论中说明是已完成、重复、范围外还是当前不计划。关闭 Issue 不等于功能永远不再回归；回归应新建有复现证据的专项 Issue。

## 2. 当前开放 backlog（2026-09-02 快照）

以下表格只列 GitHub 当前 `OPEN` 的 Issue；已关闭事项不再混入待办。

### Must：核心稳定与发布条件

| Issue                                                       | 主题                             | 计划       | 状态/备注                                       |
| ----------------------------------------------------------- | -------------------------------- | ---------- | ----------------------------------------------- |
| [#241](https://github.com/MY-moss/moyang_Reader/issues/241) | PDF 落盘与旧版本自动更新实机回归 | 发布条件项 | 依赖真实旧版本、镜像 Secret 和 Windows 安装环境 |
| [#51](https://github.com/MY-moss/moyang_Reader/issues/51)   | 安装包代码签名与手动发布版本校验 | 发布条件项 | 依赖 Authenticode 证书或可审计的受限环境说明    |

### Should：高频体验、可访问性与工程维护

| Issue                                                       | 主题                               | 计划         | 状态/备注                                                     |
| ----------------------------------------------------------- | ---------------------------------- | ------------ | ------------------------------------------------------------- |
| [#191](https://github.com/MY-moss/moyang_Reader/issues/191) | 键盘与读屏导航                     | v0.11.x      | 当前执行标签栏 roving tabindex；文件树/目录/播报/Esc 继续拆分 |
| [#171](https://github.com/MY-moss/moyang_Reader/issues/171) | CSS 设计令牌收敛与主题规则去重     | v0.11.x–v1.0 | 先令牌，后拆分规则                                            |
| [#193](https://github.com/MY-moss/moyang_Reader/issues/193) | 焦点环、按钮、页签、字体和动效令牌 | v0.11.x      | 不与 #171 的大范围重构混做                                    |
| [#112](https://github.com/MY-moss/moyang_Reader/issues/112) | opener、镜像巡检和更新限制文档     | v0.11.x      | 合并重复文档，补清楚 GitHub/镜像各自状态                      |
| [#194](https://github.com/MY-moss/moyang_Reader/issues/194) | TS↔Rust 契约、路径谓词与重复实现   | v1.0 前      | 只按明确子契约拆小切片                                        |
| [#16](https://github.com/MY-moss/moyang_Reader/issues/16)   | `App.tsx` 状态、逻辑与页面组合拆分 | v1.0 前      | 按行为边界渐进迁移，不以行数为唯一目标                        |
| [#227](https://github.com/MY-moss/moyang_Reader/issues/227) | `SECURITY.md` 与私密披露入口       | v0.11.x      | 文档型独立切片，不能上传凭据                                  |

### Could：低成本增强

| Issue                                                       | 主题                       | 计划      | 重新进入条件                 |
| ----------------------------------------------------------- | -------------------------- | --------- | ---------------------------- |
| [#111](https://github.com/MY-moss/moyang_Reader/issues/111) | 轻量中英双语 i18n 与错误码 | v1.0 后段 | 核心功能稳定且有真实语言需求 |

### Tracking：不作为执行任务

| Issue                                                       | 主题               | 处理规则                                              |
| ----------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| [#373](https://github.com/MY-moss/moyang_Reader/issues/373) | 历史审计与路线跟踪 | 保留到关联开放事项完成；不单独创建分支、PR 或 Release |

## 3. 已完成 Issue（不再是开放待办）

以下事项已在 GitHub 关闭或随稳定版本交付，只保留回归测试和历史证据，不应重新创建同名 PR：

| 范围                         | 已完成内容                                                      |
| ---------------------------- | --------------------------------------------------------------- |
| #87、#164、#165              | 批量 DOCX 流式/取消边界与 Markdown WYSIWYG 往返、补全、同步测试 |
| #189、#226                   | TypeScript/ESLint/Rust 门禁、Action SHA 固定和依赖审计          |
| #187、#190、#234、#299、#301 | 窄窗口、首屏渐进挂载、通知栈、菜单焦点和文件拖放                |
| #321、#323、#346             | 编辑工具栏/插入、草稿差异与当前磁盘版本核对                     |
| #357～#365                   | 菜单/插入浮层定位、撤销历史、视觉对比度、微成本、粘贴和图片浏览 |
| #367～#372                   | 跳转历史、书签/批注、回收站/上一版本、拼音搜索和设置备份 v2     |
| #363、#375                   | v0.10.14 导出可靠性、工作区和构建缓存治理                       |
| #233、#366、#370、#416       | 顶栏图标密度、统一确认语义、阅读历史统计和 Windows 外部图标     |

## 4. 已归档 Issue

| Issue                                                       | 归档原因                              | 状态        |
| ----------------------------------------------------------- | ------------------------------------- | ----------- |
| [#33](https://github.com/MY-moss/moyang_Reader/issues/33)   | Windows-only，不再维护跨平台 manifest | not planned |
| [#52](https://github.com/MY-moss/moyang_Reader/issues/52)   | v0.6–v0.8 历史路线图被当前路线图取代  | not planned |
| [#58](https://github.com/MY-moss/moyang_Reader/issues/58)   | 历史审计汇总，子项已拆分/重新分类     | not planned |
| [#109](https://github.com/MY-moss/moyang_Reader/issues/109) | v1.0 前不执行外部 JavaScript 插件     | not planned |
| [#162](https://github.com/MY-moss/moyang_Reader/issues/162) | 低概率路径边界，当前无稳定复现        | not planned |
| [#163](https://github.com/MY-moss/moyang_Reader/issues/163) | 低概率区域大小写边界，当前无用户案例  | not planned |
| [#166](https://github.com/MY-moss/moyang_Reader/issues/166) | 测试总览已拆至专项 Issue              | duplicate   |
| [#173](https://github.com/MY-moss/moyang_Reader/issues/173) | 历史审计汇总已过时                    | not planned |
| [#195](https://github.com/MY-moss/moyang_Reader/issues/195) | 历史审计汇总已过时                    | not planned |

归档不等于所有相关工作完成：

- `duplicate` 表示后续工作在专项 Issue 中继续；
- `not planned` 表示当前产品范围或资源规划不做；
- 有新的用户案例、平台范围变化或可复现证据时，可以重新打开或创建新 Issue。

## 5. 选择与维护规则

1. 每个功能切片只允许一个主要分支和一个 PR。
2. 开发前先检查开放 Issue，避免重复立项；开发后更新对应 Issue 的状态和证据。
3. 只有具备目标、非目标、验收、依赖、风险和回滚方式的事项才算 Ready。
4. 用户说“继续开发”时，只执行 `docs/NEXT.md` 的唯一 READY 项；失效时先修正交接，不自行改选相邻 Issue。
5. 普通逻辑改动跑定向测试；UI 改动加一个 E2E；安全、更新器、签名和发布改动跑完整门禁。
6. 一个功能切片最多一次完整构建；稳定批次才生成 Windows 安装包、Release、签名、manifest 和镜像。
7. 合并后从最新 `main` 创建新分支；完成一个切片后更新 `docs/NEXT.md`、当前版本交接归档和 `docs/AI-HANDOFF.md`，然后停止。
8. 不关闭未完成的 P2/P3 问题，不用关闭数量代替修复质量；已完成 Issue 必须写清 PR、验证和回滚证据。

## 6. 维护记录

- 2026-08-29：统一历史 Issue 的标题、正文结构和标签，归档 9 个历史汇总、重复、范围外或当前不计划事项。
- 2026-09-02：重新查询 GitHub：12 个 OPEN（Must 2、Should 8、Could 1、Tracking 1），7 个开放 PR 中 6 个为 Dependabot；#191 快速打开子切片为当前功能 PR，Issue 继续开放承载剩余子切片。
- 当前规则：开放表只列 OPEN；已完成事项进入第 3 节；探索性 HTML、Inbox/Daily、图谱、Mermaid、Canvas、分享包、URI/CLI、AI 和内部插件任务进入 `DEVELOPMENT-AUDIT.md`，准备好前不创建额外噪声 Issue。
