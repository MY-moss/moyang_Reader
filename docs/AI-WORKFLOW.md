# Moyang Reader AI 开发工作流

本文件只定义长期有效的开发流程，不记录动态候选或历史任务。当前唯一任务以 [`NEXT.md`](NEXT.md) 为准，版本摘要以 [`AI-HANDOFF.md`](AI-HANDOFF.md) 为准，产品与发布规则分别见 [`REQUIREMENTS.md`](REQUIREMENTS.md) 和 [`RELEASE-POLICY.md`](RELEASE-POLICY.md)。

Moyang Reader 只维护 Windows x64 桌面版。浏览器版仅用于本地预览和 Playwright 测试；不因一个切片新增 macOS、Linux、Windows ARM、移动端、云同步或脚本插件范围。

## 给任何 AI 的快速启动指令

```text
继续开发 Moyang Reader。先读取 docs/AI-WORKFLOW.md 和 docs/NEXT.md，只把 docs/NEXT.md 视为当前任务事实源；随后只读核对最新 origin/main、开放 PR 和对应 Issue。若文档与远端冲突，先修正交接，不要按过时状态开发。
保护当前工作区的未提交改动，不在脏目录开发；从最新 origin/main 创建独立 codex/<scope>-<date> worktree 和分支。创建后运行 `npm run worktree:prepare -- <worktree-path>`，让工作树复用主工作区的依赖目录。
严格完成 NEXT.md 中的一个垂直切片：确认 READY，实施最小变更，补测试，按风险级别验证，同步文档与 Issue，并创建 PR。门禁全绿且无安全、权限、发布或数据迁移风险时可以合并，否则停在 PR 等待确认。
完成后把结果写入当前版本交接归档，将 NEXT.md 替换为下一个唯一任务，然后停止。除非 NEXT.md 明确要求稳定发布，否则不创建安装包、Tag 或 Release。不要粘贴完整源码、历史交接或 CI 日志，只报告路径、SHA、run_id、结论和阻塞。
```

## 事实源与读取顺序

1. `docs/AI-WORKFLOW.md`：长期流程规则。
2. `docs/NEXT.md`：唯一 READY/Blocked 任务，最多 120 行，无历史。
3. 对应 GitHub Issue、开放 PR 和最新 `origin/main`：实时事实；冲突时先修正 `NEXT.md`。
4. 当前任务直接相关的技能、源码、测试和一个相似实现。
5. `docs/AI-HANDOFF.md`：只在需要稳定版本或外部风险背景时读取。

不要通读 `docs/handoff/` 历史归档。发现任务失效或已完成时停止编码，修正当前交接并明确新的唯一下一步。

## 不可违反的效率规则

- 一个任务只做一个垂直切片、一个主要分支、一个 PR；合并后停止。
- 上下文目标不超过 2000 行，优先使用 `rg`、摘要、路径和行号。
- 工具输出默认限制约 4 KB；失败只保留首个根因和最小上下文。
- 网络、Git 推送和 CI 查询等可恢复失败最多重试 3 次（总计 4 次），逐次确认外部状态；确定性代码失败不盲目重试。
- 不重复查询未变化的 Issue、PR、提交或 CI；CI 记录 SHA、`run_id`、结论和最后变化时间。
- 每个切片最多一次完整构建；仅稳定批次生成 Windows 安装包和 Release。
- 禁止强制推送、覆盖脏工作区、提交 Secret、私钥、用户文档或构建产物。
- `NEXT.md` 失效时先修正交接，不自行改选相邻 Issue。

## 本地空间与工作树卫生

- 项目源码只保留一个真实的 `node_modules`。工作树必须使用 `npm run worktree:prepare -- <worktree-path>` 建立 junction；禁止在每个工作树再次执行 `npm install`，也禁止把依赖目录复制到项目外。
- 所有本地 Tauri/Cargo 命令必须通过 `npm run desktop`、`npm run tauri -- <args>` 或 `npm run rust -- <args>`；包装层会把构建目标固定到 `%LOCALAPPDATA%\\Moyang Reader\\build-cache\\cargo-target`。同一项目的不同工作树和本地副本共用这一个目标目录；即使 `CARGO_TARGET_DIR` 误指向仓库内，也会自动改到受管缓存，禁止直接运行会写入项目的 `tauri`/`cargo` 构建命令。
- 构建、测试和覆盖率目录都是可再生文件。开始新切片前先运行 `npm run cleanup:workspace` 预览；确认输出后使用 `npm run cleanup:workspace -- --apply --prune-targets` 清理生成物和 Rust 目标。
- 清理器只认识明确的生成目录（`dist`、`coverage`、`test-results`、`playwright-report`、Vite/任务缓存和 Rust 目标）；使用 `--prune-targets` 时也会列出旧版按路径分组的共享 Rust 缓存，不会触碰源码、文档、用户笔记或主工作区 `node_modules`。
- 工作树回收是额外动作：只有确认不再需要时才使用 `--apply --prune-worktrees`。脏工作树、包含 junction/符号链接的工作树会自动保留，不能使用 `git worktree remove --force`。
- 资源管理器可能把 junction 目标重复计入“大小”。排查空间时以清理器的实际文件大小为准，并检查 `git worktree list --porcelain`；项目外出现的临时副本一律停止使用并记录路径。

## 阶段门禁

### INTAKE

