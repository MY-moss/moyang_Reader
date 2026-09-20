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

### A14 — v0.11 Release / Publish

**状态：DONE — v0.11.0 / Release run 35361595825**

- 目标：把已经完成 A07–A13 的当前 `main` 形成可安装、可验证的 Windows x64 `v0.11` 发布候选；B01–B04 已完成，在该任务完成前不继续 B05/B06。
- 版本交付：统一 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 版本号，更新 `CHANGELOG.md` 与发布说明，生成并核验 Git tag、NSIS 安装包、updater `.sig`、`latest.json`、GitHub Release 与 SHA-256。
- 发布门禁：运行前端、Rust、浏览器、a11y、Windows desktop correctness smoke、发布检查和 Release 测试；合并发布提交后再推送 tag，由 Release workflow 构建并创建非 Draft、非 Pre-release Release。
- 外部事实：旧版 `v0.10.14 → v0.11.0` 实机升级、Cloudflare 静态镜像 Secret、NSIS Authenticode 证书必须分别记录为 `verified` 或精确的 `BLOCKED_EXTERNAL`，不能用 CI 结果替代。
- 非目标：不借发布准备继续增加产品功能，不重做索引算法、IPC 或 Rust 行为；B05/B06 只能在 A14 的发布结果明确后恢复执行。
- 当前结果：`v0.11.0` tag 已指向合并后的 `main@286b1f597102881e577ddae3a7359ad15df422f7`；GitHub Release、NSIS 安装包、updater `.sig`、`latest.json` 和 SHA-256 已在线核验并记录在 `docs/release-status.json`。Release workflow 的主发布 job 与完整质量门禁通过；Cloudflare 静态镜像因 Secrets 缺失保持 `BLOCKED_EXTERNAL`，旧版本自动更新实机和 Authenticode 也保持精确外部阻塞。

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

**状态：DONE — compact context drawer slice**

- 目标：直接从当前 `main` 走真实主流程，不重建大而全旧审计表。
- 检查维度：步骤是否多余、反馈是否及时、按钮是否可理解、焦点是否丢失、取消是否安全、错误是否能恢复、同一动作是否存在多套语义。
- 输出规则：只把可复现且值得修的问题追加为 0.5–3 天的小任务。
- 结果：在 960px 窄窗口复现右侧上下文面板绝对定位覆盖编辑器/正文、且没有遮罩或 Esc 关闭路径的问题；将其明确为可关闭抽屉，补充遮罩点击和 Esc 关闭，并沿用已有触发焦点恢复逻辑。
- 验证：新增紧凑窗口 Playwright 回归，覆盖遮罩层级、遮罩关闭、Esc 关闭和上下文按钮焦点归还；本地 Vitest 448/448、Lint、Build 和 Prettier 通过。

### B06 — 用户主动导出的本地诊断摘要

**状态：DONE — 用户主动诊断摘要切片**

- 目标：让用户在不上传文档正文和密钥的情况下，导出版本、平台、已启用能力、最近错误 code、性能摘要和必要的脱敏环境信息。
- 非目标：不做默认遥测；不上传全文、API Key、私钥；路径默认脱敏/归一化。
- 验收：诊断文件能帮助复现大多数运行/发布问题；关闭功能不影响核心 Reader。
- 结果：设置面板和命令面板都提供“导出诊断摘要”；桌面端使用原有安全保存路径，浏览器预览使用 JSON 下载。报告包含版本/运行时、操作系统类别、WebView/浏览器引擎、视口、能力开关、会话状态、工作区/文档数量与大小、当前会话错误 code 和性能摘要；不写入正文、完整路径、密钥，也不发送遥测。
- 错误记录：IPC 稳定错误码、未处理的窗口异常和诊断导出失败会保留在有界的当前会话环形记录中，只导出 code、时间和安全操作标签，不导出错误消息或 details。
- 验证：新增诊断生成/序列化/错误记录单测；本地 Vitest 104 文件 / 451 测试、Lint、Build、Prettier、浏览器下载回归和设置页 axe 检查通过。边界与隐私字段记录在 [`handoff/b06-diagnostic-summary-2026-09-19.md`](handoff/b06-diagnostic-summary-2026-09-19.md)。

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

