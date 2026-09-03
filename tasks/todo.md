# Moyang Reader 任务清单

> 执行授权只有 [`../docs/NEXT.md`](../docs/NEXT.md)；本清单用于交接和排序，不能绕过 READY 门禁自行并行。

## 最近完成切片

- [x] **#171 CSS 动效时长令牌治理（已合并）**：`.file-drop-card` 与 `.quick-open-item` 的 transition 时长已收敛到语义令牌，保持原值和 reduced-motion 行为；分支 `codex/css-motion-token-2026-09-03`，PR [#437](https://github.com/MY-moss/moyang_Reader/pull/437) 已 squash 合并为 `main@5b9f4e8cb804ff6366d229a04a5e42c13840e8a1`，Quality checks run `33722999974` 通过，Issue #171 保持开放。
- [x] **#171 CSS 页面背景主题令牌治理（已合并）**：`body` 的页面背景已收敛到 `--page-background`，系统/显式深色和 forced-colors 均有主题回退；分支 `codex/css-theme-token-2026-09-03`，PR [#438](https://github.com/MY-moss/moyang_Reader/pull/438) 已 squash 合并为 `main@e2757abb2d5d2fac2f6510ae4003770ca491c6a8`，Quality checks run `33728344916` 通过，Issue #171 保持开放。
- [x] **#171 CSS 批注/高亮主题令牌化（已合并）**：批注引文、当前批注卡、正文命中和 CSS Highlight 已收敛到 `--annotation-border`/`--annotation-surface`，并覆盖 forced-colors；分支 `codex/css-theme-followup-2026-09-03`，PR [#439](https://github.com/MY-moss/moyang_Reader/pull/439) 已 squash 合并为 `main@fbd5079f8346ba53df20ae53693b8608461ba083`，Quality checks run `33747138348` 通过，Issue #171 保持开放。
- [x] **G-02 发布/交接状态结构化检查（已合并）**：新增只读 `release:status` 与 `docs/release-status.json`，校验版本、唯一 NEXT 状态、CHANGELOG、Windows x64 Release 资产、镜像/外部阻塞和交接链接；分支 `codex/g02-release-state-2026-09-03`，PR [#441](https://github.com/MY-moss/moyang_Reader/pull/441) 已 squash 合并为 `main@47a0c60a5775962cfa99dbef1c47b33315549b0b`，Quality checks run `33756198592` 与依赖审计 run `33756198652` 已通过。
- [x] **G-03 构建缓存预算提示（PR 待合并）**：清理器预览新增受管 Cargo target 的大小/闲置时间提示和显式 `--dry-run` 入口；超预算只报告路径、大小、年龄和明确清理建议，受保护 target 默认不删除；分支 `codex/g03-build-cache-budget-2026-09-03`，PR [#442](https://github.com/MY-moss/moyang_Reader/pull/442) 已创建，基线 `main@47a0c60a5775962cfa99dbef1c47b33315549b0b`。

- [x] **#193 交互视觉令牌（已合并）**：查找框焦点环、关系图 primary 主按钮、上下文页签状态和焦点/动效/等宽字体令牌已完成；相关单测 1/1、无障碍浏览器 E2E 1/1、build、Lint、类型感知、格式和 diff 检查通过。PR [#433](https://github.com/MY-moss/moyang_Reader/pull/433) 已 squash 合并为 `main@9a7017747c1121d977489a42aba2f7809e6e0892`，Quality checks run `33706502133` 全部通过，包含 Windows desktop smoke；本机桌面运行器因缺少 `tauri-driver` 未完成本地会话，Issue #193 已关闭。
- [x] **#171 CSS 颜色令牌治理第一批（已合并）**：错误/警告、代码块/行内代码、文件卡片、状态栏和工作区列表已改用语义令牌；自动/显式深色逐组件覆盖从 88 降为 0，原始颜色字面量从 245 降为 219；静态工作流测试 15/15、主题对称浏览器 E2E 1/1、build、Lint、类型感知、格式和 diff 检查通过；分支 `codex/css-token-governance-2026-09-03`，PR [#434](https://github.com/MY-moss/moyang_Reader/pull/434) 已 squash 合并为 `main@f7b0b96087c56eb6d2aab4879a433d6fbd42d54a`，Quality checks run `33711636497` 和依赖审计 `33711636526` 已通过，Issue #171 保持开放。
- [x] **#191 焦点模式 Escape 互斥（已合并）**：共享模态只消费当前焦点所属的最内层 Escape，并阻断后续全局监听；专注模式进入时聚焦可见退出入口，命令面板关闭后焦点安全归还；分支 `codex/escape-mutex-2026-09-03`，PR [#432](https://github.com/MY-moss/moyang_Reader/pull/432) 已 squash 合并为 `main@38ed9a03a11654986afa8656b2347d5784f35c34`，Quality checks run `33701530614` 全部通过，Issue #191 已关闭。
- [x] **#191 主阅读区读屏播报收窄**：移除 `main.content-area` 的宽范围 `aria-live`，打开文档加载状态改为显式 `status/polite`，补无障碍 E2E；PR [#431](https://github.com/MY-moss/moyang_Reader/pull/431) 已 squash 合并为 `main@34b3fc6b1b0656f207b9b46240c7de17279f6605`，Quality checks run `33693407155` 全部通过。Issue #191 保持开放至 Escape 互斥合并。
- [x] **用户反馈：默认首页与品牌视觉收口**：启动前已重新核验开放 Issue/PR，未发现重复产品 PR；基于 `main@6843ff2b0a736d7c9247f4cd1205ee2398a09d69` 在独立工作树/分支 `codex/default-home-brand-2026-09-03` 完成默认空状态 Logo 替换，移除旧大写 M，保留首次启动操作；PR [#430](https://github.com/MY-moss/moyang_Reader/pull/430)，Quality checks run `33687800718` 全部通过。只做这一垂直切片，#191 剩余读屏、视觉令牌和 HTML 路线另行拆分。
- [x] **#171 CSS 紧凑间距令牌治理第二批（已合并）**：顶栏、More/查找面板、左侧工作区主控件、文件条目和底栏已改用 `--space-*` 令牌，保持原值并补 720/900px 无横向溢出 E2E；分支 `codex/css-token-followup-2026-09-03`，PR [#435](https://github.com/MY-moss/moyang_Reader/pull/435) 已 squash 合并为 `main@5dcf1962950d1e88615190a0948024136b054af6`，Quality checks run `33715368941` 全部通过，Issue #171 保持开放。
- [x] **#171 CSS 字体字号令牌治理第三批（已合并）**：顶栏、更多/设置、查找栏、标签栏、左侧阅读库操作与文件条目、阅读历史摘要、状态栏已改用 `--type-*` 令牌，保持原值并补 720/900px 运行时字号与溢出 E2E；分支 `codex/css-font-token-2026-09-03`，PR [#436](https://github.com/MY-moss/moyang_Reader/pull/436) 已 squash 合并为 `main@9dfe5d8dc806023ab2881c04300d24790e35c167`，Quality checks run `33719109262` 全部通过，Issue #171 保持开放。

已完成：更新入口“更多”工作流与不中断阅读 PR [#429](https://github.com/MY-moss/moyang_Reader/pull/429) 已 squash 合并为 `main@6843ff2b0a736d7c9247f4cd1205ee2398a09d69`，Quality checks run `33681521320` 全部通过；左侧栏阅读库操作区布局与菜单交互 PR [#428](https://github.com/MY-moss/moyang_Reader/pull/428) 已 squash 合并为 `main@8325982f12276e938084523966f02404ba2db041`，Quality checks run `33671029611` 全部通过。

## 当前切片：#112 更新与 opener 文档收口

- 目标：收口更新器、opener、镜像巡检和权限边界文档，让用户能按统一说明处理更新失败、镜像不可用、文件关联和权限问题。
- 用户价值：用户遇到更新或打开文件异常时能获得准确的回退路径和故障排查，不会把静态镜像、GitHub 回退和签名状态混为一谈。
- 非目标：不重复实现更新器、不改变更新端点/签名/安装包、不上传凭据、不完成需要真实旧版本或 Cloudflare Secret 的实机验证、不扩展跨平台或 HTML 功能。
- 验收：`docs/UPDATE.md`、`docs/RELEASE-POLICY.md`、用户指南和相关交接说明不再互相矛盾；明确 opener 权限、镜像失败回退、更新限制、签名/Authenticode 边界和用户可见排查；链接/格式/文档检查通过；不伪造 #241/#51 的外部证据。
- 风险/回滚：文档表述错误可能误导用户进行更新或权限操作；以当前代码、`release-status.json` 和现有工作流为事实源，回退 #112 PR 即可恢复文档版本，不改用户数据或运行时行为。
- 分支：下一切片启动前从最新 `main@47a0c60a5775962cfa99dbef1c47b33315549b0b` 创建独立 `codex/` 分支，并重新核验是否有重复 Issue/PR。

已完成的 #191 子切片：快速打开 PR [#424](https://github.com/MY-moss/moyang_Reader/pull/424) 已 squash 合并为 `main@a650f934429f8f19511dd6c72ef5b17541c694ff`，Quality checks run `33634427700` 全绿；标签栏 PR [#425](https://github.com/MY-moss/moyang_Reader/pull/425) 已 squash 合并为 `main@0783b27c314749a3e1e1b0371b92674a0a77a247`，Quality checks run `33642980506` 全绿；文件树 PR [#426](https://github.com/MY-moss/moyang_Reader/pull/426) 已 squash 合并为 `main@e9cde556e48957f270828159890522b52ef51f89`，Quality checks run `33653154436` 全绿；目录 PR [#427](https://github.com/MY-moss/moyang_Reader/pull/427) 已 squash 合并为 `main@61ab3b35e9f50e0704846e5dac768f03f98458a2`，Quality checks run `33664518604` 全部通过。

## 下一批候选（下一切片开始前重新检查）

按“用户可见收益 / 无外部阻塞 / 可独立验收”排序：

1. **#112 更新与 opener 文档收口**：在不重复实现更新器的前提下补齐权限边界、镜像回退和故障排查；T2/T3。
2. **G-03 构建缓存预算提示**：已合并；只读报告大小/闲置时间和明确清理建议，不自动删除活动 target，不改变 D 盘构建目标路径；T1。
3. **#241/#51 发布条件旁路**：仅在真实旧版本、签名环境和 Cloudflare Secret 可用时重新评估；不把受限环境记为通过。

条件旁路（不抢占普通切片）：#241 更新/镜像/PDF 实机矩阵、#51 Authenticode、#112 更新文档；只有外部环境满足时才改为 READY。

## Must / 稳定性

- [x] #416 图标一致性（PR #418 已合并为 `main@45334c0b6cf9dc5f9b1bd39d2803b96181f0643e`，Issue 已关闭）。
- [ ] #241 旧版本更新、PDF 落盘和镜像全链路实机验证（条件项）。
- [ ] #51 Windows 安装包代码签名和手动发布校验（条件项）。
- [ ] #112 opener、镜像巡检和更新限制文档收口。

已完成但必须保留回归：#87 批量 DOCX、#164/#165 Markdown 往返、#189 质量门禁、#226 Action SHA、#234 通知栈、#321/#323/#346 编辑/草稿、#357～#372 已交付切片。

## Should / 高频体验与维护

- [x] #366 统一确认弹层（PR #419 已合并，Issue 已关闭）。
- [x] #370 阅读历史与本地统计（PR #422 已合并，Issue 已关闭）。
- [x] #191 键盘与读屏导航（主阅读区读屏播报收窄与 Escape 互斥已完成；PR 合并后关闭 Issue）。
- [x] #193 焦点、按钮、页签、字体和动效令牌细节（PR [#433](https://github.com/MY-moss/moyang_Reader/pull/433) 已合并）。
- [x] #233 顶栏图标体系与操作密度（PR #423 已合并，Issue 已关闭）。
- [ ] #171 CSS 令牌治理（后续批次）。
- [ ] #194 TS↔Rust 契约、路径谓词与重复实现。
- [ ] #16 `App.tsx` 渐进拆分。
- [ ] #227 `SECURITY.md` 与私密披露入口。

## Planned / 尚未创建专门 Issue

- [ ] H-01/H-05 HTML 安全只读预览与安全门禁。
- [ ] H-02 Markdown 白名单原生 HTML与源码回退。
- [ ] H-03 HTML 源码编辑（首版不做 WYSIWYG）。
- [ ] H-04 HTML 资源、打印与分享包。
- [ ] K-01 Inbox/Daily Markdown 收集。
- [ ] K-02 图谱筛选、显式关系和规模保护。
- [ ] K-03 Mermaid 懒加载与源码回退。
- [ ] K-04 JSON Canvas。
- [ ] K-05 属性/标签索引。
- [ ] S-01 本地分享包、S-02 URI/CLI、S-03 可选部署。
- [ ] AI-01 主动式 AI 助手、P-01 内部插件接口（v1.0 后评估）。

## Won't / 当前明确不做

- [ ] 云同步、账号、在线/实时多人协作、移动端和跨平台安装包。
- [ ] 任意 JavaScript 插件、插件市场、iframe/WebView 插件和任意脚本执行。
- [ ] DOCX/PDF 原格式回写、完整 Notion/Dataview 替代品、常驻后台服务和捆绑本地模型。

## 每个切片结束前的交接检查

- [ ] Issue/PR 状态与证据已更新，未把部分 CI 成功写成全绿。
- [ ] 代码、测试、用户文案、工程文档和回滚方式在同一个 PR 内。
- [ ] 只保留一个主要分支和 PR；不覆盖根目录脏改动。
- [ ] 记录 SHA、run_id、测试/构建次数、修改文件数、失败/重试和返工。
- [ ] 更新 [`../docs/NEXT.md`](../docs/NEXT.md)、[`../docs/AI-HANDOFF.md`](../docs/AI-HANDOFF.md) 和必要的 `docs/handoff/` 后停止。
