# Moyang Reader 开发架构契约

> 本文是维护者与 AI Agent 的**规范性工程边界**。`ARCHITECTURE.md` 描述当前实现，`FUTURE-DEVELOPMENT-PLAN.md` 描述长期候选；“现在允许怎样改代码”以本文、`AGENTS.md`、`AI-TASKS.md` 和当前 GitHub 状态为准。
>
> 本文的“必须 / 禁止 / 只能”是工程约束，不是审批状态机。不得据此恢复 T0–T3、G01–G03、approval receipt、policy/plan/state、`NEXT.md` 或第二套任务板。

## 1. 事实来源与开始条件

事实优先级：

1. GitHub / `origin/main`：最新 main、开放 PR/Issue、CI；
2. `AGENTS.md`、`docs/AI-TASKS.md`、本文、`docs/AI-HANDOFF.md`；
3. 本机 `.codex-cache/`；
4. 旧聊天、旧审计、旧 SHA、已关闭 PR/Issue。

开始新任务前必须：

- 检查工作区未提交改动，不覆盖其他人/Agent 的现场；
- 获取或尝试获取最新远程状态；
- 找到 `AI-TASKS.md` 最早未完成任务；
- 确认不存在该任务的 `IN_PROGRESS` / `WAITING` 前序；
- 检查开放 PR，但只有**对应当前最早任务、修改同一范围或形成真实合并依赖**的 PR 才阻塞；Dependabot、机器人依赖更新、纯维护或明显无关 PR 不得冻结整个产品队列；
- 当前任务能形成约 0.5–3 天、可独立测试和回滚的垂直切片。

远程状态无法确认时，可以继续已有本地任务分支，但禁止自行开启新任务或第二个 PR。

`BLOCKED_EXTERNAL` 只能标记真正依赖仓库设置、证书、凭据、正式 Release 或真实 Windows 环境的**具体子项**；仓库内可完成的代码、文档、测试和检查继续拆开完成。

## 2. 产品不可破坏边界

Moyang Reader v1.0 的正式目标是 **Windows x64、本地优先、阅读器优先的本地文档工作台**。

任何实现都必须保持：

- 普通用户文件是真源；Markdown/TXT/DOCX/PDF/图片不依赖私有数据库才能存在或读取；
- 核心阅读、编辑、搜索、批注、导出、恢复默认离线可用；
- 浏览器构建只用于开发预览和 UI 测试，不是正式产品平台；
- v1.0 前不扩展 macOS/Linux/移动端、自建云同步、实时协作、任意第三方脚本插件、RAG/MCP 核心架构；
- AI、远程内容、更新等联网能力必须独立、可关闭，关闭后核心阅读能力不降级；
- 用户文件安全优先于重构美观、代码减行数和功能速度。

禁止把正文迁进 SQLite、向量库或私有对象存储成为唯一真源。索引和缓存必须可删除重建。

## 3. 当前架构现实与大型编排点

当前仍有大型编排点：`src/app/App.tsx`、`src-tauri/src/commands.rs`、`src/app/styles.css`、`src/app/export.ts` 和部分大型组件。

规则：

- 禁止一次重写 App、commands、CSS 或导出系统；
- 每次只提取一个稳定职责，并保留行为等价测试；
- 迁移期间允许窄兼容层，不用大规模重命名制造风险；
- 新功能不得默认继续堆进 `App.tsx` / `commands.rs`；
- 历史依赖方向问题允许逐步偿还，但禁止继续扩大。

v0.11 的 A11 明确负责继续提取 Workspace Session / 工作区生命周期，不以“把 App.tsx 减到某行数”为目标。

### 3.1 复杂度增长预算

`scripts/architecture-budget.json` 记录 `App.tsx`、`commands.rs`、`export.ts` 和 `styles.css` 的规范化 UTF-8 字节/行数基线与允许增长。`check:architecture` 只阻止超出增量预算的显著增长，不把总行数当作质量目标，也不要求为了过检查机械拆文件。

