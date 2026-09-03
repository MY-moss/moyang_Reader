# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) 批注/高亮主题令牌化；范围锁定为批注引文、当前批注卡、正文批注高亮和 CSS Highlight 的琥珀色语义令牌，不扩展到其他主题规则。
- 基线与分支：远端 `main@e2757abb2d5d2fac2f6510ae4003770ca491c6a8`；独立分支 `codex/css-theme-followup-2026-09-03`，提交 `fccaafa`，PR [#439](https://github.com/MY-moss/moyang_Reader/pull/439)；启动前已核验 #171、开放 Issue/PR，无重复产品 PR；其余开放 PR 仅为 Dependabot。
- 稳定版本与发布：当前稳定版 `v0.10.14`；本切片是 v0.11 高频体验批次的 T2 样式治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 已清理，切片结束时只回收可再生生成物，不触碰脏工作树或 junction。

## Task Context：#171 批注/高亮主题令牌化

- 目标：新增 `--annotation-border` 与 `--annotation-surface` 语义令牌，让批注引文、当前批注卡、正文批注命中和 `::highlight(moyang-annotation)` 不再直接依赖琥珀色字面量，并为强制高对比度提供系统色回退。
- 用户价值：批注在浅色、深色和 Windows 强制高对比度模式下保持可辨识；后续调整主题或品牌色时只需维护统一来源，不会出现局部漏改。
- 非目标：不改批注数据、定位、保存、删除、编辑器、HTML 导出/编辑、布局尺寸、阅读库、更新器、脚本、插件或重型默认模块，不生成发布资产。
- 验收标准：相关选择器只通过两个语义令牌取色；静态治理测试 7/7；720/900px Playwright CSS 治理 E2E 5/5，覆盖浅色、显式/系统深色、forced-colors 和无横向溢出；Lint、格式、构建、`git diff --check` 与 PR Quality checks 通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright；无新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：暗色或系统色对比度配置不当可能降低批注辨识度；本批保持浅色原值、显式/系统深色分别验证并覆盖 forced-colors，限制在主题令牌层。
- 回滚：回退本切片 PR 即可恢复批注选择器原有颜色声明；无数据迁移，不影响阅读库、文档或更新资产。
- 测试级别：T2；RED 阶段先复现缺少批注令牌，修复后静态测试 7/7、CSS 治理 E2E 5/5、前端 build、Lint、格式和差异检查通过；浏览器桥接需远程调试授权时使用 Playwright 完成验证。

## 完成后唯一下一步

- 本切片 PR 合并后，重新核验 Issue/PR，从 #171 剩余主题规则中只选择一个边界；不顺手处理 #194、#16、发布条件项或 HTML 路线。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档。
- 工程项：#171 CSS 主题规则后续边界、G-02 发布/交接状态结构化检查、G-03 构建缓存预算提示、#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约、#227 安全披露、#111 轻量 i18n。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构与分享：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas、K-05 属性/标签索引、S-01/S-02/S-03 分享与 URI/CLI。

执行授权仍只有本文件；本切片完成交接后停止，不自动开始下一批。
