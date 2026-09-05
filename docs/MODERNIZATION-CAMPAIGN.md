# Moyang Reader 受控破坏式现代化 Campaign

> Tracking: #464  
> 状态：**规划完成，允许先执行独立 Fast-Lane 清理；核心架构切片等待 #449 → #458 → #459 → #463 现有链路落地后承接**  
> 核心策略：**Internal Breaking / User-Safe**  
> 目标：在 v1.0 前主动消除会阻碍 Reading Inbox、AI、知识库、新格式和后续扩展的结构瓶颈，同时保持 Windows x64、本地优先、普通文件真源和轻量启动。

---

## 0. 给后续 AI 的最短指令

如果你只读这一节，必须记住：

1. **可以大胆重构内部代码，不可以裸破坏用户数据。**
2. 不把 `App.tsx`、`commands.rs` 或 `styles.css` 拆成另一组同样巨大的文件。
3. 新功能必须通过 feature/domain 接缝进入，不再把几十个 callback 接回 App。
4. 一个 worktree / PR 仍只做一个 coherent slice；但是不同 Track、不同 write-set 可以并行。
5. Green/Yellow/Red 只决定验证强度和是否需要维护者确认，**不是审批状态机**。
6. 不重新引入 T0–T3、`AWAITING_APPROVAL`、policy/state/digest、`ai:finish` 之类旧治理。
7. UI 现代化不是换主题色，而是重做信息架构、组件边界、密度和可扩展入口。
8. 保留 React + TypeScript + Vite + Tauri 2/Rust；不为了“现代”盲目换技术栈。
9. 依赖新增必须证明它减少的复杂度大于引入的维护成本。
10. 不为未来第三方插件提前开放任意 JS ABI；先让 built-in feature registry 经真实功能验证。

---

# 1. 为什么现在值得做一次更激进的现代化

当前项目不是“功能少”，而是逐渐进入**扩展成本上升阶段**。

已确认的结构信号：

- `src/app/App.tsx` 当前约 **250 KB**，导入并编排文档会话、工作区、快捷键、搜索、导出、草稿恢复、更新、通知、布局以及多个 dialog/overlay；
- `TopBar` 同时接收文档、模式、搜索、主题、阅读、导出、更新、设置和大量 callback；
- `WorkspacePanel` 同时接收工作区、文件树、搜索、筛选、批量导出、历史、文件管理和大量 callback；
- `ContextPanel` 直接承接目录、关联、属性、书签、批注、阅读轨道等多个领域；
- `styles.css` 从全局 token 一直写到具体业务组件，当前 chrome typography 甚至存在 9/10/11px 级别；
- 顶栏使用 `More -> Settings -> Export` 等多层 `<details>`，设置、导出、更新和文档动作仍高度耦合；
- Rust `commands.rs` 同时承担访问授权、工作区文件列表、搜索缓存/索引、设置、批注、文件 IO、导出等职责；
- CI 每个 PR 都执行 frontend coverage/build/browser E2E/desktop smoke/release checks/Rust fmt/clippy/test，即使改动与其中大部分无关；
- `.github/pull_request_template.md` 仍残留已经废止的 T0–T3 / `AWAITING_APPROVAL` / `ai:finish` / 批准队列，和当前轻量工作流冲突。

这些问题单独看都不是灾难，但如果继续增加：

```text
Reading Inbox
AI Reading Companion
Daily Note / Properties
EPUB
Semantic Search / RAG
RSS / Content Sources
更多 Inspector 面板
更多设置项
```

扩展成本会以“每个功能都要改 App + TopBar + WorkspacePanel + ContextPanel + styles + bridge”的方式持续增加。

因此本 Campaign 的目标不是追求抽象洁癖，而是把**未来新增功能的改动面从“修改核心”变成“注册 contribution”**。

---

# 2. 破坏边界：什么可以推倒，什么不能推倒

## 2.1 可以 Breaking

以下都属于未公开的内部实现，可以在 `next` 集成线里大幅调整：

- TS 目录结构；
- React component 层级；
- hooks / controller / store 接口；
- App 内部状态模型；
- command 内部 API；
- feature contribution 接口；
- Rust 模块目录；
- 未公开的 Rust helper / service 接口；
- CSS class / token / component style 组织；
- UI 信息架构；
- 设置页面位置与导航方式；
- 内部测试 helper；
- 尚未对外承诺的 DocumentAdapter / IndexProvider 内部接口。

