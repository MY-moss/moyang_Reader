## 当前切片：#87 复杂 DOCX 块增量序列化（待提交）

- 基线：远程 `main@7ca9961b16fdf467374902f1a2c8ccbe5ad1babc`；开发分支为 `codex/export-block-stream-2026-08-29`，原始开发目录的未提交改动未触碰。
- 目标：让 raw-DEFLATE 流式 DOCX 路径边遍历边写出段落、列表、表格、引用和链接，避免复杂单块先生成完整 XML，同时保持内容、换行、分卷、取消、失败清理和临时文件授权不变。
- 方案：保留缓冲导出和 JSZip 回退作为兼容基线；新增异步 inline/block/table 遍历器，按有限 XML 片段写入 `word/document.xml`，在表格行和节点边界执行取消检查与调度让出。
- 验证计划：导出定向测试必须证明复杂块的流式 XML 与缓冲 XML 一致，并覆盖 120 行表格；随后运行相关 Worker、lint、格式和 Windows desktop smoke。
- 已知限制：HTML 仍需先由 WebView DOMParser 解析，图片解码/转换和复杂 DOM 本身的内存仍属于 #87 后续观测范围；没有改 Worker 协议、PDF/打印或用户文档同步。#87 继续保持 open。
- 发布边界：本切片不创建安装包、签名、`latest.json`、GitHub Release 或 Cloudflare 镜像；待 #87 达到稳定验收后按 Windows x64 发布策略统一处理。
- 下一步：完成本分支定向验证，提交、推送并创建一个关联 #87 的 PR；远程检查通过后合并并更新本段，随后停止，不自动开启下一切片。

## 已完成切片：#87 单卷 DOCX 峰值收敛（2026-08-29）