只检查一次当前 Issue/反馈、开放 PR 和最新主线，确认用户价值、是否重复、优先级和非目标。没有价值、属于 Won't 或已被其他 PR 完成时停止。

### READY

编码前确认目标、非目标、验收、预计修改范围、依赖、风险、回滚、测试级别、版本分类和发布边界；同时确认当前分支、工作区、主线 SHA 和 Issue 状态。缺一项就不是 READY。

### DISCOVERY

用 `rg` 定位符号，只读相关源码、测试和一个相似实现。事实摘要不超过一页；发现范围扩大时回到 READY，不顺手处理。

### DESIGN

用一页以内说明现状、最小变更、状态/数据边界、异常路径、测试和回滚。只有难以逆转、结果意外且存在真实权衡时才写 ADR。

### IMPLEMENT

实现一个完整用户路径，同步必要测试、文案和工程文档。禁止顺手重构、升级依赖、修改主题或加入下一版本功能。

### VERIFY

| 级别 | 适用范围                                         | 最小验证                                                        |
| ---- | ------------------------------------------------ | --------------------------------------------------------------- |
| T0   | 纯文档、模板、统计脚本                           | 目标文件格式/链接检查、脚本最小运行、`git diff --check`         |
| T1   | 普通逻辑、解析、索引、状态                       | 定向单测/集成测试、相关 lint/format                             |
| T2   | UI、交互、快捷键、布局                           | T1 + 一个相关浏览器 E2E；真实桌面路径再加 Windows desktop smoke |
| T3   | 更新器、签名、发布、保存安全、原生 IPC、数据迁移 | 完整质量门禁、一次构建、真实 Windows 验证和发布检查             |

完整门禁使用仓库已有脚本：lint、format、前端测试/coverage、构建、浏览器 E2E、desktop E2E、Rust fmt/clippy/test、release check 和 release tests。按风险选择，不在 T0/T1 机械重复全套。

### CHECKPOINT

1. 检查 diff、修改文件数和敏感内容。
2. 创建目的清晰的原子提交并推送功能分支。
3. 创建一个 PR，填写模板并记录 `sha/workflow/run_id/conclusion/last_changed_at`。
4. 无真实冲突且门禁全绿时可合并；权限、安全、发布、更新器和数据迁移风险必须等待人工确认。
5. 合并后立即停止，不在同一聊天开始下一切片。

### RELEASE

纯文档、测试、模板、CI 和内部工具不创建安装包。只有 `NEXT.md` 明确进入稳定批次发布，或重要保存/更新/签名/安全修复要求用户升级时，才按发布政策生成 Windows x64 Release、安装包、`.sig`、`latest.json` 和镜像，并做旧版更新验证。

### HANDOFF

- 将完成结果追加到 `docs/handoff/vX.Y.md`，不粘贴完整日志。
- 整体替换 `docs/NEXT.md` 为下一个唯一 READY/Blocked 契约。
- 只在稳定事实或外部风险变化时更新 `docs/AI-HANDOFF.md`。
- 同步 Issue/PR/Release 状态，然后停止。

## CI 与失败记录

```text
sha=<commit> workflow=<workflow> run_id=<id> conclusion=<queued|in_progress|success|failure|cancelled> last_changed_at=<UTC> next_action=<poll once|stop|fix root cause>
```

失败时只读取失败 job 的首个根因。代码失败先补复现测试再修复；环境或权限失败保留证据并报告，不换渠道无限尝试。功能切片完成前不得以“部分门禁通过”冒充交付完成。

## 任务上下文模板

```markdown
# Task Context: <短标题>

- 日期：<YYYY-MM-DD>
- Issue/反馈：<#id 或链接>
- 优先级：<Must/Should/Could/Won't>
- 风险级别：<T0/T1/T2/T3>
- 当前基线：<branch + main SHA>
- 版本分类：<无 Release/minor/patch>

## 目标

<一句话用户价值>

## 非目标

- <明确不做的相邻功能>

## 验收标准

- [ ] <可操作标准>

## 预计修改范围

- 源码：<路径/符号>
- 测试：<路径/场景>
- 文档：<路径>

## 依赖与风险

- 依赖：<工具链/外部条件>
- 风险：<数据/性能/权限/回归>
- 回滚：<回退方式>

## 方案

<状态边界、最小实现、异常路径和验证；不超过一页>
```

## 交接模板

```markdown
## AI Handoff — <切片标题>

- 状态：<已完成/阻塞/待审查>
- 分支 / SHA：<branch / full SHA>
- Issue / PR：<#id / #id；状态>
- Release：<无 / vX.Y.Z；理由>
- 完成：<一到三条事实>
- 修改文件：<最多 10 个路径>
- 验证：<命令 → 结果；失败只写根因>
- 已知限制/风险：<没有则写“无”>
- 回滚：<具体动作>
- 唯一下一步：<一个动作；没有则写“等待新的 READY 任务”>

### 效率指标

- 工具调用 / 失败 / 重试：<...>
- 构建 / 测试 / E2E 次数：<...>
- 修改文件数 / 返工次数：<...>
- 是否按时停止并完成交接：<是/否；原因>
```

## 当前停止规则

功能分支合并、交接归档更新、`NEXT.md` 指向下一任务后，本次聊天立即停止。新的切片必须由新的“继续开发”请求触发。