**状态：DONE — PR #500**

- 目标：冻结 v1.0 需要稳定的设置 key/schema、关键 IPC、command ids、核心快捷键和主要保存行为。
- 验收：旧配置、损坏配置、迁移和 fallback 有自动或手工可追溯结果。
- 结果：集中维护应用设置/便携备份 schema、全部浏览器持久化 key、命令面板 ID 和应用级核心快捷键；现有读写、CodeMirror 原生 Ctrl+F、外部修改保护和草稿保存语义保持不变。
- 证据：[`handoff/c01-compatibility-matrix-2026-09-19.md`](handoff/c01-compatibility-matrix-2026-09-19.md)；旧快照/坏配置/便携 v1/v2、IPC 名称、命令 ID、快捷键和保存保护均有回归测试。
- 验证：Vitest 105 文件 / 454 项、Lint、生产构建、Prettier、文档检查通过；不升版本、不生成 Release。

### C02 — 文件异常恢复矩阵

**状态：DONE — PR #501**

- 目标：覆盖磁盘满、只读、外部删除、外部修改、异常退出、临时文件残留、备份与恢复入口。
- 验收：所有失败路径优先保留用户内容，不出现静默覆盖/清理。
- 结果：保存失败按冲突、磁盘满、只读、缺失、权限和未知错误分类；失败时先保留草稿，原子写入/备份失败保留临时证据；外部删除单独提示并保留“另存为”入口。
- 验证：Vitest 106 文件 / 464 项、Lint、生产构建、Prettier、Rust 测试、Playwright a11y 和 Windows desktop smoke 18/18 通过；不升版本、不生成 Release。

### C03 — 发布链路与安全披露收口

**状态：DONE — PR #502**

- 关联：#51 / #227 / #241
- 目标：校验版本/tag/manifest/package 一致性，完成 `SECURITY.md` / 安全披露说明，并把 Windows 实机/签名事实写清楚；GitHub Private Vulnerability Reporting 仅把“仓库设置中开启入口”保留为外部子项。
- 更新器：验证 GitHub Release 权威 metadata → Cloudflare 镜像备用顺序、`latest.json`/安装包/`.sig` 一致性，以及真实旧版 → 新版升级闭环。
- 规则：无 Authenticode 证书时明确披露限制与哈希核验，不把 updater `.sig` 误称为 Windows 代码签名。
- 结果：发布状态校验阻止已发布版本的 Release/资产 URL 与 tag、文件名漂移；`SECURITY.md` 和 `docs/UPDATE.md` 已同步 v0.11.0、PVR/Authenticode/旧版升级的真实外部状态和敏感信息处理边界。
- 验证：发布测试 25/25、工作流测试 35/35、文档检查、release:check、release:status、Lint、Build、Prettier、Vitest 106 文件 / 464 项通过；不升版本、不生成新 Release。

### C04 — v1.0 RC 稳定化

**状态：DONE — PR #503、#504、#505、#506**

