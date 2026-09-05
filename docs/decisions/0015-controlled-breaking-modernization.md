# ADR 0015: 在 v1.0 前执行受控的内部破坏式现代化

- 状态：Accepted
- 日期：2026-09-05
- 相关：#464、`docs/MODERNIZATION-CAMPAIGN.md`、`docs/UI-NEXT-SPEC.md`、ADR 0001、ADR 0012

## 背景

Moyang Reader 已经形成较丰富的阅读、编辑、工作区、搜索、批注、书签、恢复、导出与更新能力。与此同时，当前主要编排点正在承担越来越多职责：大型 `App.tsx`、`commands.rs`、`styles.css` 以及通过大量 props/callback 连接的 TopBar、WorkspacePanel、ContextPanel 会让 Reading Inbox、AI、知识库、新格式与未来可选功能持续扩大核心改动面。

项目仍处于 v1.0 前，内部接口尚未对第三方承诺稳定 ABI。这是主动调整内部边界成本最低的窗口。

如果继续只做极保守的局部补丁，短期风险低，但未来每加一个能力都可能继续侵入相同核心文件；如果执行 Big Bang 重写，又会复制两套应用并提高用户文件与恢复路径回归风险。

## 决策

采用 **Controlled Breaking Modernization / Internal Breaking, User-Safe** 策略。

### 1. 内部接口允许 breaking

允许重构：

- React component 层级和 props；
- application state/controller/store；
- command/service/feature contribution 内部接口；
- TS/Rust module layout；
- CSS class/token/style organization；
- UI information architecture；
- 尚未公开承诺的 adapter/index/provider 内部接口。

### 2. 用户数据契约不得无迁移破坏

必须保持或兼容迁移：

- 用户普通文件；
- settings；
- `.moyang` 已发布数据；
- annotations/bookmarks/reading state；
- drafts/recovery/previous version；
- 外部修改保护；
- 默认离线；
- 文件授权范围；
- release/updater/signing 真实性。

内部 breaking 不等于允许清空旧数据。

### 3. 使用 Strangler migration，不复制 AppV2

每个领域按：

```text
legacy
 -> define boundary
 -> new service/component
 -> migrate callers
 -> remove legacy
```

逐步替换。

禁止长期维护两套 App、两套 Reader 或两套 CSS 主系统。

### 4. 建立 compile-time built-in Feature Registry

v1.0 前只让内置 feature 贡献：

- activities；
- commands；
- settings sections；
- inspector tabs；
- document adapters。

这用于验证扩展边界，不等于开放第三方 arbitrary JavaScript plugin ABI。

### 5. UI 采用 Activity Rail + Feature Sidebar + Document Area + Inspector

设置从 TopBar nested menu 移到独立 Settings Dialog；当前文档高频动作保留在 Command Bar；可选 feature 只有启用后才贡献入口。

UI Next 的具体规则由 `docs/UI-NEXT-SPEC.md` 定义。

### 6. AI 开发允许按 Track 并行

保留“一个 PR 一个 coherent slice”，但取消“整个项目全局只能同时有一个任务”的隐性串行限制。

不同 Track 在 write-set 不冲突时可以并行开发。

### 7. 验证按风险与改动范围决定

使用 Green / Yellow / Red risk lane：

- Green：普通 UI、内部 TS 重构、样式、测试、文档；
- Yellow：Rust/IPC、兼容迁移、权限、可选网络；
- Red：真实用户数据不可逆操作、高风险权限、密钥/签名、正式 Release/Tag。

Risk lane 只决定验证强度和 Red 是否需要维护者明确确认，不建立新的审批凭证、状态机、digest 或批准队列。

### 8. CI 改为 scope-aware，同时保留 full lane

PR 运行与改动相关的最小充分验证；main push、checkpoint、release 等继续运行完整矩阵。

目标是减少无关重复测试，而不是降低文件安全、桌面或发布验证要求。

## 技术栈决策

保留 React + TypeScript + Vite + Tauri 2/Rust、Milkdown、CodeMirror 等现有基础。

允许通过单独 spike 评估小型状态库和 runtime validation library，但不为现代化引入 Redux、完整 UI 框架、Tailwind、CSS-in-JS 或大型 runtime plugin system。

任何新 production dependency 必须说明真实问题、现有能力不足原因和未来退出方式。

## 结果

### 正面

- v1.0 前可以利用未冻结的内部契约主动偿还结构债；
- 新 feature 更可能通过 contribution 增加，而不是持续修改核心大组件；
- UI 可在不复制 Reader 的情况下容纳 Reading Inbox / AI / Knowledge；
- 并行 Track 和 scope-aware CI 提升 AI 开发吞吐；
- 用户文件和恢复路径继续得到强保护。

### 代价

- `next`/集成阶段会出现较多内部 churn；
- 测试 fixture 和 component imports 需要随迁移调整；
- feature contribution interface 必须经历真实 built-in 使用后才能稳定；
- 并行开发需要 write-set discipline，不能无边界同时修改 shared files。

这些代价优于继续让所有未来功能集中侵入 `App.tsx`、TopBar、WorkspacePanel、ContextPanel 和 `commands.rs`。

## 被拒绝方案

### 继续只做极小保守修补直到 v1.0

拒绝：会把明显的扩展瓶颈一起冻结进 v1.0，后续修改成本更高。

### Big Bang AppV2

拒绝：长时间维护两套实现，回归和 merge 风险高。

### 全面更换前端框架 / Electron

拒绝：没有证据证明能解决当前核心问题，且会破坏现有轻量与桌面安全投资。

### 直接开放第三方 JS 插件

拒绝：权限、ABI、隔离和安全成本过高；先验证 built-in Feature Registry。

### 为了提速取消重要测试

拒绝：只做 scope-aware，完整 main/release lane 继续存在。

## 后续约束

任何 Modernization PR 必须：

1. 标注 Track、Risk lane、Write-set；
2. 一个 PR 一个 coherent slice；
3. 不与并行 PR 无协调写同一 shared conflict zone；
4. internal breaking 时明确迁移 caller；
5. persistent/user contract 变化时提供兼容或回滚；
6. 不重新引入废弃审批状态机；
7. 实际运行与 scope 相匹配的验证；
8. 不顺手开始下一个 MOD slice。
