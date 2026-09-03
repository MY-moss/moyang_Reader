# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) CSS 字体令牌治理第三批，范围锁定为应用壳层、标签栏和左侧工作区的字号来源。
- 基线与分支：远端 `main@5dcf1962950d1e88615190a0948024136b054af6`；独立分支 `codex/css-font-token-2026-09-03`；启动前已核验 #171、开放 Issue/PR，无重复产品 PR。
- 稳定版本与发布：当前稳定版 `v0.10.14`；本切片是 v0.11 高频体验批次的 T2 样式治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 已清理，切片结束后只回收可再生生成物，不触碰脏工作树或 junction。

## Task Context：#171 CSS 字体令牌治理第三批

- 目标：将顶栏、更多/设置、查找栏、标签栏、左侧阅读库操作与文件条目、阅读历史摘要、状态栏的 9–19px 字号收敛到语义 `--type-*` 令牌，保持当前计算值和布局行为不变。
- 用户价值：默认首页、更多操作和侧栏信息层级更稳定；后续 UI/无障碍调整只需修改统一字号来源，减少窄窗口漂移和逐处微调。
- 非目标：不改阅读正文、编辑器或打印排版，不改变交互/数据/持久化，不处理 HTML 源码编辑、脚本、插件或跨平台范围，不生成发布资产。
- 验收标准：受治理选择器不直接写入字号像素；9 个当前字号值由 `--type-*` 令牌表达；直接字号声明从 256 降至不高于 214；720/900px 浏览器运行时字号与无横向溢出检查通过；静态测试、Lint、类型感知、格式、构建、相关 E2E 和 PR Quality checks 通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright/axe；无新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：字号令牌误配可能改变信息层级或造成窄窗口换行；本批只做同值替换，静态选择器治理和 720/900px 计算样式/溢出 E2E 锁定结果。
- 回滚：回退本切片 PR 即可恢复原字号声明；无数据迁移，不影响阅读库、文档或更新资产。
- 测试级别：T2；已完成一次前端构建，定向静态测试与 CSS 治理 E2E 通过；合并前按仓库 Quality checks 复核 Windows 桌面 smoke。

## 完成后唯一下一步

- 重新核验 Issue/PR 后，从 #171 剩余动效或主题规则中只选择一个边界；不顺手处理 #194、#16、发布条件项或 HTML 路线。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档。
- 工程项：G-02 发布/交接状态结构化检查、G-03 构建缓存预算提示、#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约、#227 安全披露、#111 轻量 i18n。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构与分享：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas、K-05 属性/标签索引、S-01/S-02/S-03 分享与 URI/CLI。

执行授权仍只有本文件；本切片完成交接后停止，不自动开始下一批。
