# Moyang Reader 唯一下一步

- 当前状态：IMPLEMENTED（#362 交互与渲染微成本包，等待 PR 质量检查）。
- 当前主线基线（本切片开始）：`main@28bf09d88f3eb379897c31adbdeda5ef426b2adc`；实现分支：`codex/perf-micro-cost-2026-08-31`。
- #361 已通过 PR #390 合并并关闭；本切片只允许一个主要分支和一个 PR。
- 稳定版本：`v0.10.13`；当前 milestone：`v0.11.0`。
- 本轮不生成安装包、Tag、Release 或 Cloudflare 镜像；稳定批次完成后统一发布 Windows x64 安装包。
- 本切片完成 PR、Issue 状态和交接同步后停止；下一项必须重新检查 Issues，不自动开始。

## 最近完成：#369 回收站删除与保存上一版本保护

- 优先级：Should / P2；风险级别：T3（删除语义、保存安全和 Windows 原生文件系统）。
- Issue：[#369](https://github.com/MY-moss/moyang_Reader/issues/369)

### 目标

- 删除工作区文件或文件夹时使用 Windows 回收站语义；回收站操作失败时明确报错并保留原内容。
- 每次成功保存文本文件时滚动保留一份 `.文件名.moyang.bak`，用于识别和恢复上一保存版本。
- 恢复前复用现有差异预览，恢复只进入编辑区，仍需用户显式保存。

### 非目标

- 不做多级版本历史、独立回收站 UI、云同步、跨平台支持或 DOCX/PDF 原格式回写。
- 不改变现有删除确认、文件监听、标签页和未保存保护契约。
- 不顺手扩展撤销、导出、更新器或其他 Issue。

### 已实现

- Windows 使用 `SHFileOperationW + FOF_ALLOWUNDO`，不再调用永久删除；扩展长度路径在进入 Shell API 前转换为兼容路径。
- 删除文件时将对应 `.moyang.bak` 一并送入同一回收站操作，避免留下无主备份；文件夹递归语义保持不变。
- `write_text_file` 在原子替换前滚动写入上一版本备份；写入失败时保留旧备份，不静默覆盖或丢失恢复材料。
- 新增上一保存版本读取边界、正文提示、差异预览和“恢复到编辑区”动作；恢复后不自动写盘。
- 工作流清理测试隔离本机共享 Cargo 缓存，避免本机环境污染测试产物判断。

### 验收与验证

- 前端定向测试：3 个文件、14 项通过。
- Rust：编译、格式、上一版本滚动测试、删除工作区条目测试通过。
- 工作流测试：13/13 通过；Lint、格式检查、`git diff --check` 通过。
- Windows Tauri desktop smoke：14/14 通过，覆盖真实保存、`.moyang.bak` 内容、差异查看、恢复到编辑区和显式保存。
- 远程 Quality checks：run `33367813186` success；Rust dependency audit：run `33367921971` success。

### 限制、回滚与发布

- Windows 回收站对特殊路径、网络盘或系统禁用回收站可能无法接收内容；失败时应用不执行永久删除。最终发布前仍需在目标 Windows 环境手动确认 Explorer 还原路径。
- `.moyang.bak` 是每个文本文件旁的一份滚动备份，不是多级历史；超大文件策略沿用现有文本大小边界。
- 回滚方式：回退本切片 PR；不需要数据迁移，不触碰用户其他笔记。
- 本切片不单独更新版本或安装包；合入后纳入 `v0.11.0` 稳定批次。

## 最近完成：#359 撤销历史从全量快照收敛为稳定粒度

- 优先级：Must / P2；风险级别：T2（编辑体验、内存和撤销正确性）。
- Issue：[#359](https://github.com/MY-moss/moyang_Reader/issues/359)；PR：[#388](https://github.com/MY-moss/moyang_Reader/pull/388)；合并提交：`5f8fba3a37d429aa052add4543832b096ee28da5`。
- 目标：降低长文档连续编辑时全量快照造成的内存和历史噪声，同时保持 Ctrl+Z/Ctrl+Y、切换文档和保存语义稳定。
- 非目标：不改 Markdown 解析、保存格式、草稿恢复、版本备份或其他编辑器功能。
- 实现：编辑器输入在 400ms 窗口内合并为一个撤销组；历史仍最多 100 个快照，并对保留的 past/future 快照增加 8 MiB UTF-16 估算上限；程序化更新保持原子边界。
- 涉及文件：`src/app/editor-history.ts`、`src/app/editor-history.test.ts`、`src/app/App.tsx`、`e2e/smoke.spec.ts` 及本切片交接文档。
- 结果：定向单测 6/6、TypeScript 检查、生产构建、源码连续输入浏览器 E2E 1/1、跨模式撤销/重做回归 E2E 1/1、完整 lint/format/diff 检查均已通过；远程 Quality checks run `33386166171` 成功，Issue 已关闭。
- 发布边界：不单独生成安装包、Tag、Release 或 Cloudflare 镜像；合入后纳入 `v0.11.0` 稳定 Windows x64 批次。
- 回滚方式：回退本切片提交；不需要数据迁移，Markdown 文件内容和保存协议不变。

## 最近完成：#361 暗色主题 accent 按钮对比度修复

- 优先级：Should / P2；风险级别：T2（视觉可读性与 WCAG AA）。
- Issue：[#361](https://github.com/MY-moss/moyang_Reader/issues/361)；PR：[#390](https://github.com/MY-moss/moyang_Reader/pull/390)；合并提交：`41acf808a54683e9ed4b2f7a1d15cdc132c8629d`；已关闭。
- 目标：修复暗色主题下编辑器“插入”、插入面板提交和通用主按钮的浅色 accent 底配白字问题，使正文、悬停、焦点和禁用状态可读且不破坏亮色主题。
- 非目标：不重做整个主题、不处理 #362 渲染成本、不引入颜色库、不顺手修改其他视觉/交互 Issue。
- 预计范围：`src/app/styles.css`、`e2e/a11y.spec.ts` 和必要的 UI 交接文档；优先复用现有深色令牌，不增加运行时依赖。
- 验收：暗色自动/显式主题下受影响按钮的实际前景与背景对比达到 WCAG AA 4.5:1；hover/focus 仍达标；亮色、键盘焦点、插入动作和现有 a11y smoke 不回归；检查覆盖两个暗色分支和通用 `.toolbar-button.primary`。
- 版本与发布：v0.11.x 普通视觉切片；不单独生成安装包、Tag、Release 或 Cloudflare 镜像。
- 当前实现：增加独立的实心按钮色令牌；暗色自动/显式主题的编辑器插入、插入提交和通用主按钮使用可读的深色底配白字，hover/focus 不再被通用浅色 hover 覆盖；Windows 强制高对比度改用系统按钮色。
- 本地验证：`npm run build` 通过一次；`e2e/a11y.spec.ts` 7/7、`npm run lint`、`npm run format:check` 和 `git diff --check` 通过；远程 Quality checks run `33392327386` 通过；已明确关闭 Issue。
- 回滚方式：回退本切片提交；不涉及文档格式、用户数据或迁移。

## 当前切片：#362 交互与渲染微成本包

- 优先级：Should / P3；风险级别：T2（交互流畅度、本地草稿持久化和差异计算）。
- Issue：[#362](https://github.com/MY-moss/moyang_Reader/issues/362)；当前状态：实现完成，待 PR 合并后关闭；不与 #361 混合开发。
- 目标：降低面板拖动时的全 App 重渲染与重复持久化，减少草稿链路对 localStorage 的重复全量 parse，并避免差异弹层每次状态 tick 重算全文 diff。
- 非目标：不改变面板、草稿、差异展示语义；不引入专用数据库，不改 Markdown 真源，不顺手处理其他性能或 UI Issue。
- 预计范围：`src/app/PaneResizeHandle.tsx`、`src/app/App.tsx`、`src/app/draft-recovery.ts`、`src/app/components/DraftRecoveryComparisonDialog.tsx` 及对应测试；先测量再做最小拆分。
- 实现：拖动期间只更新 app-shell CSS 变量，pointerup/cancel/lost-capture 才提交 React 状态和持久化；草稿存储按原始序列化内容复用解析结果，保存结果直接携带最新快照列表，查找与列表加载共用一次读取；差异计算按来源、状态和草稿内容 memo。
- 验收：定向单测 17/17、全量前端单测 76 文件/300 项、TypeScript、Lint、格式检查、生产构建和侧栏拖拽浏览器 E2E 1/1 通过；草稿 parse 回归探针在查找与保存链路中仅执行 1 次。
- 验证级别：T2，相关单测/性能探针、前端 lint/format/build 和一个浏览器 E2E；不单独生成安装包、Tag、Release 或 Cloudflare 镜像。
- 回滚方式：回退本切片提交；无数据迁移，保留现有存储格式。

## 开始前快速检查

1. 查看 Issues/PR，确认没有重复的 #362 工作；记录提交 SHA、PR 和 CI run_id。
2. 读取 [`AI-WORKFLOW.md`](AI-WORKFLOW.md) 和本文件，只读取与当前切片相关的源码、测试及一个相似实现。
3. 保持原始工作目录不动；所有新切片使用项目内 `.codex-worktrees/` 的独立工作树。
4. 完成验证、提交、推送、PR 和交接后停止，不自动开始下一项。

## 快速触发

继续开发 Moyang Reader 时，只执行本文件唯一的 IN PROGRESS/READY 事项；若事项已完成，先更新本文件和交接，再从最新 `main` 重新检查 Issues，不得凭历史上下文猜测下一项。