调整基线必须属于明确的架构切片，并同时说明职责提取、行为等价测试或确实新增的领域边界；普通产品 PR 不得只为容纳新增代码而放宽预算。超预算时，优先提取稳定职责或拆分独立任务，再更新基线。

## 4. 目标依赖方向

```text
React Components / Views
        ↓
App composition / Controllers / Services
        ↓
Neutral domain contracts / adapters / index logic
        ↓
bridge.ts + ipc-contract.ts
        ↓
Tauri command boundary
        ↓
Rust domain / filesystem / permission implementation
```

必须遵守：

- `components/` 负责展示、输入、焦点和交互，不直接拥有文件系统、原始 Tauri IPC、任意网络或秘密存储；
- React 组件不得直接调用原始 `invoke`；
- 新 `src/lib` / core 领域模块不得依赖 React/React DOM/components；
- Tauri/Rust handler 负责参数入口、授权边界和路由，领域逻辑进入可测试模块；
- 同一用户动作不要在 TopBar、快捷键、命令面板、右键菜单复制多套业务判断。

## 5. 主要职责所有者

### 5.1 `App.tsx`

允许：页面组合、controller/service 装配、顶层 React 生命周期与视图状态连接。

禁止新增：持久化格式实现、大段文件 IO 状态机、原始 Tauri IPC、AI vendor SDK、插件权限系统、可独立测试却长期埋在组件内的复杂业务逻辑。

### 5.2 `settings-controller.ts`

负责设置读取、默认值、损坏恢复、持久化顺序和 flush/debounce。

新增设置必须保持 schema/版本兼容；秘密不得进入普通设置或 portable export；UI 不重新实现第二套写队列。

### 5.3 文档会话控制边界

打开、草稿、保存、外部修改冲突、切换、关闭、恢复由文档会话边界统一协调。

禁止组件绕过它静默覆盖当前文档；禁止外部修改存在时静默保存；未来 AI/扩展也不能直接写用户文件。

### 5.4 `bridge.ts` + `ipc-contract.ts`

这是前端到 Tauri 的标准 IPC 边界。

- 新 command/event 名、参数和返回类型先进入集中契约；
- 业务/组件文件禁止新增 `invoke("...")`；
- 非平凡返回逐步增加运行时 shape validation；
- raw body 只用于明确的大二进制场景；
- Rust 注册名、TS 契约和测试同步。

### 5.5 `storage.ts` / app settings

只保存应用级 UI/会话元数据，如最近文件、布局、阅读位置、标签页恢复。

禁止保存正文真源、秘密或无 schema 的长期数据库状态。

### 5.6 `workspace-index.ts`

索引是**派生数据**：可以失效、删除、重建，不得成为正文真源；搜索结果必须回到真实文件/位置。未来 semantic recall 只能叠加确定性全文/文件名/标签搜索，不能替代它。

### 5.7 `export.ts`

导出只产生派生输出，不改变源文档语义和真源归属。新增导出格式不能顺手重写保存协议。

### 5.8 Rust command 层

路径规范化、授权、原子写入和安全检查不得复制到前端作为“等价实现”。文件/目录破坏性操作继续经过 Rust 受控边界；拆分时 IPC 名称和授权语义默认保持不变。

## 6. 数据与持久化分类

任何新持久化先归类：

| 类别 | 真源 | 允许位置 | 核心规则 |
| --- | --- | --- | --- |
| 用户内容 | 是 | 普通用户文件 | 其他工具可读；写入安全、可恢复 |
| 工作区旁路元数据 | 否 | `.moyang/` | 版本化；不得替代正文 |
| 应用偏好/会话 | 否 | app settings/local app storage | 不含秘密/正文真源 |
| 秘密 | 否 | Windows/OS 安全凭据存储 | 不进 portable settings、日志、Issue/PR、`.moyang` |
| 派生缓存/索引 | 否 | app cache | 可删除重建 |
| Agent 本机上下文 | 否 | `.codex-cache/` | 不提交 Git，不作为产品状态 |