## 2.2 必须 User-Safe

以下视为用户契约，不允许“因为重构方便”直接破坏：

- Markdown/TXT/DOCX/PDF/图片等用户原始文件；
- 原子写、临时文件、上一版本恢复；
- 外部文件修改保护；
- 草稿恢复；
- 已发布的 `.moyang/` 数据；
- 批注、书签、阅读历史、阅读位置；
- app settings 已发布 schema；
- portable settings 的向后兼容；
- 默认离线；
- 用户未授权路径不得读写；
- 密钥不得进入普通 settings/workspace/log；
- Release/Tag/updater/signing 的真实性。

这些契约需要变化时，必须走：

```text
old format
  -> versioned parser
  -> migrate/normalize
  -> new in-memory model
  -> explicit write-back policy
```

不能用：

```text
schema 不一样 -> 清空
```

---

# 3. 分支与集成策略

## 3.1 推荐建立 `next` 集成线

在 Campaign 正式启动后：

```text
main
└─ 稳定、可发布、完整 full CI

next
└─ 现代化集成线
   ├─ codex/runtime-...
   ├─ codex/rust-...
   ├─ codex/ui-...
   ├─ codex/ci-...
   └─ codex/ports-...
```

原则：

- `main` 继续是稳定线；
- `next` 允许内部 breaking；
- feature PR 优先 target `next`；
- `next` 达到一个 migration checkpoint 后再整体回到 main；
- 不让长期 breaking PR 在 main 上堆十几个依赖层。

## 3.2 不建立第二套长期产品

`next` 是临时集成线，不是永久 nightly 产品分支。

最终必须：

```text
next -> main
```

而不是长期维护：

```text
main-old
main-new
```

---

# 4. 技术栈选择：保留、候选、新增禁止

## 4.1 明确保留

```text
Tauri 2
Rust
React
TypeScript
Vite
Vitest
Playwright
WDIO/Tauri desktop smoke
Milkdown
CodeMirror
Unified/remark/rehype
Mammoth
```

理由：这些已经解决真实问题，没有证据证明换框架能带来净收益。

**本 Campaign 不做框架迁移。**

## 4.2 React 不因为重构就强制升级大版本

React 版本升级必须单独证明：

- Milkdown / editor integrations 兼容；
- 测试工具兼容；
- 没有额外 bundle/startup regression；
- 有明确功能或维护收益。

架构重构和 React major upgrade 不要放同一个 PR。

## 4.3 状态管理候选：Zustand

当前没有全局 state library；大量 state/callback 从 App 向下传递。

建议允许引入 `zustand`，但仅在一个真实 domain slice 验证后正式采用。

### 使用范围

适合：

- workspace UI/application state；
- document session snapshot；
- shell/layout state；
- feature-local state；
- command selectors。

不适合：

- 直接把文件系统 IO 放进 store；
- 把所有 domain 塞到一个 `useAppStore`；
- 把 React component ref/DOM node 放进持久 store；
- 用 store 代替 service/bridge。

### 推荐形态

```ts
const documentSessionStore = createStore<DocumentSessionState>()(...)
const workspaceStore = createStore<WorkspaceState>()(...)
const shellStore = createStore<ShellState>()(...)
```

UI 使用 selector：

```ts
const activeDocument = useStore(documentSessionStore, selectActiveDocument)
```

不要：

```ts
const everything = useAppStore()
```

如果第一个 domain spike 证明 vanilla controller + `useSyncExternalStore` 更简单，可以不引入 Zustand；**目标是减少耦合，不是必须使用某个库。**

## 4.4 Runtime schema 候选：Valibot

适合：

- Tauri IPC unknown response；
- native settings；
- portable settings；
- future Digest / provider manifests；
- extension contribution manifests。

原因：运行时验证是当前真实需求，而且 Valibot 模块化、无依赖、客户端 bundle 成本较低。

原则：

- 不为了已完全受 TS 控制的内部对象增加 schema；
- 只验证 trust boundary；
- schema 与错误 code 绑定；
- 不把 validation library API 泄漏进全部业务层。

## 4.5 暂不采用 tauri-specta 作为核心

2026-09 当前 Tauri Specta v2 主包仍处在 2.0 RC 系列。

所以当前策略：

```text
centralized typed IPC contract
+ runtime validation
+ stable error code
```

等 tauri-specta v2 稳定、升级路径清楚后再评估 codegen。

