# Moyang Reader — AI 任务队列

> 后续 AI 默认从上到下处理任务。只要更早任务处于 `IN_PROGRESS` / `WAITING`，或已有**与该任务对应 / 修改同一范围**的开放 PR，就禁止提前开启后续任务。Dependabot、机器人依赖更新、纯维护或明显无关的开放 PR 不得被误判为“整个产品队列冻结”。一个任务一个分支、一个 PR；不得用 stacked PR、多 Track 并行或额外任务板绕过顺序。完成后改为 `DONE` 并附 PR 号；遇到新问题先确认当前代码和 Issues，避免根据旧审计重复开发。

## 使用原则

- 先解决真实用户路径、文件安全和维护风险，再做抽象或新功能。
- UI 任务必须从“用户能否更快、更清楚、更稳定地完成动作”出发，不为改样式而改样式。
- 旧审计只作为线索，任何问题都必须在当前 `main` 重新确认；已关闭 Issue 不重新实现。
- 前序任务未完成时，后续任务最多可以分析，不得提前编码、提交或创建 PR。
- 开放 PR 只有在对应当前最早任务、修改同一范围或制造实际合并依赖时才算队列阻塞；自动依赖更新和无关维护 PR 只需检查冲突，不阻塞产品任务。
- `BLOCKED_EXTERNAL` 只能标记真正依赖外部设置、证书、凭据或真机的子项；仓库内仍可完成的代码、文档、测试和检查必须拆开继续做。
- 不为了未来 AI / 插件 / RAG 提前建立没有真实内置调用方的空 Provider/Manager/Service。
- v1.0 前的主线只剩：v0.11 收口 → v0.12 可靠性 → v0.13 Freeze/RC → v1.0。
- Reading Inbox、Knowledge、AI、MCP、RAG、插件等长期方向不在当前执行队列，满足对应 Gate 后再提升为 0.5–3 天的小任务。

---

## 已完成基线

### A01 — TS ↔ Tauri 命令契约集中化

**状态：DONE — PR #449**

- 结果：集中维护 Rust 命令名、参数和返回类型；现有 IPC 行为保持不变。

### A02 — 首批只读 IPC 运行时响应校验

**状态：DONE — PR #458**

- 结果：高频只读命令增加轻量 shape 校验；无效返回统一产生稳定错误。

### A03 — 设置与偏好控制器

**状态：DONE — PR #459**

- 关联：#16
- 结果：设置读取、写入、默认值、损坏恢复和保存状态从 `App.tsx` 提取。

### A04 — 文档会话生命周期

**状态：DONE — PR #470**

- 关联：#16
- 结果：打开、草稿、保存、外部修改冲突、切换、关闭与恢复进入独立控制边界。

### A05 — Rust `commands.rs` 第一阶段拆分

**状态：DONE — PR #475**

- 关联：#16 / #194
- 结果：文档识别、解码和元数据提取迁入独立 Rust 模块；IPC/授权行为不变。

### A06 — 统一快速打开 / 文内查找 / 阅读库搜索语义

**状态：DONE — PR #479**

- 结果：三类搜索分别明确“找文件 / 找当前文档文字 / 找阅读库内容”，并统一入口、焦点和空结果语义。

---

## v0.11 — 收口、职责边界与 RC

### A07 — 命令面板变成真正可用的键盘入口

**状态：DONE — PR #481**

- 当前证据：`CommandPalette` 的搜索框保持实际焦点，但活动 `role=option` 缺稳定 ID / `aria-activedescendant` 关联；当前命令集合只覆盖一部分高频动作。
- 目标：补齐 combobox/listbox 语义、活动项可见性和屏幕阅读器状态；把可安全调用的高频动作接入统一列表。
- 非目标：不引入大型模糊搜索库；不把危险文件操作默认塞进面板。
- 验收：↑↓/Home/End/Enter/Esc 可预测；活动项滚入可视区；输入框正确关联活动选项；核心动作状态一致。

### A08 — 右侧上下文面板 Tab 键盘与 ARIA 收口

**状态：DONE — PR #482**

