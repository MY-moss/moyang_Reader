# Moyang Reader 开发架构契约

> 本文是面向维护者与 AI Agent 的**规范性工程边界**。`ARCHITECTURE.md` 负责描述当前实现，`FUTURE-DEVELOPMENT-PLAN.md` 负责长期方向；当 AI 对“现在允许怎样改代码”有疑问时，以本文、`AGENTS.md`、`AI-TASKS.md` 和当前 GitHub 状态为准。
>
> 本文的“必须 / 禁止 / 只能”是工程约束，不是审批状态机。不得据此恢复 T0–T3、approval receipt、state.json、NEXT.md 或第二套任务板。

## 1. 事实来源与开始条件

事实优先级固定为：

1. **GitHub / `origin/main` 当前状态**：最新 main、Open PR、Open Issue、CI 是共享事实。
2. **仓库内受版本控制的规则与任务**：`AGENTS.md`、`docs/AI-TASKS.md`、本文、`docs/AI-HANDOFF.md`。
3. **本机 `.codex-cache/`**：只用于本机 Agent 上下文与临时交接，永远不能覆盖前两层。
4. 旧聊天记录、旧审计、旧 SHA、已关闭 PR/Issue：只能作为线索，不得当作当前事实。

开始新任务前必须满足：

- 已检查工作区未提交改动，不覆盖其他人/Agent 的本地工作；
- 已执行本地同步检查（推荐 `npm run agent:bootstrap`）；
- 已获取或尝试获取最新 `origin/main`；
- 已检查 Open PR，确认更早任务没有活动 PR；
- `AI-TASKS.md` 中更早任务不存在 `IN_PROGRESS` / `WAITING`；
- 当前任务能形成一个约 0.5–3 天、可独立测试和回滚的垂直切片。

如果 GitHub/远程状态无法确认，允许继续**已经存在的本地任务分支**，但禁止自行开启新的任务、后续任务或第二个 PR。

## 2. 产品不可破坏边界

Moyang Reader 当前唯一正式目标是 **Windows x64、本地优先的阅读/编辑工作台**。

任何实现都必须保持：

- 普通用户文件是真源；Markdown/TXT/DOCX/PDF/图片不依赖私有数据库才能存在或读取；
- 核心阅读、编辑、搜索、批注、导出、恢复默认离线可用；
- 浏览器构建只用于开发预览和 UI 测试，不是正式产品平台；
- v1.0 前不扩展 macOS/Linux/移动端、自建云同步、实时协作或任意第三方脚本插件；
- AI、远程内容、更新等联网能力必须独立、可关闭，关闭后核心能力不降级；
- 用户文件安全优先于重构美观、代码减行数和新功能速度。

禁止为了“未来扩展”把正文迁进 SQLite/向量库/私有对象存储成为唯一真源。索引和缓存必须可删除重建。

## 3. 当前架构现实与已知债务

当前存在几个大型编排点：`src/app/App.tsx`、`src-tauri/src/commands.rs`、`src/app/styles.css`、`src/app/export.ts` 和部分大型组件。它们是需要渐进收敛的工程债，不是一次重写的理由。

严格规则：

- 禁止以“架构升级”为名一次重写 App、commands、CSS 或导出系统；
- 每次只提取一个稳定职责，并保留行为等价测试；
- 旧接口在迁移完成前可保留兼容层，不通过一次大规模重命名制造额外风险；
- 新功能不得默认继续堆进 `App.tsx` 或 `commands.rs`；应先判断是否已有明确的 controller/service/domain 模块可以承载。

现有依赖方向并非完全理想，例如部分 `src/lib` 代码仍依赖 `src/app/types.ts`。这是历史债：**允许保留，但禁止继续扩大**。新的共享领域类型优先进入中立模块，而不是让底层 lib 继续向 UI/app 层反向依赖。

## 4. 依赖方向

目标依赖方向：

```text
React Components / Views
        ↓
App composition / Controllers / Services
        ↓
Neutral domain contracts + adapters + index abstractions
        ↓
bridge.ts + ipc-contract.ts
        ↓
Tauri command boundary
        ↓
Rust domain / filesystem / permission implementation
```

必须遵守：