无法说明数据属于哪一类时，不得先实现持久化。

## 7. 用户文件安全

用户文件相关能力必须满足：

- Rust/Tauri 决定用户授权路径范围；
- 单独打开文档与工作区授权不能混淆；
- 写入继续使用安全替换/备份/恢复；
- dirty、external modified、save、close、recovery 顺序可测试；
- 写入失败时保留可恢复内容并给出明确反馈；
- 批量移动、删除、覆盖显示真实影响范围；
- 日志、诊断、测试 fixture 不包含真实用户正文。

禁止静默覆盖外部已修改文件、丢弃未保存内容、让未来 AI 直接覆盖原文件、失败后把用户文件当临时文件清理。

未来任何生成式写回统一遵循：

```text
candidate → preview/diff → user apply → core safe write
```

## 8. IPC 与错误契约

新的跨 TS↔Rust 接口必须明确：command/event 名、输入、输出、稳定 error code、是否修改用户文件/状态、授权范围、测试。

方向固定为：

```text
stable code + technical details
          ↓
frontend maps code to localized user message
```

禁止把自然语言字符串匹配作为新的稳定 API。A12 优先收敛高价值文件、保存/恢复、工作区、导出和更新错误路径。

## 9. DocumentAdapter 的当前事实

`src/lib/adapters/types.ts` 的 `DocumentAdapter` 当前主要是内部 metadata/capability 声明，registry 是内部注册机制：**不是第三方插件 API，不是稳定 ABI，也不代表外部代码可以执行。**

未来是否增加 `canOpen`、`readMetadata`、`extractText`、`render`、`export`、`supportsEdit` 等行为，必须从真实内置需求提炼：

1. 先有真实内置用户动作；
2. 让现有 Markdown/TXT/DOCX 等实现真正通过该边界调用；
3. 出现第二个真实调用关系后再稳定 contract；
4. PDF 预览不等于文本提取；图片默认没有正文文本；
5. URL/RSS/网页抓取属于 Content Source / Article Import，不属于 DocumentAdapter；
6. 没有真实调用方时不制造空方法和兼容承诺。

## 10. 搜索边界

三种搜索保持语义分离：

- **Quick Open**：找文件/最近项目；
- **In-document Find**：找当前文档文字；
- **Workspace Search**：找工作区内容。

未来语义搜索只能作为 Workspace Search 的可选额外召回层。禁止向量库替代确定性搜索、索引数据库替代正文真源、AI 回答无法回溯来源文件。

## 11. Command 边界

A07 已把命令面板收成真正的键盘入口。后续同一动作逐步共享 `id/label/category/shortcut/enabled/visible/execute` 等稳定语义，但不为“未来扩展”单独建立第三方 command ABI。

真实入口达到复用价值时再提炼内部 command model；危险删除/批量覆盖不能因为命令面板方便就默认暴露。

## 12. Tauri 权限与网络边界

当前主窗口 capability 是现有应用能力，不是未来扩展的权限模板。

- presentation component 不直接调用原始 Tauri plugin API；
- `process` / `opener` / `updater` 新调用要有明确业务所有者和测试；
- **B04** 负责 v0.12 Tauri 权限库存与负向安全测试；在完成真实调用点库存前不盲目删 capability，也不扩大为 shell/任意 fs/任意网络；
- 外部链接继续走协议白名单与主窗口导航限制；
- 不允许远程 JavaScript 注入主 WebView；
- 未来第三方 UI/sidecar 必须有独立最小权限，不能继承主窗口能力。

核心默认离线。新的任意 URL 抓取不能散落在 React 组件中；未来 Article Import/Reading Inbox 若进入 v1.x 阶段，必须走受控网络边界并覆盖 SSRF、redirect、timeout、size、content-type 等负向测试。

## 13. 设置、秘密与诊断

API key/token/证书私钥绝对禁止写入：普通 localStorage 设置、portable settings、`.moyang/`、`.codex-cache/`、Git 历史、Issue/PR、日志和诊断包。

