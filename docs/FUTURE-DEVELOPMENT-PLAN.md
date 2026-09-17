# Moyang Reader 长期开发计划

> 本文是长期产品与架构方向，不是当前 TODO 清单。短期可执行任务以 [`AI-TASKS.md`](AI-TASKS.md) 为准，阶段摘要以 [`ROADMAP.md`](ROADMAP.md) 为准。后续 AI 不得因为本文出现某项长期能力，就跳过依赖直接开始实现。

## 1. 产品定位

Moyang Reader 的长期目标不是复制 Obsidian、Notion、VS Code、Readwise Reader 或某个 AI 客户端，而是成为一个：

- **Windows x64 优先**的本地阅读工作台；
- **普通文件是真源**的轻量文档工具；
- 能稳定阅读、搜索、关联、批注、编辑、导出和恢复；
- 在核心稳定后，可以按真实用户路径接入远程内容、AI、格式适配器和受控扩展；
- 即使关闭所有联网、AI 和扩展能力，核心阅读器仍完整可用。

长期优势固定为：**轻量、本地、阅读优先、文件安全、可恢复、可扩展但不失控**。

## 2. 不变原则

### 2.1 普通文件永远是真源

- Markdown、TXT、DOCX、PDF、图片等普通文件继续是用户内容的真源。
- 不把正文迁入私有数据库才能使用。
- `.moyang/` 只保存旁路元数据；数据库/索引/vector store 只能是可重建派生层。
- 所有写文件功能继续遵守安全写入、上一版本恢复、外部修改保护和明确失败反馈。

### 2.2 默认离线

- 核心阅读、编辑、搜索、索引、批注、导出默认不依赖网络。
- Reading Inbox、AI、远程图片、更新等联网能力必须独立、可关闭。
- 关闭联网功能后不能让工作区、搜索、文件格式或恢复能力降级。

### 2.3 用户文件安全高于功能速度

- 静默覆盖、静默删除、失败后清理用户原文件均不可接受。
- AI 或扩展写回统一遵循 `candidate → preview/diff → user apply → core safe write`。
- 批量操作必须展示真实影响范围并可恢复。

### 2.4 不为未来提前造空扩展框架

长期接口只能从真实内置需求中提炼，而不是先设计 provider/plugin 平台再寻找调用方。

推荐顺序：

```text
真实用户动作
  → 一个内置实现
  → 稳定业务边界
  → 第二个实现/调用方验证
  → contract tests
  → 再讨论外部兼容
```

### 2.5 AI / 扩展不能继承主应用全部权限

- 未来 AI provider、扩展包、sidecar 不直接获得主 WebView 的任意 Tauri IPC、文件系统、process、opener、updater 权限。
- 文件和网络范围由核心根据用户授权转交。
- 第三方代码不得直接注入主 WebView。

## 3. 当前架构现实

当前已经具备的基础：

- TS ↔ Rust 集中命令契约与首批运行时响应校验；
- 设置控制器与文档会话控制器；
- 工作区扫描、索引、全文搜索、标签、双链、反向链接和拼音定位；
- 多格式阅读、编辑、批注、书签、导出、恢复和更新；
- 浏览器 E2E、真实桌面 E2E、a11y、主题、发布和架构检查。

当前主要风险不是“缺少扩展点”，而是大型编排中心尚未完全收敛：`App.tsx`、Rust `commands.rs`、`export.ts` 和部分 UI/样式模块仍承担较多职责。

因此 v1.0 前的工程重点是：

- 工作区生命周期从 App 继续按职责拆出；
- 高价值错误改为稳定 code；
- 大工作区/大文件/阅读位置有已测量边界；
- 文件恢复与发布链路经过真实 Windows 验证。

## 4. 版本策略：先完成 v1.0，再扩产品面

此前计划把轻量知识库、Capability Ports、AiProvider 等放在 v1.0 前。本次深度复查后调整为：

```text
v0.11 收口
  → v0.12 可靠性证明
  → v0.13 Freeze / Compatibility / RC
  → v1.0
  → v1.1 Reader+
  → v1.2 Metadata / Knowledge
  → v1.3 AI
  → v1.4+ Interop / Extensions
```

理由：当前产品能力已经足以形成完整 Reader，继续把知识库/AI/插件架构塞进 1.0 前会扩大回归面、延后真实稳定发布，并与“不要提前造空抽象”的架构原则冲突。

## 5. v1.1 — Reader+ / Reading Inbox

这是 v1.0 后的优先产品候选，因为它直接强化“阅读器”而不是把产品变成另一个通用知识库。

### 5.1 最小闭环

第一阶段只证明：

```text
一个公开 URL
  → 用户显式发起
  → Tauri/Rust 受控抓取
  → 安全抽取/清洗
  → 普通本地 article.md + 可选 assets
  → 现有 Reader 打开
  → 阅读位置 / 批注 / 书签 / 搜索复用现有核心
```

### 5.2 不可破坏边界