- `components/` 负责展示、输入、焦点和交互，不直接拥有文件系统、Tauri IPC、任意网络或秘密存储；
- React 组件不得直接调用原始 `invoke`；
- 新的 `src/lib` / core 领域模块不得依赖 React、React DOM 或 `src/app/components`；
- Tauri/Rust command handler 应逐渐变薄：负责参数入口、授权边界和路由，领域逻辑放到可测试模块；
- 不允许为了“方便”让多个 UI 入口分别复制同一业务规则；长期由 controller/service/command model 统一。

已有违反理想依赖方向的历史代码只能在明确任务中迁移，不要在无关 PR 顺手大搬家。

## 5. 模块职责与唯一所有者

### 5.1 `App.tsx`

允许：

- 页面/区域组合；
- controller/service 的装配；
- 顶层 React 生命周期与视图状态连接。

禁止新增：

- 新的持久化格式实现；
- 大段文件读写状态机；
- 新的原始 Tauri IPC；
- AI provider/vendor SDK；
- 插件权限系统；
- 可独立测试却长期埋在组件内的复杂业务逻辑。

### 5.2 `settings-controller.ts`

是设置读取、默认值、损坏恢复、持久化顺序、debounce/flush 的当前控制边界。

新增设置时：

- 保持设置 schema/版本兼容；
- 迁移必须可回退或有旧值 fallback；
- 不把 API key/token/证书放进普通设置；
- UI 只提交设置意图，不重新实现第二套写入队列。

### 5.3 文档会话控制器（A04）

A04 完成后，打开、草稿、保存、外部修改冲突、切换、关闭、恢复必须由明确的文档会话边界统一协调。

禁止：

- 组件直接绕过会话控制器覆盖当前文档；
- 外部修改存在时静默覆盖；
- AI/插件直接写用户文件；
- 从旧 #463 复制旧 `App.tsx` 覆盖当前 main。

### 5.4 `bridge.ts` + `ipc-contract.ts`

这是前端到 Tauri 的唯一标准 IPC 边界。

- 新命令名、参数和返回类型必须先进入集中契约；
- 禁止在其他业务/组件文件中新写 `invoke("...")`；
- 非平凡只读返回应逐步增加运行时 shape validation；
- raw body 命令只能用于明确的大二进制传输场景，不能成为绕开类型契约的通用后门；
- Rust 注册名、TS 命令名和测试必须同步。

### 5.5 `storage.ts` / app settings

只保存应用级 UI/会话元数据，例如最近文件、最近工作区、布局、阅读位置、标签页恢复等。

禁止：

- 保存用户正文作为唯一副本；
- 保存秘密；
- 把 localStorage 当作跨版本无需 schema 的数据库；
- 新功能在多个文件中各建一套同义 key。

### 5.6 `workspace-index.ts` 与未来 IndexProvider

索引是**派生数据**。

- 可以失效、删除、重建；
- 不得成为用户内容真源；
- 搜索结果必须能回到真实文件路径/位置；
- 未来 semantic index 只能是额外召回层，不能替代确定性全文/文件名搜索；
- IndexProvider 在 D01 前不是对外 ABI。

### 5.7 `export.ts`

导出只产生派生输出，不改变源文档语义和真源归属。新增导出格式不能顺便重写保存协议。

### 5.8 Rust `commands.rs`

当前仍较大。A05 及后续只按领域渐进拆分。

- 路径规范化、授权范围、原子写入、安全检查不得复制到前端作为“等价实现”；
- 文件/目录破坏性操作必须继续经过 Rust 受控边界；
- 拆分时 IPC 名称和授权语义保持不变，除非任务明确要求协议迁移。

## 6. 数据与持久化分类

任何新持久化在写代码前必须归入以下之一：

| 类别 | 真源 | 允许位置 | 规则 |
| --- | --- | --- | --- |
| 用户内容 | 是 | 普通用户文件 | 可被其他工具直接读取；写入必须安全/可恢复 |
| 工作区旁路元数据 | 否 | `.moyang/` | 版本化；不得替代正文；迁移需兼容 |
| 应用偏好/会话 | 否 | app settings/local app storage | 不含秘密和正文真源 |
| 秘密 | 否 | Windows/OS 安全凭据存储 | 不进 portable settings、日志、Issue、PR、`.moyang` |
| 派生缓存/索引 | 否 | app cache | 必须可删除重建 |
| Agent 本机上下文 | 否 | `.codex-cache/` | 不提交 Git，不作为产品状态 |