不要为了消除一点手写类型，把核心 IPC 构建在 RC 依赖上。

## 4.6 明确不引入

本 Campaign 不引入：

- Redux Toolkit；
- MobX；
- XState 作为全局应用骨架；
- React Query/TanStack Query（本地 desktop state 并非远端缓存问题）；
- Tailwind；
- shadcn 全量迁移；
- Material UI / Ant Design；
- 完整 Electron-style plugin runtime；
- iframe/WebView 第三方 JS 插件；
- 为状态管理引入数据库。

除非后续出现新的、可量化问题重新立项。

---

# 5. 目标前端目录

这是**目标职责**，不是要求一个 PR 一次移动所有文件。

```text
src/
├─ app/
│  ├─ bootstrap/
│  │  ├─ create-app-runtime.ts
│  │  └─ AppBootstrap.tsx
│  └─ shell/
│     ├─ AppShell.tsx
│     ├─ ActivityRail.tsx
│     ├─ FeatureSidebar.tsx
│     ├─ DocumentArea.tsx
│     └─ Inspector.tsx
│
├─ core/
│  ├─ commands/
│  ├─ errors/
│  ├─ events/
│  ├─ features/
│  ├─ notifications/
│  ├─ permissions/
│  ├─ settings/
│  └─ runtime/
│
├─ features/
│  ├─ library/
│  ├─ reader/
│  ├─ editor/
│  ├─ search/
│  ├─ annotations/
│  ├─ bookmarks/
│  ├─ export/
│  ├─ recovery/
│  ├─ reading-inbox/   # optional, future
│  └─ ai/              # optional, future
│
├─ adapters/
│  ├─ markdown/
│  ├─ text/
│  ├─ docx/
│  ├─ pdf/
│  └─ image/
│
├─ platform/
│  └─ tauri/
│     ├─ bridge/
│     ├─ contracts/
│     └─ schemas/
│
└─ ui/
   ├─ primitives/
   ├─ icons/
   └─ styles/
```

### 目录约束

- `ui/` 不 import feature business service；
- `core/` 不 import具体 React component；
- `features/` 可以依赖 core port；
- `platform/tauri` 实现 core/platform port；
- adapter 不直接操作 Shell；
- Shell 不直接调用 raw Tauri `invoke`；
- 任何 optional feature 关闭时不应被 AppShell 静态 import 大型实现。

---

# 6. AppRuntime

最终 App 不再自己拥有所有 controller/service/store。

```ts
export interface AppRuntime {
  commands: CommandService;
  settings: SettingsService;
  notifications: NotificationService;
  permissions: PermissionBroker;
  features: FeatureRegistry;
  documents: DocumentSessionService;
  workspace: WorkspaceService;
  index: IndexProvider;
}
```

创建：

```ts
const runtime = createAppRuntime({ platform })
```

React：

```tsx
<RuntimeProvider runtime={runtime}>
  <AppShell />
</RuntimeProvider>
```

### 禁止

```tsx
<AppShell
  onOpen={...}
  onSave={...}
  onSearch={...}
  onExport={...}
  onTheme={...}
  onAI={...}
  ...70 props
/>
```

RuntimeProvider 只暴露服务引用，不让所有状态都在一个 Context value 每次重建。

---

# 7. FeatureRegistry：为未来扩展留真正的入口

## 7.1 只做 compile-time built-in module

v1.0 前：

```ts
export interface BuiltInFeatureModule {
  id: string;
  activate(runtime: FeatureRuntime): FeatureActivation;
}
```

可以贡献：

```ts
interface FeatureContributions {
  activities?: ActivityContribution[];
  commands?: CommandContribution[];
  settings?: SettingsSectionContribution[];
  inspectorTabs?: InspectorTabContribution[];
  documentAdapters?: DocumentAdapter[];
}
```

以后 Reading Inbox 可以贡献：

```text
Activity: Reading
Commands: Import URL / Import Digest
Settings: Reading Inbox
Inspector: Article metadata
```

AI 可以贡献：

```text
Activity: AI（enable 后）
Commands: Explain / Translate
Settings: Provider
Inspector: AI Assistant
```

不需要修改 TopBar + WorkspacePanel + ContextPanel + Settings 内部代码。

## 7.2 Feature lifecycle

```ts
interface FeatureActivation {
  dispose(): void;
}
```

Feature 必须能：

