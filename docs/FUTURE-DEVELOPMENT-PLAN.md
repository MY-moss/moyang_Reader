# Moyang Reader 长期开发计划

> 本文是长期产品与架构方向，不是当前 TODO 清单。短期可执行任务以 [`AI-TASKS.md`](AI-TASKS.md) 为准，阶段摘要以 [`ROADMAP.md`](ROADMAP.md) 为准。后续 AI 不得因为本文出现某项长期能力，就跳过依赖直接开始实现。

## 1. 产品定位

Moyang Reader 的目标不是复制 Obsidian、Notion、VS Code 或某个 AI 客户端，而是成为一个：

- **Windows x64 优先**的本地阅读工作台；
- **普通文件是真源**的轻量知识工具；
- 能稳定阅读、搜索、关联、批注、编辑、导出和恢复；
- 在核心稳定后，可以通过受控接口接入 AI、格式适配器和扩展能力；
- 即使关闭所有 AI / 扩展能力，核心阅读器仍完整可用。

产品长期优势应保持为：轻量、本地、可恢复、好搜索、好阅读、可扩展但不失控。

---

## 2. 不变原则

### 2.1 用户文件永远优先

- Markdown、TXT、DOCX、PDF、图片等普通文件继续是用户内容的真源。
- 不把正文迁入私有数据库才能使用。
- `.moyang/` 只保存旁路元数据，例如批注、未来的可重建索引描述或工作区级配置。
- 派生缓存必须可以删除并重新生成。
- 所有写文件功能继续遵守原子写入、上一版本恢复、外部修改保护和明确失败反馈。

### 2.2 默认离线

- 核心阅读、编辑、搜索、索引、批注、导出默认不依赖网络。
- AI、远程图片、更新检查等联网能力必须是独立、可关闭的功能。
- 关闭 AI 后不能让工作区、搜索或文件格式能力降级。

### 2.3 AI 与插件不能获得“主应用同等权限”

- AI provider、扩展包和未来插件不直接调用任意 Tauri IPC。
- 不直接暴露原始文件系统、`process`、`opener`、`updater` 权限。
- 所有扩展能力通过核心定义的受控接口和权限代理访问。
- 第三方代码不得注入主 WebView 运行。

### 2.4 写回必须可逆

- AI 或扩展产生的内容默认先形成候选结果。
- 修改现有文档时必须显示 diff / 变更范围。
- 大批量修改要显示涉及文件数和路径范围。
- 删除、覆盖、移动等破坏性动作继续由核心文件安全层执行，而不是由插件自行处理。

### 2.5 内部接口先稳定，再开放外部 API

继续遵守 ADR 0012：v1.0 前只建设内部能力端口，不发布插件 SDK，不承诺第三方 ABI。

---

## 3. 当前架构审计结论

### 3.1 已经具备、应该继续利用的基础

- 文档适配器已经有 registry、扩展名映射和能力描述。
- 工作区已经有索引、全文搜索、标签、链接、反向链接和拼音文件名检索。
- 命令面板、快捷键、顶栏动作已经形成可统一的雏形。
- Tauri/Rust 已经承担文件授权、路径校验、读写和 Windows 系统能力。
- 设置已有版本化快照，迁移备份已有 v2 格式。
- 已有浏览器 E2E、真实桌面 E2E、axe、WCAG、reduced-motion 和主题测试。
- 已有书签、批注、阅读历史、恢复、回收站、上一版本等数据安全基础。

这些能力意味着未来不需要重新造一个“AI 版阅读器”或“插件版阅读器”，而应该在现有核心外增加稳定端口。

### 3.2 当前仍存在的结构风险

#### A. 大型编排文件仍然过重

当前 `App.tsx`、Rust `commands.rs`、`styles.css`、`export.ts` 以及部分大型 UI 组件承担较多职责。问题不是文件大本身，而是未来 AI / 插件 / 知识库功能如果继续直接接到这些文件，会重新形成高耦合中心。

方向：继续按“设置、文档会话、工作区、命令、索引、导出、AI”职责提取，而不是一次重写。

#### B. DocumentAdapter 目前主要是能力描述