- 当前证据：`ContextPanel` 已有 `tablist/tab/tabpanel`，但缺 roving tabindex、方向键切换和 tab ↔ panel 明确关联。
- 目标：让目录、关联、属性、书签、批注成为标准桌面 Tab 交互。
- 验收：单一 roving tab stop；方向键/Home/End 可预测；`aria-controls`/`aria-labelledby` 对应；关闭后焦点合理归还。
- 推荐验证：组件测试 + a11y E2E。

### A09 — 顶栏与主操作信息架构 / Windows 可读性审查

**状态：DONE — PR #483**

- 关联：#16
- 目标：按“打开/定位 → 阅读/编辑 → 保存 → 次要工具”核对顶栏与 More/设置/导出的优先级，并验证 Windows 100% / 125% / 150% / 200% DPI。
- 非目标：不做品牌视觉大改；不追求移动端响应式。
- 验收：720/900/1240px + 常用 Windows DPI 下无关键控件遮挡/横向滚动；高频动作一眼可辨；次要动作稳定收纳。
- 结果：保存提升为顶栏主操作，并完成 Windows 宽度、DPI、a11y、浏览器与桌面 smoke 回归。

### A10 — CSS / 主题收敛 + 小型视觉回归基线

**状态：DONE — PR #484**

- 关联：#171
- 目标：减少仍有真实重复的硬编码主题规则，并为少量关键状态建立稳定截图基线：空状态、阅读、编辑、快速打开、上下文面板、典型确认弹窗。
- 范围控制：浅/深主题与 720/1240px 为主，不制造庞大截图仓库。
- 验收：语义令牌覆盖继续提升；关键状态无明显视觉漂移；高对比/reduced-motion/a11y 保持通过。
- 结果：新增主题感知的区段辅助文字令牌，补齐浅/深主题与高对比度检查，并建立 6 类状态的浅/深色截图基线；720/1240px 布局、完整浏览器/a11y 与 Windows desktop smoke 均通过。

### A11 — 提取 Workspace Session / 工作区生命周期

**状态：DONE**

- 关联：#16
- 当前证据：`App.tsx` 在设置与文档会话拆出后，仍承担工作区载入、挂载/切换、会话恢复、扫描/刷新与 watcher 协调等大量职责。
- 目标：把工作区打开、挂载/切换、session restore、扫描状态和 watcher 生命周期收敛到明确 controller/service 边界。
- 用户价值：工作区相关改动不再要求理解整个 App；为大工作区性能和后续 Reader+ 功能建立稳定入口。
- 非目标：不追求把 `App.tsx` 拆到某个行数；不重写索引算法；不改变持久化格式。
- 验收：现有多资料库、恢复、切换、外部变更路径行为等价；新增针对性测试；App 主要负责装配和视图连接。
- 结果：新增 `WorkspaceSessionController`，收敛工作区载入、缓存/session、扫描刷新、挂载限制、过期请求保护与 watcher 生命周期；`App.tsx` 保留装配、视图连接和当前文档外部变更决策。全量 Vitest 421 项、Playwright 104 项（单独重跑抖动用例通过）、Windows desktop smoke 17 项、lint、格式检查与生产构建通过。

### A12 — 稳定错误码契约第一阶段

**状态：DONE**

- 关联：#111 / #194
- 目标：为高价值 TS↔Rust/桌面失败路径建立 `code + message/details` 模型，优先文件访问、保存/恢复、工作区、导出和更新。
- 用户价值：错误提示可本地化、可测试，不依赖英文/中文自然语言关键词猜类别。
- 非目标：不一次迁移全部历史错误；不引入重量级错误框架。
- 验收：关键失败可按稳定 code 分类；更新器不再主要依赖自然语言关键词；未知错误仍有安全 fallback；zh-CN/en-US key 一致性可验证。
- 结果：新增 TS/Rust 共享语义的稳定错误 envelope 与归一化 fallback；文件访问、工作区、批注和 PDF 导出首批命令返回 `code + message/details`；更新器按稳定 code 本地化；补充中英文 key 一致性、IPC 错误归一化与 Rust 序列化测试。完整 Vitest 429 项、Rust 单测 55 项、lint、格式检查、文档检查与生产构建通过。

### A13 — v0.11 RC / 发布预检

**状态：DONE**