- 注册 contribution；
- 取消注册；
- feature off 不启动 timer/network/watch；
- feature off 不读用户无关文件；
- optional heavy chunk 使用 dynamic import。

## 7.3 不要把 FeatureRegistry 做成插件市场

第一版不支持：

```text
npm package discovery
runtime arbitrary JS
third-party WebView
remote install
marketplace
```

FeatureRegistry 的作用只是让**内置模块也遵守未来可扩展边界**。

---

# 8. CommandService

目标：同一个动作只有一份 enabled/visible/execute 逻辑。

```ts
export interface CommandContribution {
  id: CommandId;
  label: () => string;
  category?: string;
  icon?: IconName;
  defaultShortcut?: string;
  visible?: () => boolean;
  enabled?: () => boolean;
  execute(): void | Promise<void>;
}
```

消费者：

```text
Command Palette
Command Bar
Context Menu
Activity Sidebar
Keyboard shortcuts
More Menu
```

都调用：

```text
commands.execute(id)
```

禁止在多个组件复制：

```ts
if (fileName && canEdit && !exporting && ...)
```

---

# 9. SettingsService + Settings contribution

设置不再属于 TopBar。

```ts
export interface SettingsSectionContribution {
  id: string;
  title: string;
  order: number;
  render(): ReactNode;
}
```

基础区：

```text
General
Reading
Editor
Library
Import & Export
Features
Advanced
```

只有 feature 启用/安装时才出现：

```text
Reading Inbox
AI
Provider-specific settings
```

持久化仍由 SettingsService 控制。

Component 不直接：

```ts
localStorage.setItem(...)
```

---

# 10. 文档模型与 Adapter

当前 adapter registry 的方向保留，但升级为真实行为接口。

不要一次定义 20 个万能方法。

建议最小能力拆分：

```ts
interface DocumentAdapter {
  id: string;
  kind: DocumentKind;
  extensions: readonly string[];
  open(input: DocumentOpenInput): Promise<DocumentOpenResult>;
  extractText?(document: OpenDocument): Promise<TextExtractionResult>;
  export?: DocumentExportCapabilities;
  edit?: DocumentEditCapabilities;
}
```

如果 `render` 与 `open` 最终需要拆分，再从真实使用中提取。

### 规则

- Markdown/TXT 先迁；
- DOCX 第二批；
- PDF text extraction 不与 PDF preview 强绑；
- image OCR 不作为基础 adapter 必选能力；
- URL/RSS 不是 DocumentAdapter；
- adapter 错误使用统一 AppError code。

---

# 11. Rust 目标结构

当前 `commands.rs` 的代码不应该简单机械切成：

```text
commands_1.rs
commands_2.rs
commands_3.rs
```

而按 domain：

```text
src-tauri/src/
├─ app_error.rs
├─ access/
│  ├─ mod.rs
│  └─ registry.rs
├─ documents/
│  ├─ mod.rs
│  ├─ read.rs
│  └─ write.rs
├─ workspace/
│  ├─ mod.rs
│  ├─ listing.rs
│  ├─ watcher.rs
│  └─ mutations.rs
├─ search/
│  ├─ mod.rs
│  ├─ cache.rs
│  ├─ index.rs
│  └─ query.rs
├─ annotations/
├─ settings/
├─ export/
└─ commands/
   └─ mod.rs      # 只做 Tauri command facade / registration
```

Rust domain function 尽量可在没有 Tauri window 的情况下测试。

---

# 12. 稳定错误模型

目标：

```rust
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
    pub details: Option<serde_json::Value>,
}
```

Wire：

```json
{
  "code": "FILE_NOT_AUTHORIZED",
  "message": "...",
  "details": {}
}
```

UI：

```text
code -> i18n 用户文案
message/details -> diagnostics
```

错误 code 不包含中文/英文自然语言分类。

### 第一批领域

```text
FILE_*
WORKSPACE_*
SETTINGS_*
ANNOTATION_*
EXPORT_*
IPC_*
```

未来：

```text
ARTICLE_*
AI_*
PROVIDER_*
PERMISSION_*
```

---

# 13. CSS / UI 代码结构

目标：`styles.css` 不再包含全产品全部细节。

```text
ui/styles/
├─ tokens.css
├─ reset.css
├─ themes.css
├─ primitives.css
└─ shell.css

features/library/*.module.css
features/reader/*.module.css
features/editor/*.module.css
...
```

优先使用 Vite 原生 CSS Modules；不引入 CSS-in-JS。