现有 `DocumentAdapter` 只描述 `id / kind / extensions / capabilities`。长期需要逐步成为真正的行为接口，例如：

- `canOpen`
- `readMetadata`
- `extractText`
- `render`
- `export`
- `supportsEdit`

`extractText` 很重要：未来搜索、AI、RAG 和引用不能假定所有格式都像 Markdown 一样天然有正文字符串。当前 PDF 主要是预览能力，图片也没有正文文本，因此 AI 接入前必须先定义“哪些格式可以提供安全文本、哪些只能预览、哪些需要额外解析/OCR”。

不能一次把所有格式重写进一个万能接口。先让内置 Markdown / TXT 通过新接口跑通，再迁移 DOCX；PDF 文本提取和图片 OCR 作为独立后续能力评估。

#### C. IndexProvider 尚未成为稳定端口

当前索引、搜索、链接解析和 UI 状态已经具备能力，但没有一个稳定的 provider 边界。未来语义搜索、替代索引实现或插件查询如果直接依赖当前内部结构，会增加耦合。

方向：定义只读快照、搜索、刷新/失效、链接查询和统计等最小接口；具体 Rust/TS 实现继续可以变化。

#### D. 命令定义仍分散

同一个动作可能同时出现在快捷键、顶栏、命令面板、右键菜单。长期应由 `CommandContribution` / `CommandService` 统一提供：

- id
- label
- optional icon
- shortcut
- enabled / visible
- execute
- category

UI 只消费命令状态，不各自复制业务判断。

#### E. i18n 与错误契约只完成了一半

中文 / English 基座已经存在，但更新器错误仍依赖自然语言关键词分类，Rust 仍缺稳定错误码。未来 AI provider、插件、同步或 MCP 如果继续返回任意字符串，错误处理会越来越脆弱。

方向：完成 #111，建立稳定的 `code + message + details?` 错误模型；UI 再负责本地化说明。

#### F. AI provider 与密钥存储尚不存在

未来不能把 API Key 放进普通 localStorage、portable settings、`.moyang` 或仓库文件。

方向：

- provider 普通设置使用版本化、命名空间配置；
- API Key / token 使用 Windows 安全凭据存储或等价 OS 安全存储；
- 导出设置默认不包含密钥；
- 日志和错误信息必须做 secret redaction。

#### G. 当前主窗口权限不能直接继承给未来插件

当前主窗口具备核心、dialog、opener、process、updater 等 Tauri capability。未来第三方扩展如果运行在同一个 WebView 并继承这些权限，会扩大攻击面。

方向：第三方 UI 如未来确实需要 WebView，应使用独立受限 capability，或更优先使用核心渲染的声明式 UI；插件本身只与 Permission Broker 通讯。

---

## 4. 版本阶段总计划

## v0.11 — 核心模块化与桌面体验收口

目标：让“当前功能很多”变成“当前功能稳定、好找、好改”。

重点：

1. TS ↔ Rust 命令契约集中化与首批运行时校验。
2. 提取设置控制器、文档会话、后续工作区会话。
3. Rust `commands.rs` 按领域拆分。
4. 搜索入口、命令面板、右侧上下文、顶栏信息架构收口。
5. Windows DPI、主题、视觉回归基线。
6. 完成 #111 剩余的 i18n / 错误码契约。

退出条件：

- 新功能不再默认直接堆进 `App.tsx`；
- 主要用户动作拥有稳定 command id；
- 前后端错误可通过稳定 code 处理；
- UI 主流程在 720px 和常见 DPI 下可用。

## v0.12 — 性能、安全与真实使用验证

目标：证明它在真实工作区和异常环境里可靠，而不是只在测试样例里可靠。

重点：

- 5k / 20k 文件工作区扫描和搜索基准；
- 1MB / 10MB 文档的读取、编辑、搜索、保存、内存测试；
- 大文件降级策略；
- 当前主流程 UX 巡检；
- Tauri opener/process/updater 权限库存和负向测试；
- 本地诊断信息：允许用户主动导出不含正文/密钥的诊断摘要，便于个人项目排查问题，不做默认遥测。

退出条件：