- 目标：把当前 `main` 压成一个可真实安装和回归的候选版本，而不是继续加功能。
- 核心旅程：首次启动 → 添加阅读库 → 快速打开 → 阅读 → 文内搜索 → 批注/书签 → 编辑 → 保存 → 外部修改 → 关闭/恢复 → 导出。
- 发布检查：安装包、PDF 落盘、更新检查、恢复、版本/manifest/签名事实一致；GitHub Release 作为 updater metadata 权威源，Cloudflare 仅作镜像/备用源，自动检查必须阻止 endpoint 顺序回退。
- CI 规则：桌面功能正确性 smoke 作为 PR 阻断门禁；共享 Runner 上的性能毫秒阈值进入独立 scheduled/manual benchmark，不以单轮抖动伪装成功能回归。
- 外部规则：无法执行的真实 Windows/证书条件必须精确记录为 `BLOCKED_EXTERNAL` 子项，不能用 CI 绿灯替代真机结果，也不能把仓库内可完成的部分一起冻结。
- 验收：形成可追溯 RC 结果；只把真实阻断问题拆成独立小任务。
- 结果：完成 v0.10.14 基线的 RC 预检和在线资产核验；`release:check`、`release:status`、22 项发布测试、33 项工作流/架构测试通过，PR #486 的 Quality checks 通过并包含 104 项 Playwright、17 项 Windows desktop smoke、Rust 与发布门禁。确认 GitHub Release 的安装包、`.sig`、`latest.json` 与公开镜像版本/大小/HTTP 状态一致；修正文档中的镜像优先旧文案，并加入顺序倒置检查。旧版 Windows 自动更新实机、Cloudflare 静态镜像 Secret、NSIS Authenticode 证书继续作为 `BLOCKED_EXTERNAL` 记录在 `docs/release-status.json`，未伪装成完成。

### v0.11 Exit Gate

进入 B01 前必须满足：

- A07–A13 完成；
- 新功能不再默认继续堆进 `App.tsx`；
- 高频跨层错误有稳定 code；
- 常见窗口宽度/DPI 高可用；
- RC 主旅程完成，外部阻塞项状态真实；
- updater 权威源/镜像顺序有自动回归检查，性能 benchmark 与 correctness gate 已分离。

### A14 — v0.11 Release / Publish Candidate

**状态：TODO**

- 目标：把已经完成 A07–A13 的当前 `main` 形成可安装、可验证的 Windows x64 `v0.11` 发布候选；B01–B04 已完成，在该任务完成前不继续 B05/B06。
- 版本交付：统一 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 版本号，更新 `CHANGELOG.md` 与发布说明，生成并核验 Git tag、NSIS 安装包、updater `.sig`、`latest.json`、GitHub Release 与 SHA-256。
- 发布门禁：运行前端、Rust、浏览器、a11y、Windows desktop correctness smoke、发布检查和 Release 测试；合并发布提交后再推送 tag，由 Release workflow 构建并创建非 Draft、非 Pre-release Release。
- 外部事实：旧版 `v0.10.14 → v0.11` 实机升级、Cloudflare 静态镜像 Secret、NSIS Authenticode 证书必须分别记录为 `verified` 或精确的 `BLOCKED_EXTERNAL`，不能用 CI 结果替代。
- 非目标：不借发布准备继续增加产品功能，不重做索引算法、IPC 或 Rust 行为；B05/B06 只能在 A14 的发布结果明确后恢复执行。

---

## v0.12 — 可靠性、性能与真实使用

### B01 — 可重复的大工作区性能基准

**状态：DONE**

- 目标：把 5k / 20k 文件工作区的扫描、冷搜索、暖搜索变成可重复 benchmark。
- 产物：固定语料生成器 + JSON 报告 + scheduled/manual benchmark；PR correctness CI 不设脆弱的单轮毫秒硬门槛。
- 判定：优先比较多轮统计、趋势和固定环境；只有证明低波动、可重复后，性能指标才允许升级为 required gate。
- 用户价值：性能优化基于证据，不靠感觉。
- 结果：新增仅在 `#[ignore]` 基准入口中运行的 Rust 大工作区 benchmark，默认生成 5k/20k、每 500 个文件分桶的确定性 Markdown 语料，分别测量扫描、冷搜索和暖搜索，并输出含原始多轮样本、min/median/p95/max 的 JSON 报告；`.github/workflows/desktop-benchmark.yml` 保持 scheduled/manual 触发并上传报告，不进入 PR correctness gate。本机 5k/20k smoke（各 1 轮、3 次暖搜索）成功，报告示例与边界记录见 [`handoff/b01-workspace-benchmark.md`](handoff/b01-workspace-benchmark.md)。