### CSS layer

可以使用：

```css
@layer reset, tokens, base, primitives, shell, feature, utilities;
```

避免 specificity 战争。

### 语义 token

不要：

```css
--green-700
--gray-50
```

业务主要使用：

```css
--color-canvas
--color-surface
--color-surface-raised
--color-text
--color-text-muted
--color-border
--color-accent
--color-danger
--color-warning
```

颜色 palette 只在 theme 层。

---

# 14. 轻量预算

“可扩展”不允许变成“启动加载整个平台”。

## 14.1 Optional feature budget

feature disabled：

- 不启动网络；
- 不启动 timer；
- 不启动 watcher；
- 不注册不需要的 heavy parser；
- heavy implementation 使用 lazy/dynamic import；
- UI contribution 可以只加载极小 metadata。

## 14.2 Bundle budget

第一步先生成当前 baseline，不直接猜绝对 KB 门槛。

记录：

```text
entry JS gzip
entry CSS gzip
lazy editor chunks
DOCX chunk
largest 10 chunks
```

之后规则：

- shell 重构不能无理由显著增加 entry；
- optional feature 主体不进入 entry；
- 新依赖必须写“为什么不能用现有能力实现”。

## 14.3 Runtime budget

测量：

```text
cold launch -> shell visible
open Markdown -> readable
switch tab
Ctrl+P open
workspace 5k/20k scan/search
```

性能改进以 baseline comparison 为准，不把某个开发机毫秒数写成永久 ABI。

---

# 15. UI 目标

详细视觉与交互见 `docs/UI-NEXT-SPEC.md`。

核心结构：

```text
┌──────┬─────────────────────┬───────────────────────────────┬─────────────────────┐
│ Rail │ Feature Sidebar     │ Document Area                 │ Inspector           │
│      │                     │ Command Bar                   │                     │
│Files │ 当前 activity 内容 │ Tabs                          │ Outline             │
│Search│                     │                               │ Properties          │
│Read  │                     │ Reader / Editor               │ Bookmarks           │
│Know  │                     │                               │ Annotations         │
│AI*   │                     │                               │ AI*                 │
│      │                     │                               │                     │
│⚙     │                     │ Status                        │                     │
└──────┴─────────────────────┴───────────────────────────────┴─────────────────────┘
```

`*` = feature enabled 后才显示。

---

# 16. 迁移策略：Strangler，不做 Big Bang

虽然叫“破坏式现代化”，实现方式仍使用 Strangler Pattern。

每个新 domain：

```text
legacy implementation
       ↓
define boundary
       ↓
new service/store/component
       ↓
legacy adapter forwards into new boundary
       ↓
migrate callers
       ↓
remove legacy
```

不要：

```text
复制 App.tsx 为 AppV2.tsx
复制 styles.css 为 styles-v2.css
写完再一次切换
```

这种方式会制造两个应用并行维护。

---

# 17. AI Fast Lane

## 17.1 从“串行项目”改成“并行 Track”

**一个 PR 仍只做一个 coherent slice。**

但可以同时存在多个 PR，只要它们的 write-set 不冲突。

### Track A — Runtime / State / Command

主要 write-set：

```text
src/core/**
src/app/bootstrap/**
src/app/shell/**（与 C 协调）
相关 unit tests
```

### Track B — Rust / IPC / Error

```text
src-tauri/src/**
src/platform/tauri/**
bridge contract tests
```

### Track C — UI / Design System / Shell

```text
src/ui/**
src/features/*/components/**
feature CSS
UI E2E
```

### Track D — CI / Developer Experience

```text
.github/**
scripts/ci-*.mjs
package scripts（仅 CI 命令）
docs workflow
```

### Track E — Ports / Adapters / Feature contribution

```text
src/adapters/**
src/core/features/**
src/core/permissions/**
feature registry tests
```

## 17.2 Shared conflict zone

以下默认是 shared zone，两个并行 PR 不应同时修改：

```text
src/app/App.tsx
src/app/styles.css
package.json
package-lock.json
src-tauri/Cargo.toml
src-tauri/Cargo.lock
vite.config.ts
.github/workflows/ci.yml
```

需要改 shared zone 时：

- 一个 Track 获得该文件写权；
- 其他 PR 等该变更合入 next 后 rebase；
- 不创建“大家一起改最后解决冲突”的工作方式。

---

# 18. 风险车道：不是审批系统

## Green

例子：

