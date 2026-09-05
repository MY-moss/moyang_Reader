# ADR 0012：v1.0 前只提供内部能力接口

## 状态

已接受，作为 v0.14 和 v1.0 的架构边界。

长期实施顺序、插件阶段、AI provider、PermissionBroker、MCP 与数据分层详见 [`../FUTURE-DEVELOPMENT-PLAN.md`](../FUTURE-DEVELOPMENT-PLAN.md)。本文只固定“不提前开放不稳定第三方 ABI”这一架构原则，不要求恢复任何旧 AI 审批状态机。

## 背景

产品首先需要成为可靠的本地阅读工作台，同时希望未来接入知识库、AI provider 和受控扩展。提前发布插件 SDK 会迫使项目承诺 ABI、权限、沙箱和兼容策略，并扩大文件与网络攻击面。

## 决策

- v1.0 前只建立 `DocumentAdapter`、`IndexProvider`、`CommandContribution`、`AiProvider` 和 `ConsentScope` 等内部能力接口。
- 核心默认离线；远程 AI provider 由用户配置，发送内容前必须显示范围、用途并获得授权。
- AI 写回必须展示来源和差异并再次确认。
- 不加载任意 JavaScript，不提供 iframe/WebView 插件，不承诺第三方 ABI 或插件市场。
- 内部接口优先让 Moyang Reader 自己的内置功能真实使用，再决定是否适合对外开放。
- 未来如果增加外部扩展，权限必须经过核心受控能力层，不能继承主窗口的原始 Tauri 权限。

## 备选方案

### v1.0 前发布插件 SDK

扩展速度更快，但会在核心接口尚未冻结时形成长期兼容负担和安全风险，因此拒绝。

### 完全不预留扩展边界

当前成本最低，但未来知识库和 AI 会再次侵入 App 与命令层，因此拒绝。

## 后果

- v0.11–v0.13 的拆分需要围绕能力边界，而不是只按文件减行数。
- 内部接口在 v1.0 前仍可演进；外部插件兼容承诺推迟到核心格式和 IPC 冻结之后。
- 插件和 AI 的开发顺序由工程依赖决定，不引入 T0–T3、审批凭证或 policy/state 状态机。
