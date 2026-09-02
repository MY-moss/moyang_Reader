# Moyang Reader 当前交接摘要

本文件只保留当前稳定事实、正在推进的版本和外部阻塞。下一位 AI 的可执行任务只以 [`NEXT.md`](NEXT.md) 为准；可复制的最小接手提示词见 [`AI-TAKEOVER-PROMPT.md`](AI-TAKEOVER-PROMPT.md)；完整流程见 [`AI-WORKFLOW.md`](AI-WORKFLOW.md)；全量审计和任务地图见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)、[`../tasks/plan.md`](../tasks/plan.md) 和 [`../tasks/todo.md`](../tasks/todo.md)；历史记录见 [`handoff/`](handoff/)。

## 当前基线（2026-09-02）

- 发布代码主线基线：`main@45334c0b6cf9dc5f9b1bd39d2803b96181f0643e`；PR #415、#418 已 squash 合并，Issue #363、#416 已以 `completed` 关闭。
- 最新稳定版本：`v0.10.14`；当前后续 milestone：`v0.11.0`。
- GitHub Release [v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开；Release run `33555344560` 的 Quality checks、Windows 构建、签名和发布成功。
- 当前状态：v0.10.14 已发布；[#416](https://github.com/MY-moss/moyang_Reader/issues/416) 已合并，PR [#418](https://github.com/MY-moss/moyang_Reader/pull/418) 的 CI run `33592512919` 成功，合并提交为 `45334c0b6cf9dc5f9b1bd39d2803b96181f0643e`；当前执行 [#366](https://github.com/MY-moss/moyang_Reader/issues/366)，唯一产品 PR [#419](https://github.com/MY-moss/moyang_Reader/pull/419) 的 Quality checks run `33604977040` 已全绿，等待人工审查/合并。
- 当前开放 Issue/PR 快照（2026-09-02）：14 个开放 Issue，#373 是历史跟踪项；产品 PR 为 [#419](https://github.com/MY-moss/moyang_Reader/pull/419)，另有 6 个 Dependabot PR；Issue #366 未发现重复开放 PR。
- Cloudflare：公开 Pages 的 v0.10.14 manifest、安装包和签名已 HTTP 200，安装包 SHA-256 与 GitHub Release 一致；本次 Release 的镜像子任务因仓库 Cloudflare Secrets 未生效而失败，不能把自动镜像工作流记为全绿。
- 产品范围继续是 Windows x64、本地优先和 Markdown 真源；不增加云同步、任意脚本插件、移动端或 DOCX/PDF 原格式回写。

> 以下“本轮”段落是已完成切片的历史交接，只用于回溯实现、验证和回滚；不要从其中的旧“当前/下一项”文字选择任务。任务地图以 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md) 为参考，执行授权仍只有 [`NEXT.md`](NEXT.md)。

## 本轮工程治理与 HTML 路线

- 全量流程、现有能力、缺口、Issue 映射、HTML 适配任务和 v1.0 以后边界见 [`DEVELOPMENT-AUDIT.md`](DEVELOPMENT-AUDIT.md)。
- 工作区清理只回收可再生生成物和已确认合并/干净的临时工作树；根目录脏改动、未合并成果、用户文档和历史交接均保留，规则见 [`WORKSPACE-CLEANUP.md`](WORKSPACE-CLEANUP.md)。
- HTML 当前只作为导出目标；后续先做 H-01/H-05 安全只读预览，再评估 Markdown 白名单 HTML 和 HTML 源码编辑，不开放任意脚本执行。

## 已完成切片：#416 Windows 外部图标一致性（2026-09-02）

- 目标：统一应用内 Logo 与 Windows 可执行文件、NSIS 安装包、桌面/开始菜单快捷方式、任务栏和 `.md/.txt` 文件关联图标。
- 用户价值：安装、升级或打开 Markdown/TXT 文档时不再看到旧字母 M 或默认图标，桌面入口与应用本体能保持一致。
- 非目标：不重新设计 Logo；不做 macOS/Linux/移动端图标；不清理用户工作区或把删除 Windows 系统缓存当作唯一修复；不触碰 HTML 源码编辑、插件或其他 Issue。
- 验收标准：Windows 资源存在且非空，尺寸/格式/哈希与确认 Logo 一致；`bundle.icon` 显式覆盖资源；Release preflight 拦截缺失、旧资源、旧 M SVG 和不安全路径；全新安装、覆盖升级、桌面/开始菜单快捷方式、`.md/.txt` 关联均指向新可执行文件；Windows Shell 缓存边界有明确记录。
- 涉及文件：`src-tauri/tauri.conf.json`；删除旧的 `src-tauri/icons/icon.svg`；`scripts/release-check.mjs`、`scripts/release-check.test.mjs`；`docs/NEXT.md`、`docs/UPDATE.md`、`docs/AI-HANDOFF.md`、`docs/handoff/v0.10.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖：既有 Windows PNG/ICO 资源、Tauri NSIS 打包链和 Windows x64 验证环境；未新增运行时依赖。
- 风险：固定哈希要求未来有意换 Logo 时同步更新门禁；Windows Shell 图标缓存不受应用完全控制；错误资源会在发布前被门禁拦截。
- 回滚：回退本切片提交即可恢复原配置和校验逻辑，不需要数据迁移；若已发布，按发布政策使用上一稳定版重新安装，不删除用户缓存。
- 实现：显式列出 16 个 Windows 图标资源；校验 PNG 尺寸/哈希、ICO 目录/PNG 条目/尺寸/同源 256x256 图像、应用内 Logo 同源关系和旧 M SVG；将检查接入 `validateProject`，并补充资源夹具回归。
- 验证：`release-check` 单测 11/11；Prettier、JSON 和差异检查通过；Tauri Windows x64 无安装包构建通过；本地 NSIS 包安装后可执行文件、安装器、桌面和开始菜单图标均可由 Windows 提取；全新安装和覆盖升级均返回成功，关联与快捷方式指向隔离安装目录。验证目录已清理，本机原有安装引用已恢复。
- 发布边界：只生成本地验收用 NSIS 包；本切片不创建 GitHub Release、签名文件、`latest.json` 或 Cloudflare 镜像，v0.10.14 稳定资产保持不变。若维护者将其纳入 v0.10.15 稳定批次，再按发布政策统一生成和核验。
- 任务边界：本切片已由一个 `codex/` 分支和一个 PR 完成；合并后重新检查 Issue 并切换到 #366，不自动开始 #370、#233 或任何 HTML 工作。

## 本次切片：#366 统一确认弹层与未保存修改语义（PR #419，2026-09-02）

- 目标与用户价值：统一“清空全部草稿”和关闭未保存文档的应用内确认体验；明确草稿已留存，并提供保存并退出，降低误操作和退出时的不确定感。
- 非目标：本切片不处理 `window.prompt` 系列、不改草稿数据模型或其他确认入口、不改变 HTML/插件/发布边界。
- 验收标准：原生清空确认被应用弹层替代；弹层支持 Escape、取消、确认和焦点契约；关闭文案准确说明草稿副本；保存并退出复用现有保存管线且保存失败不继续关闭；组件、浏览器 E2E、Windows 桌面关闭路径通过。
- 涉及文件：`src/app/App.tsx`、确认弹层组件及测试、`e2e/smoke.spec.ts`、`desktop-e2e/smoke.e2e.mjs`、`docs/UI-INTERACTION.md`、`docs/NEXT.md`、本文件、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`。
- 依赖与风险：复用 `useModalBehavior`、草稿快照和 `saveDocument`；保存受外部修改/写入失败影响，弹层需保持焦点边界。无新增运行时依赖、无数据迁移。
- 回滚与发布：回退本切片提交即可恢复原确认行为；本切片不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像，纳入后续 v0.11.x 稳定批次。

## v0.10.14 发布交接（已完成）

- 修复范围：#363 批量 DOCX 导出不再对每个 256 KiB 分块强制刷盘；在提交边界统一持久化；Worker 部分输出失败时清理临时输出并回放当前卷；取消与真实错误分开处理。
- 版本交付：PR [#413](https://github.com/MY-moss/moyang_Reader/pull/413) 更新版本元数据，PR [#414](https://github.com/MY-moss/moyang_Reader/pull/414) 将 Release action 显式切换到 `npx tauri` 并保留 3 次 action 重试；合并主线为上述 `ec76d3d`。
- GitHub 资产：`Moyang.Reader_0.10.14_x64-setup.exe` 5,243,339 字节，SHA-256 `293b3884f2e66659e7ce2ab4f333dc01dcd0bf0a48ddd0ed8bbff42d661cce59`；`.sig` 428 字节，SHA-256 `fd832a5689c9064118dd0bb8e9c3ba3d88e0a75da0c061bbd6809b069ab70adf`；`latest.json` 1,413 字节，SHA-256 `dfb110ba23f248d6c374d714613888511f99a4aae2b038219caeea27350af8cc`。
- 在线验证：GitHub Release 和 Cloudflare Pages 的 manifest、安装包、签名均 HTTP 200；镜像安装包大小和 SHA-256 与 GitHub 资产一致。未上传私钥、API Token 或其他凭据。
- 首次发布失败根因：Release runner 的 npm 包装脚本将 Cargo 产物重定向到共享缓存，tauri-action 默认扫描 `src-tauri/target`，因此出现 `No artifacts were found`；#414 已修复路径不一致并重新发布。

## 本轮 #365 交接（已合并）

- 目标：让插入面板在关闭后把焦点可靠交还给编辑器，并为 Markdown 图片插入提供 Windows 工作区浏览入口。
- 实现：`EditorInsertPopover` 使用 roving tabindex 和方向键/Home/End 切换 tab；外部 pointerdown 关闭前阻止默认焦点转移；`choose_image_paths` 复用 `AccessRegistry` 注册选择结果；按文档路径生成工作区相对 Markdown 图片路径。
- 保护：图片选择限定 `avif/gif/jpeg/jpg/png/svg/webp`；工作区外、绝对和包含 `..` 的路径被拒绝；浏览器预览模式显示桌面版限制；选择失败、取消和进行中状态有明确反馈。
- 验证：`markdown-path` 与 `EditorInsertPopover` 定向单测 2 文件/6 项；变更文件 ESLint/Prettier；一次生产构建；Rust fmt/test/clippy；浏览器插入面板 E2E 2/2；远程 Quality checks run `33526998019` success，包含 Windows 桌面烟测。
- 交付：分支 `codex/insert-popover-2026-09-01`、PR [#408](https://github.com/MY-moss/moyang_Reader/pull/408)、合并提交 `4544c926a9a0485c1f02b6ac20f9982f81877da3`；Issue [#365](https://github.com/MY-moss/moyang_Reader/issues/365) 已以 `completed` 关闭。
- 发布边界：不单独生成 Windows x64 安装包、Tag、Release 或 Cloudflare 镜像；纳入 `v0.11.0` 稳定批次。回退 PR #408 无需迁移；完成交接后停止，不自动开始下一切片。

## v0.11.0 当前顺序

- #364：编辑器右键粘贴语义统一（已完成，PR #406）。
- #371：中文文件名拼音首字母搜索（已完成，PR #404）。
- #372：设置导出/导入补全阅读位置与书签（已完成，PR #402）。
- 后续事项不按历史列表自动并行开发；唯一可执行事项以 [`NEXT.md`](NEXT.md) 中重新确认的 READY 项为准。
- #241/#51 仍是外部发布条件项；v0.10.14 的公开镜像已验证可用，但自动镜像 job 仍需仓库配置 Cloudflare Secrets 后重跑，旧版本真实安装/更新闭环和 Authenticode 条件仍需发布前复核。

## 本轮 #364 交接（已合并）

- 目标：修复右键「粘贴」和「粘贴为纯文本」实现等价、富文本被静默剥离、图片剪贴板静默无操作的问题。
- 实现：`clipboard-paste.ts` 统一读取纯文本/HTML/图片；普通粘贴派发带剪贴板数据的编辑器事件，纯文本粘贴直接插入文本；所见即所得图片复用工作区 `assets/` 资源保存并插入图片节点；源码模式继续复用原有图片处理。
- 保护：空剪贴板、权限失败、图片与纯文本入口不匹配、异步期间正文变化均有状态提示；未新增依赖，未改变 Markdown 真源。
- 验证：本地 84 个前端测试文件/327 项、变更文件 ESLint/Prettier、一次生产构建、浏览器右键粘贴 E2E 通过；远程 Quality checks run `33515048213` success。
- 交付：分支 `codex/paste-semantics-2026-09-01`、PR [#406](https://github.com/MY-moss/moyang_Reader/pull/406)、合并提交 `fcdc3463f16c561ec575d8067a8ef7d6c706ee09`；Issue #364 已以 `completed` 关闭。
- 发布边界：本切片不生成 Windows x64 安装包、Tag、Release 或 Cloudflare 镜像；纳入 `v0.11.0` 稳定批次。回退 PR #406 不需要数据迁移。

## 本轮 #371：中文文件名拼音首字母匹配（已合并）

- 目标：输入 `bj` 可命中 `北京笔记.md`，同时保留原文件名匹配和现有排序。
- 实现：`src-tauri/src/commands.rs` 生成 Rust 侧轻量拼音首字母键；`WorkspaceFile.pinyinKey` 为可选 IPC 字段；`quick-open.ts`、`workspace-refresh.ts` 与工作区搜索接入该字段。
- 非目标：不做全文拼音检索、多音字消歧或前端 JS 拼音依赖；不改变 Markdown 文件内容。
- 验证：Rust 全量库测试 54 项；前端定向测试 2 文件/10 项；TypeScript、Lint、格式检查和一次生产构建通过；远程 CI run `33506583653` 与依赖审计 run `33506583870` 成功。
- 交付：PR [#404](https://github.com/MY-moss/moyang_Reader/pull/404) 已 squash 合并为 `main@c4794bcc618401c36c5a826a07ab22f18f99900a`；Issue #371 已以 `completed` 关闭。
- 发布/回滚：不单独生成 Windows x64 安装包、Tag、Release 或镜像；纳入 `v0.11.0`。回退 PR #404 无需数据迁移。

## 本轮 #372：设置备份 v2（已合并）

- 范围：`portable-settings.ts` 将版本从 v1 升到 v2，导出阅读位置和书签；`storage.ts` 暴露统一的阅读位置快照读写与 32 条规范化边界；`App.tsx` 在 v2 导入时恢复两类本机状态，在 v1 导入时保留现有状态。
- 数据边界：不复制文档正文、草稿或 AI 数据；`browser://` 临时书签不进入备份；Markdown 文件仍是真源。
- 验证：`src/app/portable-settings.test.ts` 与 `src/app/storage.test.ts` 共 17 项通过；TypeScript、Lint、格式检查和差异检查通过；远程 Quality checks run `33474094871` 通过并包含 Windows desktop smoke、发布检查和 Rust 门禁。
- 交付：PR [#402](https://github.com/MY-moss/moyang_Reader/pull/402) 已 squash 合并为 `main@d93c992474db0e5e8ab0f04d68044db1ab774700`，Issue #372 已以 `completed` 关闭。
- 发布/回滚：不单独生成 Windows x64 安装包、Tag、Release 或镜像；纳入 `v0.11.0` 稳定批次。回退 PR #402 无需数据迁移；本轮交接完成后停止。

## 本轮 #361 交接（已合并）

- 目标：修复暗色自动/显式主题下编辑器插入、插入面板提交和通用主按钮的浅色 accent 配白字对比度问题；亮色主题保持现状。
- 变更：`src/app/styles.css` 增加独立实心按钮色令牌；主按钮的普通、hover、focus 和编辑器插入动作使用可读的深色底配白字；强制高对比度改用 Windows 系统按钮色。
- 测试：新增 `e2e/a11y.spec.ts` 对两个暗色分支和普通/悬停状态执行 WCAG AA 4.5:1 检查；本地 `a11y` 7/7、Lint、格式检查、构建和差异检查通过。
- PR：[#390](https://github.com/MY-moss/moyang_Reader/pull/390) 已 squash 合并为 `main@41acf808a54683e9ed4b2f7a1d15cdc132c8629d`；Issue #361 已明确以 `completed` 关闭。
- 本地验证：`e2e/a11y.spec.ts` 7/7、Lint、格式检查、`git diff --check` 和一次前端生产构建通过；远程 Quality checks run `33392327386` 通过。
- 发布：本切片属于 `v0.11.x` 普通视觉修复，不单独生成安装包、Tag、Release 或镜像；纳入下一 Windows x64 稳定批次。
- 回滚：回退本切片提交，无数据迁移。

## 本轮 #362 交互与渲染微成本包（已合并）

- 目标：降低面板拖动期间的全 App 重渲染与重复持久化，减少草稿链路重复全量 parse，并避免差异弹层在无输入变化时重算全文 diff。
- 非目标：不改变面板、草稿和差异语义；不引入专用数据库，不改 Markdown 真源，不顺手扩展其他性能或 UI Issue。
- 预计范围：`src/app/PaneResizeHandle.tsx`、`src/app/App.tsx`、`src/app/draft-recovery.ts`、`src/app/components/DraftRecoveryComparisonDialog.tsx` 及对应测试；先测量再最小拆分。
- 实现：拖动期间只更新 app-shell CSS 变量，pointerup/cancel/lost-capture 才提交 React 状态和持久化；草稿存储按原始序列化内容复用解析结果，保存结果直接携带最新快照列表，查找与列表加载共用一次读取；差异计算按来源、状态和草稿内容 memo。
- 验收：定向单测 17/17、全量前端单测 76 文件/300 项、TypeScript、Lint、格式检查、一次生产构建和侧栏拖拽浏览器 E2E 1/1 通过；草稿 parse 回归探针在查找与保存链路中仅执行 1 次。
- PR：[#392](https://github.com/MY-moss/moyang_Reader/pull/392) 已 squash 合并为 `main@c936666043d32ed1a4a1eec9312684994636034a`；Issue #362 已以 `completed` 关闭。
- 远程验证：Quality checks run `33403555956` 重跑成功；首轮桌面性能基准的单次 318.5ms 抖动未重现，Windows desktop smoke、依赖审计、发布检查和 Rust 门禁均通过。
- 验证/发布：T2；不单独生成安装包、Tag、Release 或 Cloudflare 镜像，纳入 `v0.11.0` Windows x64 稳定批次；回退 PR #392，无数据迁移。

## 本轮 #368 文档书签第一切片（已合并）

- 状态：第一切片已完成，Issue 继续 open 等待第二切片；Should / P2；T2；计划 `v0.11.x`；Issue：[#368](https://github.com/MY-moss/moyang_Reader/issues/368)；PR：[#397](https://github.com/MY-moss/moyang_Reader/pull/397)；合并提交：`fc51db210cf2142f4a317e713516dd39c6454edf`。
- 目标：为文档保存可复用的定位，在正文右键添加书签，并在右栏书签页签中列出、跳转和删除。
- 边界：书签使用本机 localStorage，字段为 `path`、可选 `headingId`/`quote`/`note` 和 `createdAt`；不写回 Markdown，不做选中文本高亮、sidecar、跨设备同步或 DOCX/PDF/图片标注。
- 实现：`bookmarks.ts` 本机存储与 Windows 路径去重；阅读区右键标题添加/移除；ContextPanel 第四页签列出、跳转、删除，并标出当前阅读库外的定位；临时 `browser://` 书签不写入持久存储。
- 验收：定向测试 5 文件/27 项，快速打开和书签浏览器 E2E 2/2，TypeScript、Lint、格式检查、`git diff --check` 和一次前端生产构建均通过。Escape、焦点、未保存保护、目录和关联页签沿用现有边界。
- 发布/回滚：不单独生成 Windows x64 安装包、Tag、Release 或 Cloudflare 镜像，纳入 `v0.11.0` 稳定批次；回退 PR #397，不需要数据迁移；#368 第二切片（选中文本批注）必须重新走 Issues/Ready 检查。

## 本轮 #368 选中文本高亮批注第二切片（已合并）

- 基线：`main@9f5f7934f0fdfcb2ac0b265eb29f574c9ba2c583`；分支：`codex/annotation-highlight-2026-09-01`；Issue：[#368](https://github.com/MY-moss/moyang_Reader/issues/368)；PR：[#399](https://github.com/MY-moss/moyang_Reader/pull/399)；合并提交：`871d6032336036b406109126c26f80bf831463bc`。
- 目标：阅读模式选中文本后创建高亮/备注；在正文中定位显示，在右栏批注页签中查看、跳转和删除；Markdown 仍是唯一正文真源。
- 实现：新增 `.moyang/annotations.json` 的 Tauri 授权读写、引文/前后文锚点、CSS Custom Highlight 与 DOM 回退、失配“待定位”状态、批注设置开关和右键/右栏闭环；浏览器会话使用内存回退，不写本机文件。
- 非目标：不改写 Markdown，不做编辑器内标注、DOCX/PDF/图片标注、尾注导出、跨设备同步或数据库。
- 验证：前端 83 文件/323 项、TypeScript、Lint、格式和差异检查、一次生产构建、Rust 52 项/clippy、浏览器批注 E2E 1/1、Windows desktop smoke 14/14、发布预检和构建产物检查均通过。
- 发布/回滚：本切片不生成 Windows x64 安装包、Tag、Release 或 Cloudflare 镜像；纳入 `v0.11.0` 稳定批次；回退 PR #399，无数据迁移。Issue #368 已标记 `completed`，本轮交接完成后停止。

## 本轮 #359 交接（已合并）

- 基线：`origin/main@4a60c61fe5ec0b6adc760f177af4f166275984e`；分支：`codex/editor-undo-granularity-2026-08-31`；Issue：[#359](https://github.com/MY-moss/moyang_Reader/issues/359)；PR：[#388](https://github.com/MY-moss/moyang_Reader/pull/388)；合并提交：`5f8fba3a37d429aa052add4543832b096ee28da5`。
- 目标：把连续输入从“每个字符一条全量快照”收敛为可理解的撤销组，同时限制历史驻留内存，保持源码/WYSIWYG 共用应用级撤销、重做分支和保存语义不变。
- 实现：编辑器输入在 400ms 内合并；原子程序化更新打断分组；past/future 快照最多 100 条且合计不超过 8 MiB 的 UTF-16 估算上限；超限优先丢弃最旧历史。
- 变更：`editor-history` 增加分组时钟、字节预算和边界裁剪；App 仅给两个编辑器输入回调标记可合并；新增定向单测和源码快速输入 E2E。
- 已验证：定向单测 6/6、`tsc --noEmit`、一次前端生产构建、源码连续输入 E2E 1/1、已有跨模式撤销/重做 E2E 1/1，以及完整 lint/format/diff 检查均通过；远程 Quality checks run `33386166171` 成功，Issue 已关闭。
- 发布/回滚：本切片不单独生成安装包、Tag、Release 或镜像，纳入 `v0.11.0`；回退本切片提交即可，不需要数据迁移。

## 本轮 #369 交接（已完成）

- 分支：`codex/recycle-bin-backup-2026-08-31`；基于 `origin/main@16180304cf80d713ae411015b3832fa4338e96d3`；PR [#386](https://github.com/MY-moss/moyang_Reader/pull/386) 已 squash 合并为 `main@7aaf2bffe887ec7967c6b6fb44391fac657acbd7`。
- 目标：删除工作区条目进入 Windows 回收站；成功保存后保留上一版本，并在界面中提供差异预览和显式恢复到编辑区。
- 变更：`SHFileOperationW + FOF_ALLOWUNDO`、扩展路径兼容转换、滚动 `.moyang.bak`、上一版本读取桥接、恢复差异对话框和顶部入口；删除文件时同步处理无主备份。
- 测试：前端定向 3 文件/14 项、Rust 编译/格式/定向备份与删除测试、工作流 13/13、Windows desktop smoke 14/14、Lint、格式和构建已通过；远程 Quality checks `33367813186` 和 Rust audit `33367921971` 均成功。
- 限制：特殊路径/网络盘/禁用回收站可能无法接收内容，失败时不永久删除；`.moyang.bak` 仅保留最近一份；发布前仍需确认 Explorer 还原路径。
- 发布：本切片不生成安装包、Tag、Release 或镜像，纳入 `v0.11.0` 稳定批次；回滚为回退本切片 PR。
- Issue #369 已自动以 `completed` 关闭；当时下一唯一事项为 #359，当前唯一 READY 已切换为 #361，不自动开启其他任务。

## 本轮 #384 交接

- PR：[#384](https://github.com/MY-moss/moyang_Reader/pull/384)，squash 合并提交为 `d25eb0b6f6e2330bbc1cf67ee7ac08d305b1b931`。
- 目标：把工作区树的长时递归文件 IO 移出 Tauri 窗口事件循环，降低大目录删除、复制、移动和 Markdown 新建时的“未响应”风险。
- 变更：保留入口权限校验；五个命令通过现有 `run_blocking` 执行内部文件 IO，没有引入新任务系统、进度协议或依赖。
- 本地验证：`workspace_entries` 3/3、`markdown_files` 1/1、Rust format 和 `git diff --check` 通过；项目内没有生成 `src-tauri/target`。
- 远程验证：Quality checks run `33361212388` 成功；旧的格式失败 run `33360473718` 未合并，根因是 API 上传时多出的文件尾空行，已修正。
- 发布：不单独生成安装包、Tag、Release 或镜像；按稳定批次纳入 `v0.11.0`。
- 下一唯一任务：#369；完成本次交接后停止，不自动开始 #369。

## 下一项 #369 的边界

- 先核对 Windows 回收站 API 与 `.moyang.bak` 滚动策略；删除、恢复和保存安全属于 T3，未经完整回归不要自动合并。
- 只做最近一份上一版本，不做多级历史、独立回收站 UI 或数据迁移；详细目标和验收见 [`NEXT.md`](NEXT.md)。

## 已知条件与风险

- #241：Cloudflare 静态自动部署仍需仓库凭据；凭据不得进入仓库、Issue、PR 或聊天。
- #51：Tauri 更新包已有签名，NSIS Authenticode 仍取决于证书；无证书时保留 SmartScreen 限制和哈希核验说明。
- 原始开发目录存在大量未提交修改且落后主线；所有新切片必须从最新 `main` 建独立 worktree，不得重置或覆盖原目录。

## 文档职责

- `docs/NEXT.md`：唯一当前任务，最多 120 行，无历史。
- `docs/AI-HANDOFF.md`：当前版本状态和外部风险摘要，最多约 150 行。
- `docs/handoff/v0.11.md`：v0.11 已完成切片的短记录。
- `docs/handoff/v0.10.md`、`v0.9-and-earlier.md`：只读历史摘要。
- `docs/ROADMAP.md`：版本目标和跨切片顺序。
- `docs/ISSUE-INDEX.md`：Issue 分类、Ready 状态与治理规则。

## 历史交接摘要

## 最近完成

- #172 reduced-motion 程序化滚动已在 PR #374 合并到 `main@c187edcf39798b16d9610b5b8fdda6e22532086c`；程序化滚动会尊重 Windows 的减少动画偏好，Issue 已关闭；结果纳入 v0.11.0，不单独发布安装包。
- #375 工作区空间治理已在 PR #375 合并到 `main@c3f5c8ce1967f2649a47337ca699aedca48fd1e8`；增加生成物清理、工作树依赖复用和安全回收规则，避免重复 `node_modules` 与构建缓存造成目录膨胀；不生成安装包或 Release。
- #357 右键菜单 viewport 定位已在 PR #377 合并到 `main@c32c34991b25f11cf4890ad793dbdbc065e46872`；共享菜单通过 portal 脱离 `.content-area` containing block，阅读区右键定位与正文滚动 E2E 已通过；Issue #357 已以 `completed` 关闭；不单独发布安装包。

- #190 首屏按需加载与大文档渐进挂载已完成：普通文档不再静态加载 KaTeX CSS；大 HTML 首块先挂载，后续按帧渐进挂载；搜索和目录/锚点跳转会在需要时完成剩余挂载。PR #351 合并提交为 `e7a08d6`，Issue 已以 `completed` 关闭。
- #190 本地验证：定向单测 11/11、lint、类型规则探针 3/3、format、一次生产 build、构建产物检查、性能浏览器 E2E 2/2 和相关回归 E2E 4/4 通过；远程 Quality checks `run_id=33322595846` 成功，依赖审计 `run_id=33322611814` 成功。
- #190 发布边界：不单独生成 Windows 安装包、Tag、Release 或镜像；结果并入 v0.11.0。回滚为回退 PR #351。

- #234 已在 PR #342 实施统一固定通知视口：设置/更新反馈最多三条 FIFO，支持独立关闭，info/success 六秒自动关闭，error/action 常驻；正文无布局位移。
- #234 本地门禁通过：270 个单测、50 条浏览器 E2E、Windows desktop E2E 12/12、lint、format、build；CI 已通过：`sha=c37627628bf9916b00a31961a672b68827a6139e workflow=CI/Quality checks run_id=33290796215 conclusion=success last_changed_at=2026-08-30T03:49:37Z next_action=merge PR #342`。
- #189 本轮已完成类型感知 ESLint 异步门禁：`src` 启用 `no-floating-promises`、`await-thenable`、`no-misused-promises`，脚本和 desktop-e2e 保持非类型感知边界；13 处测试 fallout 已修复，3/3 规则探针通过。
- #189 本地门禁通过：全量单测 270、TypeScript build、lint、format、Rust fmt/clippy/tests 51、发布预检和 Actions 固定检查；远程 PR/Quality checks 结果以 GitHub 为准。
- #87 最终 Windows 矩阵已在 PR #341 实施：96 篇文档（重复图片 24、独立图片 20、长文本 20、复杂表格 16、嵌套 HTML 16），成功导出连续 3 轮。
- 三轮 renderer 最大间隔为 77/80/76ms，上下文交互为 3/6/6ms；三轮各生成 5 个可解析 DOCX，Working Set 均非单调增长。
- 取消路径确认延迟 50ms、renderer 最大间隔 78ms、生成 2 个可解析 DOCX；取消和目标目录失败后临时文件均为 0。
- 本地门禁通过：定向导出 37、全量单测 265、覆盖率、lint、format、build、浏览器 E2E 48、Windows desktop E2E 12、release checks、Actions 固定检查、npm audit 0 vulnerabilities、Rust fmt/clippy/tests 51。
- PR #339 的合并提交为 `0c83f80`：复杂 DOCX 段落、列表、表格、引用和链接改为增量序列化。
- PR #338 已合并为 `main@7ca9961`：超长文本分块和重复图片媒体复用。
- PR #337 已完成 GitHub Actions SHA 固定和前端定时依赖审计；PR #336 已完成 #189 首个门禁切片。

## 本轮 #234 交接

- 分支：`codex/notification-layer-2026-08-30`；独立 worktree，基于 `origin/main@33c798c`。
- PR：[#342](https://github.com/MY-moss/moyang_Reader/pull/342)；Issue：[#234](https://github.com/MY-moss/moyang_Reader/issues/234)。
- 风险：T2；无安全、权限、数据迁移、发布资产或持久化语义变化。回滚为回退 PR #342。
- 变更：`src/app/notification-queue.ts`、`src/app/components/NotificationViewport.tsx`、`src/app/App.tsx` 与样式、单测和窄窗口 E2E；UpdateNotice 共用固定视口。
- 完成后唯一下一步：#189；不自动开始。

## 本轮 #189 交接

- 分支：`codex/typescript-eslint-gates-2026-08-30`；独立 worktree，基于远程 `main@4ca46c5` 的等价文件树。
- 范围：仅收紧 `src` 的类型感知异步规则；补充规则探针和 CI 步骤；清理同步 `act` 测试中的真实未处理 Promise。未改变用户功能、持久化、导出、更新器或发布资产。
- 回滚：回退本切片 PR；不需要数据迁移，不生成安装包、Tag、Release 或镜像。
- 验证：`npm test -- --run` 270/270、`npm run lint`、`npm run check:type-aware` 3/3、`npm run format:check`、TypeScript build、Rust fmt/clippy/tests 51、发布预检和 Actions 固定检查通过。
- 交接：PR/CI 合并完成后将 #189 标记 completed；下一位 AI 只执行 [`NEXT.md`](NEXT.md) 中的 #301，不自动扩展范围。

## 本轮 #301 交接

- 基线：远程 `main@89b812af8b331e909a744686628b9abb6b3a4ee3`；分支：`codex/drag-drop-feedback-2026-08-30`；独立 worktree。
- PR：[#344](https://github.com/MY-moss/moyang_Reader/pull/344)；Issue：[#301](https://github.com/MY-moss/moyang_Reader/issues/301)。
- 结果：合并提交 `2ae4836895f314ef40d65e0e29d5aa194e0d1000`；Issue 已以 completed 关闭。
- 范围：浏览器和 Windows Tauri 原生拖放覆盖 enter/over/leave/drop 生命周期；支持、混合、不支持和未知类型有轻量反馈；重复、跳过和失败有可关闭通知；未改变文件识别、工作区导入、标签页或编辑语义。
- 验证：本地全量单测 70 文件/275 项、Lint、format、TypeScript build、前端 build、浏览器拖放 E2E 和 Windows desktop 原生拖放 E2E 1/1 通过；Quality `run_id=33303742441` 第 2 次运行全步骤成功。第 1 次失败为既有 #87 批量导出第 3 轮基准抖动，未修改该无关功能。
- 变更：新增 `FileDropOverlay`、拖放分类 helper 和 Tauri 生命周期映射；补充需求、CHANGELOG、浏览器与桌面 smoke。
- 发布：本切片不生成 Windows 安装包、Tag、Release 或镜像，结果并入 `v0.11.0` 稳定批次。
- 下一唯一任务：#119 axe/WCAG AA Windows UI 基线；不自动开始。

## 本轮 #346 交接

- 基线：远程 `main@3b82408d67772f75cb75ec5eca702e8ec014abc1`；分支：`codex/draft-compare-2026-08-30`；独立 worktree。
- Issue：[#346](https://github.com/MY-moss/moyang_Reader/issues/346)；本轮目标是恢复前明确比较“当前文件”和“本机草稿”，不是引入版本历史或三方合并。
- 变更：桌面端恢复中心和当前文档提示读取当前磁盘版本；异步加载/失败禁止恢复；浏览器回退明确标注为草稿保存时的原文；增加来源卡片、差异统计、换行等价判断、重试和过期请求保护；恢复仍只进入编辑区，显式保存后才写盘。
- 验证：定向前端单测 4 文件/13 项、TypeScript build、format、git diff 检查、生产构建、浏览器恢复中心 E2E 1/1、Windows desktop targeted smoke 1/1 均通过。
- 风险与回滚：T2；只读当前文件并改变恢复前确认 UI，无数据迁移、更新器、签名、发布或镜像影响；回退本切片 PR 即可恢复旧行为。
- 发布：本轮不生成安装包、Tag、Release 或镜像；纳入后续稳定 `v0.11.0` 批次。
- 完成后唯一下一步：合并并关闭 #299，然后执行 [`NEXT.md`](NEXT.md) 中的 #119；不自动开始下一项。

## 本轮 #299 交接

- 分支：`codex/context-menu-focus-2026-08-30`；基于远程 `main@0e85cbc0d9f6507f8dc0fcf08f748cac77d7b9cd` 的等价文件树；独立 worktree。
- Issue：[#299](https://github.com/MY-moss/moyang_Reader/issues/299)。共享右键菜单现已统一支持 Tab/Shift+Tab 循环、Arrow/Home/End 导航、Escape/外点/菜单选择后的焦点归还，以及触发元素失效时的安全回退。
- 入口：文件树、标签页、阅读区、WYSIWYG 和源码编辑器共用同一焦点契约；鼠标、Context Menu 键和 Shift+F10 保持同一业务菜单。
- 验证：共享菜单单测、浏览器键盘 E2E、Windows desktop 文件树 targeted smoke、全量单测、lint、format、TypeScript build 和生产 build 已通过；桌面回归优先发送真实 WebDriver Escape，嵌入 driver 未转发 keydown 时使用同一焦点目标的受控 DOM 回退；driver/mock-store 的既有环境警告不影响测试结果。
- 发布：不创建安装包、Tag、Release 或镜像；本切片不涉及数据迁移、更新器、签名或跨平台范围。
- 回滚：回退本切片 PR；下一位 AI 只执行 [`NEXT.md`](NEXT.md) 中的 #119，不自动开始下一项。

## 本轮 #119 axe/WCAG AA Windows UI 基线

- 基线：`main@ee84be9949f71f2745118b52a89d889ce170106c`；分支：`codex/a11y-baseline-2026-08-30`；独立 worktree。
- Issue：[#119](https://github.com/MY-moss/moyang_Reader/issues/119)；PR：[#350](https://github.com/MY-moss/moyang_Reader/pull/350)。
- 结果：空状态、阅读、快速打开和设置四个浏览器入口分别运行 axe；浅色/深色关键文字令牌执行 WCAG AA 对比度计算；Windows `forced-colors` 运行 axe 和实际 CSS 颜色探针；修正低对比度令牌并新增 Narrator/NVDA 手动清单。
- 变更：新增 `test:e2e:a11y` 定向入口、`docs/ACCESSIBILITY-WINDOWS.md` 和高对比度 CSS 回退；没有新增运行时依赖、跨平台范围或用户文档同步。
- 验证：`npm run lint`、`npm run format:check`、`npm run build`、`npm run test:e2e:a11y -- --reporter=line --workers=1`（6/6）通过；远程 `sha=c0bca3de57e00cee3bbe59b8956b9a3c9952b856 workflow=CI run_id=33320052388 conclusion=success last_changed_at=2026-08-30T15:43:13Z`。
- 发布/回滚：不创建安装包、Tag、Release 或镜像；回退 PR #350 即可恢复原主题令牌和测试范围。真实 Narrator/NVDA 抽查保留在发布前清单，不声称自动化替代读屏认证。
- 下一唯一任务：#190 已完成；下一项 #172 以 [`NEXT.md`](NEXT.md) 为准，不自动开始。

## 已知条件与风险

- #241：Cloudflare 静态自动部署仍缺仓库 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`，旧版本安装升级闭环仍需真实 Windows 环境；凭据不得进入仓库、Issue、PR 或聊天。
- #51：Tauri 更新包已有签名，NSIS Authenticode 仍取决于可用证书；无证书时必须保留 SmartScreen 限制和哈希核验说明。
- 原始开发目录存在大量未提交修改且落后主线；所有新切片必须从最新 `origin/main` 建独立 worktree，不得重置或覆盖原目录。
- 产品边界继续是 Windows x64、本地优先、Markdown 真源；不增加跨平台、云同步、脚本插件或 DOCX/PDF 原格式编辑。

## 本轮 #87 交接

- 分支：`codex/batch-export-final-matrix-2026-08-30`；独立 worktree，基于 `origin/main@628e5c3`。
- 风险：T3；只补真实 Windows 矩阵与回归证据，未修改生产导出语义、未做数据迁移、未发布安装包/Tag/Release。
- 回滚：回退 PR #341；不会影响用户设置或已有导出文件。
- 外部记录：PR #341、Issue #87；CI 最终结论以 PR required checks 为准。
- 完成后：按 [`NEXT.md`](NEXT.md) 执行 #234，不自动开始。

## 文档职责

- `docs/NEXT.md`：唯一当前任务，最多 120 行，无历史。
- `docs/AI-HANDOFF.md`：当前版本状态和外部风险摘要，最多约 150 行。
- `docs/handoff/v0.11.md`：v0.11 已完成切片的短记录。
- `docs/handoff/v0.10.md`、`v0.9-and-earlier.md`：只读历史摘要。
- `docs/ROADMAP.md`：版本目标和跨切片顺序。
- `docs/ISSUE-INDEX.md`：Issue 分类、Ready 状态与治理规则。