- 已知道大工作区和大文件的安全边界；
- 无已知高严重度文件安全问题；
- 用户可以在不提供私人正文的情况下报告大多数运行故障。

## v0.13 — 轻量知识库

目标：增强组织能力，但不把阅读器变成大型数据库应用。

重点：

- Inbox 快速记录；
- Daily Note；
- 可编辑 Properties；
- 属性 / 标签表格视图；
- 可选的保存搜索 / 智能集合（只有在现有搜索体验稳定后再立项）；
- 简单模板只做普通 Markdown 文件模板，不运行脚本。

退出条件：

- 用户可以从“阅读资料”自然过渡到“记录和整理”；
- 所有知识库数据仍可直接被其他 Markdown 工具读取。

## v0.14 — 内部扩展内核与 AI 接口

目标：建立未来插件和 AI 可以复用的内部接口，但仍不开放第三方任意代码。

### 4.14.1 Capability Ports

逐步稳定：

- `DocumentAdapter`
- `IndexProvider`
- `CommandService / CommandContribution`
- `SettingsNamespace`
- `PermissionBroker`
- `AiProvider`
- `ConsentScope`

这些接口先只供内置功能使用。至少经过两个版本的真实使用后，再讨论外部兼容承诺。

### 4.14.2 权限模型

建议按能力而不是按“插件是否可信”授权：

只读能力：

- `document.current.read`
- `document.selection.read`
- `workspace.metadata.read`
- `workspace.search`
- `workspace.file.read`（必须限定用户已授权工作区）

写入能力：

- `document.selection.replace`
- `document.create`
- `document.frontmatter.update`
- `workspace.file.move`

高风险能力默认不对扩展开放：

- 任意进程执行
- 原始 shell
- 任意网络
- updater
- 任意文件系统路径
- 无确认删除/覆盖

### 4.14.3 AI Provider 第一阶段

先做 provider-agnostic 接口和 mock，不先绑定任何厂商：

- `id / displayName`
- `listModels()`
- `healthCheck()`
- `generate()` / streaming
- `cancel()`
- 可选 `embed()`
- 能力声明：text / vision / tools / embeddings 等

第一批真实 provider 只需要验证两类：

1. 一个远程 API provider；
2. 一个本地或 OpenAI-compatible endpoint provider。

核心业务只依赖 `AiProvider`，不能在阅读/编辑组件里出现特定厂商 SDK 逻辑。

### 4.14.4 ConsentScope

用户每次发给 AI 的上下文必须可见。建议范围从小到大：

- 当前选中文本；
- 当前文档；
- 当前打开的若干文档；
- 当前搜索结果；
- 用户手动选择的工作区文件集合；
- 全工作区只能显式选择，不能默认开启。

请求前 UI 显示：provider、model、发送范围、文件数量、用途；取消后必须停止后续请求和写回。

### 4.14.5 AI 写回

AI 第一阶段只产生：

- 回答；
- 摘要；
- 解释；
- 翻译；
- 标签 / 属性建议；
- 候选 Markdown。

写回已有文件统一进入 diff 流程。AI 不能直接静默保存。

## v0.15 — 兼容冻结

目标：为 v1.0 锁住公共行为。

- 设置 schema；
- portable settings；
- 工作区 sidecar schema；
- command ids；
- IPC 名称；
- 主要快捷键；
- DocumentAdapter / IndexProvider 内部最小接口；
- 文件恢复语义；
- AI provider 配置格式（如果已落地）。

此阶段不再加入大型新功能。

## v1.0 — 可靠发布

继续以 Windows x64 为唯一正式平台，完成：

- 安装 / 卸载 / 升级 / 回滚 / 自动更新实机闭环；
- 文件异常恢复矩阵；
- 安装包签名策略；
- Release / updater / mirror / SHA-256 一致性；
- 安全与隐私文档；
- 核心 E2E / desktop E2E / accessibility / performance 基线。

---

## 5. v1.0 之后的插件路线

插件不是 v1.0 的阻塞项。建议分四个阶段推进。

### P0 — 内部 Contribution（v1.0 前）

只允许内置代码通过统一接口注册：

- commands
- document adapters
- index providers
- AI providers
- settings sections
- context panel contributions