### B02 — 大文件阅读与编辑降级策略

**状态：DONE — PR #489**

- 目标：测量 1MB / 10MB Markdown 的首次可读、编辑切换、搜索、保存、内存和交互延迟。
- 验收：形成明确阈值；超过阈值时关闭昂贵能力或提示只读/源码模式，而不是卡死。
- 非目标：先测量，不先假设优化方案。

- 当前结果：基于 Windows desktop E2E 测得未保护的 1 MiB 富文本路径超过 10 分钟 runner 上限；已将 Markdown `>= 512 KiB` 默认保持为源文本模式，保留 CodeMirror 原生查找和保存，并在富文本切换时给出说明。1 MiB / 10 MiB 两组复测均通过；详见 [`handoff/b02-large-document.md`](handoff/b02-large-document.md) 和 PR #489。

### B03 — 稳健阅读位置 / Resilient Reading Anchor

**状态：DONE — PR #491**

- 当前证据：现有位置主要是 `{ path, top }`，并有有限历史容量；长期开大量文档或正文结构变化后恢复不够稳健。
- 目标：兼容旧数据，新增 `headingId + relativeOffset/progressRatio + scrollTop fallback + updatedAt` 等稳定定位信息。
- 数据原则：第一版不必保存正文 quote/context，避免为了定位复制用户正文；确有需求再单独做隐私/数据设计。
- 验收：旧数据可迁移/回退；正文前部插入内容后仍能大致回到原阅读区域；历史容量不再只适合少量短期文档。

### B04 — Tauri 权限库存与负向安全测试

**状态：DONE — PR #493**

- 目标：列出 `opener` / `process` / `updater` 的真实调用点，并补危险协议、未授权路径和 capability 拒绝测试。
- 用户价值：1.0 前证明最小权限，而不是为了“看起来安全”盲目删 capability。
- 验收：危险/未知协议拒绝；正常 http/https/mailto/tel 与更新流程不回归；未授权文件路径无法绕过 Rust/Tauri 边界。
- 结果：外部链接在 bridge 边界收紧为 http/https/mailto/tel；Tauri opener/process/updater capability 改为最小调用集合；补齐前端、配置和 Rust 负向测试，并通过浏览器、桌面和 Rust CI 门禁。

### B05 — 当前 main 的真实主流程 UX 回归

**状态：TODO**

- 目标：直接从当前 `main` 走真实主流程，不重建大而全旧审计表。
- 检查维度：步骤是否多余、反馈是否及时、按钮是否可理解、焦点是否丢失、取消是否安全、错误是否能恢复、同一动作是否存在多套语义。
- 输出规则：只把可复现且值得修的问题追加为 0.5–3 天的小任务。

### B06 — 用户主动导出的本地诊断摘要

**状态：TODO**

- 目标：让用户在不上传文档正文和密钥的情况下，导出版本、平台、已启用能力、最近错误 code、性能摘要和必要的脱敏环境信息。
- 非目标：不做默认遥测；不上传全文、API Key、私钥；路径默认脱敏/归一化。
- 验收：诊断文件能帮助复现大多数运行/发布问题；关闭功能不影响核心 Reader。

### v0.12 Exit Gate

进入 v0.13 Freeze 前必须同时满足：

- 20k 文件工作区有已测量且可解释的行为边界；
- 10MB Markdown 即使不能完整编辑，也不会无提示卡死或冒险写坏文件；
- 阅读位置不再只依赖有限数量的绝对 `scrollTop`；
- 危险协议、越权路径和关键 capability 有负向测试；
- 完整真实用户旅程重新走通；
- 无未处理的高严重度文件安全问题；
- 阻断级 P1/P2 产品问题已修复或有明确延期理由。

---

## v0.13 — Freeze / Compatibility / RC

### C01 — 设置 / IPC / 快捷键兼容矩阵

**状态：TODO**

- 目标：冻结 v1.0 需要稳定的设置 key/schema、关键 IPC、command ids、核心快捷键和主要保存行为。
- 验收：旧配置、损坏配置、迁移和 fallback 有自动或手工可追溯结果。