如果无法说明某份数据属于哪一类，禁止先实现持久化。

## 7. 文件安全与文档生命周期

用户文件相关功能必须满足：

- 用户显式授权的路径范围由 Rust/Tauri 安全边界决定；
- 单独打开文档与打开工作区的读写权限不能混淆；
- 写入继续采用安全替换/备份/恢复策略；
- dirty、external modified、save、close、recovery 的顺序必须可测试；
- 写入失败必须保留用户仍可恢复的内容并给出明确反馈；
- 任何批量移动、删除、覆盖都必须显示真实影响范围；
- 日志、诊断、测试 fixture 不得包含真实用户正文。

以下操作禁止静默完成：

- 覆盖外部已修改文件；
- 删除未保存内容；
- AI 生成后直接覆盖原文件；
- 失败后把用户文件当临时文件清理。

未来 AI/扩展写回统一遵循：`candidate → preview/diff → user apply → core safe write`。

## 8. IPC 与错误契约

跨 TS↔Rust 的新接口必须同时定义：

- 稳定 command/event 名；
- 输入 payload；
- 输出 payload；
- 错误 code；
- 是否会修改用户文件/状态；
- 所需授权范围；
- 对应测试。

错误方向固定为：

```text
stable code + technical details
          ↓
frontend maps code to localized user message
```

禁止把英文/中文自然语言字符串匹配作为新的稳定 API。现有 updater 等历史自然语言分类是 #111 待收敛债务，不得复制到 AI/provider/plugin/新 IPC。

未知错误可以保留安全 fallback，但诊断 details 不得泄露秘密或正文。

## 9. DocumentAdapter：当前事实与未来接口

这是当前最容易被 AI 误解的地方，必须明确：

### 当前事实

`src/lib/adapters/types.ts` 中的 `DocumentAdapter` **目前只是内部元数据/能力声明**：

- `id`
- `kind`
- `extensions`
- `capabilities`

`src/lib/adapters/registry.ts` 的 `registerDocumentAdapter()` 只是内部注册机制，**不是第三方插件 API、不是稳定 ABI，也不代表某个外部插件可以运行代码**。

实际 Markdown/TXT/DOCX 渲染行为目前仍主要在 `src/lib/document-adapters.ts` 等现有模块中。

### 未来方向（D01）

未来行为接口可逐步收敛到类似：

- `canOpen`
- `readMetadata`
- `extractText`
- `render`
- `export`
- `supportsEdit`

但必须遵守：

1. 不在 A04/A05 等无关任务提前重写；
2. 先让内置 Markdown/TXT 成为真实调用方；
3. 再迁移 DOCX；
4. PDF 预览不等于 PDF 文本提取；
5. 图片默认没有正文文本，OCR/vision 必须显式能力；
6. URL/RSS/网页抓取属于 Content Source / Article Import，不属于 DocumentAdapter；
7. 没有真实内置调用方时禁止为“以后插件可能用”制造空方法和兼容承诺。

`extractText` 是以后 workspace search、AI、RAG、引用的共同前置，必须能够标记原文、解析文本、部分提取、OCR/vision 等来源差异。

## 10. 搜索与 IndexProvider 边界

三种搜索永远保持语义分离：

- **Quick Open**：找文件/最近项目；
- **In-document Find**：找当前文档文字；
- **Workspace Search**：找工作区内容。

未来语义搜索只能叠加到 Workspace Search：

```text
确定性全文/文件名/标签搜索
        +
可选 semantic recall
        ↓
rerank / merge
        ↓
可选 RAG/AI
```

禁止：

- 用向量库取代确定性搜索；
- 把索引数据库变成正文真源；
- 让 AI 回答无法回溯到来源文件；
- 在 D01 前把当前索引内部结构承诺为插件 API。

## 11. Command 边界

同一用户动作未来应逐步统一为稳定 command model：

- `id`
- `label`
- `category`
- `shortcut?`
- `enabled`
- `visible`
- `execute`

A07 先解决命令面板用户体验；D02 才稳定内部 `CommandContribution`。

禁止：

- 为同一动作在 TopBar、快捷键、命令面板、右键菜单各写一套业务判断；
- 提前发布第三方 command ABI；
- 把删除、批量覆盖等危险操作因为“命令面板方便”就默认暴露。

