# Moyang Reader 架构说明

## 目标

Moyang Reader 以“本地文件快速阅读”为第一目标：启动时不加载完整文档解析器，打开文件或文件夹后才按需读取和索引；文档内容默认留在本机，不需要账号或云端数据库。

当前正式产品边界是 **Windows x64、本地优先、普通文件真源的文档阅读工作台**。架构优化的目的不是追求“更漂亮的抽象”，而是让阅读、编辑、搜索、恢复、导出和更新在长期使用下仍然可靠。

## 分层

```text
React UI
  ├─ App.tsx：窗口/区域组合、顶层状态连接与 controller/service 装配
  ├─ components/：顶部栏、命令面板、上下文面板、编辑器、预览
  └─ styles.css：主题、打印样式和阅读布局

应用控制与服务
  ├─ settings-controller.ts：设置读取、写入、损坏恢复和保存状态
  ├─ document-session-controller.ts：打开、草稿、保存、冲突、切换、关闭、恢复
  ├─ workspace-session-controller.ts：工作区载入、切换、缓存与监听
  ├─ workspace-entry-operations-controller.ts：文件树重命名、删除、移动和复制后的会话状态协调
  ├─ bridge.ts + ipc-contract.ts：Tauri 调用与前后端契约边界
  ├─ workspace-index.ts：工作区索引、搜索和标签关系
  ├─ markdown.ts / document-adapters.ts：阅读与文档格式适配
  ├─ export.ts：HTML、DOCX 和打印导出
  └─ storage.ts / preferences.ts：本地会话和偏好

Tauri/Rust
  ├─ commands.rs：当前仍承担大量路径、工作区、文件、安全和系统协调
  ├─ commands/document.rs：已提取的文档识别、解码和元数据逻辑
  ├─ lib.rs：应用生命周期、单实例处理、外部导航兜底
  └─ capabilities/：插件权限和文件监听权限

桌面验证
  ├─ desktop-e2e/wdio.conf.mjs：真实 Tauri Debug 应用与临时工作区夹具
  ├─ desktop-e2e/smoke.e2e.mjs：启动、编辑、保存写回、外部刷新冒烟路径
  └─ scripts/test-desktop-e2e.mjs：仅测试构建的跨平台启动入口
```

## 关键决策

- 使用 Tauri 2 + Rust + React：Windows 文件关联和轻量桌面窗口由 Tauri 负责，阅读界面保留 Web 技术的迭代速度。
- 文件夹是工作区：工作区只保存本地路径，索引在后台建立，用户可以继续先浏览目录。
- 添加文件夹动作同时暴露在空白页、顶部工具栏和 Ctrl/Cmd+Shift+O 快捷键，避免用户必须先找到侧栏入口。
- 启动参数和单实例请求使用带类型的路径消息区分文档与工作区；传入文件夹时直接进入工作区载入流程，传入支持的文档继续进入标签页流程。
- 桌面版拖放由 Tauri Webview 的原生文件拖放事件提供路径，再由 Rust 统一过滤、登记权限并返回文档/工作区类型，浏览器开发模式继续使用浏览器 File API。
- 最近文件和阅读库只持久化本地路径；启动或用户点击最近项目时，Rust 会先规范化、确认存在且类型受支持，再重新登记本次会话的读写范围，不保存文档正文。
- 工作区监听采用差量刷新：事件在前端合并后，仅将变更文件或目录交给 Rust 重新读取，返回作用域内的文件和索引差量；删除路径从前端状态移除，初次打开工作区仍执行完整扫描。
- 全文搜索在 Rust 侧按文件大小和修改时间缓存已解码文本；工作区差量刷新会失效受影响路径，避免连续输入时重复读盘，同时保留首个查询的完整扫描成本。
- 关系索引在工作区快照变化时建立反向链接 Map，当前文档切换只查询相关键；文件树按规范化目录路径复用文件夹节点。
- 快速打开只消费前端已有的工作区文件、最近文件和标签状态，不为定位文档再次读取正文；全文搜索继续由工作区搜索负责。
- Markdown 目录从最终 HAST 渲染树提取：TOC 使用实际渲染后的 heading id，避免目录锚点与页面不一致。
- 更新使用 GitHub Releases + Tauri 签名 updater：updater 签名负责更新包真实性，不等同于 Windows Authenticode 代码签名。
- HTML 是通用导出中间层：HTML 可打印为 PDF；DOCX 导出只处理安全 HTML 的常用块，不引入服务端转换依赖。
- 远程资源策略由本地偏好控制：默认只允许 data 和工作区附件协议，远程图片和更新检查都是可选联网能力。
- 外部链接采用双层防护：前端只把允许的 `http(s)`、`mailto`、`tel` 交给系统打开；主 WebView 导航仍由 Tauri/Rust 限制。
- Markdown 编辑时 Milkdown/源码编辑器负责交互与序列化，统一渲染链仍负责阅读、搜索和导出；编辑器内部状态不得成为持久化真源。
- 外部修改同步必须保持“未保存时只通知、不静默替换”，确认重载前先保留可恢复草稿。
- 真实 Tauri desktop E2E 的测试权限只存在于测试构建；普通构建不得携带测试能力或全局 Tauri API。

## 当前已知架构债

### 1. `App.tsx` 仍是大型编排中心

设置、文档会话、工作区生命周期及文件树操作已经提取，但搜索、导出、弹层和大量顶层 UI 状态仍汇聚在 App。后续继续按真实用户动作提取稳定职责，不以文件行数为目标。