目的：先证明扩展点设计真的能承载项目自身功能。

### P1 — 声明式扩展包（建议 v1.1+）

第一种外部扩展不要运行任意 JavaScript，只读取 manifest 和静态资源。

可以支持：

- 命令别名 / 命令分组；
- Markdown 模板；
- snippets；
- 主题 token 覆盖；
- 文件类型描述；
- AI prompt preset；
- provider 配置描述。

Manifest 建议包含：

- id
- version
- minimumAppVersion
- displayName
- author
- contributions
- requestedCapabilities

这样可以先建立安装、启用/禁用、版本兼容和权限展示，而不引入代码执行风险。

### P2 — 受控 Provider / Sidecar 扩展（建议 v1.2+）

对于必须执行代码的能力，优先考虑“进程外 provider / sidecar + 有限 RPC”，而不是注入主 WebView。

要求：

- 明确协议版本；
- 请求超时和取消；
- 消息大小限制；
- capability allowlist；
- 崩溃只影响该扩展；
- 扩展无法直接拿到主窗口 Tauri 权限；
- 文件内容由核心根据权限按请求转交。

### P3 — 第三方代码插件（需求足够大时再评估）

只有当 P1/P2 无法满足真实用户需求时，才评估：

- WASM sandbox；
- 独立进程；
- 签名扩展包；
- 插件源 / 市场；
- 权限升级提示；
- 兼容性和撤回机制。

**明确不采用：** 在主 WebView `eval()`、加载任意远程 JS、让插件直接 import Tauri API。

---

## 6. AI 功能路线

### AI 前置：统一可提取文本能力

AI 不应只对 Markdown 好用。每个 DocumentAdapter 要明确 `extractText` 能力和来源质量：

- Markdown/TXT：原始文本；
- DOCX：从安全解析结果提取正文和标题；
- PDF：当前预览不等于可供 AI/搜索使用的正文，未来需要独立文本提取能力；
- 图片：默认无正文，OCR 必须作为可选能力而不是偷偷联网；
- EPUB：若未来支持，按章节提供结构化文本。

AI UI 必须告诉用户当前格式是“完整正文”“部分提取”“OCR/视觉理解”还是“不支持正文上下文”。

## AI-1：手动辅助阅读

建议最先落地，因为风险低、价值直接：

- 解释选中文本；
- 总结当前章节 / 当前文档；
- 翻译；
- 对当前文档提问；
- 生成阅读问题；
- 从当前文档提炼术语 / 人物 / 观点。

回答必须显示上下文来源，例如文档名、标题或选区，不需要复杂 agent。

## AI-2：工作区检索增强 / RAG

不能用向量搜索替换现有全文搜索。正确结构是：

`现有词法检索 + 可选语义召回 + 重排 / 合并`

建议：

- 按 Markdown/EPUB 标题、DOCX 标题或可提取段落切块；
- PDF 只有在文本提取质量合格后才进入语义索引；
- 保存 `path + content fingerprint + heading + offsets`；
- 文件修改时只重算变化块；
- embeddings 是派生数据，可随时重建；
- 远程 embedding 必须单独征得同意；
- 本地 embedding provider 可以后加，不捆绑大模型；
- 回答展示检索到的文档来源，不只给模型自然语言答案。

## AI-3：写作辅助

- 改写选区；
- 扩写 / 缩写；
- 生成标题；
- 生成 frontmatter 建议；
- 生成链接建议；
- 将批注整理为新 Markdown。

全部采用“生成候选 → diff → 应用”流程。

## AI-4：受控 Agent

最后才做 Agent。工具应复用核心命令和 PermissionBroker，而不是另建一套文件 API。

第一批工具只允许：

- search workspace
- read selected document
- navigate/open document
- create draft note
- propose patch

默认禁止：

- 删除；
- 覆盖多个文件；
- shell；
- 任意网络；
- 安装插件；
- 修改应用设置；
- 发布 / 更新。

后续如果开放写工具，每次执行前仍由核心检查 scope，并记录本地 action log。

---

## 7. MCP 的定位

MCP 可以成为 v1.0 之后的互操作层，但**不能成为 Moyang Reader 内部架构的唯一基础**。