## 12. Tauri 权限与网络边界

当前主窗口 capability 包含 core/dialog/opener/process/updater，这是现有应用能力，不是未来扩展可以继承的权限模板。

必须遵守：

- React presentation component 不直接调用原始 Tauri plugin API；
- `process`、`opener`、`updater` 新调用必须有明确业务所有者和测试；
- B03 前不盲目删现有 capability，但也禁止扩大为 shell/任意 fs/任意网络；
- 外部链接继续走允许协议和主窗口导航双层限制；
- 不允许远程 JavaScript 注入主 WebView；
- 未来第三方 UI/sidecar 必须使用独立最小权限和 PermissionBroker，而不是继承主窗口权限。

网络原则：核心默认离线。新的任意 URL 抓取不能直接散落在 React 组件中。未来 Reading Inbox/Article Import 应通过专门的 Rust/受控 fetch 边界，并补 SSRF、redirect、timeout、size、content-type 等负向测试。

## 13. 设置、秘密与诊断

普通配置可以进入版本化 app settings / provider namespace；秘密只能进入 OS 安全存储。

绝对禁止将 API key/token/证书私钥写入：

- localStorage 普通设置；
- portable settings；
- `.moyang/`；
- `.codex-cache/agent-context.md`；
- Git 历史；
- Issue/PR；
- 日志和诊断包。

真实远程 AI provider 上线前必须有 secret redaction 和配置导出不含秘密的测试。

## 14. AI、插件与 MCP 边界

继续遵守 ADR 0012：v1.0 前只稳定内部能力端口，不发布第三方插件 ABI。

### AI

AI 不得直接写进 `App.tsx` 或阅读组件，也不得绑定某一厂商 SDK到核心业务。

正确方向：

```text
UI action
  ↓
AiProvider
  + ConsentScope
  + PermissionBroker
  + DocumentAdapter/extractText
  ↓
answer / candidate change
  ↓
preview/diff
  ↓
user apply
```

第一阶段只允许辅助阅读/解释/摘要/翻译/问答等低风险能力；Agent 自动执行属于更晚阶段。

默认不给 AI：任意 shell、删除、无范围文件写、任意网络、安装插件、发布、更新设置等能力。

### 插件

阶段顺序固定：

1. P0：内部 contribution/port；
2. P1：声明式扩展包，不运行任意 JS；
3. P2：受控 sidecar/provider，版本化 RPC + timeout/cancel/size/capability allowlist；
4. P3：只有真实需求出现后才评估第三方代码插件。

禁止 `eval(thirdPartyCode)`、remote JS → main WebView、第三方直接获得原始 Tauri plugin 权限。

### MCP

MCP 只能是未来的外部适配层，不得成为内部 service 的依赖方向：

```text
internal services → McpAdapter → MCP
```

优先考虑只读 server；写能力仍经过核心 PermissionBroker 和文件安全层。

## 15. UI 与可访问性架构

组件职责优先保持 presentation/interaction：

- 文件/网络/持久化业务进入 service/controller；
- modal/focus/tab/listbox 行为遵循 `docs/UI-INTERACTION.md`；
- UI 行为修改必须补相应 Playwright/a11y；
- 当前正式适配 Windows DPI/桌面窗口，不为了手机响应式改变布局架构；
- 新视觉值优先使用语义 token，不建立第二套主题系统；
- 禁止在普通功能 PR 引入大型 UI framework/CSS-in-JS 重写。

## 16. 新接口创建规则

新增一个长期存在的 controller/service/port/interface 前，必须能回答：

1. 当前哪个真实内置功能需要它？
2. 它拥有哪一种明确职责？
3. 谁可以调用它？谁禁止调用它？
4. 输入、输出、错误和取消语义是什么？
5. 是否涉及用户文件、权限、网络或秘密？
6. 如何测试？
7. 如何回滚？
8. 为什么不能先复用已有边界？

如果没有当前调用方，默认**不创建**。只有 AI-TASKS 明确标注的原型任务（例如 D03 mock）可以以原型形式存在，并且不得伪装成冻结的公共 API。

禁止：