### 2. Rust `commands.rs` 仍很大

已经拆出 `commands/document.rs`，但路径、工作区、文件写入、导出和系统能力仍高度集中。后续只有在出现清晰领域边界和测试收益时继续拆；v1.0 不以“commands.rs 必须足够小”为阻塞条件。

### 3. `export.ts` 是复杂领域模块，不是普通 helper

它已经包含 DOCX、ZIP streaming、压缩、分块写入、取消和大文件内存控制。后续若继续演进，应按导出格式/流式写入等稳定领域拆分，不因为文件长就机械搬运代码。

### 4. 当前阅读位置模型不足以支撑长期 Reader

现有阅读位置主要保存 `{ path, top }`，并有有限历史容量。它适合短期恢复，但正文结构变化、长期文章库或大量文档使用时不够稳健。

v0.12 的方向是兼容式增加：

```text
path
headingId
relativeOffset / progressRatio
scrollTop fallback
updatedAt
```

第一版不要求保存正文 quote/context；如果未来确实需要基于正文片段的精确重定位，必须先做隐私和数据分类决策。

### 5. Frontmatter 当前只适合“轻量读取”，不适合直接无损编辑

右侧 Properties 当前通过简单规则读取顶层字段；Rust 的 title/tags 也有轻量字符串提取。这对展示和索引足够，但不能据此推导“YAML 可以安全 parse → stringify 回写”。

未来 Properties 编辑必须先做 round-trip safety spike；复杂对象、注释、未知字段和格式不能被静默重排或丢失。无法安全 patch 时回退源码模式。

## 数据与持久化原则

- **用户正文**：普通用户文件，是真源；必须可被其他工具直接读取。
- **工作区旁路元数据**：`.moyang/`，不是正文真源；必须版本化。
- **应用偏好/会话**：app settings/local storage；不得含正文真源和秘密。
- **秘密**：未来 API key/token 必须进入 OS 安全凭据存储，不进入 portable settings、日志或 Issue/PR。
- **派生索引/cache**：必须可删除重建。

任何新持久化如果无法先说明属于哪一类，就不能先实现。

## IPC、错误与权限边界

前端到桌面的唯一标准路径是：

```text
component/view
  → controller/service
  → bridge.ts / ipc-contract.ts
  → Tauri command
  → Rust authorization + domain/filesystem
```

规则：

- 组件/业务文件不新增原始 `invoke()`。
- 新跨层接口必须定义稳定 command/event 名、输入、输出、错误 code、授权范围和测试。
- 错误长期统一为 `stable code + technical details`，前端再映射本地化用户提示；不新增自然语言正则作为稳定 API。
- Tauri capability 是桌面权限边界的一部分；未来 AI/扩展不得继承主窗口全部权限。
- 破坏性文件操作继续由核心 Rust/文件安全层执行，不能下放给 AI/插件。

## 扩展接口的建立顺序

v1.0 前不为未来能力建立没有真实调用方的空 `Provider/Manager/Service`。

正确顺序固定为：

```text
真实内置用户动作
  → 明确业务边界
  → 一个可测试的内部接口
  → 第二个真实实现/调用方验证
  → contract tests
  → 再讨论外部扩展兼容
```

例如 AI 不采用“先设计 AiProvider + mock，再寻找用途”的顺序。应先让一个真实的“选区解释/翻译”动作通过一个真实 provider 跑通，再从 streaming、cancel、error、model、consent 的真实需要中提炼 `AiProvider` / `ConsentScope`。

同理：

- `DocumentAdapter` 先由真实内置格式迁移验证；
- `IndexProvider` 先由真实索引/搜索替换需求验证；
- `PermissionBroker` 只有出现需要隔离的新内部/外部能力时才建立；
- MCP/RAG/第三方插件不能反向决定核心 Reader 架构。

## v1.0 前的架构完成标准

v1.0 不要求“架构最终形态”，只要求：

- `App.tsx` 不再是新增复杂业务的默认落点；
- 设置、文档会话、工作区生命周期拥有可测试边界；
- 关键 IPC 和错误契约稳定；
- 大工作区、大文件和阅读位置有明确行为边界；
- 文件恢复和外部修改保护经过真实主流程验证；
- 发布/更新链路事实可追溯；
- AI、知识库、插件、RAG 仍可以完全不存在而不影响核心产品完整性。

## v1.0 后的演进顺序

优先级按“是否强化 Reader”排序：

1. **Reader+ / Reading Inbox**：手动 URL → 安全抓取 → 普通 Markdown → 离线阅读/批注/搜索。
2. **Metadata / Knowledge**：frontmatter 安全编辑和只读派生视图；先证明 round-trip，再提供写入。
3. **AI 阅读辅助**：真实选区解释/翻译动作优先，再抽 provider/consent/secret 边界。
4. **Interop / Extensions**：PDF 文本提取、EPUB、声明式扩展、OpenAI-compatible/local provider、RAG、MCP、RSS。
5. **更晚**：第三方代码插件、插件市场、Agent 大规模写文件、云同步、跨平台。

更详细的执行阶段见 [`docs/ROADMAP.md`](docs/ROADMAP.md)；当前小任务只以 [`docs/AI-TASKS.md`](docs/AI-TASKS.md) 为准。后续重大架构变化新增 ADR，不覆盖历史决策。
