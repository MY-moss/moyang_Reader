# Issue 治理索引

> 更新时间：2026-08-31
>
> 适用范围：Moyang Reader，Windows x64、本地优先、轻量快速。
>
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

### v0.11.0 milestone 顺序

`#172 → #375 → #357 → #358 → #379 → #360 → #369 → #359 → #361–#366 → #367/#368/#371/#372`。其中 #241/#51 是外部条件项：缺少 Cloudflare Secrets、旧版本安装环境或 Authenticode 证书时保留开放并移出 milestone，不阻塞常规功能切片。#359 已由 PR #388 完成并关闭，当前唯一可执行事项始终以 [`NEXT.md`](NEXT.md) 为准，不能仅凭表格顺序自动开始下一项。

## 2. 当前可执行 backlog

### Must：核心阅读、编辑、稳定性与发布

| Issue                                                       | 主题                               | 计划                      | 备注                                                                        |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------- | --------------------------------------------------------------------------- |
| [#87](https://github.com/MY-moss/moyang_Reader/issues/87)   | 批量导出单卷驻留内存与可取消归档   | v0.11.0 第 1 切片         | PR #339 已完成复杂块流式化；剩余三轮真实 Windows 最终矩阵                   |
| [#164](https://github.com/MY-moss/moyang_Reader/issues/164) | GFM 与 WYSIWYG 往返保真            | v0.11.0                   | 防止脚注、任务列表等内容静默丢失                                            |
| [#165](https://github.com/MY-moss/moyang_Reader/issues/165) | WYSIWYG 补全、同步、保存行为测试   | v0.11.0                   | 本轮验收已完成，PR 合并后关闭；与 #164 保持独立                             |
| [#321](https://github.com/MY-moss/moyang_Reader/issues/321) | 原生格式工具栏与链接/图片/表格插入 | v0.10.13 稳定批次         | 已完成；PR #322 已合并，后续资源管理另行切片                                |
| [#323](https://github.com/MY-moss/moyang_Reader/issues/323) | 草稿恢复前显示当前版本与草稿差异   | v0.10.13 稳定批次         | 已完成；PR #324 已合并，v0.10.13 已发布；后续当前磁盘核对由 #346 补齐       |
| [#346](https://github.com/MY-moss/moyang_Reader/issues/346) | 草稿恢复时核对当前磁盘版本         | v0.11.0 第 6 切片         | 已完成；PR #347 已合并，Issue 已以 completed 关闭；不引入三方合并或版本历史 |
| [#187](https://github.com/MY-moss/moyang_Reader/issues/187) | Windows 窄窗口与工具栏溢出         | v0.11.0                   | 已完成；PR #328 已合并，Issue 已关闭（completed）                           |
| [#189](https://github.com/MY-moss/moyang_Reader/issues/189) | TypeScript/ESLint/Rust 质量门禁    | v0.11.0 第 3 切片         | 基础严格项已完成；剩余类型感知异步规则与真实 fallout                        |
| [#226](https://github.com/MY-moss/moyang_Reader/issues/226) | Actions SHA 固定与前端定时审计     | v0.11.0 发布前            | 发布/镜像工作流优先                                                         |
| [#241](https://github.com/MY-moss/moyang_Reader/issues/241) | PDF 落盘与旧版本自动更新实机回归   | v0.11.0 第 5 阶段（条件） | 依赖 Cloudflare Secrets、真实旧版本安装环境和发布条件                       |
| [#51](https://github.com/MY-moss/moyang_Reader/issues/51)   | 安装包代码签名与手动发布版本校验   | v0.11.0 第 5 阶段（条件） | SemVer 校验已完成；剩余 Authenticode 证书或限制说明                         |
| [#357](https://github.com/MY-moss/moyang_Reader/issues/357) | 右键菜单 fixed 定位与内容区包含块  | v0.11.x                   | 已完成；PR #377 已合并，Issue 已以 completed 关闭                           |
| [#358](https://github.com/MY-moss/moyang_Reader/issues/358) | 插入浮层跟随光标/视口              | v0.11.x                   | 已完成；PR #380 已合并，Issue 已以 completed 关闭                           |
| [#359](https://github.com/MY-moss/moyang_Reader/issues/359) | 撤销历史全量快照与编辑粒度         | v0.11.x                   | 已完成；PR #388 合并，400ms 分组与 100 条/8 MiB 历史预算                    |
| [#360](https://github.com/MY-moss/moyang_Reader/issues/360) | 工作区树操作异步化                 | v0.11.x                   | 与 #369 分开验收、可共用底层命令改造                                        |

### Should：明显改善高频体验和可维护性

| Issue                                                       | 主题                             | 计划              | 备注                                              |
| ----------------------------------------------------------- | -------------------------------- | ----------------- | ------------------------------------------------- |
| [#190](https://github.com/MY-moss/moyang_Reader/issues/190) | 首屏按需加载与真实渐进挂载       | v0.11.0           | 已完成；PR #351 已合并，Issue 已以 completed 关闭 |
| [#171](https://github.com/MY-moss/moyang_Reader/issues/171) | CSS 令牌与主题规则治理           | v0.11.x–v1.0      | 分阶段，先令牌后拆文件                            |
| [#301](https://github.com/MY-moss/moyang_Reader/issues/301) | 系统文件拖放反馈与失败提示       | v0.11.0 第 4 切片 | 已完成；PR #344 已合并，Issue 已以 completed 关闭 |
| [#234](https://github.com/MY-moss/moyang_Reader/issues/234) | 设置通知可关闭、堆叠且不挤布局   | v0.11.0 第 2 切片 | 统一右上角最多三条通知栈和富更新通知              |
| [#299](https://github.com/MY-moss/moyang_Reader/issues/299) | 右键菜单焦点循环与关闭归还       | v0.11.0 第 7 切片 | 共享菜单基座和五类调用入口                        |
| [#191](https://github.com/MY-moss/moyang_Reader/issues/191) | 键盘与读屏导航细节               | v0.11.x           | 按子问题独立切片                                  |
| [#119](https://github.com/MY-moss/moyang_Reader/issues/119) | axe/WCAG AA Windows UI 基线      | v0.11.x           | 已完成；PR #350，真实读屏抽查保留在发布前清单     |
| [#172](https://github.com/MY-moss/moyang_Reader/issues/172) | reduced-motion 下的程序化滚动    | v0.11.0           | 已完成；PR #374 已合并，Issue 已关闭              |
| [#193](https://github.com/MY-moss/moyang_Reader/issues/193) | 焦点环、主按钮、页签和令牌细节   | v0.11.x           | 不与 #171 的大范围拆分混做                        |
| [#233](https://github.com/MY-moss/moyang_Reader/issues/233) | 顶栏图标体系和操作密度           | v0.11.x           | 与 #187/#171 协同                                 |
| [#227](https://github.com/MY-moss/moyang_Reader/issues/227) | SECURITY.md 与私密披露入口       | v0.11.x           | 文档成本低，独立交付                              |
| [#112](https://github.com/MY-moss/moyang_Reader/issues/112) | opener、镜像巡检和更新限制文档   | v0.11.x           | 清单中部分已完成，不能重复实现                    |
| [#194](https://github.com/MY-moss/moyang_Reader/issues/194) | TS↔Rust 契约、路径谓词和重复实现 | v1.0 前           | 只有明确子切片才进入 Ready                        |
| [#16](https://github.com/MY-moss/moyang_Reader/issues/16)   | 渐进拆分 App.tsx                 | v1.0 前           | 以职责和测试边界为准，不以行数为唯一目标          |
| [#361](https://github.com/MY-moss/moyang_Reader/issues/361) | 暗色主题 accent 按钮对比度       | v0.11.x           | 视觉小切片                                        |
| [#362](https://github.com/MY-moss/moyang_Reader/issues/362) | 交互与渲染微成本                 | v0.11.x           | 面板、草稿解析和差异对话框按测量拆分              |
| [#363](https://github.com/MY-moss/moyang_Reader/issues/363) | 导出分块 Flush 与分卷恢复        | v0.11.x           | 仅在有基线后处理                                  |
| [#364](https://github.com/MY-moss/moyang_Reader/issues/364) | 右键粘贴与图片剪贴板反馈         | v0.11.x           | 明确纯文本、图片和失败反馈                        |
| [#365](https://github.com/MY-moss/moyang_Reader/issues/365) | 插入浮层焦点归还与图片浏览入口   | v0.11.x           | 不与 #358 混成一个 PR                             |
| [#366](https://github.com/MY-moss/moyang_Reader/issues/366) | 统一确认弹层与关闭文案           | v0.11.x           | 统一草稿保存/关闭语义                             |
| [#367](https://github.com/MY-moss/moyang_Reader/issues/367) | 文档级跳转历史与返回上一文档     | v0.11.x           | 双链闭环；独立导航切片                            |
| [#368](https://github.com/MY-moss/moyang_Reader/issues/368) | 全文书签与选中文本批注           | v0.11.x–v1.0      | 第一切片已由 PR #397 合并；第二切片仍 open，需重新 Ready 检查 |
| [#369](https://github.com/MY-moss/moyang_Reader/issues/369) | 回收站删除与保存上一版本保护     | v0.11.x           | 数据安全动作需单独验收                            |
| [#370](https://github.com/MY-moss/moyang_Reader/issues/370) | 阅读历史与本地统计               | v1.0 前           | 仅本机数据，不做云同步                            |
| [#371](https://github.com/MY-moss/moyang_Reader/issues/371) | 中文拼音首字母搜索               | v0.11.x           | 索引侧预计算，避免前端引入大依赖                  |

### Could：保留记录，当前不占用快速迭代资源

| Issue                                                       | 主题                       | 计划      | 重新进入条件                             |
| ----------------------------------------------------------- | -------------------------- | --------- | ---------------------------------------- |
| [#111](https://github.com/MY-moss/moyang_Reader/issues/111) | 轻量中英双语 i18n 与错误码 | v1.0 后段 | 核心功能稳定且有真实语言需求             |
| [#372](https://github.com/MY-moss/moyang_Reader/issues/372) | 设置导出/导入补全阅读位置  | v0.11.x   | 采用版本化迁移，待核心功能切片稳定后处理 |

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
4. 用户说“继续开发”时，只执行 `docs/NEXT.md` 的唯一 READY 项；失效时先修正交接，不自行改选相邻 Issue。
5. 普通逻辑改动跑定向测试；UI 改动加一个 E2E；安全、更新器、签名和发布改动跑完整门禁。
6. 一个功能切片最多一次完整构建；稳定批次才生成 Windows 安装包、Release、签名、manifest 和镜像。
7. 合并后从最新 `main` 创建新分支；完成一个切片后更新 `docs/NEXT.md`、当前版本交接归档和 `docs/AI-HANDOFF.md`，然后停止。
8. 不关闭未完成的 P2/P3 问题，不用关闭数量代替修复质量。

## 5. 维护记录

- 2026-08-29：盘点 32 个开放 Issue。
- 2026-08-29：统一 32 个 Issue 的标题、正文结构和标签。
- 2026-08-29：归档 9 个历史汇总、重复、范围外或当前不计划事项。
- 当前结果：25 个开放可执行 Issue（Must 4、Should 19、Could 2），9 个已归档；#172 已完成（PR #374），#301 已完成（PR #344），#346 已完成（PR #347），#299 已完成（PR #349），#357 已完成（PR #377），#358 已完成（PR #380），#119 已完成（PR #350），#190 已完成（PR #351）；#375 为已合并的工程治理 PR，下一工程切片为 PR #379，随后进入 #360。

