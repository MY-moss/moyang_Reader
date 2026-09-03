# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) PDF/图片预览画布主题令牌化；范围锁定为 `.pdf-preview`、`.image-preview` 和 `.image-canvas` 的主题表面，不扩展到其他剩余颜色、阴影或布局规则。
- 基线与分支：远端 `main@fbd5079f8346ba53df20ae53693b8608461ba083`；独立分支 `codex/css-theme-next-2026-09-03`；PR [#440](https://github.com/MY-moss/moyang_Reader/pull/440)；启动前已核验 #171、开放 Issue/PR，无重复产品 PR；其余开放 PR 仅为 Dependabot。
- 稳定版本与发布：当前稳定版 `v0.10.14`；本切片属于 v0.11 高频体验批次的 T2 样式治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 已清理；切片结束时只回收可再生生成物，不触碰脏工作树或 junction。

## Task Context：#171 PDF/图片预览画布主题令牌化

- 目标：新增 `--preview-surface`、`--preview-checker-light`、`--preview-checker-dark`，让 PDF/图片预览外框和图片棋盘背景从语义令牌取色；深色复用现有暗色表面，forced-colors 使用系统 `Canvas`。
- 用户价值：深色阅读时 PDF/图片预览不再出现刺眼的浅色画布；Windows 高对比度模式下移除低辨识度棋盘渐变，预览仍与系统画布一致。
- 非目标：不改变 PDF 页面白底、图片内容、缩放、滚动、尺寸布局、阅读库、更新器、业务逻辑、HTML 导出/编辑、安全门禁、脚本、插件或重型默认模块，不生成发布资产。
- 验收标准：浅色计算样式保持现有值；显式/系统深色预览外框与棋盘均为暗色且一致；forced-colors 三个令牌为 `Canvas`、棋盘背景为 `none`；静态令牌测试 8/8；CSS 治理 E2E 6/6，覆盖 720px、四种主题模式与无横向溢出；Lint、类型感知、构建产物、格式、构建和 `git diff --check` 通过。
  one`；静态令牌测试 8/8；CSS 治理 E2E 6/6，覆盖 720px、四种主题模式与无横向溢出；Lint、类型感知、构建产物、格式、构建和 `git diff --check` 通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright；无新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：深色预览表面或高对比度回退配置不当可能影响预览边界辨识；保持浅色原值，使用显式/系统深色等价和 forced-colors 计算样式 E2E 控制。
- 回滚：回退 PR #440 即可恢复预览选择器原有颜色和棋盘背景，不涉及数据迁移或用户文件。
- 当前验证：RED 阶段先复现缺少预览令牌；修复后工作流/令牌静态测试 21/21、CSS 治理 E2E 6/6、前端 build、Lint、类型感知、构建产物、Prettier 和 `git diff --check` 通过；本机 desktop smoke 仍受缺少 `tauri-driver` 影响，交由 PR Quality 门禁复核。

## 完成后唯一下一步

- 本切片 PR 合并后，重新核验 Issue/PR；若 #171 仍有可安全归类的剩余主题边界，只选择一个独立批次，否则进入 F-10 `App.tsx` 渐进拆分；不顺手处理 #194、发布条件项或 HTML 路线。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档；缺少真实旧安装环境、证书或 Cloudflare Secret 时只记录阻塞，不伪造通过。
- 工程项：G-02 发布/交接状态结构化检查、G-03 构建缓存预算提示、#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约、#227 `SECURITY.md`、#111 轻量 i18n。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构与分享：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas、K-05 属性/标签索引、S-01/S-02/S-03 分享与 URI/CLI。
- 明确不做：云同步、账号、在线协作、移动端/跨平台安装包、任意 JavaScript 插件、插件市场、iframe/WebView 插件和任意脚本执行。

执行授权仍只有本文件；本切片完成交接后停止，不自动开始下一批。