- 基线：远程 `main@828a7409736e7e811858aedda92372e664d7dd0c`；开发分支为 `codex/export-single-volume-2026-08-29`，原始开发目录的未提交改动未触碰。
- 合并结果：PR [#338](https://github.com/MY-moss/moyang_Reader/pull/338) 已 squash 合并为 `main@7ca9961b16fdf467374902f1a2c8ccbe5ad1babc`；Quality checks run `33258714173` 全部成功。
- 已实现：连续文本按有限大小 XML 文本节点和流式写入片段处理；同内容同类型图片复用单个媒体资源，同时保留独立绘图 ID 和关系引用。
- 验证：导出/Worker 定向测试 36/36、lint、格式、构建和 Windows desktop smoke 12/12 通过；#87 未关闭，复杂块增量序列化由当前切片继续完成。

## 已完成切片：#226 Actions SHA 固定与前端定时审计

- 基线：远程 `main@805f5dcb8094dfd23d796beee645d4a338caf7c2`；开发分支为 `codex/actions-sha-audit-2026-08-29`，原始开发目录的未提交改动未触碰。
- 目标：固定 CI、Rust 审计、Windows Release 和 Cloudflare 镜像工作流的第三方 Action，并增加每周前端生产依赖审计与浮动引用阻断检查。
- 已核验来源：`actions/checkout@v4`、`actions/setup-node@v7`、`dtolnay/rust-toolchain@stable`、`Swatinem/rust-cache@v2`、`rustsec/audit-check@v2.0.0`、`tauri-apps/tauri-action@v1` 和 `cloudflare/wrangler-action@v3` 的提交 SHA 均从各自公开 GitHub ref/commit 核验；完整映射记录在对应 PR。
- 实现边界：新增 `scripts/check-action-pins.mjs` 及测试；CI、Release、镜像和 Rust 审计工作流执行检查；新增 `.github/workflows/frontend-audit.yml`，定时执行生产依赖审计且安装阶段禁用生命周期脚本。
- 发布边界：不改变产品功能、发布权限、签名 Secret 或镜像凭据，不生成安装包/Release；本切片完成后需在 #226 留下验证摘要，再从最新 `main` 选择下一项 Ready 任务。

## 当前发布状态（2026-08-29）

- 当前远程主线：`main@7ca9961b16fdf467374902f1a2c8ccbe5ad1babc`，版本文件仍为 `0.10.13`；PR [#338](https://github.com/MY-moss/moyang_Reader/pull/338) 已合并，#87 的复杂 DOCX 块增量序列化正在当前分支继续推进。
- 当前稳定 Release：[v0.10.13](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.13) 已公开；Windows x64 安装包 5,046,081 字节，SHA-256 `2bd6097e9952e7c6c74365a4a1751290470586a16e28b54df8e4a994b642782f`；签名文件 428 字节，SHA-256 `7b031ce4636b48d1774d118c4a6b2cbcff716bccb4038a07d072ff760088482c`。
- 草稿恢复差异预览（#323）已随本版本发布：恢复前可查看当前版本与草稿的新增/移除行、字符变化和有限差异；无差异时显示“无需恢复”，恢复只进入编辑区，必须显式保存。
- Cloudflare Pages 的 `latest.json`、安装包和签名已在线核验且哈希与 GitHub 一致；Release 自动镜像 job `33245475550` 仍因 Cloudflare Actions Secret 缺失失败，因此自动同步门禁保持未全绿。
- 下一步：完成当前 #87 复杂块增量序列化切片的单一 PR；合并和交接后再重新检查 Issues，不自动进入下一项或单独发布安装包。

## 已完成切片：#87 Windows 桌面批量导出响应性与授权边界（2026-08-29）

- 状态：生产修复、针对性 Rust/前端测试和真实 Windows Tauri smoke 均完成；本段记录的是单一垂直切片，不等同于关闭整个 #87。
- 工作范围：`src-tauri/src/commands.rs` 收紧精确导出目标和同目录 ` - 第 N 卷` 分卷授权；`src/app/App.tsx` 在导出开始及逐文档处理间让出调度；`desktop-e2e/smoke.e2e.mjs` 增加可操作性、取消清理和本机趋势基准；同步更新需求、路线、工作流和变更记录。
- 验收结果：Rust 定向授权测试通过，Rust library `51 passed`；前端导出定向测试 `30 passed`；真实 Windows desktop smoke `1/1` 通过。夹具为 48 篇 Markdown、1,884,816 字节文本和 228,143 字节 SVG；上下文面板交互 2ms、渲染事件循环最大间隔 66ms、取消延迟 97ms；Working Set 47,038,464 → 48,058,368 字节。以上为本机趋势数据，不是跨设备承诺。
- 失败路径：取消和目标路径为目录的提交失败均确认没有残留 `.moyang-export-part-*.tmp`；已提交分卷必须以 `PK` 开头。测试夹具、导出产物和失败模拟目录都在 smoke 结束时清理。
- 合并结果：PR [#335](https://github.com/MY-moss/moyang_Reader/pull/335) 已 squash 合并为 `main@4e31ad7653f9449214a2736dd390fc0eea795e10`；Quality checks run `33254080852` 全绿，#87 已追加验收摘要但继续保持 open。
- 发布边界：本切片不生成安装包、签名、`latest.json`、GitHub Release 或 Cloudflare 镜像；稳定批次再按 `docs/RELEASE-POLICY.md` 发布。#87 后续仅在更大真实图片、长单块内容和重复矩阵有明确缺口时再开新切片。
- 下一位 AI：先检查最新 `main` 和开放 Issues，从 Ready backlog 选择唯一切片；不要重复 #335、#87 桌面验收或顺手处理更新器、镜像 Secret 和其他产品功能。

## 当前切片：#189 TypeScript/Rust 质量门禁首个垂直切片（2026-08-29）

- 基线：`main@4e31ad7653f9449214a2736dd390fc0eea795e10`；功能分支为 `codex/quality-gates-2026-08-29`，原始开发目录的未提交改动未触碰。
- 目标：把显式 `any`、未使用变量、TypeScript 未使用/`switch`/模块语义和 Rust 最低版本约束固化为阻断门禁，降低后续 AI/贡献者回归风险。
- 已实现：ESLint 将显式 `any` 与未使用变量设为 error；两个 tsconfig 启用未使用、`switch` 穿透检查，应用配置启用 `verbatimModuleSyntax`；Cargo 声明 `rust-version = "1.88"`；Windows CI 增加不重复编译的 Rust metadata 兼容性预检。
- 基线证据：显式 `any` 为 0、ESLint warning/error 为 0；严格 TypeScript 试运行通过；Windows 依赖解析最高 Rust 要求为 1.88；本地 lint、TypeScript build 和 metadata 通过。
- 发布边界：只改变静态质量约束和 CI 预检，不改变用户可见功能；#189 不因本切片提前关闭，后续类型感知规则和 fallout 另行切片；不生成安装包或 Release。
- 交接：完成本分支的定向验证和一次 PR Quality checks 后，更新本段与 #189，若全绿且无真实冲突则合并并停止，不自动进入下一事项。

## 已完成切片：#87 单卷 DOCX 增量归档（2026-08-29）

- 基线：从 `main@0c6138f1f85ca47e1acca5e5b9ed9372445548ca` 创建 `codex/batch-export-memory-2026-08-29`；原始开发目录的 29 个未提交改动未触碰，隔离工作树位于项目内 `.codex-worktrees/batch-export-memory-2026-08-29`。
- 根因：前置切片虽已把 JSZip 内部流分块写入临时文件，但 `prepareBatchDocxArchive` 仍先拼接整卷 `document.xml`、图片和 JSZip 条目；Worker 只转移线程，不降低该峰值。
- 实现：新增轻量 ZIP 流写入器；`word/document.xml` 以文档块写入，XML 通过 raw DEFLATE，图片按原始字节写入；中央目录、数据描述符、图片关系和超链接关系在归档结束时补齐。`buildDocxExport` 和不支持 raw DEFLATE 的环境继续走 JSZip。
- 保持不变：Markdown/HTML/Word 转换、分卷上限、保存路径授权、同目录临时文件、原子提交、取消/失败清理和失败清单均不改；复杂单个 HTML 块尚未细分。
- 已验证：导出定向测试 31/31、前端全量测试 66 个文件/262 项、`npm run format:check`、`npm run build` 和 `npm run lint` 均通过；合成同环境基准（32 篇约 16 MiB 高变化文本）堆峰值从约 82.8 MiB 降至约 75.0 MiB，属于趋势测量，不是设备承诺。临时基准文件只用于本地测量，不纳入提交。
- 合并结果：PR [#332](https://github.com/MY-moss/moyang_Reader/pull/332) 已 squash 合并为 `main@85adbae647aa580b05207afe46c7c69015f9a5bc`；PR Quality checks run `33248063932` 全部成功，push run `33248078709` 为并发去重后的 skipped，不代表失败。
- 验收边界：真实 Windows 桌面批量 Word 导出、取消/失败清理由下一段独立切片验收；未完成前不要关闭 #87，也不要创建 Release。
- 回滚：回滚本分支/PR 即可；无数据迁移，导出目标仍通过现有临时文件提交边界保护。
- 下一位 AI：先查看本段、#87、开放 PR 和最新 `main`；只继续本轮 Windows 桌面验收，完成一个 PR 后更新本文件并停止。不要同时处理 #104、发布镜像或其他 Issue。

## 已完成切片：#87 Windows 桌面批量导出验收（2026-08-29）

- 目标：在真实 Tauri Windows Debug 进程中验证批量 Word 导出期间窗口仍可操作，并确认取消和最终目标提交失败后不会残留隐藏临时文件。
- 实现：扩展 `desktop-e2e/smoke.e2e.mjs`；创建临时大批量 Markdown 夹具，真实点击“单文件 Word”后取消，检查取消提示、中央文档仍可见、已生成卷以 `PK` 开头且没有 `.moyang-export-part-*.tmp`；再将第一卷目标变为目录，验证提交失败后的临时文件清理。
- 保持不变：不修改生产导出代码、DOCX/HTML/PDF 语义、分卷规则、取消协议、路径授权或 Release 流程；夹具和导出产物均在 smoke 结束时删除。
- 已验证：真实 Windows desktop smoke 12/12 通过；现有成功 PDF/HTML/Word、文件树、双链、编辑保存、外部修改、阅读位置、草稿冲刷和关闭确认场景均未回归。`npx eslint desktop-e2e/smoke.e2e.mjs` 与 `npm run format:check` 通过。
- Issue 状态：#87 仍保持 open；本切片补齐真实桌面取消/失败清理证据，后续只剩大批次主窗口响应性量化与是否关闭 Issue 的维护决策，不在本 PR 中虚报完成。
- 发布边界：这是验收/回归测试切片，不单独创建 Release、Windows 安装包、签名、manifest 或镜像；待 #87 验收闭环并形成稳定批次后再发布。
- 下一位 AI：先重新检查 #87、开放 PR 和最新 `main`；若继续 #87，只补主窗口响应性基准或新的可复现缺口；否则从 Ready backlog 选择唯一事项，不重复本切片。

## #187 Windows 窄窗口与工具栏可发现性（2026-08-29）

- 基线：以 Windows x64 最小窗口 `720px` 和 `960/1180px` 关键宽度为验收基线；原始开发目录未触碰，临时工作树位于项目内 `.codex-worktrees/narrow-layout-2026-08-29`。
- 目标：保证核心操作在窄窗口保持可见，次要操作可以通过明确的“更多”入口访问，正文和工具栏不产生意外横向滚动。
- 实现：窄窗口固定保留打开、侧栏、上下文、搜索和“更多”；快速打开、编辑模式、草稿和专注动作补入“更多”；工具栏空间不足时自动换行；移除仅适用于 640/360 的旧断点和横向滚动提示逻辑，保留单一 720px 浏览器回退布局。
- 验收：390px 回退以及 720/960/1180px 关键宽度的浏览器测试通过；编辑器、搜索、导出、面板和右键路径无回归；Windows 桌面冒烟测试通过。
- 已验证：本地 lint、格式检查、TypeScript、构建、定向浏览器测试和 Windows desktop smoke 均通过；PR #328 的 Quality checks run `33242777865` 成功，合并后的 main Quality checks run `33243109176` 成功。
- 发布边界：已随 Windows x64 `v0.10.13` 稳定批次发布；GitHub 与 Cloudflare 公开资产已核验，自动镜像 Secret 缺口另行维护。
- 已知边界：本轮不改变 Tauri 三栏职责、面板宽度持久化或图标体系；真实 Windows DPI/系统字体若有新问题另开复现 Issue。
- 当前状态：PR #328 已合并，#187 已自动关闭（completed）；已随 `v0.10.13` 发布，当前 main 为 `5c016e2ddf71c589de3191383b3595af4c6e7705`。
- 下一步：本切片到此停止；下一位 AI 必须重新检查 Issues 和最新 `main`，再从 Ready backlog 选择唯一事项。

## #323 草稿恢复差异预览与多段差异清晰度（2026-08-29）

- 基线：从已验证的 `origin/main@b83b92e` 创建 `codex/draft-recovery-clarity-2026-08-29`；原始开发目录的未提交修改未触碰，临时工作树位于项目内 `.codex-worktrees/draft-recovery-clarity-2026-08-29`。
- 目标：让用户在恢复草稿前看清当前版本与草稿的差异，并能判断“是否真的有必要恢复”，避免因为只看到草稿时间而误恢复。
- 已实现：保留既有恢复中心、当前文档提示和差异对话框；差异计算改为多段行级比较，小范围使用有界精确匹配，大文档使用轻量锚点策略；显示新增/移除行、字符变化和变更区域；无差异明确显示“无需恢复”，存在磁盘后续变化时提示先核对；大文档采用快速摘要时显式标记，不伪装成完整比较。
- 验收：分散修改不会被合并成一个大变更区；恢复前显示“无需恢复 / 存在未保存内容 / 建议先核对”三类明确决策提示；无差异时恢复按钮禁用；恢复仍只替换编辑区，必须显式保存才写回文件。
- 已验证：草稿差异、恢复决策对话框和恢复提示定向测试 3 个文件/7 项通过；lint、格式检查、TypeScript、前端构建通过；恢复中心浏览器 E2E 1/1 通过。构建仅保留仓库已有的 chunk 体积提示。
- 发布边界：已随 Windows x64 `v0.10.13` 稳定批次发布；GitHub Release、签名、manifest 和 Cloudflare 公开镜像资产已核验，自动镜像 Secret 缺口仍保持公开记录。
- 已知边界：不做三方合并、二进制比较或语义判断；超大且缺少稳定行锚点的文档会显示快速摘要并建议打开编辑区复核，最终是否保留仍由用户决定。
- 下一步：本切片已完成并发布；下一位 AI 必须重新检查 Issues 和最新 `main`，再从 Ready backlog 选择唯一事项。

## #321 原生编辑工具栏与插入面板（2026-08-29）

- 基线：从已验证的 `b842cef` 等价代码树创建 `codex/editor-insert-toolbar-2026-08-29`；原始开发目录的未提交修改未触碰，隔离工作区位于项目内 `.codex-worktrees/editor-insert-toolbar-2026-08-29`。
- 目标：把编辑格式、段落和链接/双链/图片/表格插入收敛为一致的应用内操作，修复图片 alt 误用路径、固定 3×3 表格和 WYSIWYG `execCommand`/原生 prompt 问题。
- 已实现：共享 `EditorToolbar`、`EditorInsertPopover` 和 `editor-insertion` 构造边界；WYSIWYG 使用 Milkdown 链接/图片/表格命令，源码模式使用统一 Markdown 生成；链接地址做危险协议拒绝，表格支持 2–8 行/列；命令面板和 `Ctrl+K` 改为请求编辑器面板。
- 已验证：编辑器插入与上下文动作单测 11/11；lint、Prettier、TypeScript/Vite build；浏览器 E2E `inserts a Markdown link from source mode` 与 `in-app insertion panel` 2/2。构建只有仓库既有 chunk 体积提示。
- 发布边界：已随稳定 Windows x64 `v0.10.13` 发布；安装包、签名、manifest 和公开镜像资产已核验。
- 已知边界：图片仍要求用户提供路径/URL，不在本切片实现资源选择器或复制上传；DOCX/PDF 仍只读；右键菜单的更深焦点循环仍由 #299 单独跟踪。
- 状态：PR #322 已合并到 `main`；其余资源选择器、原格式回写和右键焦点循环仍按原边界分别规划，不在本切片重复处理。

## #165 WYSIWYG 组件行为测试（2026-08-29）

- 基线：从已包含 #164 的 `main@b6f5687a91789f27cc6d03b972b40e8dee427b11` 等价代码树创建独立分支；原始开发目录的未提交改动未触碰。临时工作树位于项目内 `.codex-worktrees/issue-165-wysiwyg-tests-2026-08-29`，没有在项目父目录创建工作副本。
- 目标：为 WYSIWYG 补全、外部源同步、200ms 延迟保存和编辑器卸载冲刷建立可重复的行为保护，减少后续 Milkdown/React 变更造成的回归。
- 实现：新增 `src/app/editor-completion.ts`，抽出 `/` 与 `[[` 光标触发读取和卸载前 Markdown 冲刷边界；`MarkdownWysiwygEditor` 复用该边界，生产行为保持不变。新增组件挂载失败可恢复提示测试、触发范围/代码块/选区测试、未发送编辑只冲刷一次测试，以及真实 Milkdown 200ms 防抖测试。浏览器 smoke 增加 ArrowDown/ArrowUp 选择和 Tab 接受路径。
- 已验证：相关前端单测 6 个文件/37 项通过；`npx eslint` 变更文件通过；`npm run build` 通过；目标浏览器 E2E 1/1 通过。构建仅保留仓库已有的 chunk 体积提示。
- 发布边界：这是编辑器测试与稳定性切片，不创建 Release、Windows 安装包、签名、`latest.json` 或 Cloudflare 镜像；待稳定功能批次统一发布。
- Issue 状态：#165 的验收范围已完成，PR 合并后关闭；#164 的 GFM 保真边界继续作为前置保护。若后续发现真实编辑器行为缺口，应新建独立 Issue/分支，不在本分支继续扩展。
- 下一位 AI：先检查最新 Issues、开放 PR 和 `main`，再从最高优先级 Ready 项（当前为 #87 残余导出性能切片）选择一个主题；保持一个功能切片、一个主要分支、一个 PR，完成交接后停止。

## #164 GFM/WYSIWYG 保真边界（2026-08-29）

- 基线：从远程 `main@9cdd39309f83631388425af9c2df3a35bffc8243` 创建独立分支；原始开发目录的未提交改动未触碰。
- 目标：锁定 Milkdown GFM 所见即所得编辑的可安全回写范围，避免 Markdown 在模式切换或保存时静默丢失结构。
- 已实现：安全检查新增 TOML frontmatter、行内数学、行内/块级原始 HTML、Callout 的源码回退；保留既有 YAML frontmatter、嵌入、块 ID 和数学边界保护。GFM 任务列表、删除线、表格、脚注和 autolink 增加真实 Milkdown 序列化回归测试。
- 已验证：`markdown-editor-support` 与 `wysiwyg-editor-setup` 定向测试 7/7；`npm run lint`、`npm run format:check`、`npm run build` 和现有 GFM 规范化 E2E 1/1 通过。构建仅有仓库已有的 chunk 体积提示。
- 发布边界：这是编辑器保真/测试切片，不单独创建 Release、安装包、签名、`latest.json` 或 Cloudflare 镜像；待稳定 Windows x64 批次统一发布。
- 环境维护：原始开发目录中被重复 Tauri debug 构建累积的 `src-tauri/target`（约 64.292 GB，主要为 37.42 GB incremental 缓存）已确认是可再生且被 `.gitignore` 忽略的生成物，已清理；源码、Git 历史和用户文件未删除。后续桌面构建前后应关注该目录，避免重复 debug 构建缓存再次失控。
- Issue 状态：#164 的 GFM 回归与安全回退验收已覆盖；WYSIWYG 组件级行为、外部修改和未保存交互仍归 #165 等独立事项，不混入本切片。
- 下一位 AI：先检查最新 Issues 和 `main`，若 PR 合并后从最高优先级 Ready 项选择一个独立切片；保持一个主题、一个分支、一个 PR，完成交接后停止。

## Issue 治理已完成（2026-08-29）

- 已复核 GitHub 全部 32 个开放 Issue，并统一为 [MoSCoW][Priority][Category] 标题和标准验收结构；本轮另创建 #321 作为编辑器 Ready 切片。
- 已归档 9 个有明确依据的历史汇总、重复、当前范围外或低优先级不计划项；未关闭仍有价值但尚未完成的事项。
- Canonical index：[docs/ISSUE-INDEX.md](./ISSUE-INDEX.md)；路线图入口：[docs/ROADMAP.md](./ROADMAP.md)。
- 当前开放项：25 个（Must 10、Should 14、Could 1），开放 PR 需单独复核。
- 下一次开发必须先检查 Issues 和最新 main，只选择索引中具备完整 Ready 条件的一个垂直切片；完成后更新对应 Issue、代码/测试/文档和本交接文件，然后停止。
- 本次治理没有修改产品代码、安装包、Release、密钥或镜像。

# AI 开发与交接流程

## 已完成切片：#87 批量导出流式写入与取消清理（2026-08-29）

- 基线：从远程 `main@c22bbbd32104680994514549976ed17b2fc73602` 创建功能分支；原始工作区未修改。
- 目标：降低批量 Word/HTML 导出对窗口响应和峰值内存的影响，并确保取消或失败不会留下半成品目标文件。
- 已实现：批量 Word 导出按分卷逐文档构建；JSZip 内部流分块写入用户选择目录中的隐藏临时文件，完成后原子替换最终文件；取消/失败清理临时文件。图片读取、Markdown 转换、HTML 批量构建和 ZIP 写入增加取消检查与有限调度让出。Tauri 分块写入、提交和清理命令增加最终路径授权、临时文件标记和同目录约束。
- 合并结果：PR [#315](https://github.com/MY-moss/moyang_Reader/pull/315) 已 squash 合并为 `main@ef8076376615e23de785cb48eb5695cb6d8586d6`；push CI run `33223041845` 的 Quality checks 全绿，前置格式失败 run `33221769319`、`33222661564` 已定位为同步文件时产生的 Windows 换行/尾部空行并修复。
- 本地验证：前端全量测试 60 个文件/231 个测试、Rust 测试 50/50；lint、Prettier、前端构建、Rust fmt、clippy，以及远程浏览器 smoke、Windows desktop smoke、依赖审计和发布预检均通过。
- 安全边界：临时文件必须带固定标记、与最终文件位于同一目录，且最终路径必须已通过用户保存选择授权；不接受任意临时路径或将临时文件写入其他目录。
- Issue 状态：#87 已完成本轮分块写入、取消清理和响应性改进，但仍保持 open。单卷内 JSZip 结构和 XML 转换仍可能驻留内存或占用前端线程；Worker/原生归档生成和进一步降低单卷驻留属于下一独立切片，不要写 `Closes #87`。
- 发布边界：本切片不创建 Release、不生成稳定安装包、签名、manifest 或 Cloudflare 镜像；待稳定 Windows x64 补丁批次统一发布。
- 下一位 AI：先重新检查 Issues 和 `main@ef8076376615e23de785cb48eb5695cb6d8586d6`，再从 #87 残余性能切片、#190 或其他更高优先级 Ready 事项中选择一个；保持一个主题、一个分支、一个 PR，完成后停止并更新交接文档。

## v0.10.12 稳定发布结果（2026-08-29）

- 发布范围：PR #305 已合并，Issue #169 已标记 completed；版本 PR #306 已合并到 `main@0e8d0bf6b14753953c9b988f07c2ddc08e5476d6`，内容为大型工作区枚举边界、生成目录过滤、单次列表 IPC 和文件树窗口化渲染。
- GitHub Release：[v0.10.12](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.12) 已公开；Release run `33207011251` 的 Windows 构建/发布 job `98970518793` 成功。
- 资产核验：`latest.json` 1,413 字节；Windows x64 安装包 4,976,921 字节，SHA-256 `de577b06d78eabc837df87da4e20ab5f127c8ddcd15fcd8d62e1f4ac558d8e74`；`.sig` 428 字节，SHA-256 `fcedb0c65194abb42838ba079458506e98b5e6fbeb2207309108b7b36bdec65d`。
- 镜像核验：Cloudflare Pages 的 manifest 版本为 `0.10.12`，根 `latest.json`、安装包和 `.sig` 均可访问；镜像安装包与 GitHub 资产大小和 SHA-256 一致，Windows manifest URL 已重写到 Pages 版本目录。
- 发布边界：同一 Release 的镜像 job `98973037391` 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在凭据检查阶段失败；这不影响 GitHub 安装包，但不能将整个 workflow 记录为全绿。未上传任何私钥或令牌。
- 后续修复：PR #307 已合并为 `main@a2f6ef61c151ce127ede11cade50a3a82383d82b`；Quality checks run `33209526541` 全绿，Windows PDF 导出改为后台渲染并将有效文件等待窗口从约 5 秒提高到 15 秒。#241 继续保持 open，待自动镜像 Secret 链路重新验证；旧版本更新器历史实机结果仍以 Issue 记录为准。
- 当前基线：PR #309 已合并为 `main@feb43b1f78500da6e9f9359bf694d6c7c44e7b8f`，Issue #168 已标记 completed；Quality checks run `33213057443` 全绿，包含浏览器 smoke、Windows desktop smoke、Rust tests 和发布预检。
- 最新合并：PR #311 已 squash 合并为 `main@51e432e19dc76f0d701bd747050c5a589fa017d3`，Issue #181 已标记 `completed`；Quality checks run `33216115439` 全绿，包含前端、浏览器、Windows desktop、Rust 和发布预检。
- 最新合并：PR #313 已 squash 合并为 `main@92009301e619a1babaeaf4f0a44ae2eb49af79ed`，Issue #182 已标记 `completed`；Quality checks run `33218342844` 全绿，包含前端、浏览器、Windows desktop、Rust 和发布预检。
- 下一步：从最新 `main@ef8076376615e23de785cb48eb5695cb6d8586d6` 重新检查 Issues，再从 #87 残余性能切片、#190 或其他更高优先级的独立事项中选择一个；不要重复 PR #315，也不要为本切片立即单独打包，待稳定补丁批次再发布。

## #182 已完成：渲染模式文内搜索高亮优化（2026-08-29）

- 目标：减少大文档连续查找时的全树扫描、旧高亮拆除、布局失效和逐命中 DOM 包裹，同时保持结果数量、当前结果、滚动跳转和暗色主题可读性。
- 改动：新增 `src/app/search-highlighter.ts`；现代 Windows WebView 优先使用 CSS Custom Highlight，当前渲染树的文本节点只收集一次并复用，活动结果使用独立高亮范围；不支持该 API 时回退到原有 `<mark>` 路径，并一次性恢复文本节点。
- 性能证据：相同文档连续 3 次查询，旧实现为 3 次 TreeWalker、9 次高亮查询和 9 次 `surroundContents`；当前实现为 1、0、0，CSS 高亮注册 6 次且不修改阅读 DOM。
- 已验证：高亮控制器单测 2/2；前端全量测试 226/226；搜索与暗色主题 E2E 2/2；`npm run lint`、`npm run format:check`、`npm run build` 和 `git diff --check` 通过；远程 Quality checks run `33218342844` 全绿，Windows desktop smoke 通过。
- 非目标：不重写工作区搜索、不改变编辑器搜索或跨文本节点匹配语义、不引入第三方依赖、不修改 Markdown 真源、版本号、导出和更新器。
- 合并结果：分支 `codex/issue-182-search-highlight-2026-08-29` 已推送，PR [#313](https://github.com/MY-moss/moyang_Reader/pull/313) 已通过远程门禁并 squash 合并；GitHub 已将 #182 关闭为 `completed`。
- 发布边界：本切片不单独生成安装包、签名、`latest.json` 或 Cloudflare 镜像；待 #168/#181/#182 与其他稳定性修复一起进入补丁批次时统一生成 Windows x64 发布资产。
- 下一位 AI 的唯一下一步：先重新检查 Issues 和 `main@92009301e619a1babaeaf4f0a44ae2eb49af79ed`，从 Ready backlog 选择一个独立切片；完成后停止，不自动扩大范围或生成开发安装包。

## #181 已完成：渲染关联数据与源码编辑同步（2026-08-29）

- 目标：避免 App 每次渲染为每条出链重复构建全量 `linkIndex`，并避免 SourceEditor 在每次输入时额外复制整篇文档做相同值比较。
- 改动：`src/app/App.tsx` 按 `workspaceIndex` memoize `linkIndex`、当前条目、反向链接和出链，并让正文双链点击复用同一索引；`src/app/components/SourceEditor.tsx` 用最后已知编辑器值判断外部同步，更新监听器只保留一次必要的 `doc.toString()`。
- 性能证据：同一 SourceEditor 输入场景，旧实现触发 4 次 `Text.toString()`，当前实现 3 次；减少的是同步 effect 的重复全文复制。App 侧由每次渲染 `K×O(N)` 的全量索引构建改为工作区快照变化时一次构建。
- 已验证：workspace-index/editor 相关单测 7/7；前端全量测试 224/224；编辑器定向 E2E 5/5，最终改动后的撤回/重做与文内查找 E2E 2/2；`npm run lint`、`npm run format:check` 和一次完整构建通过；远程 Quality checks run `33216115439` 全绿，Windows desktop smoke 通过。
- 非目标：不重写搜索索引、不改变双链解析优先级、不改 Markdown 数据模型、不拆分 `App.tsx`、不增加依赖、不修改版本号。
- 合并结果：分支 `codex/issue-181-render-cache-2026-08-29` 已推送，PR [#311](https://github.com/MY-moss/moyang_Reader/pull/311) 已通过远程门禁并 squash 合并；GitHub 已将 #181 关闭为 `completed`。
- 发布边界：本切片不单独生成安装包、签名、`latest.json` 或 Cloudflare 镜像；待 #181 与 #168/#307 一起进入下一稳定补丁批次时，再按 Windows x64 发布流程统一生成并核验。
- 下一位 AI 的唯一下一步：先重新检查 Issues 和 `main@92009301e619a1babaeaf4f0a44ae2eb49af79ed`，从 Ready backlog 选择一个独立切片；完成后停止，不自动扩大范围或生成开发安装包。

## #168 已完成：长文档滚动阅读轨道（2026-08-29）

- 目标：修复长文档滚动时全树重渲染和逐标题布局读取造成的抖动；保持阅读轨道进度、目录高亮、边界跳转和当前章节显示一致。
- 改动：`src/app/App.tsx` 缓存渲染文章标题节点；渲染模式用 `IntersectionObserver` 追踪标题；进度状态按整数百分比刷新；观察器无法直接确定跳跃位置时保留受控回退计算。新增 `src/app/reading-rail.ts` 与单元测试，`e2e/smoke.spec.ts` 增加 120 标题滚动性能回归。
- 性能证据：相同 120 标题文档、20 个滚动位置的本地基线为 21 次标题查询/1,087 次标题布局读取；当前为 1 次标题查询/284 次布局读取。布局读取不再发生在每个滚动帧。
- 已验证：阅读轨道浏览器 E2E 通过；性能回归 E2E 通过；前端全量测试 222/222 通过；`npm run lint`、`npm run format:check` 和一次完整构建通过；远程 Quality checks run `33213057443` 全绿。
- 非目标：不改 Markdown 解析、编辑器、目录模型、阅读位置存储、导出、更新器或版本号；不创建 Release/安装包。
- 合并结果：分支 `codex/issue-168-reading-rail-2026-08-29` 已推送，PR #309 已通过检查并 squash 合并；GitHub 已将 #168 关闭为 completed。性能数据已写入 PR 和路线图。
- 下一位 AI 的唯一下一步：先重新检查最新 Issues 和 `main@feb43b1f78500da6e9f9359bf694d6c7c44e7b8f`，若仍无更高优先级 Ready 项，按路线图处理 #181；完成一个切片后停止，不自动生成下一批。

## v0.10.11 稳定发布结果（2026-08-29）

- 发布原因：PR #302 已合并到 `main@1ac808b810ad058723cb0d4f8dd9582ddb667c09`，完成 #179 的工作区后台 IO、缓存复用、Windows 路径和增量刷新稳定性修复；Issue #179 已标记 completed。
- 版本结果：版本 PR #303 已通过 Quality checks（run `33198995404`）和 Rust audit（run `33198995394`）并合并到 `main@7cc08e21663c24fca3190539402711516569738b`；`v0.10.11` tag 已指向该合并提交。
- GitHub 资产：Release workflow run `33199034454` 的 Windows 构建成功，GitHub Release 已发布 `Moyang.Reader_0.10.11_x64-setup.exe`、对应 `.sig` 和 `latest.json`。
- 在线核验：GitHub 与 Cloudflare 镜像均返回 `0.10.11`；安装包两边均为 4,960,497 字节，SHA-256 均为 `10cf086f89eb0bf16269b0922d71e7aac9684416f7bd8da7c19471ed0357e0ea`，签名均为 428 字节且哈希一致。
- 镜像状态：Release 内置镜像 job 首次运行和重跑均失败在 Cloudflare Secret 前置检查；仓库当前只配置了签名私钥 Secret，缺少 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`。镜像现有公开资产已是 `0.10.11`，但自动同步尚未达到全绿，配置新 Token 后应从同一 Release 手动重跑镜像 workflow。
- 交接边界：只发布 #179 修复，不把剩余 36 个开放 Issue 混入本批次；Cloudflare 凭据和签名私钥继续只使用 GitHub Secrets，不进入仓库或交接文本。

## 已完成切片：#169 大工作区边界与文件树虚拟化（2026-08-29）

- 基线：从 `main@50355863a7fb8ff2a76f3e8f618bc513c1dca670` 创建独立分支；PR #305 已合并为 `main@c3165828e220890a636c61b2e06b587933279869`，原工作区未提交内容保持不动。
- 目标：限制工作区枚举规模和递归深度，消除加载文件与文件夹时的重复遍历，并让文件树只渲染当前滚动窗口。
- 已实现：Rust 受控遍历限制 20,000 个文件、10,000 个文件夹和 32 层目录；常见生成目录按 Windows 不区分大小写跳过；列表按名称稳定遍历并返回 `truncated/scannedTotal`；前端用一次列表 IPC 获取文件和文件夹，文件树固定行高虚拟渲染并复用已有侧栏滚动容器。
- 正确性边界：右键新建、复制/剪切/粘贴、重命名、删除、属性、路径、刷新和文件夹折叠逻辑保持不变；超出安全边界时显示明确提示，不能伪装为完整工作区；当前搜索/索引同样只覆盖安全枚举范围。
- 非目标：不重写搜索算法、不引入大型虚拟列表依赖、不处理 #168 长文档滚动、不扩展为跨平台产品。
- 本地验证：5000 文档暖搜索 P95 为 14 ms；前端全量测试、Rust 命令测试、构建、lint 和格式检查已通过；浏览器 E2E 45/45、Windows 桌面 smoke 11/11 已通过。桌面测试仍可能显示 `tauri-driver not found`、磁盘空间和 mock store 清理诊断，但不影响用例通过。
- 发布边界：该切片尚未单独生成安装包，已纳入当前 `v0.10.12` 稳定发布准备；开发阶段不重复打包。
- 下一位 AI 的唯一下一步：先完成 `v0.10.12` 版本 PR、发布门禁和资产核验；发布后从最新 Issues 重新选择一个独立切片，不要重复 PR #305 或 #169。

## Issue 清理切片：#179 工作区后台 IO 与缓存复用（2026-08-29）

- 审计快照：仓库当前 37 个开放 Issue、0 个开放 PR；本轮先把最高影响且可复现的 #179 做成独立垂直切片，其余问题不混入同一 PR。
- 基线：`origin/main@1585772863bc92667dc3ef3b22c0de91caa51d65`；工作分支：`codex/issue-179-2026-08-28`。原工作区的未提交内容保持不动。
- 目标：大工作区枚举、索引、搜索、刷新和附件读写不再占用 Tauri 主线程；切回已缓存工作区时，文件与文件夹快照未变化则不重复全量索引。
- 已实现：相关 Tauri 命令统一通过 `spawn_blocking` 执行；搜索缓存改为可安全共享的 `Arc` 状态；工作区文件快照加入修改时间；删除目录事件保留缺失目录本身的失效范围；前端按文件/文件夹快照决定是否复用索引；Windows 普通路径、`\\?\\` 扩展路径和 UNC 路径统一比较；连续的前端增量刷新按阅读库顺序串行应用，避免添加/删除事件乱序覆盖；桌面 E2E 的工作区断言改为每次轮询读取当前 DOM，避免 WebDriver 旧元素造成误报。
- 正确性边界：IPC 命令名和参数契约不变；Markdown 真源、保存路径授权、更新器和导出协议未改动；只处理 #179，不顺手合并 #168、#169 或发布安全问题。
- 跨环境修正：Windows Runner 的临时目录可能使用 `RUNNER~1` 短路径，而 `canonicalize` 返回长路径；删除目录回归测试现在先用同一访问路径规范化逻辑生成预期值，避免把等价路径误报为产品失败。
- 性能基线：既有 5000 文档暖搜索 P95 为 14 ms；修复后为 15 ms。该数字用于确认索引搜索没有退化，本切片的主要收益是重 IO/CPU 不再阻塞窗口消息泵。
- 已完成验证：前端定向测试 6/6、前端全量测试 217/217、浏览器 E2E 45/45、Rust 全量测试 47/47、Lint、格式检查、前端构建和 Rust clippy 已通过；Windows 桌面完整 smoke 11/11 通过；扩展路径归一化定向测试 1/1 通过。最终门禁完成后补录 PR、合并提交和 Release 状态。
- 环境提示：桌面测试可能显示 `tauri-driver not found`、EdgeDriver 下载受本机 PowerShell profile 影响以及 mock store 清理提示；当前用例仍可运行，这些不是仓库代码改动范围。
- 发布边界：本切片尚未创建 Release。合并并通过发布预检后，作为重要稳定性修复评估 `v0.10.11` Windows x64 patch；不上传私钥，不把 Cloudflare 凭据写入仓库或交接记录。
- 下一步：完成最终门禁 → 提交并推送本分支 → 创建一个关联 #179 的 PR → 检查 Quality checks；合并后更新 #179 状态和本节记录，然后停止，不自动开始下一切片。

## #241 验收进展（2026-08-28，v0.10.10 主线）

- 远程基线：`main@b36619c358b86c9cef950898a1add30fad9d3bab`；本次使用独立干净工作副本验证，没有改动原工作区的未提交内容。
- PDF 子场景已通过：使用 `VITE_MOYANG_DESKTOP_E2E=1 npx tauri build --debug --no-bundle --ci --features wdio --config src-tauri/tauri.wdio.conf.json` 构建后，运行 `npx wdio run desktop-e2e/wdio.conf.mjs --mochaOpts.grep "exports a real PDF"`，真实 Windows Tauri smoke `1/1` 通过；文件存在、大小有效、`%PDF-` 文件头和 `%%EOF` 均通过校验。
- 测试注意：桌面 smoke 的 Tauri 可执行文件必须在构建时带 `VITE_MOYANG_DESKTOP_E2E=1`，只在构建后重新生成 `dist` 不会更新已打包的 exe；`tauri-driver not found` 是当前嵌入式驱动的诊断提示，不影响本次用例通过。
- 未完成边界：本次没有重新安装旧版本并执行 v0.10.10 的检查更新、签名校验、替换、重启全链路；历史 v0.9.3→v0.9.4 实机升级证据仍保留在 `docs/UPDATE.md`。#241 继续保持 open。
- 外部阻塞：v0.10.10 Release workflow 的静态 Cloudflare 镜像 job `98791213977` 仍因仓库缺少 Secret 失败；公开 Pages 代理和 GitHub 回退可用，但不能把静态自动同步记为完成。不得在仓库或交接记录中写入凭据。
- 交接：本次为验证/文档同步切片，无产品代码、无 Release、无安装包。唯一下一步是由维护者配置 Cloudflare Secret 后重跑对应镜像 job，并在具备旧安装实例时补做当前版本更新回归；完成前不要关闭 #241。

## 已完成发布切片（2026-08-28，v0.10.10 工作区转移与纯文本粘贴）

- 目标：将已合并的工作区内文件/文件夹剪切复制粘贴与编辑器纯文本粘贴作为 Windows x64 稳定版本发布。
- 基线：PR [#296](https://github.com/MY-moss/moyang_Reader/pull/296) 已 squash 合并，合并提交为 `main@2ff2330368af5415a84e7f9b8ce084b128efa99c`；版本准备 PR [#297](https://github.com/MY-moss/moyang_Reader/pull/297) 已合并，发布提交为 `main@369411206b6bfd8b4a75cd70e37d81c91b20f5d7`。
- 质量门禁：PR #296 的 Quality checks run `33150649302` 全绿；版本 PR #297 的 Quality checks run `33151532148` 在一次既有 watcher smoke 瞬时失败后重跑全绿，Rust audit `33151597033` 和 main CI `33152550659`、Rust audit `33152550649` 均通过。
- 发布资产：tag `v0.10.10` 已指向 `369411206b6bfd8b4a75cd70e37d81c91b20f5d7`；Release workflow `33153221247` 的 Windows 构建/发布 job `98789862805` 成功。GitHub Release [v0.10.10](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.10) 已公开；安装包 4,904,672 字节，SHA-256 `e49ccf9f689bad64b966d9513761e236c52d784d1869020ee55b0149890cf91c`；`.sig` 428 字节，SHA-256 `5c1c072418adef0e3209acdb5b456f39f62b52b763eac127dbfd4c079147e9fe`；`latest.json` 1,413 字节，SHA-256 `bcbf62897a32f6a95a215377a9668f87d97f1de98d5542cca4a0a6c6c8dce1de`。
- 在线核验：GitHub Release 三项资产可下载；Cloudflare Pages 的 `latest.json`、v0.10.10 安装包和签名均 HTTP 200，manifest 版本为 `0.10.10`，镜像安装包 4,904,672 字节且 SHA-256 与 GitHub Release 一致，签名内容一致。
- 镜像边界：Release workflow 的静态镜像子 job `98791213977` 失败；当前仓库仍未配置 Cloudflare 部署 Secret，因此不能把静态上传 workflow 记为全绿。公开 Pages 镜像代理当前可用，客户端仍保留 GitHub Release 回退；本轮没有上传私钥或 Cloudflare 凭据。
- 交接：v0.10.10 发布与在线资产核验完成，本功能切片停止。下一位 AI 先检查 Issues 和镜像状态，再从 Ready backlog 选择单一事项；不得重复创建 v0.10.10 Release、安装包或 tag。

## 已完成功能切片（2026-08-28，v0.10.9 右键快速管理补全）

- 目标：补齐文件树和阅读正文的高频右键动作，让文件/文件夹的查看、管理、定位与文本操作形成闭环。
- 分支：`codex/reader-context-actions-2026-08-28`；PR [#292](https://github.com/MY-moss/moyang_Reader/pull/292) 已 squash 合并，合并提交为 `main@cf713ab97b48dd18c872b2ad1b2fcbf12cd52bc4`。
- 已实现：文件树刷新当前范围、复制名称、文件夹相对路径、活动文件关闭标签；阅读模式选中文本复制/查找、链接复制/打开、进入编辑、复制文档路径；内部双链、标题锚点、本地文档和外部链接复用同一解析边界。
- 非目标：文件移动、回收站恢复、批量文件操作、属性写回、DOCX/PDF 原格式编辑和用户文档云同步。
- 验收：WorkspaceTree/ReaderContextMenu/编辑器动作定向测试、类型检查、Lint、Prettier、阅读模式浏览器 E2E 通过；GitHub Quality checks run `33142306368` 的浏览器 smoke、Windows 桌面 smoke、依赖审计、发布预检和 Rust 门禁全部通过。#232 已评论并以 completed 关闭。
- 交接：v0.10.9 Windows x64 Release 已公开；本节后续工作已由 PR #296 和 v0.10.10 发布切片完成，不要重复执行旧版本发布或扩展已关闭的范围。

## 已完成发布切片（2026-08-28，v0.10.8 右键管理增强）

- 目标：在现有文件/文件夹 CRUD 和编辑器菜单基础上，补齐条目属性查看、标签页批量关闭和编辑器选中文本查找。
- 功能合并：PR [#287](https://github.com/MY-moss/moyang_Reader/pull/287) 已 squash 合并，合并提交为 `main@78acc0276306ff3318862fa9bbb42769239c93c2`；版本准备 PR [#288](https://github.com/MY-moss/moyang_Reader/pull/288) 已 squash 合并，最终 `main@8d957327e09d8dba10cd5a5a144cfc4787dfc64c`。
- 非目标：本切片不处理文件移动、回收站恢复、批量文件操作、属性写回、更新器或 DOCX/PDF 原格式编辑。
- 实现：新增 `WorkspaceEntryDetailsDialog` 和 `WorkspaceEntryDetails`；文件树右键展示只读属性；标签页复用 `ContextMenu` 提供关闭当前/其他/右侧/全部；Markdown WYSIWYG 与 CodeMirror 源文本共用“查找选中文本”，直接打开顶部搜索。
- 质量门禁：PR Quality checks `33135276414`、版本 PR Quality checks `33135827247`、Rust audit `33135855058` 和 Release workflow 的 Windows 构建/发布 job `98736611211` 均成功；本地构建、lint、14 个定向 Vitest 和 2 个编辑器 E2E 也通过。
- GitHub Release：已发布 [v0.10.8](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.8)，Release workflow `33136197499` 已上传 Windows x64 安装包、`.sig` 和 `latest.json`。安装包 4,902,647 字节，SHA-256 `67994715a1f9c9369656c7976bcc8347b55393ba457c3dd6ebcd3fc2e8ee382a`；`.sig` 428 字节，`latest.json` 1,411 字节；三项下载后哈希均与 Release 资产一致。
- 镜像状态：Cloudflare Pages 静态镜像子任务 `98737666564` 失败；修复 PR [#290](https://github.com/MY-moss/moyang_Reader/pull/290) 已 squash 合并，合并提交为 `main@9da9c8d4d707e29ad65a4c07ab43a99024428a11`。修复后的手动镜像运行 `33139453566` 已通过版本校验并加载资产映射，随后准确停在 `Require Cloudflare credentials`；当前镜像仍未切换到 v0.10.8。不要把镜像记为已验证，也不要把凭据写入仓库或交接上下文；下一步只需由维护者配置 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` 后重跑该版本镜像，不需要重新打包或创建 Release。
- Issue 状态：#232 保持 open，剩余中键关闭、标签拖拽和连续缩放另行切片；#241 保持 open，继续跟踪旧版本更新器实机回归和 PDF/更新链路最终验收。
- 交接：v0.10.8 发布切片和镜像代码修复已完成。下一位 AI 先确认仓库 Secrets 已配置，再手动重跑 `mirror-release.yml` 的 `v0.10.8`；镜像验证完成后才能从 Ready backlog 选择下一个产品切片。不要重复合并 PR #287/#288/#290 或重复创建 v0.10.8 Release。

## 已完成发布切片（2026-08-28，v0.10.6）

- 目标：将 PR #281 的文件/文件夹右键管理与正文编辑动作作为稳定 Windows x64 patch 发布。
- 基线：功能 PR #281 与版本准备 PR [#282](https://github.com/MY-moss/moyang_Reader/pull/282) 已合并；发布提交为 main@ec64aa7909f62c99ba25a6720080fdeeb8a7d84d，tag 为 v0.10.6。
- 质量门禁：PR Quality checks 33120355283、PR Rust dependency audit 33120398093、main CI 33120915721、main Rust audit 33120915661，以及 Release Quality gate 均成功。
- 发布资产：Release workflow 33121420237 的 Windows 构建/发布 job 98688939326 成功；安装包 4,900,782 字节，SHA-256 `799cc6b826dae0c67882e764505279247439941d69e49ec7d65f59bf983b43f1`；`.sig` 428 字节，SHA-256 `fb432b0cc3e8af2077d9d8a181237e1a66cb6df914e2929069be0e39e17b8f99`；latest.json 1,411 字节，SHA-256 `37ffcbeee4f07532c5188e4193b545b4142bd2e17213d83f14afee77e6fadbeb`。
- 在线核验：GitHub Release 和 Cloudflare 动态镜像的 manifest、安装包、签名均 HTTP 200；动态镜像版本为 0.10.6，资产大小和 SHA-256 一致。
- 镜像边界：静态镜像子 job 98690424253 因仓库未配置 Cloudflare Secrets 失败；未上传私钥或 Cloudflare 凭据。后续若要让静态 Pages workflow 变绿，需维护者在 GitHub Secrets 中配置凭据后重新运行。
- 已知事项：#241 的 PDF 文件落盘/旧更新器实机回归和 #232 的剩余桌面交互范围保持 open。
- 交接：本切片已完成；下一位 AI 只能从已确认的 Ready backlog 选择单一切片，不重复发布 v0.10.6，不扩大范围。

## 已完成发布切片（2026-08-28，v0.10.5）

- 目标：将已合并的文件/文件夹右键管理和正文编辑动作作为稳定 Windows x64 patch 发布，版本号、CHANGELOG、安装包、签名、manifest 和镜像保持一致。
- 基线：PR #278 已 squash 合并到 `main@69819064a261bf411ea98f36f9f3b901548e7175`；版本准备 PR #279 已 squash 合并到 `main@d9c0a5967f673af0152746130a46a551994628df`。
- 质量门禁：main CI `33109821835`（Quality checks job `98649371453`）和 Rust dependency audit `33109821807` 均成功；Release workflow `33110395454` 的 Windows 构建/发布 job `98651395153` 成功。
- 发布资产：GitHub Release [v0.10.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.5) 已公开；Windows x64 安装包 4,900,301 字节，SHA-256 `83a06f1cd88fef435cea0c486b6c99c5e99f2fb9661d4fe24bf6e6b99ae8d36c`；`.sig` 428 字节，SHA-256 `fd3a547c358c20381c425bec5cb527f7345502a3034fc3973b56b4572edc3912`；`latest.json` 1,411 字节，SHA-256 `5f899d3fa81986b001a24f422cf178936d4f8d9a08cfebe4925ee717eb62e830`。
- 在线核验：GitHub Release 的安装包、`.sig` 和 `latest.json` 均已上传；Cloudflare 动态镜像根 manifest 返回版本 `0.10.5`，版本目录安装包和 `.sig` 均 HTTP 200，Content-Length 分别为 4,900,301 和 428 字节。
- 镜像边界：Release workflow 的静态镜像子任务 `98653318098` 因仓库缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败；动态镜像仍可用，客户端保留 GitHub Release 回退。不能把静态自动同步记为全绿。
- 未完成：PDF 文件落盘与旧版本更新器实机回归继续由 #241 跟踪；Cloudflare 静态自动部署需维护者在 GitHub Actions Secrets 配置凭据后重新运行和核验。
- 交接要求：v0.10.5 发布切片已完成；下一位 AI 只能从已确认的 Ready backlog 选择单一切片，不自动扩大范围或重复发布本版本。

## 已完成功能切片（2026-08-28，v0.10.5 文件/文件夹管理与文本右键）

- 目标：在已有工作区树和编辑器菜单上补齐高频右键管理，不引入新运行时依赖或云同步。
- 分支：`codex/context-menu-crud-2026-08-28`，基于 `origin/main@804e56e9fc936b156c3b8f024ff65f975684fc03`；提交 `75749655c61cc44a794dfcb05a58988433e7ebe4` 和交接提交 `104e19fb43bb0bda43d91343afff289da74f745c` 已由 [PR #278](https://github.com/MY-moss/moyang_Reader/pull/278) squash 合并到 `main@69819064a261bf411ea98f36f9f3b901548e7175`。
- 已实现：文件/文件夹右键打开、重命名、删除、资源管理器定位、复制完整路径；根目录保留新建/定位/路径复制；文件树支持空工作区根目录菜单；Markdown/TXT 源码与 WYSIWYG 菜单补齐撤销、重做、剪切、复制、粘贴、全选。
- 安全边界：Tauri 端再次校验授权工作区、相对路径、路径穿越、目标重名和最终符号链接；文件重命名默认保留原扩展名；资源管理器调用使用无控制台窗口的 Windows 原生进程参数。
- 当前验证：前端 lint、树/路径定向测试 8/8、一次前端生产构建、Rust 全部 42 项测试通过；`cargo fmt` 已执行，前端格式检查通过。构建仅保留既有入口 chunk size warning。
- 桌面验证：新增 Windows Tauri CRUD smoke 定向用例 1/1 通过；完整桌面 smoke 的其余 9 项通过，既有 PDF 文件导出用例仍因“保存 PDF 失败”失败。Tauri 内嵌 WebDriver 报告 `tauri-driver` 缺失警告，但本机 embedded driver 仍完成测试。
- 文档同步：`docs/REQUIREMENTS.md`、`docs/UI-INTERACTION.md`、`docs/ROADMAP.md`、`docs/USER-GUIDE.md`、本文件和 `CHANGELOG.md` 已补充 v0.10.5 边界、验收与交接信息。
- 发布边界：`v0.10.4` 已有独立 Release；本切片不覆盖或重复该发布。合并后的 main CI 和 PR Quality checks 已通过，v0.10.5 安装包、`.sig`、`latest.json` 和镜像已由发布 workflow 生成并核验。
- 已完成：代码、测试、文档和 PR 已交付；PDF 文件落盘/旧版本更新器实机回归继续留在 #241，不扩大本功能切片范围。

## 已完成开发切片（2026-08-28，v0.10.4 #232 第二批）

- 目标：补齐标签页中键关闭、原生拖拽排序和阅读区连续缩放，延续 #232 的桌面惯例交互。
- 分支：`codex/tab-zoom-2026-08-28`，基于远程 `main@769784f642426310c15e0aae6c923e1d0b9e19f4`；本切片只包含一个主题、一个 PR，不修改 Markdown 存储格式或新增运行时依赖。
- 非目标：标签页右键批量关闭、文件树操作、编辑器格式能力、更新器和安装包发布；标签页右键批量关闭仍留在 #232 后续验收。
- 已验证：Vitest 54 files / 204 tests、lint、format、build、针对性 Playwright 2 tests；构建仅保留既有入口 chunk size warning。
- 发布边界：这是 v0.10.4 稳定批次的功能补齐，不单独创建 Release；合并并通过 Quality checks 后再纳入 v0.10.4 安装包。
- 下一步：审查该唯一 PR 的 Quality checks；合并后从最新 `main` 创建下一条 Ready 分支并停止本切片，不自动扩展下一功能。

## 已完成发布切片（2026-08-28，v0.10.4 发布准备）

- 目标：发布 #232 第一批桌面惯例交互，包括工作区新建 Markdown 笔记/真实文件夹、根目录/文件夹/文件所在目录右键新建，以及 Markdown/TXT 编辑上下文菜单。
- 功能 PR：[PR #275](https://github.com/MY-moss/moyang_Reader/pull/275) 已通过 Quality checks 并 squash 合并，远程功能合并提交为 `5d0891945c4fb8b7daa0989192e9f2532536bb6b`。
- 版本准备：发布分支 `codex/release-v0.10.4-2026-08-28` 已从远程 `main` 创建，`package.json`、lock 文件、Cargo、Tauri 配置和 CHANGELOG 已同步为 `0.10.4`。
- 已验证：PR #275 的 Quality checks run `33092295394` 全绿，包含前端 lint/格式/覆盖率/构建、浏览器 smoke、Windows 桌面 smoke、依赖审计、发布检查和 Rust 门禁；本地 Vitest 196/196、Rust 41/41、编辑右键 E2E 1/1 通过。
- 发布边界：当前仍未创建 `v0.10.4` tag、GitHub Release 或安装包；版本准备 PR 合并且 main CI 通过后，才推送 tag，由 release workflow 生成 Windows x64 NSIS、`.sig` 和 `latest.json`，随后核验 GitHub/Cloudflare 镜像及旧版更新链路。
- 已知阻塞：本机 Git HTTPS fetch 在合并后连续两次连接重置，因此发布分支通过 GitHub API 从远程 `main` 建立；不强推、不上传私钥。Cloudflare 静态镜像仍取决于仓库 Secrets 配置。
- 交接要求：下一步只审查该发布分支的版本差异、创建一个版本准备 PR 并等待门禁；发布完成后更新 `docs/UPDATE.md`、本节和 Issue 状态，然后停止，不自动开启下一个功能。

## 快速启动模板（交给任何 AI 时直接粘贴）

> 你是 moyang_Reader 仓库的协作开发 AI。启动步骤：
>
> 1. 按顺序读取：`CONTEXT.md` → `docs/REQUIREMENTS.md` → `docs/ROADMAP.md` → 本文件（只读“当前功能切片快照”和“下一位 AI 的唯一下一步”）。
> 2. 用 `git status`、`git log --oneline -5` 和 GitHub Issues 确认没有重复工作。
> 3. 不要通读仓库；用 `rg` 定位符号后只读相关文件的局部范围。
> 4. 只做“唯一下一步”，完成后按本文件“完成功能切片”清单交接并推送功能分支。
> 5. 汇报只写新增事实、失败根因、下一步；不粘贴完整日志。

## 标准读取顺序

1. `CONTEXT.md`
2. `docs/REQUIREMENTS.md`
3. `docs/ROADMAP.md`
4. `docs/UI-INTERACTION.md` 或 `ARCHITECTURE.md`
5. 本任务关联的 Issue、测试和入口文件

不要先读取整个仓库。先用 `rg` 定位符号，再读取相关文件的局部范围；不要在聊天中重复粘贴完整日志。

## 开始任务

1. 查看 GitHub Issues，确认没有重复工作或新的反馈。
2. 检查 `git status`、当前分支和 `origin/main`。
3. 创建 `codex/<scope>-<date>` 分支，或在明确的未完成功能分支上继续。
4. 写下目标、非目标、关联 Issue、验收标准和预计影响文件。

## 完成功能切片

代码、测试、用户文案和相关文档必须在同一个功能分支中完成。交接包至少包含：

- 当前分支和最新提交；
- 已完成内容和未完成内容；
- 修改文件和行为变化；
- 已运行命令及结果；
- 已知限制、风险和回滚方式；
- 当前切片：填写本次功能切片的 Issue、PR、合并提交和验证结果；未完成的 Issue 保持 open，并注明计划版本。
- 在线下一步：稳定批次合并后，按 `docs/RELEASE-POLICY.md` 判断是否生成 Windows x64 安装包、`.sig`、`latest.json` 和镜像资产。
- 已知限制：记录真实失败根因、重试次数和未验证边界；不绕过分支保护、不强制覆盖远程。
- 关联 Issue、PR、是否需要 Release，以及下一位 AI 的唯一下一步。

## PR 规则

PR 说明必须包含目标、非目标、测试、手动 UI 路径、文档同步情况、截图（如有 UI 改动）、发布影响和回滚方式。没有文档交接说明的代码 PR 不算完成。

功能分支与 `main` 无冲突且 Quality checks 全绿时可以自动合并。遇到真实冲突、失败检查、权限/安全/更新器/发布工作流/数据迁移等高风险变更时暂停并说明原因；禁止强制推送覆盖他人提交。

## Release 规则

合并 PR 不等于发布安装包，但用户功能 minor 版本达到验收后必须及时发布；重要 Bug、保存、更新、签名或安全修复可以直接发布 patch。每个 PR 必须标记无 Release、minor 或 patch，并写出目标版本和理由。稳定发布时必须同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、CHANGELOG、Git tag、GitHub Release、NSIS 安装包、`.sig`、`latest.json` 和 Cloudflare 镜像；发布后必须做在线 HTTP、哈希、签名、manifest 和旧版本自动更新验证。纯文档、测试、CI 和内部重构可以不发布，但交接中必须明确写出原因。完整规则见 `docs/RELEASE-POLICY.md`。

## 当前平台边界（Windows x64）

- 产品、发布、文件关联、自动更新和真实桌面 E2E 只覆盖 Windows x64。
- 浏览器版只用于本地开发预览和 Playwright UI 测试，不作为独立桌面平台发布。
- macOS、Linux、Windows ARM、移动端和跨平台自动更新在 v1.0 前不进入主线；不要为它们新增构建矩阵、安装包或桌面回归。
- `.github/workflows/ci.yml` 只保留 Windows 质量门禁；独立 RustSec 审计可以使用 Ubuntu runner，但不代表支持 Linux 产品。
- 现有跨平台抽象不主动删除，除非它们增加 Windows 构建/启动/维护成本；未来重新开放平台必须先写新的 ADR。

## Token 预算规则

- 先给出短上下文包，再按需读取文件。
- 每轮只汇报新增事实、失败根因和下一步。
- 测试失败只粘贴首个根因和相关文件，不粘贴整段流水线日志。
- 一个 PR 保持一个清晰目标；无关重构另开 Issue。
- 代码、文档和验证结果一起提交，减少下一位 AI 的重复探索。

## 最近完成切片（2026-08-27）

- **v0.10.1 已发布**：版本准备 [PR #267](https://github.com/MY-moss/moyang_Reader/pull/267) 已合并，`v0.10.1` tag 指向 `main@0e8b4e9d5ea2471b6a318fec6335f8e7a2dc000d`；[GitHub Release](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.1) 已公开。Release workflow [33057606371](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371) 的 Windows 构建/发布 job [98468201360](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371/job/98468201360) 成功，安装包 4,876,807 字节、SHA-256 `2e386893e2026986c684ede967d9758b0e52c0c990adc1d65ad7ef6171395a10`；`.sig` 428 字节、SHA-256 `03ba73d07dab409ce2bf16b0b3de76d40fca40690ecf8ee8613299ec06c671f8`；`latest.json` 1,411 字节、SHA-256 `f1ea49a293ef785d428e8fb5e3a1472341da2bd0d4053e3deda1a67d50caf0cc`。
- GitHub 和 Cloudflare 的 `latest.json`、`/v0.10.1/` 安装包及 `.sig` 均 HTTP 200，Cloudflare 公开地址实际由轻量代理读取 GitHub 最新 Release，因此用户可获取 `v0.10.1` 更新。镜像子任务 [98470047373](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371/job/98470047373) 在可复用工作流凭据预检前失败且无执行步骤，#241 的 Cloudflare Secrets 仍未配置；不能把该子任务记录为全绿。
- 本轮只完成在线更新资源核验，未在已登记旧 Windows 安装实例上自动执行 v0.9.5→v0.10.1 的下载、签名校验、替换和重启；回滚保留 v0.9.5，不删除现有 Release 或资产。

- #104 搜索性能切片已由 [PR #257](https://github.com/MY-moss/moyang_Reader/pull/257) 合并，合并提交为 `2d2209e35a2e45b66a0455edfcfba7074f4036ff`。未变化的工作区索引现在复用文件快照，跳过重复的逐文件元数据检查和重复持久化；watcher、保存和显式刷新失效路径保持不变。
- 本切片不改变搜索结果、Markdown 真源或依赖，也不创建 Release/安装包。#104 仍保持 open；5000 文档基准、索引上限和未入索引文件的进一步命中策略留给 v0.10.1 后续切片。
- #104 的 ASCII 子串候选切片已由 [PR #259](https://github.com/MY-moss/moyang_Reader/pull/259) 合并，合并提交为 `a1c986c1bf5f54bcd32468e4147ad9674129ddc6`。非完整 ASCII 词查询会复用已有 posting 生成候选，再用原始 substring 规则确认结果；读取失败文件仍进入安全回退。
- PR #259 同时修正快速路径边界：watcher 事件先失效 Rust 缓存，只有成功启用 watcher 的工作区才跳过重复索引元数据检查；未启用 watcher 时仍检测直接文件修改。无新依赖、无持久化索引格式变化、无 Release/安装包。
- #104 的工作区文件列表缓存切片已由 [PR #261](https://github.com/MY-moss/moyang_Reader/pull/261) 合并，合并提交为 `b5e62e7b8d00634261aa1b269cec13fb8853500f`。未变化的工作区快照会复用 Rust 文件列表，避免重复的逐文件读取；watcher、保存和显式刷新仍负责失效。新增 5000 文档回归基准通过，#104 的正式 P95、索引上限和长文档验收仍保持 open。
- PR #261 不改变搜索结果、Markdown 真源、持久化索引格式或依赖；该内部切片当时不创建 Release/安装包，后续已随 #104 验收并入 v0.10.1 稳定批次。
- #104 索引容量切片已由 [PR #264](https://github.com/MY-moss/moyang_Reader/pull/264) 合并，合并提交为 `d109baab2624735b64d2e60d19dc5a7113936cbb`：posting 预算达到上限时按文件最近使用顺序淘汰旧 posting，并将被淘汰文件保留在线性回退集合；索引候选命中会更新 LRU，持久化索引记录访问序列并升级缓存版本。#104 仍保持 open，正式 5000 文档 P95 和长文档验收留待后续切片。
- PR #264 的 Quality checks `33049962606` 全部通过（前端 lint/覆盖率/构建、浏览器与 Windows 桌面 smoke、依赖/发布检查、Rust fmt/clippy/tests）；无新依赖、无用户可见行为变化、无 Release/安装包。
- 本轮验证：Rust `commands::tests` 39/39、Rust fmt 和 `cargo clippy --lib -- -D warnings` 通过；无新依赖、无用户可见行为变化、无 Release/安装包。
- 撤回/重做视口修复已由 [PR #262](https://github.com/MY-moss/moyang_Reader/pull/262) 合并，合并提交为 `a76613b63d319a123d51cf98d7816a1492ca7e6d`。Ctrl+Z/Ctrl+Shift+Z 现在会恢复中央阅读区及 Milkdown/CodeMirror 内部滚动位置，并用文档路径校验避免延迟恢复污染新文档。
- PR #262 的 Quality checks `33046894608` 全部通过（前端覆盖率、构建、浏览器/Windows 桌面 smoke、依赖、发布元数据和 Rust 门禁）；新增视口单测 2/2、undo/redo E2E 1/1，该修复已随 v0.10.1 发布。
- 功能分支 `codex/three-pane-navigation-2026-08-27` 已由 [PR #253](https://github.com/MY-moss/moyang_Reader/pull/253) 合并，合并提交为 `57860bb2ae0ad54e3a42d1e8846a37d2769af165`；版本准备由 [PR #254](https://github.com/MY-moss/moyang_Reader/pull/254) 合并，当前 `main` 为 `086888f6c5ce5a7e2219510d0de31a575564248d`。
- 用户可见范围：修复右侧目录在中央正文中的定位、清理侧栏嵌套滚动、修复窄屏布局，并支持左右侧栏拖拽/键盘调宽、双击重置、快捷键开关和本机布局记忆。#187 的完整响应式断点体系仍保持 open。
- 验证：前端完整单测 182/182、lint、format、构建、浏览器 E2E 39/39；PR #253 Quality checks 和 v0.9.5 Release 的 Windows 质量门禁均通过。没有新增依赖，也没有改变 Markdown 真源。
- v0.9.5 已发布：Release workflow [33036785808](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808) 的 Windows 构建/发布 job [98401073429](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98401073429) 成功；[GitHub Release v0.9.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.5) 已包含 `latest.json`（1,401 字节）、Windows x64 安装包（4,868,087 字节）和 `.sig`（424 字节）。
- v0.9.5 资产核验：安装包 SHA-256 为 `8af02aa74e4b2bea5a02ec07feb7c9a1d215c8b822d790e92a11129125dababd`，`.sig` SHA-256 为 `7f069913d679fde7e0a63b0c730d15a38f667e505568906b843e576239d8da93`，`latest.json` SHA-256 为 `1da1a9971b33a72cc1ad90e5b91fd61e41df9dc37ec411a08d4845e2d7fafa7f`；版本、签名字段和 Release 资产一致。
- Cloudflare 根 manifest、`/v0.9.5/` 安装包和 `.sig` 均 HTTP 200，版本为 `0.9.5`，安装包 4,868,087 字节且 SHA-256 与 GitHub 一致，签名 424 字节且 SHA-256 与 GitHub 一致。自动镜像子任务 [98402066927](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98402066927) 仍因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败，#241 保持 open。
- 当前登记的 Windows 安装实例为 v0.9.4；本轮已完成新版本 manifest、安装包、签名和两个下载端点的在线核验，但尚未在本轮自动点击 v0.9.4→v0.9.5 并重启，因此不把完整旧版本桌面升级回归记为已完成。
- 回滚：保留 v0.9.4 Release；若 v0.9.5 出现问题，修复后发布更高 patch，不删除已有 Release 或 manifest。
- 下一位 AI 的唯一下一步：从最新 `main@086888f6c5ce5a7e2219510d0de31a575564248d` 创建新的 `codex/<scope>-<date>` 分支，先检查 Issues，再从 Ready backlog 选择一个独立切片；不要重复 v0.9.5 发布，也不要把 #241 凭据写入仓库或上下文。

## 当前功能切片快照

> **最新检查点（2026-08-27，验证基线：`main@33c171c32aa81c291b1606203b500ef4ed9e861f`）**
>
> - #104 的未变化索引快速路径、ASCII 子串候选、工作区文件列表缓存和文件级 LRU 淘汰已由 PR #257、#259、#261、#264 合并；当前 `main@0e8b4e9…` 已包含上述实现和交接文档。
> - PR #266 已将 5000 篇每篇至少 2 KiB、混合中英文文档的暖缓存 P95 验收，以及超出单文件 token 上限时的线性回退验收合并到 `main`；#104 已标记 completed。
> - 本机正式验收记录：5000 文档暖查询 P95 为 38 ms，低于 #104 的 100 ms 目标；长文档回退、完整 Rust 测试 40/40、Rust fmt 和 `cargo clippy --lib -- -D warnings` 均通过；PR #266 的 Windows Quality checks 已通过。
> - `v0.10.1` 版本准备已由 PR #267 合并，标签、Release 和 Windows x64 安装包已完成；不要重复版本准备、#104 验收或 v0.10.1 打包。
> - PR #269 已将当前功能切片（#187）合并到 `main`：Windows 最小窗口宽度调整为 720px；工具栏按真实横向溢出显示边缘提示和标题，保持现有横向滚动与快捷操作不变。
> - 本切片已通过 `npm run lint`、`npm run format:check`、`npm run build`、3 条相关 Playwright smoke，以及主线 Quality checks `33067255980`；版本准备 PR #270 的 Quality checks `33068718042`、主线 CI `33069290326` 和 Rust audit `33069290435` 也全部通过；没有新增依赖或数据格式变化，#187 完整断点验收保持 open。
> - v0.10.2 版本准备由 PR #270 合并，`v0.10.2` tag 指向 `main@38973bd1a72f1d61bb50ea26ee6a1014934f7fce`；Release workflow [33069798614](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614) 的 Windows 发布 job [98508812457](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614/job/98508812457) 成功，GitHub Release 已公开并包含 Windows x64 安装包、`.sig` 和 `latest.json`。
> - v0.10.2 安装包为 4,873,310 字节，SHA-256 `626df63dadb79b2a9b564a505b4bbacf140a44c88e7ba7899e319d5b7a7ad36d`；`.sig` 为 428 字节，SHA-256 `0a22446928e600dc3ef854ac500d538f56027f8f074888ed0775e25a64c27748`。GitHub 与 Cloudflare 公开下载均 HTTP 200 且哈希一致，根/版本 manifest 均为 `0.10.2`。
> - Release 总 run 因 Cloudflare 静态镜像子任务失败而显示 failure；仓库 Actions 尚未配置 Cloudflare Pages Secrets，动态镜像仍可用，不能把静态同步记为全绿；版本目录 manifest 当前回退到 GitHub 资产地址。
> - PR #272 已合并为 `main@be2dcb28504b8a10f2be90f9deedd8e90e1151b5`；`CI #543`（run `33079519834`）全绿，包含浏览器/桌面 smoke、覆盖率、依赖审计、发布检查和 Rust 门禁。
> - PR #273 已合并，`v0.10.3` tag 指向 `main@33c171c32aa81c291b1606203b500ef4ed9e861f`；Release workflow `33084715056` 的 Windows 构建/发布 job `98561110937` 成功，安装包 4,873,988 字节、SHA-256 `4d20950202aa71e319c848635a105fc93cda6b5a0514bd6cd4c135cae861fdc3`；`.sig` 428 字节、SHA-256 `2b3b0350ad1b1f136b820e65a6c6a6cff00bd5ad02fbcfeb13d0538fdb4ab082`；`latest.json` 1,411 字节、SHA-256 `6616538994de3dcbee3f30f5a778fa6141e29e9fbc5c431c1cfa8ddd36767ddd`。
> - GitHub 与 Cloudflare 根/版本 manifest、安装包和 `.sig` 均 HTTP 200，版本为 `0.10.3`，镜像资产哈希与 GitHub Release 一致；静态镜像 job `98564736672` 因 #241 缺少 Cloudflare Secrets 失败，动态镜像仍可用。
> - v0.9.5 已完成三栏导航、目录跳转、侧栏滚动、面板调宽和窄屏布局修复，并已通过 [PR #253](https://github.com/MY-moss/moyang_Reader/pull/253) 与 [PR #254](https://github.com/MY-moss/moyang_Reader/pull/254) 合并。
> - [GitHub Release v0.9.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.5) 已发布，Windows 构建/发布 job 成功；安装包、`.sig`、`latest.json` 均已在线核验。
> - Cloudflare v0.9.5 公开资产在线且与 GitHub 的大小和 SHA-256 一致，但自动镜像 job 因 #241 缺少 Secrets 失败；公开资产在线不等于自动镜像 workflow 全绿。
> - 撤回/重做阅读位置修复已由 [PR #262](https://github.com/MY-moss/moyang_Reader/pull/262) 合并，合并提交为 `a76613b63d319a123d51cf98d7816a1492ca7e6`；修改集中在编辑历史应用、Markdown/CodeMirror 状态同步、共享滚动位置辅助模块和回归测试，不改变撤回语义或 Markdown 真源。
> - PR #262 的 Quality checks `33046894608` 全部通过；视口单测 2/2、undo/redo Playwright E2E 1/1、构建、Windows 桌面 smoke 和 Rust 门禁均通过，该修复已随 v0.10.1 发布。
> - #104 索引容量切片已由 [PR #264](https://github.com/MY-moss/moyang_Reader/pull/264) 合并：posting 预算按文件 LRU 淘汰并安全回退线性扫描；新增回归测试和 Quality checks 通过，持久化索引版本升级为 4，旧缓存会安全重建。本切片不生成安装包。
> - 下一位 AI 的唯一下一步：从最新 `main@33c171c32aa81c291b1606203b500ef4ed9e861f` 检查 Issues，再从 Ready backlog 选择一个独立的 v0.10.4 功能切片；不要重复 PR #272、PR #273、v0.10.3 发布、v0.10.2、v0.10.1、#104、PR #262 或 PR #264 的实现，不要把 Cloudflare 或签名凭据写入仓库或 AI 上下文。

## 历史功能切片快照

> **历史检查点（2026-08-27，v0.9.4，验证基线：`main@2b35c83f6d03c7faaa20baa1b4771b1454958610`）**
>
> - 稳定基线已升级为 `v0.9.4`；[PR #250](https://github.com/MY-moss/moyang_Reader/pull/250) 已将 #183 合并到 `main`，版本准备 [PR #251](https://github.com/MY-moss/moyang_Reader/pull/251) 随后合并，当前 `main` 合并提交为 `2b35c83f6d03c7faaa20baa1b4771b1454958610`。#241 的 Cloudflare Secrets 外部前置仍未解决。
> - v0.9.3 已包含 Windows PDF 当前文档保存、Edge headless 渲染、有效 PDF 文件头校验、原子替换和真实桌面 smoke；Markdown、TXT、Word、PDF、图片既有打开行为保持不变。
> - v0.9.4 发布 workflow [33030470944](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 的 Windows 构建/发布 job [98381570060](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944/job/98381570060) 成功；GitHub Release [v0.9.4](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.4) 已上传 `latest.json`（1,401 字节）、Windows x64 NSIS 安装包（4,867,204 字节）和 `.sig`（424 字节）。安装包 SHA-256 为 `dd59f1f7b70b77df118672e4ce0ffe5af92f5895e5b54fcb962067a08418fe6b`，`.sig` SHA-256 为 `4cc07d181afa855172f3ffdb688c0bb110c0ccd48fe166cbb94b3a138e457838`，manifest SHA-256 为 `c12f59118f31ce2a4638e14d691b36d90079bbf119bdf9fcc1aef726919b804`。
> - v0.9.4 发布门禁全部通过：质量门禁 run [33029947556](https://github.com/MY-moss/moyang_Reader/actions/runs/33029947556) 成功，Rust 依赖审计 run [33029950442](https://github.com/MY-moss/moyang_Reader/actions/runs/33029950442) 成功；本地和 PR 验证保持前端完整测试 176 项、缓存/桥接针对性测试 7 项、浏览器 E2E 38 项、Windows 桌面 E2E 10 项、Rust 37 个 tests，以及 lint、format、构建、fmt/clippy 全部通过。
> - 已登记的 Windows x64 v0.9.3 安装实例已实际点击更新到 v0.9.4；下载、签名校验、替换、自动重启成功，注册表 `DisplayVersion`、文件 `ProductVersion` 和运行进程版本均为 v0.9.4，安装文件大小为 15,232,000 字节。未登记的旧副本不计入回归。
> - Cloudflare 根 manifest、`/v0.9.4/` 安装包和 `.sig` 均 HTTP 200；镜像安装包（4,867,204 字节）和 `.sig`（424 字节）与 GitHub Release 的 SHA-256 完全一致，镜像 manifest 版本为 `0.9.4` 且下载地址指向镜像。Release 镜像子任务 [98382698574](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 仍因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败；公开镜像在线不等于自动部署 workflow 全绿，不能把该子任务记录为成功，也不能把令牌写入文档。
> - #241 保持 open，仅等待维护者在 GitHub Actions Secrets 中安全配置 Cloudflare 凭据后，重跑镜像 workflow 并确认自动同步全绿；GitHub Release、签名资产和当前 v0.9.4 公开镜像已经可用。
> - 当前发布切片：v0.9.4 / #183；已加入会话级有界文档缓存、轻量文件标记命令、变更/保存/关闭失效边界及针对性测试；缓存不写盘、不改变 Markdown 真源。
> - v0.9.4 tag、Release、Windows x64 安装包、签名和 `latest.json` 已完成；旧 v0.9.3 安装实例已完成应用内更新回归。镜像静态资产目前在线且内容一致，但自动镜像子任务仍受 #241 阻塞。
> - 下一位 AI 的唯一下一步：从最新 `main@2b35c83f6d03c7faaa20baa1b4771b1454958610` 创建新的 `codex/<scope>-<date>` 分支，先检查 Issues，再从 Ready backlog 选择一个独立功能切片；不要重复 v0.9.4 发布，也不要把 #241 的凭据写入仓库或上下文。

> **历史检查点（2026-08-27，v0.9.2；优先级低于上方当前检查点）**
>
> - 稳定基线：`v0.9.2`；PR #242 已合并到 `main`，合并提交为 `62af5b7cbadb76aa7071c59e0ccd17d79cdf7608`，包含已完成的 #174、#188、#231 稳定化切片。
> - GitHub Release [`v0.9.2`](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.2) 已发布；Release workflow [`33012202887`](https://github.com/MY-moss/moyang_Reader/actions/runs/33012202887) 的 Windows 构建 job 成功，安装包 4,868,757 字节，SHA-256 `33d4879f2d6d267391acb5e18a1c84a6627f5e0f1e9a5884ccd684840b6d0047`；`.sig` 424 字节，SHA-256 `fcc2ac968a384d43bb2289ad1f7c85c983ad81ad5fd88942547fd22585760468`；`latest.json` 已随 Release 上传。
> - Release workflow 的镜像子任务 [`33012202692`](https://github.com/MY-moss/moyang_Reader/actions/runs/33012202692) 因 `Require Cloudflare credentials` 失败，根因是仓库未配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`；不得把整个 Release run 记录为全绿，也不要把 token 放入聊天、仓库或文档。
> - Cloudflare 公开镜像当前 `/latest.json`、v0.9.2 安装包和 `.sig` 均 HTTP 200；镜像 manifest 版本为 `0.9.2`，安装包 4,868,757 字节且 SHA-256 与 GitHub 一致，`.sig` 424 字节且 SHA-256 与 GitHub 一致。镜像资产在线不等于本次自动部署通过；补齐 GitHub Actions Secrets 后再重跑或在下一次稳定 Release 验证自动同步。
> - GitHub Release 已发布：[`v0.9.1`](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.1)，Release workflow [`32996354493`](https://github.com/MY-moss/moyang_Reader/actions/runs/32996354493) 成功；安装包 4,861,912 字节，SHA-256 `bf511b08459d78023055fecd9605579dae23cf883826203309460f4f1d36a35f`；`.sig` 424 字节，SHA-256 `47d9185a297e4839f7d33ac5db68572a9fae323e1c6a82a724187ccf4df04bef`。
> - Cloudflare 根 manifest、`/v0.9.1/` 安装包和 `.sig` 均 HTTP 200，镜像安装包与 GitHub Release SHA-256 一致；镜像 workflow [`32998515986`](https://github.com/MY-moss/moyang_Reader/actions/runs/32998515986) 在凭据预检失败，仓库当前没有 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` Secret。不要把该失败记录为部署成功，也不要在聊天中传递 token。
> - PR #237 已将两项流程修复合并到 `main`：CI 并发组按事件隔离；Release 工作流直接调用镜像工作流，避免 `GITHUB_TOKEN` 创建 Release 后不触发 `release` 事件。该流程切片只改 CI/发布/文档，不生成新安装包。
> - 镜像自动部署的唯一外部前置是维护者在 GitHub Actions Secrets 中配置 Cloudflare API Token（仅 Pages 编辑权限）和账户 ID；流程修复合并后应先补齐 Secrets，再在下一次稳定 Release 验证端到端镜像部署。

> - #88 已关闭的范围是 Windows 真实桌面 E2E 基线；PDF 文件真实落盘和旧版本更新器实机回归仍未完成，已单独登记为 [#241](https://github.com/MY-moss/moyang_Reader/issues/241)，计划放入 v0.9.3。不要把 #88 的关闭状态当作这两项工作的完成证明。

- 已完成切片（#231，PR #238）：顶栏“更多 / 设置 / 导出”菜单新增捕获阶段的外点 `pointerdown` 与 `Escape` 关闭；菜单内部控件不受影响，关闭时会一并收起嵌套菜单。`e2e/smoke.spec.ts` 新增外点和 Esc 回归，本地单测 168/168、lint、构建及顶栏 E2E 2/2 已通过；PR #238 已合并到 `main`，Issue #231 已标记 completed；本切片不单独生成安装包，纳入 v0.9.2 稳定批次。

- 已完成切片（#174，PR #239）：在 `src/main.tsx` 根节点接入独立 `ErrorBoundary`，捕获渲染期异常并显示可重新加载的恢复页；错误详情仅在本地折叠显示并写入开发者控制台，不上传或覆盖用户文件。新增 `ErrorBoundary.test.tsx` 覆盖恢复页和重载回调；PR #239 已合并为 `99cb59701a71b05cd8da81047b1ec9fe90eb04da`，Issue #174 已标记 completed；本切片不单独生成安装包，纳入 v0.9.2 稳定批次。

- 已完成切片（#188，PR #240）：统一阅读模式、Milkdown WYSIWYG 和 HTML 导出的 h4/h5/h6 层级与列表排版节奏；h4 使用 19px，列表提供缩进、嵌套间距、列表标记色和多段列表项收束规则。新增 HTML 导出回归与真实浏览器样式 E2E；PR #240 已合并到 `main`，Issue #188 已标记 completed；纳入 v0.9.2 稳定批次。

- 历史基线：`v0.9.0`（详细历史合并记录保留在本文件中）；当前状态以“最新检查点”为准。
- 历史切片（Cloudflare 静态镜像发布链路）：该阶段已确认静态资产映射、重试校验和缺少凭据时失败的行为；v0.9.1 的真实资产与自动同步状态以最新检查点为准。
- 镜像健康巡检：`.github/workflows/mirror-health.yml` 每 6 小时和手动触发，读取 GitHub 最新 Release，对比 Cloudflare 根 manifest 的版本、版本目录、下载地址、安装包和 `.sig`；它不上传资产，不增加提交或 Release 的耗时，失败时作为发布链路告警。
- 历史切片（v0.9.1 编辑历史与恢复）：编辑历史、编辑器保真与相关稳定化内容已包含在 v0.9.1；具体 Release 和验证结果以最新检查点为准。
- 已完成（历史切片）：三栏布局、上下文面板、Milkdown 按需加载与挂载修复、命令面板、外部变更决策边界、WYSIWYG 同路径源码同步、`[[` 双链补全（两模式）、`/` 块级命令菜单（两模式，含 Enter 响应修复）、序列化规范化逐字节断言 + 决策文档 0004。
- 本切片新增（#158）：`e2e/smoke.spec.ts` 的 `readEditorText` 保留 CodeMirror 内部 view state 读取以绕过视口虚拟化，但路径失效时不再静默回退到可视区 DOM，而是抛出 `CodeMirror internal view state path changed — update readEditorText`。现有 round-trip e2e 继续验证完整文档读取；后续若升级 CodeMirror，必须先处理该显式失败，再评估通过公开实例引用替代内部路径。
- #156 已关闭：新增 e2e `downgrades a heading one level per Backspace at its start` 固化 Milkdown heading keymap 的降级语义（H2 起始 Backspace→H1，H1→段落，与 Obsidian/Typora 一致）。调查结论是该 keymap 属于预期 UX；原始 `<br />` 损坏在 #159 的竞态修复后无法复现。
- 历史关键根因（避免复发，详见 git 历史与本文件旧版）：
  1. CodeMirror 补全对中文标签做模糊匹配——补全源需返回 `filter: false` 由应用侧预过滤。
  2. Milkdown `markdownUpdated` 200ms debounce 销毁时被 cancel——cleanup 里需显式 `serializer(view.state.doc)` flush 差量。
  3. CodeMirror `acceptCompletion` 在菜单更新后 75ms 内拒绝 Enter——`autocompletion({ interactionDelay: 0 })`。
- 本切片（#177）为源码、rendered 和 WYSIWYG 模式统一接入 180ms 可取消渲染防抖；`sourceRenderRequestRef` 继续丢弃过期异步结果。`src/app/source-render-scheduler.ts` 是计时契约的唯一入口，单测覆盖延迟与取消；不要把防抖改成不可取消的全局队列，也不要在没有基准的情况下引入更重的解析器。
- 本切片（#180）修复阅读位置持久化竞态：`src/app/reading-position.ts` 维护每个文档最后一次已知的滚动值，旧文档 effect 清理时不会重新读取已切换文档的共享 DOM；位置恢复只在真正进入阅读模式并完成布局后执行，最多重试 6 个动画帧，并监听渲染内容/模式变化，避免 WYSIWYG 首次打开后切到阅读模式时漏恢复。无效和负值归一化为 0，单测覆盖清理时写入最新值与边界值，真实桌面 smoke 覆盖慢布局路径。
- 本切片（#170）将文档内搜索普通命中和当前命中收敛为 `--search-hit` / `--search-hit-active` 主题令牌，系统暗色（无 `data-theme`）和显式深色共用暗色值；新增浏览器 E2E 验证系统暗色下的两个计算背景色。版本文件已统一到 `0.8.3`，PR #212 已合并，Issue #170 已标记 completed；GitHub Release、安装包、签名、`latest.json` 和 Cloudflare 镜像均已在线核验，GitHub 与镜像安装包及签名 SHA-256 一致。
- 本切片（#186）已由 PR #214 合并（提交 `ca0cb8214bb287e681e5e30a8f40e5bfe2c7b67a`），Issue #186 已标记 completed。所有 `aria-modal="true"` 弹层接入 `useModalBehavior`：统一初始焦点、Escape 关闭、Tab/Shift+Tab 焦点循环和卸载后焦点归还；命令面板、快速打开的上下键/Enter 行为不变。单元测试覆盖边界循环、Esc 和焦点恢复，浏览器 E2E 覆盖草稿恢复、快速打开和命令面板的初始焦点/触发器恢复；该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#185）已由 PR #216 合并（提交 `7a35036d75ce7bda4908f3b41c978e2d9e74fbfb`），Issue #185 已标记 completed。在切换文档、关闭标签、打开文件、创建笔记或切换阅读库前同步冲刷当前本地草稿；桌面文件写入失败会阻止切换，成功后确认文案说明可在“草稿”中心恢复。浏览器临时预览仍使用未保存警告；真实 Tauri smoke 新增立即切页、确认文案、草稿存储和恢复清理场景。该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#184）已由 PR #224 合并（提交 `c131d9f122705328e6e475dddf9a3e7391b01ca7`），Issue #184 已标记 completed。草稿恢复中心的逐条“丢弃”先进入可取消确认对话框，取消会恢复中心且不修改本地存储；当前文档的草稿提示新增“稍后处理”，只隐藏提示、不删除草稿。新增确认模态的 Escape/焦点/显式确认单测和浏览器 E2E 取消/确认路径；该切片属于 v0.9.1 稳定化，暂不单独生成安装包。
- 本切片（#88）已由 PR #218 合并（提交 `bfc480d33d462e9a462501f822feb059db91bf44`），Issue #88 继续保持 open。真实 Tauri Windows desktop smoke 已覆盖：启动参数打开工作区和 Markdown、默认 WYSIWYG、切换源码、CodeMirror 编辑、Rust 保存写回、外部追加修改后的无冲突自动刷新、本地未保存编辑下的冲突提示、HTML/Word 工作区导出真实写盘、外部新增/删除文件和目录后的文件树刷新、应用内未保存退出确认的真实取消路径，以及桌面端 `[[` 双链候选/接受/序列化和源码 `/ul` 块级命令筛选/接受/写回；退出确认组件单测覆盖 Escape、焦点归还和显式确认回调。确认后会销毁主窗口，WebDriver 会话随之断开，因此烟测不再在销毁窗口后继续发命令。导出保存位置在桌面测试中使用确定的临时目录，正式构建仍使用系统保存对话框；二进制写入优先走原始 IPC，旧 WebView 无法传递原始字节时回退到已有授权写入命令。测试专用编辑器桥只在 `__MOYANG_DESKTOP_E2E__` 构建开关下注册，普通构建不加载测试 capability 或全局入口。PDF 目前仍是打印预览链路，未完成真实桌面文件落盘验证。前端路径键补齐 Windows `\\?\\`/UNC 扩展路径归一化，测试夹具主进程/worker 路径已统一。仍需继续：PDF 文件落盘、更新器桌面回归、a11y 自动化扩展和 i18n 分批迁移；不能把 #88 误报为完成。
- 本切片（UX 简化）继续保持低价值“打开列表”入口的移除，并进一步移除文件树任意前 80 项的“显示全部 / 收起列表”门槛：完整筛选树负责浏览，`Ctrl+P` 负责快速定位，系统多选负责一次打开多个文档，批量导出保持不变；#169 继续负责超大工作区虚拟化与规模保护。
- 本切片继续收敛低收益入口：移除右侧只放“打开关系图”按钮的重复页签，关系图入口统一归入“关联”视图；无阅读库或当前筛选无 Markdown/纯文本/Word 时隐藏批量导出菜单；上下文状态卡片会明确标记外部修改而不是显示“已保存”。旧版持久化的 `graph` 页签值会安全回退到“目录”。
- 本切片（UX 入口审查）已由 PR #219 合并（提交 `6816a7477952725b1e929ea4ce4d59285cccc47f`），Issue #195 保持 open。继续保持“打开列表”和任意“显示全部 / 收起列表”门槛移除；进一步让“添加整个文件夹”在同一界面只保留一个可见入口：侧栏展开时由空白主区或阅读库侧栏承接，侧栏收起后由顶部按钮承接；已有阅读库的空白主区改为引导从文件树或 `Ctrl+P` 开始阅读，根目录文件不再渲染空路径副行。快捷键、命令面板、快速打开、最近记录和批量导出职责不变。本切片不创建 Release 或安装包，纳入下一稳定 v0.9 minor 批次。
- 本切片（多阅读库与直接编辑入口）保留现有最多 5 个阅读库的缓存/持久化模型，但将已打开阅读库的按钮改为“添加阅读库”，切换菜单继续只负责激活另一个库；达到上限时明确禁用并提示先移除，不再让 `rememberMountedWorkspace` 静默挤掉最旧库。顶部新增直接“编辑 / 阅读”主动作，`Ctrl+E` 与它采用读写二态语义，“更多”菜单仍保留源码/WYSIWYG 循环以兼容高级路径。普通 Markdown 输入先更新草稿并经过 180ms 可取消渲染防抖，磁盘仍由明确保存动作写回。
- 本切片（Windows 窗口生命周期）修复 `src-tauri/src/main.rs` 缺少 `windows_subsystem = "windows"` 导致 Debug/Release 进程创建 CMD 宿主的问题；`tauri.conf.json` 改用 `scripts/tauri-dev-server.mjs`，其 Vite 子进程设置 `windowsHide: true`。开发终端仍可能保留日志，这是启动器本身，不是应用额外窗口；安装版不依赖 Vite。该切片已纳入并发布于 v0.9.0；仍需用旧版实机验证更新、替换安装和重启。
- 本切片（#192）更新提示允许在下载进行中隐藏，下载继续运行，顶部“下载中…”入口可恢复进度；“启动时检查更新”改为只读取初始启动快照，运行期间切换设置不会立即触发检查。由于 Tauri updater 当前没有可靠取消信号，不提供伪造的取消下载按钮。
- 本切片（#178）修复外部修改保护：冲突提示“稍后处理”只隐藏提示，`OpenDocument.externallyModified` 持续标记并在标题、标签、正文信息和状态栏呈现；普通保存被拦截，处理选项提供重新载入、覆盖保存和另存为，覆盖保存使用应用内确认并在写入前复核磁盘内容。自身写入增加 in-flight 集合，写入完成后才开始 watcher 抑制窗口；决策细节见 `docs/decisions/0006-external-change-safety.md`。
- 关键入口：`docs/decisions/0004-serialization-normalization.md` 是规范化清单唯一事实源；`e2e/smoke.spec.ts` 的序列化测试与它必须同步修改，且 `readEditorText` 是 CodeMirror 依赖升级的显式哨兵；`src/app/slash-command-menu.ts` 是 slash 命令纯逻辑；`src/app/wiki-link-completion.ts` 是双链补全纯逻辑。
- 相关测试：`e2e/smoke.spec.ts` 的 heading 降级、round-trip、直接“编辑 / 阅读”主动作和草稿丢弃确认场景；`src/app/reading-position.test.ts` 覆盖阅读位置 tracker 的最新值和边界值；`src/app/components/CloseConfirmationDialog.test.tsx` 与 `DraftDiscardConfirmationDialog.test.tsx` 覆盖 Escape、焦点归还和显式确认；`DraftRecoveryNotice.test.tsx` 覆盖“稍后处理”；`src/app/components/ExternalChangeNotice.test.tsx` 与 `ExternalOverwriteDialog.test.tsx` 覆盖冲突处理动作和焦点；`src/app/components/WorkspacePanel.test.tsx` 覆盖多阅读库添加、切换和上限保护；`src/app/components/WorkspaceTree.test.tsx` 防止工作区文件树重新引入任意 80 项截断；`src/app/document-transition.test.ts` 与 `src/app/draft-recovery.test.ts` 覆盖切换文案和草稿存储；`desktop-e2e/smoke.e2e.mjs` 的真实桌面启动/编辑/保存/双链补全/源码 slash 命令/HTML+Word 导出/外部新增删除/外部刷新/真实文件阅读位置切换/切换前草稿冲刷与恢复/冲突标记/覆盖保护/关闭确认取消。批量导出仍存在；合并前以实际门禁输出为准，不要沿用旧的场景计数。
- 已运行：完整前端单测 165/165、lint、format、构建、浏览器 e2e 35/35、真实 Tauri 桌面 smoke 10/10、Rust 单测 35/35、Rust fmt、release:check 和 release 测试均通过；Debug/Release exe 的 PE Subsystem 均为 `Windows GUI`。v0.9.0 Release workflow 的质量门禁和 Windows 签名构建均通过；构建仍可能有既有的大入口包体积提示，Milkdown 保持独立懒加载分包；WebdriverIO embedded provider 的 `tauri-driver`/mock store 诊断噪声不影响测试结果，但若它们变成失败必须单独定位。
- 本切片按重要数据安全修复发布 `v0.8.2` patch；版本号、CHANGELOG、安装包、签名、`latest.json` 和镜像已完成发布核验。纯文档、测试、CI 和内部重构仍可不发布。
- 发布结果：PR #204、#205 已合并；Release workflow [32900250651](https://github.com/MY-moss/moyang_Reader/actions/runs/32900250651) 全部通过，公开 Release 为 [v0.8.2](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.8.2)。GitHub 与 Cloudflare 的 `latest.json` 均为 `0.8.2`、HTTP 200；两边安装包均为 4,862,485 字节，SHA-256 为 `4eed2a25b81c7cb148e80fdf242afc89f4162f4ac24a79787d16fb9f2c592a23`；签名文件均为 424 字节，SHA-256 为 `19d7d860f395d67e3861b729d252f4ccf4ad6c18f628804718d1ef08fb1fed24`。镜像工作流 [32902095328](https://github.com/MY-moss/moyang_Reader/actions/runs/32902095328) 通过；当前未配置 Cloudflare Secret，因此跳过静态资产重新上传，使用已部署的轻量代理并验证成功。
- v0.9.0 发布结果：PR #222 已合并；Release workflow [32933116043](https://github.com/MY-moss/moyang_Reader/actions/runs/32933116043) 和镜像 workflow [32934449872](https://github.com/MY-moss/moyang_Reader/actions/runs/32934449872) 均通过，公开 Release 为 [v0.9.0](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.0)。GitHub 与 Cloudflare 的 `latest.json` 均为 `0.9.0`、HTTP 200；两边 Windows 安装包均为 4,862,669 字节，SHA-256 为 `063a075e50a39d013725eb25a5eb5f38dbf70f4dd39b201b17f99daf6bec497d`；GitHub 与镜像安装包均 HTTP 200，签名文件均 HTTP 200、424 字节，manifest 均带签名字段。
- 更新验证边界：本机检测到已安装 `v0.8.1`，v0.9.0 的 GitHub/镜像 manifest、安装包、签名和 HTTPS 下载链路均已验证；本次仍未自动点击旧版本的“下载并安装”并重启，不能将其记录为完整旧版本实机升级回归。下一次 Windows 实机回归需验证旧版本点击更新、签名校验、替换安装和重启后的版本号。
- 回滚方式：回滚本功能分支即可；无数据迁移，Markdown 文件仍是唯一真源。
- 下一位 AI 的唯一下一步：先查看“最新检查点”、Issues 和当前 PR；确认 v0.9.2 发布资产和镜像状态后，从最新 `main` 选择一个已确认的 Ready 切片。若 #241 尚未具备 Ready 条件，不要提前实现 PDF/更新器功能；若先处理发布基础设施，优先由维护者在 GitHub Actions Secrets 配置 `CLOUDFLARE_API_TOKEN`（仅 Pages 编辑权限）和 `CLOUDFLARE_ACCOUNT_ID`，再验证自动镜像。不要把 token 放入聊天、仓库或文档，也不要重复实现已完成的编辑、搜索、阅读位置、外部修改保护和工作区入口功能。
- CI 触发记录：PR #236 的 head `e364648fe703c4689a148f894525a68d25452a1b` 的 push `Quality checks` 曾被并发重跑取消，恢复后的 job `98264563669` 已成功；PR #236 已合并为 `c08987ac6d5b7b778b0f4814937714c7f302e55b`。Release workflow `32996354493` 已成功，镜像 workflow `32998515986` 仅因 Cloudflare Secrets 缺失失败。