推荐两种可选方向：

### 7.1 Moyang Reader 作为 MCP Server

用户显式开启后，对外暴露受控只读工具，例如：

- 搜索当前工作区；
- 读取用户授权文档；
- 获取当前文档 / 选区；
- 获取标签、链接、书签和批注。

写工具后置，并继续经过核心 PermissionBroker。

### 7.2 Moyang Reader 作为 MCP Client

让 AI provider 通过 MCP 使用外部工具，但工具权限、结果大小、超时和联网状态仍由应用管理。

由于 MCP 规范仍在演进，必须放在 `McpAdapter` 后面，不让内部 command / AI provider 直接依赖某个协议版本。

---

## 8. 数据与配置分层

长期明确五类数据：

| 类型 | 示例 | 位置原则 | 可否重建 |
| --- | --- | --- | --- |
| 用户正文 | Markdown/TXT/DOCX | 用户文件夹 | 否 |
| 工作区元数据 | 批注、未来工作区设置 | `.moyang/` | 部分否 |
| 应用偏好 | 主题、布局、provider 配置 | App data / settings | 是或可迁移 |
| 密钥 | API Key、token | Windows 安全凭据存储 | 否，且不导出 |
| 派生缓存 | 搜索索引、embedding、缩略图/OCR cache | cache | 是 |

要求：

- 每种持久格式有 `format/version`；
- 大的工作区元数据使用原子写；
- provider / plugin 设置采用 namespace：`provider.<id>` / `extension.<id>`；
- 卸载插件时默认保留非敏感配置一段时间，但提供“同时清理数据”；
- portable settings 明确哪些 namespace 可导出；secret 永不进入普通备份。

---

## 9. 格式能力路线

现有 adapter registry 是正确方向。新增格式或增强既有格式按用户价值与维护成本评估，而不是为了数量。

### 既有格式增强：PDF 深度阅读

当前 PDF 的优势是快速预览。后续如果真实需求明确，优先顺序应是：

1. 安全文本提取；
2. 文内搜索和复制一致性；
3. 目录/页码定位；
4. 将提取文本提供给 AI/RAG，并明确页码来源；
5. 最后才评估 PDF 批注映射。

不以“自己实现完整 PDF 引擎”为目标，也不做 PDF 原格式编辑器。

### 既有格式增强：图片 OCR / 视觉理解

只作为可选功能。优先本地或用户明确配置的 provider；OCR 结果是派生数据，可清除重建。不能因为打开图片就默认把图片发送到远程 AI。

### 高价值候选：EPUB 只读

适合“阅读器优先”定位。先做章节、目录、图片、基础 CSS 的安全阅读；不做 EPUB 原格式编辑。

### 中价值候选：HTML / 单文件网页导入

适合本地归档阅读，但要明确远程资源、脚本清理和 base URL 安全语义。

### 低优先候选

- CSV：只有属性/表格工作流出现明确需求后再做；
- PPTX：解析成本高、阅读价值有限；
- DOCX/PDF 原格式回写：长期仍不建议作为核心目标。

任何新格式先实现内置 adapter，再决定是否适合未来外部扩展。

---

## 10. 搜索与知识发现

推荐顺序：

1. 保持当前全文搜索和拼音定位稳定；
2. 改善排序、字段权重、标题/路径/标签命中解释；
3. saved search / collection；
4. 可选语义检索；
5. AI 问答。

原则：AI 搜索失败时，用户仍可以回到确定性的普通搜索。

---

## 11. 同步、云与跨平台

### v1.0 前

不做自建账号、云同步、实时协作。

用户把工作区放在 OneDrive、Dropbox、Syncthing 等普通同步文件夹时，Moyang Reader 应尽量兼容外部文件修改，这是比自建云更符合当前项目成本的路线。

### v1.0 后

只有出现真实需求再评估：

- 工作区元数据冲突合并；
- 可选端到端加密同步；
- 多设备阅读位置。

跨平台同理。当前只保证 Windows x64，但内部核心不应主动写死 Windows UI 假设；Windows 特有实现放在 platform adapter / Rust 系统层，未来才有低成本评估 macOS/Linux 的可能。