### C02 — 文件异常恢复矩阵

**状态：TODO**

- 目标：覆盖磁盘满、只读、外部删除、外部修改、异常退出、临时文件残留、备份与恢复入口。
- 验收：所有失败路径优先保留用户内容，不出现静默覆盖/清理。

### C03 — 发布链路与安全披露收口

**状态：TODO**

- 关联：#51 / #227 / #241
- 目标：校验版本/tag/manifest/package 一致性，完成 `SECURITY.md` / 安全披露说明，并把 Windows 实机/签名事实写清楚；GitHub Private Vulnerability Reporting 仅把“仓库设置中开启入口”保留为外部子项。
- 更新器：验证 GitHub Release 权威 metadata → Cloudflare 镜像备用顺序、`latest.json`/安装包/`.sig` 一致性，以及真实旧版 → 新版升级闭环。
- 规则：无 Authenticode 证书时明确披露限制与哈希核验，不把 updater `.sig` 误称为 Windows 代码签名。

### C04 — v1.0 RC 稳定化

**状态：TODO**

- 目标：只接受阻断发布的缺陷修复，停止大型产品功能和非必要重构。
- 验收：至少一个 RC 完成完整前端、Rust、浏览器、desktop、a11y、performance、release 和真实 Windows 核验矩阵；结果可追溯。

### 外部条件项

- **Windows 安装/升级实机闭环 — BLOCKED_EXTERNAL**：#241，需要真实 Windows x64 旧安装环境；v1.0 前至少成功跑通一次完整旧版 → 新版升级链路。
- **Windows Authenticode — BLOCKED_EXTERNAL / NON-FATAL IF DISCLOSED**：#51；有证书时接入，没有时明确披露和哈希核验，不无限期阻塞 1.0。
- **Private Vulnerability Reporting 开关 — BLOCKED_EXTERNAL**：#227；只有 GitHub 仓库设置中的“开启私密报告入口”依赖维护者操作。`SECURITY.md`、披露文案和不引导公开 Issue 提交敏感细节的仓库内部分不得因此挂起。

---

## v1.x 候选池（当前不可直接开发）

这些不是当前 TODO，状态统一视为 **GATED**：

- **v1.1 Reader+**：Reading Inbox / 手动 URL 导入 / Queue / Digest / Offline Assets；基本闭环先于 RSS/AI/MCP。
- **v1.2 Metadata / Knowledge**：Quick Capture → frontmatter round-trip safety spike → 简单 Properties → 只读表格；Daily Note/collection 按真实需求再立项。
- **v1.3 AI**：先做一个真实选区解释/翻译动作，再从真实调用提炼 `AiProvider` / `ConsentScope` / secret storage；禁止 mock-first 架构工程。
- **v1.4+ Interop / Extensions**：PDF text extraction、EPUB、声明式扩展、OpenAI-compatible/local provider、RAG、read-only MCP、RSS。
- **更晚**：第三方代码插件、插件市场、Agent 大规模写文件、云同步、跨平台、内置大模型。

只有对应前置 Gate 满足且用户价值明确后，才把**下一个**候选提升到本文件成为可执行任务。

---

## 维护规则

- 队列只保留约 10–25 个近期可执行或即将执行的任务；长期候选留在 ROADMAP/FUTURE PLAN，不把本文件变成愿望清单。
- 新任务优先复用现有 Issue；如果 Issue 已关闭，先确认是否真的回归，再决定是否新开。
- 不需要任务 digest、审批 JSON、动态 state 文件或生成 NEXT。
- 用户临时改变优先级时，直接移动 Markdown 条目，但必须同时更新依赖/Gate 说明。
- UI/UX 新问题必须带最短复现路径和用户影响；“看起来可能不好”不直接进入开发队列。
- 新 CI Gate 必须能说明它要阻止哪一类真实回归；不为治理本身增加治理。
- 性能指标默认进入 benchmark/趋势证据，不直接与 correctness gate 混用；要升级为 required gate 必须先证明稳定、可重复、低噪声。
- `BLOCKED_EXTERNAL` 必须写清“外部子项”和“仓库内仍可做部分”，避免制造假阻塞。