- `Manager`/`Service`/`Provider` 只为了“以后可能用”而空转；
- 同一职责创建第二套 controller；
- 用 EventBus/global store 规避清晰依赖；
- 为减少参数数量把无关状态塞进一个巨型 context；
- 在一个 PR 同时改变接口、持久化格式、UI IA 和权限模型。

## 17. 何时必须更新架构文档/ADR

以下改动必须在同一 PR 更新本文或 `ARCHITECTURE.md`：

- 新的持久化类别；
- 新的跨层依赖方向；
- 新的 IPC/permission/network 边界；
- 新的核心 service/controller/port；
- 用户文件写入策略变化；
- DocumentAdapter/IndexProvider/Command/AiProvider 的职责变化。

只有“长期、难以逆转、会约束多个后续版本”的决策才新增 ADR。普通模块拆分不为凑流程写 ADR。

## 18. 测试义务矩阵

| 改动 | 最少必须验证 |
| --- | --- |
| TS/纯逻辑 | 相关 unit test + lint |
| React UI 行为 | unit/组件测试 + 对应 Playwright；可访问性变化加 a11y |
| IPC command/shape | contract/bridge test + TS build；关键路径 desktop smoke |
| 文档保存/会话/恢复 | controller/unit + desktop open/edit/save/外部修改/恢复路径 |
| Rust 路径/文件系统 | Rust test/clippy + desktop smoke |
| settings schema/migration | 正常、旧版本、损坏输入、round-trip/失败 fallback |
| permission/network | 正常路径 + 拒绝/越权/错误协议等负向测试 |
| updater/release/signing | 完整 CI + 能获得的真实 Windows 证据；不能伪造 |
| 新内部 port | 至少一个内置调用方 + contract test；原型任务除外但需 mock test |
| CSS/布局 | 相关 UI E2E；关键稳定状态才加少量截图 |

GitHub `Quality checks` 是最终合并门禁，但它不能替代真实 Windows 安装/升级/签名证据。

## 19. AI Agent 明确禁止清单

任何 Agent 未经当前任务明确授权，不得：

- 开后续任务、stacked PR 或第二个并行 Track；
- 重建 T0–T3、审批队列、state.json、NEXT.md；
- 一次重写 App.tsx/commands.rs/styles.css/export.ts；
- 新增任意 direct Tauri `invoke` 到业务/组件文件；
- 给组件直接文件系统、process、opener、updater、任意 fetch 权限；
- 静默覆盖/删除用户文件；
- 把正文、密钥写入日志或配置导出；
- 把当前 DocumentAdapter registry 当成第三方插件 SDK；
- 提前实现插件市场、任意 JS 插件、MCP 核心架构或 Agent 自动写文件；
- 为长期计划创建一批空接口但没有当前调用方；
- 因为旧 Issue/聊天说有问题，就不在 current main 重新验证直接修；
- 为了通过测试删除/弱化安全检查。

## 20. 阶段约束

- **v0.11**：契约、App/controller 拆分、Rust commands、小步 UI/错误码收口；不做 AI/plugin。
- **v0.12**：性能、权限负向测试、真实主流程与异常行为；不做大产品扩张。
- **v0.13**：普通文件真源的轻量知识库；不引入云数据库。
- **v0.14**：内部 capability ports + AiProvider/ConsentScope mock；仍不开放第三方任意代码。
- **v0.15 / v1.0**：兼容和恢复矩阵、可靠 Windows 发布。
- **post-v1**：只有真实需求和前置边界成熟后，才逐步评估 AI RAG、声明式插件、PDF 文本、EPUB、MCP、sidecar/WASM 等。

长期计划中的条目不是开工许可。只有被提升到 `AI-TASKS.md` 且前序任务已结束的切片才能实现。

## 21. 本地 Agent 交接

推荐本地 Agent 开始时运行 `npm run agent:bootstrap`，读取生成的 `.codex-cache/agent-context.md`；若存在 `.codex-cache/agent-handoff.md`，再读取上一 Agent 的本地未完成事项。

停止工作前，本地 Agent应更新 `agent-handoff.md`，至少记录：

- Task ID；
- branch；
- last commit；
- 已完成；
- 已运行测试；
- 未完成；
- 不得覆盖/回退的关键改动。

`.codex-cache` 永远不提交；共享交接仍以 branch/PR/AI-TASKS/GitHub 为准。