- 默认关闭、默认不联网；关闭后现有用户几乎感知不到额外复杂度。
- URL/RSS/Digest 属于 **Content Source / Article Import**，不能伪装成 `DocumentAdapter`。
- 导入后的普通 Markdown 是正文真源；索引/队列数据库如以后存在也只能是旁路或派生层。
- 不建立第二套 Reader/Editor。
- 不绕过登录墙/付费墙，不读取浏览器 cookies，不默认下载所有远程资源。
- 网络抓取必须有 redirect、timeout、size、content-type、SSRF 等负向测试。

### 5.3 后续顺序

在手动 URL MVP 之后再依次评估：Queue → Digest manifest → Offline assets → RSS / 浏览器来源 → AI 精读。

不要一开始同时做 RSS、推荐系统、浏览器扩展和 AI。

## 6. v1.2 — Metadata / Knowledge

知识库能力只有在它继续服务“普通 Markdown 真源”时才值得加入。

### 6.1 Quick Capture

最小能力：用户选择一个目录，一键创建普通 Markdown。文件名冲突、权限和写入失败必须走核心安全文件层。

### 6.2 Frontmatter Safety Spike

这是 Properties 编辑的强制前置任务。

当前 Properties/索引只需要轻量读取；真正写回 YAML 时必须验证：

- 未知字段不丢失；
- 注释、空行、字段顺序和常见 scalar/array 风格尽量保留；
- 无法安全 patch 的复杂 YAML 直接保持只读或回退源码模式；
- 不采用简单 `parse → object → stringify → 覆盖整段 frontmatter` 作为默认策略。

第一批写入只考虑顶层常见 scalar 和简单数组。复杂对象、anchors、特殊 tags 等继续只读。

### 6.3 Table / Collection

顺序固定为：

1. 只读派生表格；
2. 证明字段来源与索引一致；
3. Properties 安全 patch 已成熟；
4. 才评估单元格轻编辑。

Daily Note、saved search、collection、模板等不自动进入主线，有真实使用需求再立项。

## 7. v1.3 — AI 阅读辅助

AI 第一阶段不先建立大型 provider 框架，而先完成一个真实用户动作。

### 7.1 第一条真实路径

推荐从“解释/翻译选中文本”开始：

```text
用户选中文本
  → 选择解释或翻译
  → UI 显示 provider/model/发送范围/用途
  → 一个真实 provider
  → streaming result
  → cancel / retry / error
```

这条路径不要求先改正文即可产生价值，风险较低。

### 7.2 从真实调用提炼接口

当第一条真实路径稳定后，再提炼最小 `AiProvider`：

- `id / displayName`
- model selection（确有需要时）
- `generate()` / streaming
- `cancel()`
- stable error mapping

再根据真实需求提炼：

- `ConsentScope`
- secret storage
- current document / search result context
- diff writeback

不要把 vision/tools/embeddings 等未来能力提前塞进第一版接口。

### 7.3 Secret 与隐私

- API key/token 不进入 localStorage、portable settings、`.moyang`、日志、Issue、PR。
- 用户每次发送内容都能看见范围和用途。
- 全工作区上下文不能默认开启。
- 取消后必须停止后续请求与写回。

### 7.4 AI 后续层级

1. 当前文档解释/翻译/摘要/问答；
2. 写作辅助，全部 candidate → diff → apply；
3. 可选语义检索 / RAG；
4. 最后才评估受控 Agent。

RAG 不能替代现有确定性全文搜索；embedding 永远是可删除重建的派生数据。

## 8. v1.4+ — Interop / Extensions

### 8.1 高价值格式方向

- PDF 安全文本提取、页码来源与搜索/AI 上下文；
- EPUB 只读 adapter；
- 图片 OCR/vision 仅在用户明确开启时工作。

### 8.2 声明式扩展优先

第一种外部扩展不要执行任意 JavaScript。可以先支持 manifest + 静态资源形式的：

- 模板；
- snippet；
- 主题 token；
- prompt preset；
- 文件类型描述；
- provider 配置描述。

只有声明式能力无法满足真实需求时，才评估 sidecar / WASM / 独立进程插件。

### 8.3 MCP

MCP 是 v1.0 后的互操作层，不是 Moyang Reader 内部架构的唯一基础。

优先只读能力：

- 搜索当前工作区；
- 读取用户授权文档；
- 获取当前文档/选区；
- 获取标签、链接、书签和批注。

写工具必须继续经过核心文件安全和权限边界。

## 9. 数据与配置分层

| 类型 | 示例 | 位置原则 | 可否重建 |
| --- | --- | --- | --- |
| 用户正文 | Markdown/TXT/DOCX | 用户文件夹 | 否 |
| 工作区旁路元数据 | 批注、未来 queue/metadata | `.moyang/` | 视类型而定 |
| 应用偏好 | 主题、布局、非敏感 provider 配置 | App data/settings | 是或可迁移 |
| 密钥 | API Key、token | OS 安全凭据存储 | 否，且不导出 |
| 派生缓存 | 搜索索引、embedding、OCR cache | cache | 是 |

要求：

- 新持久格式明确 `format/version`；
- 大的工作区元数据使用安全/原子写入；
- secret 永不进入普通备份；
- 派生缓存可删除重建；
- 不允许数据库逐渐变成正文的隐式唯一真源。