- UI 布局；
- CSS/token；
- React 内部重构；
- 新 primitive；
- unit test；
- browser E2E；
- docs；
- 无持久数据变化的 internal store/service。

要求：

- 相关测试；
- CI green；
- 有回滚点。

**不需要人工审批。**

## Yellow

例子：

- Rust/IPC；
- 文件读写实现但行为保持；
- backward-compatible settings migration；
- Permission Broker；
- optional network fetch；
- annotation/storage schema additive migration。

要求：

- targeted negative tests；
- Rust/desktop smoke；
- migration compatibility fixture（涉及持久化时）。

不需要旧式审批票据；验证通过即可进入集成线。

## Red

仅这些需要维护者明确确认：

- 删除/覆盖真实用户文件；
- 不可逆数据迁移；
- 主动扩大到任意文件系统/进程/网络高权限；
- 处理 API Key/证书/签名私钥；
- Release / Tag；
- Windows installer/updater signing；
- 关闭已有恢复保护；
- 丢弃旧设置/批注/草稿的兼容读取。

Red 也不需要 state machine，只需要 PR 明确写：

```text
RED ACTION
风险：...
需要维护者确认：...
```

---

# 19. CI Fast Lane 目标

当前 CI 的问题不是“测试多”，而是**每个 PR 都跑所有测试**。

建议实现一个 dependency-free `scripts/ci-scope.mjs`：

输入 Git diff；输出：

```text
docs=true/false
frontend=true/false
ui=true/false
rust=true/false
desktop=true/false
release=true/false
full=true/false
```

GitHub Actions 之后按 scope 跑 job。

## 19.1 Docs-only

```text
format / documentation check
git diff --check
```

不安装 Playwright/Rust toolchain。

## 19.2 Frontend logic

```text
npm ci
lint
type-aware
format
vitest --changed <base>
build
```

Vitest 4 支持 `--changed` / `related`；配置、package、共享 runtime 变化时自动 fallback full frontend tests。

## 19.3 UI

Frontend logic + relevant Playwright spec。

## 19.4 Rust / IPC / file

```text
frontend contract tests
rust fmt
rust clippy
rust targeted/full test（按共享文件判断）
desktop smoke relevant scenario
```

## 19.5 Release

只有改：

```text
release workflow
updater
signing
version manifests
installer config
```

才在 PR 执行 release preflight。

## 19.6 Full lane

完整矩阵保留：

- `main` push；
- `next` checkpoint；
- manual workflow_dispatch；
- release/tag；
- 可选定期 full run。

这样减少的是**无关重复工作**，不是安全覆盖。

---

# 20. PR 模板（Campaign）

```md
## Slice

- Track: A / B / C / D / E
- Risk lane: Green / Yellow / Red
- Issue/task:
- Write-set:

## 目标

## 用户价值

## 变更

## 不做

## Compatibility

- 用户文件：unchanged / migrated
- settings/sidecar：unchanged / backward-compatible migration
- shortcuts/UI behavior：

## 验证

| Check | Result |
| --- | --- |
| unit | |
| browser E2E | |
| Rust | |
| desktop | |

只填写实际适用项。

## 风险 / 回滚

## Integration

- target: next / main
- conflicts with active Track: no / yes
```

不要再写：

```text
T0/T1/T2/T3
AWAITING_APPROVAL
approval digest
ai:finish
ai:render
批准队列
```

---

# 21. AI Task 模板

```md
### MOD-XX — <动作标题>

**Track:** A/B/C/D/E  
**Risk:** Green/Yellow/Red  
**Depends on:** ...  
**Write-set:** ...

#### 目标

#### 用户价值

#### 当前证据

#### 必须实现

#### 明确不做

#### 接口

#### 验收

- [ ]

#### 验证

#### 回滚
```

后续 AI 必须根据 `Write-set` 控制修改范围。

---

# 22. Campaign 分期

## M0 — 清理治理残留 + 建 baseline

可以与当前 #449/#458/#459/#463 并行。

### MOD-00 — 删除 PR 模板旧审批状态机

Track D / Green

- 更新 `.github/pull_request_template.md`；
- 与 `AGENTS.md` / `AI-WORKFLOW.md` 统一；
- 删除 T0–T3 / approval queue / ai:* 遗留；
- 保留真实风险与测试结果字段。

### MOD-01 — CI scope detector

Track D / Green→Yellow（workflow change）

