# Moyang Reader 全量开发计划

本文件是可交接的任务地图，不是并行开发授权。当前唯一可执行事项仍以 [`../docs/NEXT.md`](../docs/NEXT.md) 为准；全量审计与产品边界见 [`../docs/DEVELOPMENT-AUDIT.md`](../docs/DEVELOPMENT-AUDIT.md)，长期流程见 [`../docs/AI-WORKFLOW.md`](../docs/AI-WORKFLOW.md)。

## 计划原则

- Windows x64、本地优先、Markdown 真源、轻量启动；HTML、图谱、Canvas、AI 和发布能力按需加载。
- 一个切片一个目标、一个主要分支、一个 PR；完成后更新文档/Issue/交接并停止。
- 先处理 Must 和真实稳定性风险；外部凭据、证书或实机条件未满足的事项标记为条件项，不阻塞普通开发。
- 纯文档/测试/内部工具不生成安装包；只有稳定批次或重要更新/安全修复才发布 Windows x64 安装包。

## 依赖顺序

```text
G-01 工程治理与清理（本轮）
  → F-01 #416 图标一致性
  → F-05 #366 确认语义 / F-06 #370 阅读历史 / F-08 #233 顶栏密度
  → F-07 #191 可访问性 / F-09 #171+#193 令牌治理
  → H-01+H-05 HTML 安全预览
  → H-02 Markdown 原生 HTML → H-03 HTML 源码编辑
  → K-01 Inbox/Daily → K-04 图谱 → K-05 Mermaid → K-06 Canvas
  → H-04/S-01 分享包 → S-02 URI/CLI → S-03 可选部署
  → AI-01/P-01 v1.0 后评估
```

`F-02/#241`、`F-03/#51`、`F-04/#112` 是发布条件旁路：有真实环境和 Secret 时单独 Ready；没有时记录阻塞，不把失败状态伪装成通过。

## 阶段与任务卡

### G：工程治理（本轮）

- [x] **G-01 全量流程与交接整改**：更新 `DEVELOPMENT-AUDIT.md`、`WORKSPACE-CLEANUP.md`、`AI-WORKFLOW.md`、任务计划、待办和交接入口；修正开放 Issue 表与 ADR 编号；T0。
- [ ] **G-02 发布/交接状态结构化检查**：在现有 `release:check` 或独立脚本中校验版本、`NEXT.md` 唯一 Ready、CHANGELOG、Release 资产、镜像状态和交接链接；不触发发布；T0/T1；依赖 #241/#51 的真实状态格式。
- [ ] **G-03 构建缓存预算提示**：仅增加大小/空闲时间提示和 dry-run，不自动删除正在使用的 Cargo target；超过预算给出明确清理建议；T1；不改变构建目标路径。

### F：核心稳定与高频体验