未来远程 AI 上线前必须有 OS 安全存储、secret redaction 和“配置导出不含秘密”的测试。v1.0 不要求提前实现 AI secret store。

## 14. AI：真实用户动作优先，不做 provider-first

AI 属于 **v1.3 GATED 候选**，不是 v1.0 前置条件。

第一条路径应从真实低风险动作开始，例如“解释选区 / 翻译选区”，并满足：

- 核心阅读在 AI 关闭时完整可用；
- 用户明确知道发送了哪些内容；
- 默认不给任意 shell、删除、无范围文件写、安装插件、发布、更新设置等权限；
- 生成内容如需写回，走 `candidate → preview/diff → user apply → core safe write`。

只有一个真实动作和一个实现时，不先创建庞大的 `AiProvider + ConsentScope + PermissionBroker` 架构。出现第二个真实 provider/调用方且证明复用价值后，再提炼 provider/consent/permission/secret contract，并补 contract tests。

## 15. 插件、MCP、RAG 与 Interop

这些都是 v1.x 之后候选，不能作为 v1.0 架构前置工程。

- 不运行 `eval(thirdPartyCode)`；
- 不允许 remote JS → main WebView；
- 不让第三方直接拿原始 Tauri plugin 权限；
- MCP 如果未来实现，只能是外部适配层，依赖方向保持 `internal services → McpAdapter → MCP`；
- RAG 只能叠加可追溯来源的检索能力，不替代确定性搜索；
- 声明式扩展、sidecar/WASM 等只有真实需求和成熟边界后再设计，不预先冻结 P0/P1/P2/P3 插件平台路线。

## 16. UI 与可访问性

- 文件/网络/持久化业务进入 service/controller；
- modal/focus/tab/listbox 遵循 `docs/UI-INTERACTION.md`；
- UI 行为修改补对应 Playwright/a11y；
- 正式适配 Windows DPI/桌面窗口，不为手机响应式重构；
- 新视觉值使用语义 token，不建立第二套主题系统；
- 普通功能 PR 不引入大型 UI framework/CSS-in-JS 重写。

## 17. 新长期接口创建规则

新增长期 controller/service/port/interface 前必须回答：

1. 当前哪个真实内置功能需要它？
2. 它拥有哪一种明确职责？
3. 谁可调用、谁禁止调用？
4. 输入、输出、错误、取消语义是什么？
5. 是否涉及用户文件、权限、网络或秘密？
6. 如何测试与回滚？
7. 为什么不能先复用现有边界？
8. 是否已经有第二个真实调用方证明需要长期抽象？

如果没有当前调用方，默认不创建。禁止为“以后可能用”创建空 Manager/Service/Provider、第二套 controller、用 EventBus/global store 规避清晰依赖，或在一个 PR 同时改变接口、持久化、UI IA 和权限模型。

## 18. 文档与 ADR 更新义务

以下改动必须同步本文或 `ARCHITECTURE.md`：新持久化类别、新跨层依赖、新 IPC/permission/network 边界、新核心 controller/service、用户文件写入策略、DocumentAdapter/index/command/AI 职责变化。

只有长期、难以逆转、会约束多个后续版本的决策才新增 ADR。ADR 0011/0013 是旧治理历史；ADR 0012 只保留窄原则：**没有真实内置调用关系前，不承诺第三方插件 ABI**。它不要求 v1.0 前稳定 AI/provider/plugin 内核。

## 19. 测试义务矩阵