- 新建 `scripts/ci-scope.mjs` + unit tests；
- 只计算 scope，不先改 CI；
- fixture 覆盖 docs/frontend/ui/rust/release/shared config。

### MOD-02 — CI job split

Track D / Yellow

- 使用 MOD-01；
- docs-only 不跑完整 desktop/Rust；
- main push 保留 full matrix；
- workflow 本身测试/文档同步。

### MOD-03 — Bundle/perf baseline

Track D / Green

生成机器可读 JSON：

```text
chunk sizes
entry sizes
largest chunks
```

不先设武断门槛。

---

## M1 — Runtime Foundation

依赖当前 settings/document session controller 链路落地。

### MOD-10 — AppRuntime skeleton

Track A / Green

只建立真实依赖容器：

```text
settings
documents
notifications
```

不一次注册全部 future ports。

App 行为必须完全等价。

### MOD-11 — Domain store spike

Track A / Green

选 `shell/layout` 或其他低风险 domain 验证：

```text
Zustand vanilla store + selector
vs
现有 controller + useSyncExternalStore
```

PR 必须记录选型结论。

不要从第一天建立全局 `useAppStore`。

### MOD-12 — CommandService first real consumers

Track A / Green

先迁：

```text
quick open
sidebar toggle
context/inspector toggle
search
```

TopBar + CommandPalette 同时消费统一 command。

---

## M2 — UI Primitive + New Shell

### MOD-20 — UI token v2

Track C / Green

- 新 `ui/styles/tokens.css`；
- 字号、spacing、radius、surface 语义；
- 不一次迁全部 styles。

### MOD-21 — Button/Menu/Dialog primitives

Track C / Green

最先提取重复行为最多的 primitive。

**不要**先造 40 个组件设计系统。

### MOD-22 — ActivityRail shell

Track C / Green

初期只贡献：

```text
Files
Search
Settings
```

Reading/Knowledge/AI 先不放占位图标。

### MOD-23 — Dedicated SettingsDialog

Track C + A coordination / Green

- 从 TopBar nested details 移出；
- 复用 SettingsService；
- 原设置数据不变。

---

## M3 — Feature Migration

### MOD-30 — Library feature boundary

Track A/C / Green

从 WorkspacePanel 提取：

```text
LibrarySidebar
WorkspaceTree
LibrarySearch
ReadingActivity
```

不改变文件系统行为。

### MOD-31 — Reader feature boundary

阅读、进度、目录、书签、批注 contribution 化。

### MOD-32 — Editor feature boundary

保持 Milkdown/CodeMirror lazy loading，不在 shell import editor heavy implementation。

### MOD-33 — Export feature boundary

Export 从 TopBar/App 巨型 handler 迁出；用户导出结果保持。

### MOD-34 — Recovery feature boundary

Draft/previous version/external modification 统一 service，但不改变保护策略。

---

## M4 — Rust Domain Split

可与 M2/M3 中不碰 Rust 的 Track 并行。

### MOD-40 — AppError

Track B / Yellow

先让 3–5 个 read-only command 使用 stable code。

### MOD-41 — workspace listing/watcher module

### MOD-42 — search index/cache module

### MOD-43 — document IO/access module

### MOD-44 — annotations/settings module

每个 PR 行为等价、IPC name 不变，直到 facade 层稳定。

---

## M5 — Feature Contribution Kernel

### MOD-50 — FeatureRegistry

先只支持 built-in registration/dispose。

### MOD-51 — ActivityContribution

### MOD-52 — InspectorTabContribution

### MOD-53 — SettingsSectionContribution

### MOD-54 — CommandContribution

只有当至少两个真实 built-in feature 使用后才稳定 interface。

---

## M6 — Adapter / Index ports

### MOD-60 — Markdown/TXT DocumentAdapter behavior

### MOD-61 — DOCX adapter migration

### MOD-62 — IndexProvider read/search snapshot

### MOD-63 — PermissionBroker internal first consumer

不要把 PDF text/OCR/AI/RAG 顺手塞入。

---

## M7 — UI v2 完成与 legacy 删除

### MOD-70 — New Command Bar

### MOD-71 — Inspector replacement

### MOD-72 — WorkspacePanel legacy removal

### MOD-73 — TopBar legacy removal

### MOD-74 — styles.css legacy shrink/removal

### MOD-75 — App.tsx composition-only checkpoint

完成标准不是强行某个行数，而是 App 不再拥有 domain 业务状态和大规模 callback wiring。