---

## 12. 质量与兼容策略

未来每个新扩展点都要有 contract test：

- DocumentAdapter contract suite；
- IndexProvider contract suite；
- CommandContribution contract suite；
- AiProvider mock contract suite；
- PermissionBroker deny-by-default 测试；
- plugin manifest schema 测试；
- provider 取消、超时、错误、流中断测试；
- secret redaction 测试；
- 配置迁移测试。

AI 特别需要测试：

- provider 不可用；
- 用户中途取消；
- 超大上下文；
- 部分流输出后失败；
- 模型返回空内容；
- 文档文本提取不完整或失败；
- diff 应用时原文件已经改变；
- 远程请求不能偷偷扩大文件范围。

---

## 13. 进入条件，而不是审批门禁

以下只是工程依赖，不是恢复旧的 T0–T3 审批体系。

### 外部插件开始条件

同时满足后才把插件 SDK 任务提到 `AI-TASKS.md`：

- DocumentAdapter / IndexProvider / CommandContribution 已被内置功能实际使用；
- 设置 namespace 和版本迁移存在；
- PermissionBroker deny-by-default 已测试；
- 核心接口至少稳定两个小版本；
- 有至少一个真实插件需求不能用声明式扩展解决。

### AI 真 provider 开始条件

- AiProvider mock contract 通过；
- secure secret storage 可用；
- ConsentScope UI 可用；
- 请求取消 / timeout / error 可控；
- 至少 Markdown/TXT/DOCX 有稳定 `extractText` 路径；
- 不需要修改正文即可完成第一个阅读辅助功能。

### PDF / 图片进入 AI 上下文的条件

- PDF 有可验证文本提取，并能保留页码或可定位来源；
- 图片必须由用户明确启用 OCR/vision；
- UI 能说明“原文 / 提取文本 / OCR / 视觉模型”的来源类型；
- 失败时不伪装成完整文档理解。

### 语义索引开始条件

- B01/B02 性能基线完成；
- 普通搜索仍作为主入口；
- embedding 数据有明确 cache/version/fingerprint；
- 用户能清除和重建语义索引。

### Agent 写文件开始条件

- diff + external change + previous version recovery 已统一复用；
- PermissionBroker 能限制到具体文件集合；
- 每次写入都有本地记录和可恢复路径。

---

## 14. 方向优先级

### 现在（v0.11–v0.12）

- 模块化
- UI/交互收口
- 错误码
- 性能
- 安全负向测试
- 真实 Windows 使用验证

### 接下来（v0.13–v0.15）

- Inbox / Daily / Properties
- 内部 capability ports
- 文档统一 `extractText` 边界
- AI provider mock
- 权限代理
- 安全密钥存储
- 兼容冻结

### v1.0 后优先候选

- AI 选区/当前文档辅助
- OpenAI-compatible / 本地 provider
- 声明式扩展包
- PDF 安全文本提取与 AI 上下文
- EPUB 只读
- saved search / collection
- 可选语义搜索
- MCP read-only bridge

### 明确后置

- Agent 大规模自动改文件
- 插件市场
- 任意第三方 JS
- 自建云账号/同步
- 实时协作
- 跨平台安装包
- 内置大模型
- DOCX/PDF 原格式编辑器

---

## 15. 后续 AI 如何使用本文

1. 先读 `AGENTS.md` 和 `AI-TASKS.md`。
2. 本文只用于确认长期方向和边界。
3. 只有当当前阶段的前置条件已经满足，才把本文某个候选拆成 `AI-TASKS.md` 中 0.5–3 天的小任务。
4. 开工前检查当前代码、Issue 和 PR，避免实现已经完成的能力。
5. 每个切片必须写清：目标、用户价值、非目标、验收、测试、回滚。
6. 不因为“未来需要插件/AI”提前制造复杂框架；优先让当前内置功能真实使用新接口。
7. 不重新引入 policy/plan/state/T0–T3 审批状态机。

这份计划的作用是让项目**有方向但不失控，有扩展性但不提前背兼容债，有 AI 能力但仍然是一个可靠的本地阅读器**。
