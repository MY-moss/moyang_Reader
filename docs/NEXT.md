# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) 页面背景主题令牌治理，范围锁定为 `body` 现有固定浅色渐变的主题适配；此前动效令牌 PR #437 已合并到 `main@5b9f4e8`，本切片 PR [#438](https://github.com/MY-moss/moyang_Reader/pull/438) 已创建。
- 基线与分支：远端 `main@5b9f4e8cb804ff6366d229a04a5e42c13840e8a1`；独立分支 `codex/css-theme-token-2026-09-03`，远端提交 `ceb4eea2f48eb541ce5b3cad8dda70baa9d73b1d`，PR [#438](https://github.com/MY-moss/moyang_Reader/pull/438)；启动前已核验 #171、开放 Issue/PR，无重复产品 PR；其余开放 PR 仅为 Dependabot。
- 稳定版本与发布：当前稳定版 `v0.10.14`；本切片是 v0.11 高频体验批次的 T2 样式治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 已清理，切片结束时只回收可再生生成物，不触碰脏工作树或 junction。

## Task Context：#171 页面背景主题令牌治理

- 目标：把 `body` 的页面背景收敛到语义 `--page-background`，保留现有浅色渐变，并为系统/显式深色提供一致的深色渐变；Windows 高对比度继续使用 `Canvas`。
- 用户价值：深色主题下窗口边缘、滚动露底和空白区域不再残留浅色页面底，应用壳层与页面背景保持同一主题，不打断阅读流程。
- 非目标：不改组件配色、布局尺寸、交互、阅读库/更新器/文档数据语义，不处理 #194、#16、发布条件项、HTML 源码编辑、脚本、插件或重型默认模块，不生成发布资产。
- 验收标准：`body` 通过 `--page-background` 渲染；系统深色和显式深色均使用深色页面背景且计算样式一致；浅色现有渐变保持不变；强制高对比度保持 `Canvas`；静态令牌测试、720/900px 浏览器 E2E、Lint、格式、构建和 PR Quality checks 通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright；无新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：深色渐变选值不当可能造成页面边缘亮度突变或与内容区脱节；浅色值保持原样，深色只使用现有深色语义色，并用显式/系统主题计算样式与窄窗口溢出 E2E 控制。
- 回滚：回退本切片 PR 即可恢复 `body` 原固定背景声明；无数据迁移，不影响阅读库、文档或更新资产。
- 测试级别：T2；RED 阶段已复现缺少页面背景令牌，修复后静态测试 6/6、CSS 治理 E2E 4/4（720/900px、显式/系统深色、无横向溢出）；本地浏览器桥接等待 Chrome 远程调试授权时使用 Playwright 完成验证。

## 完成后唯一下一步

- PR #438 合并后，重新核验 Issue/PR，从 #171 剩余主题规则中只选择一个边界；不顺手处理 #194、#16、发布条件项或 HTML 路线。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档。
- 工程项：#171 CSS 主题规则后续边界、G-02 发布/交接状态结构化检查、G-03 构建缓存预算提示、#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约、#227 安全披露、#111 轻量 i18n。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构与分享：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas、K-05 属性/标签索引、S-01/S-02/S-03 分享与 URI/CLI。

执行授权仍只有本文件；本切片完成交接后停止，不自动开始下一批。