- 目标：只接受阻断发布的缺陷修复，停止大型产品功能和非必要重构。
- 验收：至少一个 RC 完成完整前端、Rust、浏览器、desktop、a11y、performance、release 和真实 Windows 核验矩阵；结果可追溯。
- 当前结果：修复独立 Windows desktop performance workflow 的 Rust 报告路径。Cargo 单元测试在 `src-tauri` 工作目录运行，原相对路径会把报告写到 `src-tauri/artifacts`，导致上传步骤错误失败；现在使用 `${{ github.workspace }}` 绝对路径，并加入工作流回归测试。
- 性能证据：GitHub Actions [`Desktop benchmark`](https://github.com/MY-moss/moyang_Reader/actions/runs/35393264851) 在 PR #503 分支通过；工作区 5,000 / 20,000 文档、1MB / 10MB 大文档测试和两份报告上传均成功，原始报告留在 Actions artifacts。
- Windows x64 实机证据（2026-09-19）：在隔离临时目录先安装 v0.10.14，再用 v0.11.0 安装包覆盖升级；应用文件版本和卸载注册信息均从 `0.10.14` 更新为 `0.11.0`，升级后应用可启动并保持响应，带 PDF 文件参数启动的入口 smoke 也通过。复现记录见 [`docs/handoff/c04-rc-stabilization-2026-09-19.md`](handoff/c04-rc-stabilization-2026-09-19.md)。
- 应用内 updater 证据（2026-09-19）：使用已安装的 v0.10.14 正式构建，通过真实桌面 WebDriver 点击“检查应用更新”，确认发现 v0.11.0 并点击“下载并安装”；旧 WebView 随安装器退出，随后从文件版本、卸载注册信息和重新启动的进程确认已落到 v0.11.0。该过程未把会话因旧窗口关闭误报为“重启按钮点击成功”。
- 当前结果：仓库内 RC 证据继续沿用 C01–C03 的前端、Rust、浏览器、desktop、a11y 和 release 检查；安装器覆盖升级、应用内 updater 的检查 → 下载 → 安装 → 重启，以及升级后正式 v0.11.0 的 PDF 页面可视化读取均已完成。真实 Edge PDF viewer 显示单页 `1 / 1` 和测试页面文字 `C04 PDF visual check`，没有打开错误提示；完整记录见 [`docs/handoff/c04-rc-stabilization-2026-09-19.md`](handoff/c04-rc-stabilization-2026-09-19.md)。

### 外部条件项

- **Windows 安装/升级实机闭环 — VERIFIED**：#241。已在真实 Windows x64 环境完成隔离的 `v0.10.14 → v0.11.0` 安装覆盖升级、应用内 updater 的检查 → 下载 → 安装 → 重启，以及升级后正式构建的 PDF 页面可视化读取；Edge PDF viewer 显示 `1 / 1` 和 `C04 PDF visual check`，无打开错误。
- **Windows Authenticode — BLOCKED_EXTERNAL / NON-FATAL IF DISCLOSED**：#51；有证书时接入，没有时明确披露和哈希核验，不无限期阻塞 1.0。
- **Private Vulnerability Reporting 开关 — BLOCKED_EXTERNAL**：#227；只有 GitHub 仓库设置中的“开启私密报告入口”依赖维护者操作。`SECURITY.md`、披露文案和不引导公开 Issue 提交敏感细节的仓库内部分不得因此挂起。

---

## v1.0 Freeze / 接手收口（当前阶段）

C04 已完成。正式 v1.0 之前，当前可执行队列先处理事实源、开发环境和架构防膨胀问题；v1.x 产品候选继续保持 `GATED`，不得提前实现。

**冻结契约：当前唯一可执行范围是本节的 `D00–Dxx` 任务；v1.x 候选、Future Issues 和 Future Development Plan 中的条目全部保持 `GATED`。如果没有已定义的 Dxx 任务，必须先重新核对最新 `main`、开放 PR/Issue 和真实开发反馈，再定义下一项；不得直接实现 Reader+、Knowledge、AI、RAG、MCP、RSS 或插件候选。**

### D00 — 修复 v1.0 事实源与接手文档

**状态：DONE — PR #507**

- 目标：让 README、ROADMAP、AI 任务队列、AI 交接摘要和需求文档对当前 `v0.11.0`、C01–C04 完成状态及 v1.0 收口阶段给出一致事实。
- 范围：修正文档版本/阶段漂移，恢复被错误编码破坏的中文文档，移除已废弃的 `plan-v1.json` / `state.json` / `NEXT.md` 实时状态引用；核对 `CHANGELOG.md` 与 `docs/release-status.json`，不改产品代码、版本号或 Release。
- 验收：新人或 AI 只读 `AGENTS.md`、README、ROADMAP、AI-TASKS、AI-HANDOFF、REQUIREMENTS 即可找到唯一当前任务入口；历史 `v0.10.14` 只保留在升级证据等历史语境中；文档和发布状态检查通过。
- 下一项：D00 完成后进入 D01“开发环境说明”；在 D00–Dxx 收口前不开始 Reader+、Knowledge、AI、RAG、MCP 或插件候选。

---

### D01 — 可复现 Windows 开发环境与接手入口

**状态：DONE — PR #508**

- 目标：让新 Agent 或维护者在 Windows x64 上用一套可复现步骤恢复依赖、识别真实前置条件、区分浏览器预览与 Tauri 桌面验证，并判断开放 PR 是否真的阻塞当前任务。
- 范围：新增 `docs/DEVELOPMENT-SETUP.md` 作为开发环境事实源；README、CONTRIBUTING、AI 工作流和接手提示统一链接并使用 `npm ci`；补齐 Node.js 22、Rust 1.88/MSVC、C++ Build Tools、WebView2、worktree、测试分层和 Cargo 缓存说明；修复 `agent:bootstrap` 把 Dependabot/维护 PR 误判为产品队列阻塞的问题。
- 非目标：不改变产品运行时、IPC、Rust 文件行为、索引算法、拼音匹配、版本号或 Release；不为未来 AI、插件、RAG、MCP 创建接口。
- 验收：全新或独立 worktree 可按文档完成 `agent:bootstrap`、`npm ci` 和最小验证；bootstrap 明确列出全部开放 PR 与真正阻塞 PR；文档检查能阻止重新出现 `npm install` 初始化和缺失前置条件；相关脚本测试、文档检查、格式检查和远程 Quality checks 通过。
- 下一项：D01 完成后进入 D02“开发环境自检”；架构防膨胀与 App/commands 收口另行定义为后续独立任务。

### D02 — 开发环境自检 `doctor`

**状态：DONE — PR #509**

- 目标：让新 Agent 或维护者运行一次 `npm run doctor` 就能知道当前机器是否具备 Windows x64 桌面开发的关键前置条件。
- 范围：检查 Windows/x64、Node.js/npm、Rust/Cargo、`x86_64-pc-windows-msvc` target、MSVC C++ Build Tools、Windows SDK、WebView2、`node_modules` 核心依赖和 Git 工作树状态；输出通过、警告、失败和跳过。
- 非目标：不自动安装依赖或工具，不修改系统设置，不创建环境变量，不覆盖未提交改动，不改索引算法、IPC、Rust 文件行为、版本号或 Release。
- 验收：缺失前置条件有明确可执行提示；非 Windows 主机明确失败并跳过 Windows 专属检查；工作树改动只产生警告；脚本有隔离单测并接入 workflow 检查；setup 文档给出标准首次运行路径。
- 下一项：D02 完成后先根据最新 main、开放 PR 和真实开发反馈重新定义唯一的 D03；在 D00–Dxx 收口前不开始 Reader+、Knowledge、AI、RAG、MCP 或插件候选。

### D03 — 标准首次运行验证路径

**状态：DONE — PR #511**

- 目标：把独立 worktree 的首次运行收敛为 `npm ci → verify:dev → desktop`，让维护者先得到可解释的开发验证结果，再进入真实 Tauri 桌面调试。
- 范围：新增 `npm run verify:dev`，依次执行只读 `doctor`、workflow helper tests、Vitest、Lint、架构边界检查和生产构建；setup 文档明确通过后再运行 `npm run desktop`。
- 非目标：不自动安装依赖，不启动交互式桌面进程，不跑 Playwright/desktop smoke 或 benchmark，不把完整 Release 流程塞进日常验证，不改产品运行时、IPC、索引算法、Rust 文件行为、版本号或 Release。
- 验收：验证阶段顺序稳定且首个失败即停止；测试覆盖不包含 desktop、E2E、benchmark、Release；独立 worktree 可按文档完成首次路径；脚本、文档、格式、Lint 和 Build 门禁通过。
- 下一项：D03 完成后进入 D04“v1.0 Freeze 执行契约”；在 D00–Dxx 收口前不开始 Reader+、Knowledge、AI、RAG、MCP 或插件候选。

### D04 — v1.0 Freeze 执行契约

**状态：DONE — PR #513**

- 目标：把 v1.0 前的范围冻结规则变成所有 Agent 都能直接执行、文档检查能够阻止漂移的明确契约。
- 范围：在 AI 任务队列中声明唯一可执行范围为 `D00–Dxx`；把 `v1.x` 与 `FUTURE-DEVELOPMENT-PLAN.md` 的候选统一标为 `GATED`；README、AI 工作流和长期计划明确不能提前实现 Reader+、Knowledge、AI、RAG、MCP、RSS 或插件候选；补充文档一致性测试。
- 非目标：不实现任何 v1.x 产品功能，不新增 provider/plugin/RAG/MCP 接口，不改产品运行时、IPC、索引算法、Rust 文件行为、版本号或 Release，不批量修改无关 Issue。
- 验收：新 Agent 只读 README、AI-TASKS、AI-HANDOFF、AI-WORKFLOW 和 Future Development Plan 时，不能合理推导出当前可以直接开始 v1.1 功能；`check:docs` 和相关测试在冻结契约缺失时失败。
- 下一项：D04 完成后进入 D05“架构复杂度预算”；在 D00–Dxx 收口前继续保持 v1.x GATED。

### D05 — 架构复杂度预算

**状态：DONE — PR #515**

- 目标：让大型编排点的继续增长变得可见、可解释，并在显著超出预算时阻止继续堆叠领域逻辑。
- 范围：新增 `scripts/architecture-budget.json`，为 `App.tsx`、`commands.rs`、`export.ts` 和 `styles.css` 记录规范化字节/行数基线与允许增长；扩展 `architecture-guard` 在超出增量预算时失败，并补充超预算 fixture 测试；把预算检查保留在现有 `check:architecture` / `verify:dev` 路径。
- 非目标：不按总行数机械重构，不拆分文件、不改变产品运行时、IPC、索引算法、Rust 文件行为、版本号或 Release，不把一次正常的小修复误判成必须架构迁移。
- 验收：当前 main 的四个大型编排点通过预算；超出字节或行数增量的隔离 fixture 被 guard 拒绝；预算字段、职责所有者和“只在架构任务中调整基线”的规则有文档说明；workflow、Lint、Build、格式和远程 Quality checks 通过。
- 下一项：D05 完成后进入 D06“App.tsx 文内查找编排提取”；不进行一次性大重写。

### D06 — App.tsx 文内查找编排提取

**状态：DONE — PR #517**

- 目标：把文内查找的状态、焦点恢复、输入防抖、正文高亮和结果导航收敛到独立的 controller，让 `App.tsx` 继续负责页面装配而不是持有整段查找生命周期。
- 当前证据：最新 `main` 的 `App.tsx` 仍包含文内查找的 4 组状态、3 个焦点/高亮 ref、搜索生命周期 effect 和入口回调；Issue #16 仍开放。开放 PR 只有无关 Dependabot，未发现新的预算超限代码证据。
- 范围：新增文内查找 controller 与定向测试；迁移 `App.tsx` 的文内查找状态、`Ctrl+F` 文本入口、搜索按钮/编辑器/正文焦点归还、正文高亮和上一条/下一条结果导航；阅读库搜索、快速打开、CodeMirror 原生 `Ctrl+F`、IPC、索引算法和数据格式保持不变。
- 非目标：不一次性重写 `App.tsx`，不迁移当前阅读库搜索或全局快捷键注册，不新增 Provider/插件/RAG 接口，不改变产品运行时、IPC、Rust 文件行为、版本号或 Release。
- 验收：文内查找现有 Playwright/组件行为等价；新增 controller 测试覆盖焦点归还、防抖结果和结果导航；App 只保留入口装配；workflow、Vitest、Lint、Build、格式和远程 Quality checks 通过。
- 下一项：D07“App.tsx 阅读位置恢复与保存编排提取”；不自动推进长期 v1.x 候选。

### D07 — App.tsx 阅读位置恢复与保存编排提取

**状态：DONE — PR #519**

- 目标：把阅读位置恢复、滚动位置采集、锚点计算和延迟保存从 `App.tsx` 收敛到独立 controller，保留阅读位置在文档切换和渐进式渲染下的稳定行为。
- 当前证据：最新 `main` 的 `App.tsx` 仍直接持有阅读位置 ref、恢复 effect 和滚动保存 effect；D06 已先收敛文内查找，Issue #16 仍开放；当前没有修改同一范围的开放产品 PR，也没有新的架构预算超限证据。
- 范围：新增 `reading-position-controller` 与定向测试；迁移阅读位置恢复、标题锚点/比例回退、滚动位置防抖保存和卸载 flush；保留阅读标题观察器、阅读进度栏、缩放、批注、阅读库搜索、IPC、索引算法和 Rust 行为不变。
- 非目标：不一次性重写 `App.tsx`，不迁移阅读标题观察器或其他阅读面编排，不改变阅读位置存储格式、产品运行时、IPC、Rust 文件行为、版本号或 Release。
- 验收：阅读位置 controller 测试覆盖锚点恢复、滚动保存和卸载 flush；完整 Vitest 469 个测试通过；workflow、Release、Lint、Build、格式、文档、架构和 type-aware 检查通过；浏览器相关回归 2 个通过；Windows desktop smoke 18 个通过；远程 Quality checks 通过后合入 PR #519。
- 下一项：D07 已完成；根据最新 `main`、预算变化和稳定职责边界重新核对并定义 D08，不自动推进长期 v1.x 候选。

### D08 — App.tsx 阅读进度栏与标题观察编排提取

**状态：DONE — PR #521**

- 目标：把阅读进度、当前标题状态、标题缓存、IntersectionObserver 和滚动合帧编排从 `App.tsx` 收敛到独立 controller，继续降低页面组合层的领域生命周期负担。
- 当前证据：最新 `main` 的 `App.tsx` 仍直接持有阅读进度/标题三组状态、标题列表与 observer refs、阅读栏回调及三段相关 effect；Issue #16 仍开放；Issue #168 的性能问题已有 rAF/IntersectionObserver 基础修正但结构性编排仍在 App；当前没有修改同一范围的开放产品 PR，也没有新的架构预算超限证据。
- 范围：新增 `reading-rail-controller` 与定向测试；迁移阅读标题缓存、当前标题/进度状态、IntersectionObserver 生命周期、滚动 rAF 合帧和非阅读面重置；保留阅读位置 controller、标题导航、阅读缩放、批注、阅读库搜索、IPC、索引算法和 Rust 行为不变。
- 非目标：不一次性重写 `App.tsx`，不改变标题定位算法、IntersectionObserver 语义、阅读位置存储、产品运行时、IPC、Rust 文件行为、版本号或 Release。
- 验收：controller 测试覆盖标题缓存/回退、IntersectionObserver 当前标题、滚动进度和非阅读面重置；完整 Vitest 109 文件 / 472 项、coverage、workflow 46 项、Release 27 项、a11y 11 项、Lint、Build、格式、文档、架构和 type-aware 检查通过；阅读栏 Playwright 2 项通过；Windows desktop smoke 18 项通过；远程 Quality checks 通过后合入 PR #521。
- 下一项：D08 已完成；根据最新 `main`、预算变化和稳定职责边界重新核对并定义 D09，不自动推进长期 v1.x 候选。

### D09 — App.tsx 更新生命周期编排提取

**状态：DONE — PR #523**

- 目标：把应用更新检查、安装、重启、恢复提示和清理生命周期从 `App.tsx` 收敛到独立 controller，让页面组合层只负责连接顶栏与通知视图。
- 当前证据：最新 `main` 的 `App.tsx` 仍直接持有当前版本、更新状态、待处理更新、检查锁和启动检查偏好三组 ref，以及检查/安装/重启/关闭回调和启动恢复 effect；Issue #16 仍开放；`updater.ts` 与 `update-recovery.ts` 已提供稳定桥接和持久化边界；当前没有修改同一范围的开放产品 PR，开放 PR 仅为无关 Dependabot。
- 范围：新增 `update-controller` 与定向测试；迁移更新状态、待处理更新清理、手动/启动检查、下载安装、重启、恢复提示和顶栏更新动作；保留现有 updater bridge、错误码/本地化、恢复 key/格式、设置中的启动检查偏好和通知语义不变。
- 非目标：不修改更新源、IPC、Rust 文件行为、权限、版本号、tag、Release、安装包或 `latest.json`；不重做更新 UI，不提前建立 Provider/插件接口。
- 验收：controller 测试覆盖浏览器预览保护、启动恢复提示、检查无更新/有更新、下载进度、失败恢复和资源清理；完整 Vitest 110 文件 / 478 项、coverage 49.53% statements、44.90% branches、55.98% functions、51.30% lines、workflow 46 项、Release 27 项、Lint、Build、格式、文档、架构和 type-aware 检查通过；a11y 11 项（并行首轮 3 个浏览器启动抖动用例单 worker 重跑通过）；Windows desktop smoke 18 项通过；远程 Quality checks 通过后合入 PR #523。
- 下一项：D09 已完成；根据最新 `main`、预算变化和稳定职责边界重新核对并定义 D10，不自动推进长期 v1.x 候选。

### D10 — App.tsx 批注高亮生命周期编排提取

**状态：DONE — PR #525**

- 目标：把阅读正文批注高亮 controller 的创建、更新、定位和清理从 `App.tsx` 收敛到独立 controller，让页面组合层只连接批注面板和编辑/阅读上下文。
- 当前证据：PR #525 已合入最新 `main`；Issue #16 仍开放；底层 `annotation-highlighter` 已有稳定 controller 和测试；当前没有修改同一范围的开放产品 PR，开放 PR 仅为无关 Dependabot。
- 范围：新增 `annotation-controller` 与定向测试；迁移高亮 controller 生命周期、当前文档批注过滤、位置列表更新、待聚焦批注滚动和卸载清理；保留批注保存/删除、数据格式、文本定位算法、批注面板、IPC、索引算法和 Rust 行为不变。
- 非目标：不修改批注持久化协议或高亮算法，不重做批注 UI，不改变阅读/编辑模式切换、版本号、tag、Release 或未来 Provider/插件接口。
- 验收：controller 定向测试覆盖无效阅读面清理、按文档过滤、批注位置更新、待聚焦批注定位和卸载 dispose；完整 Vitest 111 文件 / 482 项、coverage 49.82% statements、45.18% branches、56.22% functions、51.64% lines、workflow 46 项、Release 27 项、Lint、Build、格式、文档、架构和 type-aware 检查通过；a11y 11 项、Playwright 首轮 104/106 后两个时序用例单 worker 重跑 5/5、Windows desktop smoke 18 项通过；远程 Quality checks 全部通过后合入 PR #525。
- 下一项：D10 已完成；重新核对最新 `main`、预算变化和稳定职责边界，再定义 D11；不自动推进长期 v1.x 候选。

### D11 — App.tsx 设置与偏好生命周期编排提取

**状态：DONE — PR #527**

- 目标：把设置初始读取、原生设置恢复、持久化调度、卸载清理和兼容性存储同步从 `App.tsx` 收敛到独立生命周期 hook，让页面组合层只连接设置值、控件动作和保存结果。
- 当前证据：PR #527 已合入最新 `main`；Issue #16 仍开放；现有 `settings-controller` 的读/写/debounce/flush 边界保持不变；当前没有修改同一范围的开放产品 PR，开放 PR 仅为无关 Dependabot。
- 范围：新增 `settings-lifecycle` 与定向测试；迁移设置状态初始化、原生快照恢复、持久化/flush/dispose、设置保存状态和兼容性布局存储同步；保留设置 UI、portable settings 导入导出、文档会话、更新器、IPC、索引算法和 Rust 行为不变。
- 非目标：不修改设置数据格式、原生读写协议、设置控件视觉/文案、portable settings 兼容逻辑、版本号、tag、Release 或未来 Provider/插件接口。
- 验收：生命周期测试覆盖本地初始值、原生快照恢复、持久化状态、显式 flush 和卸载 flush；完整 Vitest 112 文件 / 486 项、coverage 50.51% statements / 45.45% branches / 57.27% functions / 52.26% lines、workflow 46 项、Release 27 项、Lint、Build、格式、文档、架构和 type-aware 检查通过；a11y 11 项、Playwright 首轮 105/106 后渐进渲染场景单 worker 重跑 5/5、Windows desktop smoke 18 项通过；远程 Quality checks 通过（14m50s）后合入 PR #527。
- 下一项：D11 已完成；重新核对最新 `main`、预算变化和稳定职责边界，再定义 D12；不自动推进长期 v1.x 候选。

### D12 — App.tsx 命令编排提取

**状态：DONE — PR #529**

- 目标：把命令目录的 label/shortcut/enabled 状态和 command id 分发从 `App.tsx` 收敛到独立命令控制器，让页面组合层只绑定当前状态与既有动作。
- 当前证据：PR #529 已合入最新 `main`；Issue #16 阶段 2 仍开放；`compatibility-contract` 的命令 ID 与快捷键边界保持不变；当前没有修改同一范围的开放产品 PR，开放 PR 仅为无关 Dependabot。
- 范围：新增 `reader-command-controller` 与定向测试；迁移命令目录生成、可用性判断和动作分发；保留命令面板、顶栏、全局快捷键、CodeMirror 原生快捷键、IPC、索引算法和 Rust 行为不变。
- 非目标：不修改命令 ID、快捷键协议、命令文案语义、命令面板视觉、工作区搜索、版本号、tag、Release 或未来 Provider/插件接口。
- 验收：命令控制器测试覆盖完整目录、disabled 状态、每个 command id 的动作映射和 React hook 装配；完整 Vitest 113 文件 / 490 项、coverage 50.85% statements / 45.71% branches / 57.42% functions / 52.65% lines、workflow 46 项、Release 27 项、Lint、Build、格式、文档、架构和 type-aware 检查通过；a11y 11 项、Playwright 首轮 105/106 后渐进渲染场景单独运行 1/1、Windows desktop smoke 18 项通过；远程 Quality checks 通过（16m03s）后合入 PR #529。
- 下一项：D12 已完成；当前进入 D13“App.tsx 工作区搜索生命周期编排提取”；不自动推进长期 v1.x 候选。

### D13 — App.tsx 工作区搜索生命周期编排提取

**状态：IN_PROGRESS — 当前分支**

- 目标：把当前阅读库搜索的查询状态、结果状态、加载状态、防抖和异步过期保护从 `App.tsx` 收敛到独立控制器，让页面组合层继续只连接工作区会话、筛选和搜索面板。
- 当前证据：最新 `main` 为 `56d7cd1`（D12 代码 PR #529 与状态 PR #530 均已合入）；Issue #16 阶段 2 仍开放；`App.tsx` 仍直接持有工作区搜索状态和搜索生命周期 effect；当前没有修改同一范围的开放产品 PR，开放 PR 仅为无关 Dependabot。
- 范围：新增 `workspace-search-controller` 与定向测试；迁移工作区查询、搜索结果/加载状态、180ms 防抖、工作区 revision 触发重搜、过期结果忽略和错误提示；接入既有 `WorkspaceSessionController` 的查询/清空结果视图；保留 `WorkspacePanel` 搜索输入 ref、筛选与结果展示、`searchWorkspace` IPC、索引算法和 Rust 行为不变。
- 非目标：不修改搜索语义、匹配算法、拼音匹配、IPC 协议、工作区筛选规则、快速打开、文内查找、版本号、tag、Release 或未来 Provider/插件接口。
- 验收：controller 测试覆盖查询防抖与 trim、无阅读库/短查询清空、revision 重搜、过期结果保护、错误与 loading 状态；完整 Vitest、coverage、workflow、Release、Lint、Build、格式、文档、架构和 type-aware 检查通过；a11y、Playwright 与 Windows desktop smoke 中现有工作区搜索路径保持通过；远程 Quality checks 通过后合入代码 PR。
- 下一项：完成 D13 后重新核对最新 `main`、预算变化和稳定职责边界，再定义下一项 Dxx；不自动推进长期 v1.x 候选。

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
