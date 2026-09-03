# Moyang Reader 唯一下一步

- 当前切片：Issue [#171](https://github.com/MY-moss/moyang_Reader/issues/171) 的第二批 CSS 紧凑间距令牌治理；分支 `codex/css-token-followup-2026-09-03`，PR [#435](https://github.com/MY-moss/moyang_Reader/pull/435) 已创建，远端提交为 `44e3c08fe54051545f2ac6ee60d7d14816bc09eb`；主线基线已核验为 `main@f7b0b96087c56eb6d2aab4879a433d6fbd42d54a`。
- 基线与交付：从包含已合并 #171 第一批和 #193 代码的干净工作树建立独立分支；本批只处理顶栏、More/查找面板、左侧工作区主控件、文件条目和底栏的间距来源，不关闭仍需后续批次的 #171。
- Issue/PR 核验：启动前已检查 #171、开放 Issue 与 PR；没有重复产品 PR；当前开放 PR 仅为 Dependabot 更新。
- 稳定版本：`v0.10.14`；本切片属于 v0.11 高频体验批次，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 构建缓存：统一使用 `D:\AI-moyang\本地阅读工具-build-cache`；C 盘旧 `build-cache` 内容已清理，后续只在无活动构建时回收 D 盘可再生目标。

## 本轮切片：#171 CSS 紧凑间距令牌治理第二批（2026-09-03）

- 目标：把顶栏、More/查找面板、左侧工作区主控件、文件条目和底栏的紧凑间距集中到 `--space-*` 令牌，保持现有密度值和布局行为不变。
- 用户价值：后续处理“更多”、更新、阅读库和文件树 UI 时只需调整统一间距来源，减少窄窗口遮挡、间距漂移和重复微调。
- 非目标：不重做视觉设计，不改变交互、阅读库/文档/更新器数据语义，不进入 HTML 源码编辑，不执行脚本，不引入插件或重型默认模块，不生成发布资产。
- 验收标准：受治理选择器的 `gap`/`margin`/`padding` 不再直接写入像素值；现有紧凑值通过 16 个 `--space-*` 令牌表达；原始间距声明从 476 降至不高于 445；720/900px 浏览器 E2E 无横向溢出且顶栏、侧栏边界完整；静态令牌检查、相关主题/无障碍 E2E、构建、Lint、类型感知、格式和 diff 检查通过。
- 涉及文件：`src/app/styles.css`、`scripts/style-token-check.test.mjs`、`e2e/css-token-governance.spec.ts`，以及本文件、`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：现有 CSS Custom Properties、React/Vite、Node test、Playwright/axe；不新增运行时依赖、凭据、数据迁移或发布资产。
- 风险：间距令牌替换若误写可能造成局部溢出或密度变化；本批只替换保持原值的顶栏/工作区公共间距，并用 720/900px 计算样式和横向溢出检查控制风险。
- 回滚：回退本批 PR 即可恢复原间距声明，不需要数据迁移，不影响阅读库、文档或已下载更新。
- 基线指标：`styles.css` 5950→5967 行；原始间距声明 476→437；原始颜色字面量保持 219；受治理选择器直接间距像素值为 0。
- 验证：间距/颜色静态令牌测试 3/3；新增紧凑宽度 E2E 1/1；主题/设置无障碍 E2E 5/5；More、工具栏图标、窄工具栏和顶栏互斥回归 4/4；前端 build、Lint、类型感知 ESLint、Prettier、构建产物和 `git diff --check` 通过；本机桌面 smoke 仍受缺少 `tauri-driver` 阻塞，远端 Windows smoke 由 PR [#435](https://github.com/MY-moss/moyang_Reader/pull/435) 门禁确认。

## 合并后唯一下一步：#171 CSS 令牌治理后续批次（重新核验后启动）

- #171 尚未整体完成；合并本批后，下一批只从剩余字体/动效/主题规则中重新选择一个边界，继续保持一个分支和一个 PR，不顺手处理 #194、#16 或 HTML 路线。
- 依赖/风险/回滚：继续依赖 #193 与 #119 对比度基线；每批通过独立 PR 回退，不修改数据格式。

## 仍未开发的路线

- 条件项：#241 更新/镜像/PDF 实机矩阵、#51 Windows 安装包签名、#112 更新与 opener 文档。
- 工程项：#16 `App.tsx` 渐进拆分、#194 TS↔Rust 契约收敛、#227 安全披露、#111 轻量 i18n/错误码、G-02/G-03 治理收口。
- HTML：先完成 H-01 安全只读预览与 H-05 CSP/清洗门禁，再评估 H-02 白名单 HTML、H-03 源码编辑和 H-04 资源/打印/分享；当前 HTML 仅为导出目标。
- 知识结构：K-01 Inbox/Daily、K-02 图谱筛选、K-03 Mermaid 懒加载、K-04 JSON Canvas。

执行授权仍只有本文件；完成当前 #171 第二批后停止，不自动开始后续令牌批次。