- [x] **F-01 #416 Windows 外部图标一致性（已合并）**：显式 `bundle.icon`、资源完整性检查、全新安装/覆盖升级/快捷方式/文件关联验证；PR #418 已 squash 合并，现位于 `main@f064b4621232dae9cbb292f6eaf200b5e3a3604a`，Issue #416 已关闭；不重做 Logo、不做跨平台；T3；不单独发布。
- [ ] **F-02 #241 更新/镜像/PDF 实机矩阵**：验证旧版本升级、签名 manifest、PDF 落盘和镜像一致性；不上传凭据；T3；依赖真实旧安装环境和 Cloudflare Secret。
- [ ] **F-03 #51 安装包签名条件项**：验证 Authenticode 或记录受限环境的可审计说明；私钥只在 Secret/本机安全位置；T3。
- [ ] **F-04 #112 更新与 opener 文档收口**：清理重复说明、补镜像失败回退/权限边界和用户可见故障排查；不重复实现更新器；T2/T3。
- [x] **F-05 #366 统一确认语义（已合并）**：清空草稿、关闭窗口和未保存修改使用应用内弹层，说明草稿已自动留存，并提供保存并退出；不处理 `window.prompt` 系列、不改数据模型；PR #419 已合并为 `main@f064b4621232dae9cbb292f6eaf200b5e3a3604a`，Issue #366 已关闭；T2。
- [x] **F-06 #370 阅读历史与本地统计（已合并）**：步骤 1/2 已合并最近文档时间语义和本机前台可见性心跳；步骤 3 补齐本地周一至周日统计、去重文档数、累计时长和清理确认入口；仅本机、无联网/匿名上报、不引入图表库；PR [#422](https://github.com/MY-moss/moyang_Reader/pull/422) 已 squash 合并为 `main@b7dc14358aee7025a83e86a7ba06d865914fddb1`，Issue #370 已关闭；T1/T2。
- [x] **F-07 #191 键盘与读屏细节（已完成）**：快速打开、标签栏、文件树、目录 roving/当前章节高亮、主阅读区读屏播报收窄和 Escape 互斥六个子切片已完成；不引入新 UI 框架；T2。全部合并后 Issue #191 关闭。
- [x] **F-07a #191 快速打开子切片（已合并）**：PR [#424](https://github.com/MY-moss/moyang_Reader/pull/424) 已 squash 合并为 `main@a650f934429f8f19511dd6c72ef5b17541c694ff`，Quality checks run `33634427700` 全绿；Issue #191 保持开放。
- [x] **F-07b #191 标签栏子切片（已合并）**：PR [#425](https://github.com/MY-moss/moyang_Reader/pull/425) 已 squash 合并为 `main@0783b27c314749a3e1e1b0371b92674a0a77a247`，Quality checks run `33642980506` 全绿；Issue #191 保持开放。
- [x] **F-07c #191 文件树子切片（已合并）**：PR [#426](https://github.com/MY-moss/moyang_Reader/pull/426) 已 squash 合并为 `main@e9cde556e48957f270828159890522b52ef51f89`，Quality checks run `33653154436` 全绿；Issue #191 保持开放。
- [x] **F-07d #191 目录 roving 与当前章节高亮（已合并）**：目录使用 `tree/treeitem` 语义、单一 roving Tab 停靠点、上下/Home/End 和现有中央正文导航；当前高亮同步 `active`/`aria-current`/`aria-selected`；读屏播报和 Esc 互斥另行拆分；T2。PR [#427](https://github.com/MY-moss/moyang_Reader/pull/427) 已 squash 合并为 `main@61ab3b35e9f50e0704846e5dac768f03f98458a2`，Quality checks run `33664518604` 全部通过。
- [x] **F-07e #191 主阅读区读屏播报收窄（已合并）**：移除 `main.content-area` 的宽范围 `aria-live`，打开文档加载状态改为显式 `status/polite`，保留缩放/渐进渲染状态和错误提示；补无障碍回归 E2E；T2。PR [#431](https://github.com/MY-moss/moyang_Reader/pull/431) 已 squash 合并为 `main@34b3fc6b1b0656f207b9b46240c7de17279f6605`，Quality checks run `33693407155` 全部通过。
- [x] **F-07f #191 焦点模式 Escape 互斥（已合并）**：专注模式/命令面板等嵌套交互只由最内层 Escape 关闭并正确归还焦点；不与读屏播报切片合并；T2。分支 `codex/escape-mutex-2026-09-03`，PR [#432](https://github.com/MY-moss/moyang_Reader/pull/432) 已 squash 合并为 `main@38ed9a03a11654986afa8656b2347d5784f35c34`，Issue #191 已关闭，Quality checks run `33701530614` 全部通过。
- [x] **F-08 #233 顶栏图标与密度（已合并）**：统一当前文档操作、低频菜单和窄窗口溢出；不与完整主题重构混做；T2。PR [#423](https://github.com/MY-moss/moyang_Reader/pull/423) 已 squash 合并为 `main@42337e840f2266f31715bee914630fc9b42cde1d`，Issue #233 已关闭。
- [ ] **F-09 #171/#193 视觉令牌治理**：先抽取颜色/间距/焦点/字体/动效令牌，再拆规则；不大改布局行为；T2。
- [x] **F-09a 用户反馈：左侧栏阅读库操作区布局与菜单交互**：修复“新建、批量导出、添加/切换阅读库”在窄侧栏中的遮挡与操作中断；菜单进入布局流并互斥收起；不改变创建、导出、挂载的数据语义；T2；分支 `codex/sidebar-actions-ui-2026-09-03`，PR [#428](https://github.com/MY-moss/moyang_Reader/pull/428) 已 squash 合并为 `main@8325982f12276e938084523966f02404ba2db041`，Quality checks run `33671029611` 全部通过。
- [x] **F-09b 用户反馈：更新入口“更多”工作流与不中断阅读（已合并）**：更新按钮固定在“更多”操作栏；已有更新、下载中和已安装状态可恢复查看，下载完成不自动重启；不改更新端点、签名和发布资产；T3；分支 `codex/update-more-workflow-2026-09-03`，PR [#429](https://github.com/MY-moss/moyang_Reader/pull/429) 已 squash 合并为 `main@6843ff2b0a736d7c9247f4cd1205ee2398a09d69`，Quality checks run `33681521320` 全部通过。
- [x] **F-09c 用户反馈：默认首页与品牌视觉收口（已完成）**：默认空状态复用现有新 Logo，移除残留大写 M 并保持首次启动操作可用；只做该区域的视觉收口，不改阅读库数据语义、侧栏、更新器或 HTML 安全边界；T2；分支 `codex/default-home-brand-2026-09-03`，PR [#430](https://github.com/MY-moss/moyang_Reader/pull/430)，Quality checks run `33687800718` 全部通过；代码提交 `b6ac4ba6ceb009ba4bd346765dd1650448dab8e6`。
- [x] **F-09d #193 交互视觉令牌（已合并）**：补齐查找框焦点环、关系图主按钮、上下文页签状态，并抽取焦点/动效/等宽字体令牌；同步 reduced-motion 与 forced-colors；不改变布局、业务语义、HTML 安全路线或发布资产；T2。分支 `codex/visual-token-focus-2026-09-03`，PR [#433](https://github.com/MY-moss/moyang_Reader/pull/433) 已 squash 合并为 `main@9a7017747c1121d977489a42aba2f7809e6e0892`，Quality checks run `33706502133` 全部通过，Issue #193 已关闭。
- [x] **F-09e #171 CSS 颜色令牌治理第一批（已合并）**：错误/警告、代码块/行内代码、文件卡片、状态栏和工作区列表使用语义颜色令牌；自动/显式深色主题移除逐组件重复覆盖；不改布局和业务逻辑；T2；分支 `codex/css-token-governance-2026-09-03`，PR [#434](https://github.com/MY-moss/moyang_Reader/pull/434) 已 squash 合并为 `main@f7b0b96087c56eb6d2aab4879a433d6fbd42d54a`，Quality checks run `33711636497` 和依赖审计 run `33711636526` 已通过；Issue #171 保持开放，后续令牌批次另行拆分。
- [x] **F-09f #171 CSS 紧凑间距令牌治理第二批（已合并）**：顶栏、More/查找面板、左侧工作区主控件、文件条目和底栏使用 `--space-*` 令牌；保持现有间距值和布局行为，补 720/900px 无横向溢出 E2E；不改交互和业务语义；T2；分支 `codex/css-token-followup-2026-09-03`，PR [#435](https://github.com/MY-moss/moyang_Reader/pull/435) 已 squash 合并为 `main@5dcf1962950d1e88615190a0948024136b054af6`，Quality checks run `33715368941` 全部通过；Issue #171 保持开放。
- [ ] **F-09g #171 CSS 字体/动效/主题规则后续批次**：按独立垂直切片继续治理；本切片的字体字号边界见 F-09g1，动效或主题规则须重新核验 Issue/PR 后再单独授权；T2。
- [x] **F-09g1 #171 CSS 字体字号令牌治理第三批（本切片）**：顶栏、更多/设置、查找栏、标签栏、左侧阅读库操作与文件条目、阅读历史摘要、状态栏使用 `--type-*` 令牌收敛 9–19px 字号；保持当前计算值和布局行为，不改业务语义；T2；分支 `codex/css-font-token-2026-09-03`，PR 待创建，合并后补主线 SHA 与 Quality checks。
- [ ] **F-09g2 #171 CSS 动效/主题规则后续批次**：重新盘点剩余动效或主题覆盖，只选择一个边界，补对应静态和浏览器回归；不与 #194、#16 或 HTML 安全路线混做；T2。
- [ ] **F-10 #16 App.tsx 渐进拆分**：一次只迁移一个 hook/服务边界，行为快照不变；不以行数为唯一目标；T1/T2。
- [ ] **F-11 #194 TS↔Rust 契约收敛**：每次只处理一个 IPC/路径谓词族，补类型和测试；T1/T3。
- [ ] **F-12 #227 安全披露文档**：新增 `SECURITY.md`、支持版本和私密报告入口；T0。
- [ ] **F-13 #111 轻量 i18n/错误码**：稳定文案中英切换与错误码映射；不覆盖实验功能；T1/T2。

### H：HTML 适配

- [ ] **H-01 HTML/HTM 安全只读预览**：新增 `DocumentKind`、Rust 文件类型和预览组件；允许源码回退；T3；依赖 H-05。
- [ ] **H-02 Markdown 白名单原生 HTML**：支持有限语义/布局标签，未知结构保真回退；T3；依赖统一清洗器。
- [ ] **H-03 HTML 源码编辑**：CodeMirror、保存、外部修改、撤销和工作区资源提示；首版不做 HTML WYSIWYG；T2/T3。
- [ ] **H-04 HTML 资源与打印/分享**：本地 CSS/图片解析、静态分享包、打印样式和失败清单；T3；依赖 H-01/H-02。
- [ ] **H-05 HTML 安全门禁**：CSP、危险标签/属性/URL/iframe/网络资源测试和桌面 E2E；不允许插件/URI绕过；T3。

### K：日常工作流与知识结构

- [ ] **K-01 Inbox/Daily 收集**：普通 Markdown 追加剪贴板、链接、文件引用和时间戳；`- [ ]`/`- [x]` 任务只存 Markdown；T2。
- [ ] **K-02 图谱筛选增强**：局部/全局/跨工作区、标签属性筛选、孤立节点和显式关系说明；默认只算局部；T2。
- [ ] **K-03 Mermaid 懒加载**：检测图表代码块时按需加载，解析失败显示源码；T2。
- [ ] **K-04 JSON Canvas**：`.canvas` 文件、文档卡片、图片、分组、连线、缩放和平移；约 200 节点流畅；T2/T3。
- [ ] **K-05 属性/标签索引**：frontmatter 与标签索引、筛选和关系面板；不建立正文第二真源；T1/T2。

### S/AI/P：分享、自动化与扩展

- [ ] **S-01 本地分享包**：选择内容生成 HTML/PDF/Word/Markdown 目录或压缩包，带资源和 manifest；不默认上传；T3。
- [ ] **S-02 URI/CLI v1**：open/new/capture/search/export，路径授权、参数校验和取消；禁止任意脚本；T3。
- [ ] **S-03 可选部署适配器**：Cloudflare Pages、GitHub Pages、本地服务器；核心阅读离线可用；T3。
- [ ] **AI-01 主动式 AI 助手**：选区/文档级总结、任务、标签、双链、改写和 Mermaid；差异/来源/确认后才写盘；v1.0 后评估，T3。
- [ ] **P-01 内部插件接口**：命令、侧栏、上下文面板按需加载；文件操作走应用服务，暂不开放脚本/市场；v1.0 后评估，T3。

## 版本出口

| 批次           | 进入条件                                                 | 交付物                                                                    |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| v0.10.15 patch | F-01 图标证据通过且确实改善用户可见问题                  | Windows x64 安装包、`.sig`、`latest.json`、GitHub Release；镜像按条件验证 |
| v0.11.x        | F-05/F-06/F-08 等高频小切片稳定，HTML 安全预览可单独验收 | 稳定批次安装包和交接；不为每个小 PR 打包                                  |
| v0.12          | HTML/图谱/Mermaid/Canvas 中已准备的垂直切片              | Windows x64 安装包、完整桌面验证                                          |
| v0.13          | 分享包、URI/CLI 和可选部署完成                           | 安装包、更新链路、分享包验收                                              |
| v1.0           | 核心格式、保存、搜索、导出、更新和文档兼容性冻结         | 长期维护版；AI/插件只在安全边界满足后评估                                 |
