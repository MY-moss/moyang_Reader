# Moyang Reader 任务清单

> 执行授权只有 [`../docs/NEXT.md`](../docs/NEXT.md)；本清单用于交接和排序，不能绕过 READY 门禁自行并行。

## 最近完成切片

- [x] **#193 交互视觉令牌（已合并）**：查找框焦点环、关系图 primary 主按钮、上下文页签状态和焦点/动效/等宽字体令牌已完成；相关单测 1/1、无障碍浏览器 E2E 1/1、build、Lint、类型感知、格式和 diff 检查通过。PR [#433](https://github.com/MY-moss/moyang_Reader/pull/433) 已 squash 合并为 `main@9a7017747c1121d977489a42aba2f7809e6e0892`，Quality checks run `33706502133` 全部通过，包含 Windows desktop smoke；本机桌面运行器因缺少 `tauri-driver` 未完成本地会话，Issue #193 已关闭。
- [x] **#171 CSS 颜色令牌治理第一批（待合并）**：错误/警告、代码块/行内代码、文件卡片、状态栏和工作区列表已改用语义令牌；自动/显式深色逐组件覆盖从 88 降为 0，原始颜色字面量从 245 降为 219；静态工作流测试 15/15、主题对称浏览器 E2E 1/1、build、Lint、类型感知、格式和 diff 检查通过；分支 `codex/css-token-governance-2026-09-03`，PR [#434](https://github.com/MY-moss/moyang_Reader/pull/434) 已创建，Quality checks run `33709940611` 和依赖审计 run `33709940595` 已通过，Issue #171 保持开放。
- [x] **#191 焦点模式 Escape 互斥（已合并）**：共享模态只消费当前焦点所属的最内层 Escape，并阻断后续全局监听；专注模式进入时聚焦可见退出入口，命令面板关闭后焦点安全归还；分支 `codex/escape-mutex-2026-09-03`，PR [#432](https://github.com/MY-moss/moyang_Reader/pull/432) 已 squash 合并为 `main@38ed9a03a11654986afa8656b2347d5784f35c34`，Quality checks run `33701530614` 全部通过，Issue #191 已关闭。
- [x] **#191 主阅读区读屏播报收窄**：移除 `main.content-area` 的宽范围 `aria-live`，打开文档加载状态改为显式 `status/polite`，补无障碍 E2E；PR [#431](https://github.com/MY-moss/moyang_Reader/pull/431) 已 squash 合并为 `main@34b3fc6b1b0656f207b9b46240c7de17279f6605`，Quality checks run `33693407155` 全部通过。Issue #191 保持开放至 Escape 互斥合并。
- [x] **用户反馈：默认首页与品牌视觉收口**：启动前已重新核验开放 Issue/PR，未发现重复产品 PR；基于 `main@6843ff2b0a736d7c9247f4cd1205ee2398a09d69` 在独立工作树/分支 `codex/default-home-brand-2026-09-03` 完成默认空状态 Logo 替换，移除旧大写 M，保留首次启动操作；PR [#430](https://github.com/MY-moss/moyang_Reader/pull/430)，Quality checks run `33687800718` 全部通过。只做这一垂直切片，#191 剩余读屏、视觉令牌和 HTML 路线另行拆分。

已完成：更新入口“更多”工作流与不中断阅读 PR [#429](https://github.com/MY-moss/moyang_Reader/pull/429) 已 squash 合并为 `main@6843ff2b0a736d7c9247f4cd1205ee2398a09d69`，Quality checks run `33681521320` 全部通过；左侧栏阅读库操作区布局与菜单交互 PR [#428](https://github.com/MY-moss/moyang_Reader/pull/428) 已 squash 合并为 `main@8325982f12276e938084523966f02404ba2db041`，Quality checks run `33671029611` 全部通过。

已完成的 #191 子切片：快速打开 PR [#424](https://github.com/MY-moss/moyang_Reader/pull/424) 已 squash 合并为 `main@a650f934429f8f19511dd6c72ef5b17541c694ff`，Quality checks run `33634427700` 全绿；标签栏 PR [#425](https://github.com/MY-moss/moyang_Reader/pull/425) 已 squash 合并为 `main@0783b27c314749a3e1e1b0371b92674a0a77a247`，Quality checks run `33642980506` 全绿；文件树 PR [#426](https://github.com/MY-moss/moyang_Reader/pull/426) 已 squash 合并为 `main@e9cde556e48957f270828159890522b52ef51f89`，Quality checks run `33653154436` 全绿；目录 PR [#427](https://github.com/MY-moss/moyang_Reader/pull/427) 已 squash 合并为 `main@61ab3b35e9f50e0704846e5dac768f03f98458a2`，Quality checks run `33664518604` 全部通过。

## 下一批候选（下一切片开始前重新检查）

按“用户可见收益 / 无外部阻塞 / 可独立验收”排序：

1. **#171 CSS 令牌治理后续批次**：第一批已完成待合并；后续重新盘点并只选择一个剩余颜色/间距/主题边界；T2；不与大范围布局重构混做。
2. **#241/#51/#112 发布条件旁路**：仅在真实旧版本、签名环境和 Cloudflare Secret 可用时重新评估；不把受限环境记为通过。
3. **G-02/G-03 工程治理收口**：发布/交接状态结构化检查和构建缓存预算提示仍未开发；按 `NEXT.md` 重新授权后再做。

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