---

## M8 — Future Feature Readiness

达到这里后，Reading Inbox / AI Reading Companion 等长期方案可以开始实际 MVP，而不再需要修改旧核心结构。

验证：

- optional feature dynamic import；
- feature enable/disable lifecycle；
- contribution unregister；
- no network when disabled；
- settings section dynamic visibility；
- Inspector/activity injection。

---

# 23. 并行建议

在 #449/#458/#459/#463 尚未完成时，可以并行：

```text
Track D: MOD-00 -> MOD-01 -> MOD-02/MOD-03
Track C: UI-NEXT-SPEC fixture / token prototype（避免改 App/TopBar）
```

待 controller 链完成：

```text
Track A: MOD-10/11/12
Track B: MOD-40/41
Track C: MOD-20/21/22
Track D: CI optimization
```

必须检查 write-set；不要为了“并行”人为制造 merge conflict。

---

# 24. 旧任务如何处理

## 保留

当前 #449 / #458 / #459 / #463：

- IPC contract；
- runtime validation；
- settings controller；
- document session controller。

它们是新架构的前置资产，不推倒。

## 吸收

Issue #16：并入 Track A/M1/M3 的更激进目标。

Issue #171：并入 Track C/UI v2，不再只做“令牌收敛”。

Issue #111：并入 Track B AppError/i18n contract。

## 不复制

不要因为 #464 存在，就把旧 Issue 全关掉然后创建 50 个新 Issue。

只有一个切片真正 ready 时才开对应实现 Issue/PR。

---

# 25. 开发过程中允许删除什么

可以删除：

- 迁移完成且无 caller 的 legacy helper；
- 被新 shell 替代的旧 component；
- 已被 token/module CSS 替代的 legacy style；
- obsolete adapter glue；
- 无效测试 fixture；
- 旧审批模板/状态机文案。

必须先证明无依赖再删。

不能因为“看起来旧”删除：

- recovery path；
- compatibility parser；
- old settings migration；
- file safety guard；
- fallback reader/source mode；
- release integrity check。

---

# 26. 现代化期间的 Dependency Rule

每个新增 production dependency 的 PR 必须写三句话：

```text
1. 当前问题：
2. 为什么现有代码/平台 API 不适合：
3. 新依赖的退出方式：
```

例如 Zustand：如果未来移除，domain store interface 应能保持，UI 不应到处依赖 middleware-specific API。

Valibot：schema 只放 trust boundary，业务层只看 parse result/model。

---

# 27. AI 可直接复制的实现提示词

```text
你现在接手 Moyang Reader Modernization Campaign。

仓库：MY-moss/moyang_Reader
先读：
1. AGENTS.md
2. docs/AI-WORKFLOW.md
3. docs/MODERNIZATION-CAMPAIGN.md
4. docs/UI-NEXT-SPEC.md（涉及 UI 时）
5. 目标 Issue/PR

只执行一个 MOD-XX slice，但允许仓库中其他 AI 同时执行 write-set 不冲突的 Track。

开始前：
- git status --short --branch
- git fetch origin
- 检查同主题开放 PR
- 写明 Track / Risk lane / Write-set / Depends on

Internal API 可以 breaking，但用户文件、settings、.moyang、批注、书签、草稿、恢复和默认离线不能无迁移破坏。

不要重新引入旧审批状态机。Green/Yellow 任务验证满足后即可提交 PR；Red 仅在真实用户数据、不可逆迁移、高风险权限、密钥/签名、正式 Release/Tag 时需要维护者明确确认。

实现后只跑与 scope 匹配的最小充分验证，并在 PR 中列出实际运行结果。不要伪造 desktop、签名或 release 结果。

严禁顺手做下一个 MOD 任务。
```

---

# 28. 完成条件

Campaign 达成时应满足：

- App 是 composition root，不是业务中心；
- major feature 不通过几十个 callback 连接；
- Settings/Command/Inspector/Activity 可 contribution；
- Rust commands facade 轻量，domain 可独立测试；
- IPC 有稳定错误 code 和 runtime validation；
- optional feature 不污染 startup；
- UI 信息层级清楚并满足 Windows DPI/a11y；
- CI 按 scope 快速执行，main/full lane 继续给最终安全保证；
- 后续 Reading Inbox / AI / new adapter 可以主要通过新增 feature/module 实现，而不是改五个核心巨型文件。

这才是本 Campaign 的真正成功指标。