## 10. 扩展端口何时才值得建立

### DocumentAdapter

只有当至少两个真实内置格式需要统一行为时，才逐步稳定 `canOpen/readMetadata/extractText/render/export/supportsEdit` 等能力。不要一次重写全部格式。

### IndexProvider

只有出现真实替代索引、语义召回或独立查询实现的需求时建立；普通搜索仍是确定性主入口。

### CommandService / CommandContribution

A07 及后续 UI 收口可以先统一现有命令模型，因为它有多个真实 UI 入口；但不为外部插件承诺 ABI。

### PermissionBroker

只有出现 Reading Inbox、AI、sidecar 或其他需要隔离能力的真实调用方时再建立；底层尽量复用 Tauri capability/permission，而不是自造第二套 OS 权限系统。

### AiProvider

只有真实 AI 动作已经通过一个 provider 工作后再提炼；禁止“mock-first → 再找用途”的架构项目。

## 11. 进入条件，而不是审批状态机

以下是工程依赖，不是 T0–T3 或审批票据。

### Reading Inbox 开始条件

- v1.0 已发布；
- 核心工作区/文件安全/阅读位置稳定；
- 网络抓取可以只通过受控 Rust/Tauri 边界；
- feature off 时没有额外后台网络行为。

### Properties 写回开始条件

- Frontmatter safety spike 证明最小 patch 可行；
- 复杂 YAML 有明确只读/fallback 策略；
- 文件外部修改/恢复路径可复用。

### AI 真功能开始条件

- 至少一个明确阅读动作不需要 AI 写文件即可产生价值；
- secure secret storage 方案明确；
- 请求取消/timeout/error 可控；
- 发送范围和 provider/model 对用户可见。

### 语义索引开始条件

- 普通搜索性能基线稳定；
- embedding 有 cache/version/fingerprint；
- 用户可清除并重建；
- 远程 embedding 单独征得同意。

### Agent 写文件开始条件

- diff + external change + previous version recovery 已统一复用；
- 权限能限制到具体文件集合；
- 每次写入都有本地可恢复路径。

## 12. 方向优先级

### 现在：v0.11–v1.0

- 模块职责收口；
- 稳定错误码；
- Windows DPI / a11y / UX；
- 性能与大文件；
- 稳健阅读位置；
- 安全负向测试；
- 文件恢复；
- 真实 Windows 安装/升级/发布验证。

### v1.0 后优先

1. Reader+ / Reading Inbox；
2. Metadata / Knowledge；
3. AI 阅读辅助；
4. PDF/EPUB/声明式扩展/MCP/RAG/RSS。

### 明确后置

- 第三方任意 JS；
- 插件市场；
- Agent 大规模自动改文件；
- 自建云账号/同步；
- 实时协作；
- 跨平台安装包；
- 内置大模型；
- DOCX/PDF 原格式编辑器。

## 13. 功能方向矩阵

| 方向 | 价值 | 建议时间 | 当前决定 |
| --- | --- | --- | --- |
| UI/交互/错误收口 | 高 | v0.11 | 当前主线 |
| 性能/大文件/阅读位置 | 高 | v0.12 | 当前主线 |
| Freeze/兼容/发布 | 高 | v0.13 | 当前主线 |
| Reading Inbox | 高 | v1.1 候选 | v1.0 后优先 |
| Quick Capture / Properties | 中高 | v1.2 候选 | safety spike 后再写 |
| Daily Note | 中 | v1.2+ | 有真实需求再做 |
| AI 选区/当前文档辅助 | 高 | v1.3 候选 | 真实动作优先 |
| PDF 文本提取 | 中高 | v1.4+ 或 AI 前置 | 候选 |
| EPUB 只读 | 中高 | v1.4+ | 候选 |
| RAG/语义搜索 | 中高 | AI 后续 | 普通搜索稳定后做 |
| 声明式扩展 | 中 | v1.4+ | 先于代码插件 |
| MCP | 中 | v1.4+ | 互操作层 |
| Sidecar/WASM 插件 | 中 | 更晚 | 有真实需求再做 |
| 云同步/实时协作 | 低/成本高 | 更晚 | 暂缓 |
| macOS/Linux | 不确定 | 更晚 | 由真实需求决定 |
| 插件市场/任意 JS | 低优先 | 很晚 | 不提前建设 |

## 14. 后续 AI 如何使用本文

1. 先读 `AGENTS.md` 和 `AI-TASKS.md`。
2. 本文只用于长期方向和边界，不自动产生 TODO。
3. 只有当前版本 Gate 已满足，才把**下一个**长期候选拆成 `AI-TASKS.md` 中 0.5–3 天的小任务。
4. 开工前检查当前代码、Issue、PR 和真实用户路径，避免实现已经完成或尚无需求的能力。
5. 每个切片写清：目标、用户价值、非目标、验收、测试、回滚。
6. 不因为“未来可能需要插件/AI/RAG”提前制造复杂框架。
7. 不重新引入 policy/plan/state/T0–T3 审批状态机。

这份计划的作用是让项目**先成为一个可靠的本地 Reader，再有节制地向 Reader+、Knowledge、AI 和 Interop 演进**。