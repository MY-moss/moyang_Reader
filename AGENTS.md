# Moyang Reader AI 开发规则

## 产品边界

- Windows x64 本地阅读工作台；React + TypeScript + Vite + Tauri 2/Rust。
- 本地优先，用户文件安全优先；Markdown 与用户原文件保持可直接读取，不建立强绑定私有内容格式。
- 浏览器构建只用于开发预览与 UI 测试。
- v1.0 前不扩展 macOS、Linux、移动端、云同步、AI 产品面、Reading Inbox、RAG、MCP 或第三方脚本插件。
- 不提交密钥、令牌、签名私钥、用户文档、安装包、构建产物或本地缓存。

## 当前收敛期约束（2026-09-17 深度复查）

当前唯一主线是：

```text
v0.11 收口
  → v0.12 可靠性/性能/真实使用
  → v0.13 Freeze / Compatibility / RC
  → v1.0
```

在 v1.0 发布前：

- 不提前实现 Reading Inbox、Daily Note、Properties 表格、AI provider、RAG、RSS、插件市场、MCP、远程内容平台或新的跨平台安装包。
- `AI-TASKS.md` 必须严格顺序推进。v0.11 继续 A07 → A08 → A09 → A10 → A11 → A12 → A13；之后只有满足 Exit Gate 才能进入 B/C 阶段。
- 新代码不得重新把职责堆回 `App.tsx`、`commands.rs` 或其他大型编排中心；提取必须按稳定业务职责进行，并保持行为等价与可回滚。
- 不以文件行数作为重构目标。只在修改影响面、测试边界或真实调用关系得到改善时拆分。
- 当前 `main` 与稳定 Release 有较大开发跨度时，真实 Windows 主流程、安装/升级、PDF 落盘、更新器、恢复和签名事实验证优先于新功能。
- Authenticode 缺失可以作为明确披露的外部限制，但旧版 → 新版自动更新完整实机闭环必须在 v1.0 前至少成功验证一次。
- 旧 AI governance policy/state machine、额外任务板、身份隔离与生成式审批流程均视为历史设计；不得恢复。

## AI 接手流程

本地 Agent 优先先运行：

```powershell
npm run agent:bootstrap
```

然后必须：

1. `git status --short --branch`，不要覆盖已有未提交改动；读取 `.codex-cache/agent-context.md`，如存在再读 `.codex-cache/agent-handoff.md`。
2. 阅读 `docs/AI-TASKS.md` 和 `docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`。
3. 检查最新 `origin/main`、GitHub Open PR / Issue 和目标 PR 的 CI；旧聊天、旧审计、旧 SHA 不能替代当前状态。
4. 严格从任务队列最早未完成项处理：只要更早任务是 `IN_PROGRESS` / `WAITING` 或存在对应开放 PR，就禁止跳到后续 TODO。不能用 stacked PR、多 Track、第二套任务板绕过。
5. 只有远程状态已确认、没有前序阻塞时，才从最新 `origin/main` 创建一个 `codex/<scope>-<date>` 分支或独立 worktree；一个任务一个 PR。
6. 只读取当前任务相关源码、测试、架构边界和一个相似实现，不全仓无目的重写。
7. 完成后运行与改动匹配的测试，把结果写进 PR；若任务来自 `AI-TASKS.md`，同一 PR 更新状态和一句交接。

如果 GitHub/远程状态为 UNKNOWN：可以继续当前已经存在的本地任务分支，但不得自行开启新任务或后续 PR。

## 架构硬边界

详细规范以 [`docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`](docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md) 为准。尤其禁止：

- 在业务/组件文件新增原始 Tauri `invoke`；前端 IPC 统一经过 `bridge.ts` / `ipc-contract.ts`。
- 组件直接拥有文件系统、任意网络、process/opener/updater 或秘密存储。
- 将当前 `DocumentAdapter` metadata registry 当成公开插件 ABI。
- 静默覆盖/删除用户文件；AI/扩展写回必须走核心安全写入，并先 preview/diff。
- 为“以后可能用”建立没有当前内置调用方的空 Provider/Manager/Service。
- 一次重写 `App.tsx`、Rust `commands.rs`、`styles.css`、`export.ts`。
- 把用户正文、API Key/token、证书私钥写入日志、portable settings、`.moyang`、`.codex-cache`、Issue 或 PR。

### 真实调用方优先规则

长期接口必须从真实内置用户路径提炼，顺序固定为：

```text
真实用户动作
  → 一个内置实现
  → 稳定业务边界
  → 第二个真实实现/调用方验证
  → contract tests
  → 再讨论外部扩展兼容
```

因此：

- 不做“先 AiProvider + mock，再找 AI 功能”；未来应先有真实选区解释/翻译路径，再提炼 provider/consent/secret 边界。
- 不为了 RAG 先造 IndexProvider；普通全文搜索仍是确定性主入口。
- 不为了插件先造 PermissionBroker；出现 Reading Inbox/AI/sidecar 等真实隔离需求后再建立。
- Properties 写回前必须先做 frontmatter round-trip safety spike；复杂 YAML 无法安全 patch 时保持只读/源码模式。

## 阅读位置与长期 Reader 边界

当前阅读位置主要依赖 `{ path, scrollTop }`，并有有限历史容量。v0.12 应兼容式增强为 heading/progress/scroll fallback 等稳健 anchor。

第一版不为了定位保存正文 quote/context；如果未来需要正文片段定位，先明确隐私、持久化和迁移策略。

## 开发原则

- 一个 PR 只解决一个清晰问题；发现范围外问题，记录到任务清单或 Issue，不顺手扩大。
- Bug 先补复现测试；UI 改动补至少一个相关 E2E；Rust / 文件 / IPC 改动补对应 Rust 或 desktop smoke。
- 不为了拆文件而拆文件；重构必须保持行为等价，并有可回滚边界。
- 新的长期接口必须有明确职责、依赖方向、输入/输出/错误/权限语义和真实内置调用方。
- 不伪造测试、真机、签名、发布或外部服务验证结果。
- 删除用户文件、修改持久化格式、发布 Release/Tag、处理密钥时必须明确说明风险；普通代码、IPC、UI、重构不需要额外审批凭证。
- 新 CI Gate 必须能说明它要阻止哪一类真实回归；不为治理本身继续增加治理。

## 最小验证

按改动选择，不要求每个小 PR 都跑完整门禁：

- 文档/工具：相关检查 + `git diff --check`
- TS/React：相关单测 + `npm run lint`，必要时 `npm run build`
- UI：上述 + 对应 Playwright E2E
- Rust/IPC/文件路径：相关前端测试 + Rust test/clippy 或 desktop smoke
- 权限/网络：正常路径 + 拒绝/越权等负向测试
- 发布/更新器/签名：完整 CI + 真实 Windows 验证（能做多少写多少，不能做就明确标记未验证）

`main` 的 GitHub `Quality checks` 是最终合并门禁，但不能替代真实 Windows 安装/升级/签名证据。

## 交接

PR 描述保持短而完整：

- 目标 / 用户价值
- 做了什么
- 没做什么
- 测试结果
- 风险与回滚
- 下一步（如有）

本地未 push 的工作可记录在 `.codex-cache/agent-handoff.md`；它只是一台电脑上的便签，不是共享状态机，不得提交。

长期路线看 `docs/ROADMAP.md`；当前可执行任务只看 `docs/AI-TASKS.md`；架构硬边界看 `docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`；长期候选看 `docs/FUTURE-DEVELOPMENT-PLAN.md`；稳定版本和外部阻塞看 `docs/release-status.json` / `docs/AI-HANDOFF.md`。