| 改动 | 最少必须验证 |
| --- | --- |
| TS/纯逻辑 | 相关 unit + lint |
| React UI | unit/组件 + 对应 Playwright；a11y 变化加 axe/键盘路径 |
| IPC command/shape | contract/bridge + TS build；关键路径 desktop smoke |
| 文档保存/恢复 | controller/unit + desktop open/edit/save/external-change/recovery |
| Rust 路径/文件 | Rust test/clippy + desktop smoke |
| settings migration | 正常/旧版本/损坏输入/round-trip/fallback |
| permission/network | 正常路径 + 拒绝/越权/错误协议等负向测试 |
| updater/release/signing | 完整 CI + 能获得的真实 Windows 证据 |
| 新长期 port | 至少一个真实内置调用方；稳定 contract 前最好有第二个真实调用关系 |
| CSS/布局 | 相关 UI E2E；仅关键稳定状态加少量截图 |

### Correctness 与 performance 分离

`npm run test:e2e:desktop` 是确定性 correctness smoke，可作为 required PR gate；`npm run test:e2e:desktop:benchmark` 是独立性能证据。共享 Runner 的单轮毫秒抖动不能直接阻断功能正确性，但 benchmark 必须保留、可追踪，并以固定 fixture、多轮和趋势判断。

## 20. 当前阶段约束

- **v0.11**：A08–A13，完成上下文 Tab/a11y、顶栏/DPI、CSS/视觉基线、Workspace Session、稳定错误码、RC/发布预检；不做 AI/plugin/RAG/MCP。
- **v0.12**：性能/大文件降级、Resilient Reading Anchor、B04 权限库存与负向测试、真实主流程 UX、本地诊断；不做大型产品扩张。
- **v0.13**：Freeze / Compatibility / RC，只修兼容、恢复、发布和真实 blocker，不承载大型新功能。
- **v1.0**：可靠 Windows x64 核心基线 + 完整核心体验重设计；新视觉是发布门槛，但不得重写文件安全、恢复、IPC、三栏信息架构或现有快捷键契约。
- **v1.1**：Reader+ 候选。
- **v1.2**：Metadata / Knowledge 候选；Properties 写回前必须先通过 frontmatter round-trip safety spike。
- **v1.3**：AI 候选，从真实选区解释/翻译等动作开始。
- **v1.4+**：RAG、MCP、RSS、声明式扩展、更多格式等按 Gate 评估。

长期计划条目不是开工许可；只有进入 `AI-TASKS.md` 且前序完成的切片才能实现。

## 21. 更新、发布与安全披露

- GitHub Release `latest.json` 是 updater metadata 权威源；Cloudflare Pages 只作备用镜像/分发源；
- Tauri updater `.sig` 不等于 Windows Authenticode；
- 真实 Windows 旧版本 → 新版本升级闭环不能由 CI 代替；
- 安全漏洞按根目录 [`SECURITY.md`](../SECURITY.md) 报告；不要在公开 Issue/PR 粘贴敏感 PoC、用户数据或秘密；
- Private Vulnerability Reporting 的开关是外部设置，但 `SECURITY.md`、链接和披露规则本身不是外部阻塞。

## 22. Agent 明确禁止清单

未经当前任务明确授权，不得：

- 开后续任务、stacked PR 或第二个 Track；
- 重建旧 AI 审批/状态机；
- 一次重写 App/commands/styles/export；
- 在业务/组件直接新写 Tauri `invoke`；
- 给组件文件系统/process/opener/updater/任意 fetch 权限；
- 静默覆盖或删除用户文件；
- 把正文/密钥写入日志、配置导出或 Agent cache；
- 把当前 DocumentAdapter 当第三方插件 SDK；
- 提前实现插件市场、任意 JS 插件、MCP 核心、RAG 核心或 Agent 自动写文件；
- 为长期计划创建没有当前调用方的空接口；
- 因旧 Issue/聊天说有问题就不在 current main 复现；
- 为通过测试删除/弱化安全检查或性能证据。

## 23. 本地交接

开始时推荐 `npm run agent:bootstrap`；停止且任务未完成时更新 `.codex-cache/agent-handoff.md`，记录 Task ID、branch、last commit、已完成、测试、未完成、do-not-overwrite/do-not-regress。

`.codex-cache` 永远不提交；共享事实仍以 GitHub、branch/PR、`AI-TASKS.md` 和版本控制文档为准。
