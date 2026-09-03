# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) 动效时长令牌治理，范围锁定为 `.file-drop-card` 与 `.quick-open-item` 两个仍含直接 transition 时长的规则；PR [#437](https://github.com/MY-moss/moyang_Reader/pull/437) 已创建，等待门禁与合并。
- 基线与分支：远端 `main@9dfe5d8dc806023ab2881c04300d24790e35c167`；独立分支 `codex/css-motion-token-2026-09-03`；远端功能提交 `a1bf9fda50d228f2ba38e647e8dd21adca861236`；启动前已核验 #171、开放 Issue/PR，无重复产品 PR；其余开放 PR 仅为 Dependabot。
- 稳定版本与发布：当前稳定版 `v0.10.14`；本切片是 v0.11 高频体验批次的 T2 样式治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 已清理，切片结束时只回收可再生生成物，不触碰脏工作树或 junction。

## Task Context：#171 动效时长令牌治理

- 目标：把 `.file-drop-card` 的 140ms 与 `.quick-open-item` 的 130ms transition 时长收敛到语义 `--motion-file-drop` 与 `--motion-quick-open-item`，保持原有时长、标准缓动和 reduced-motion 覆盖行为不变。
- 用户价值：后续维护动效时从统一来源调整这两个残余路径，减少样式漂移，不打断当前阅读流程。
- 非目标：不重做动效、不改交互/数据/持久化/主题规则，不处理更新器、阅读库或默认首页，不进入 HTML 源码编辑，不执行脚本，不引入插件或重型默认模块，不生成发布资产。
- 验收标准：两个规则仅引用语义动效令牌；样式表不含直接 transition 时长；静态令牌测试通过；720/900px 浏览器 E2E 验证正常与 reduced-motion 计算值且无横向溢出；Lint、格式、构建和 PR Quality checks 通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`、本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright；无新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：令牌误配可能改变微交互时序；本批保留 140/130ms 原值，并以静态规则和运行时 computed style 检查控制风险。
- 回滚：回退 PR #437 即可恢复两个直接 transition 声明；无数据迁移，不影响阅读库、文档或更新资产。
- 测试级别：T2；RED 阶段已复现缺少令牌，修复后静态测试 5/5、CSS 治理 E2E 3/3（720/900px、正常/减少动效）、Lint、Prettier、build 与 `git diff --check` 通过；本机 desktop smoke 仍需在远端 Quality checks 中复核。

## 完成后唯一下一步

- PR #437 合并后，重新核验 Issue/PR，从 #171 剩余主题规则中只选择一个边界；不顺手处理 #194、#16、发布条件项或 HTML 路线。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档。
- 工程项：#171 CSS 主题规则后续边界、G-02 发布/交接状态结构化检查、G-03 构建缓存预算提示、#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约、#227 安全披露、#111 轻量 i18n。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构与分享：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas、K-05 属性/标签索引、S-01/S-02/S-03 分享与 URI/CLI。

执行授权仍只有本文件；本切片完成交接后停止，不自动开始下一批。
