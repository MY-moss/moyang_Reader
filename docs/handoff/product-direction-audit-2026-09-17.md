# 产品方向与开发收敛审计 — 2026-09-17

## 结论

当前 `main` 没有发生严重产品跑偏，但已经进入必须收敛、并且应该尽快形成 v1.0 的阶段。

Moyang Reader 的实际产品形态已经从“轻量 Markdown 阅读器”扩展为“轻量、本地优先、阅读器优先的 Windows 文档工作台”。现有能力已经足以形成完整产品：多格式阅读、工作区、全文搜索、双链/标签、编辑、批注、书签、导出、恢复和更新都已经存在。

本次深度复查后的核心调整是：

- **不再把轻量知识库、AiProvider、插件/扩展内核放在 v1.0 前作为必经阶段；**
- **v1.0 提前到 v0.11 收口 → v0.12 可靠性 → v0.13 Freeze/RC 之后；**
- **Reading Inbox 改为 v1.0 后最高优先级产品候选之一，因为它最直接强化 Reader 定位；**
- **Metadata/Knowledge 次于 Reader+；AI 再后；插件、RAG、MCP 和第三方代码继续后置；**
- **长期接口必须从真实内置用户动作提炼，不再采用 provider/mock-first 的架构推进方式。**

## 主要证据

### 1. 产品已经不是“功能不足”的阶段

README 当前已经覆盖：Markdown/TXT/DOCX/PDF/图片、多阅读库、文件树、全文搜索、拼音快速打开、双链/标签/反向链接、关系图、WYSIWYG/源码编辑、批注、书签、阅读历史、恢复、导出、打印/PDF、更新和本地偏好等大量能力。

继续扩展功能数量已经不再是最主要的产品价值。下一阶段的价值来自：可靠、可维护、可发布、长期阅读体验稳定。

### 2. 当前最大的工程问题是真实存在的大型编排中心

当前 `App.tsx` 仍然是非常大的顶层编排文件；Rust `commands.rs` 同样仍承担大量路径、工作区、文件、安全和系统能力。A05 虽已拆出 `commands/document.rs`，但这只是第一阶段。

因此继续按职责拆分是必要的，但目标不是“把文件变小”，而是：

- 工作区、文档会话、设置、IPC、错误等领域拥有明确边界；
- 修改一个领域不要求理解整个 App；
- 新功能不再默认进入 App/commands 中心；
- 每次迁移都有行为等价测试和回滚点。

`export.ts` 同样已经包含 DOCX/ZIP streaming、压缩、CRC、分块写出和取消逻辑，应按真实领域边界治理，而不是作为普通 helper 机械拆分。

### 3. v1.0 前原路线承载了过多“未来架构”

旧路线计划在 v1.0 前完成：

- Inbox / Daily Note / Properties / 表格；
- DocumentAdapter / IndexProvider；
- CommandContribution；
- PermissionBroker；
- AiProvider + ConsentScope；
- 兼容冻结后才进入 v1.0。

这与仓库自身“不要为了未来建立没有真实调用方的空 Provider/Manager/Service”原则存在张力。

本次调整后，v1.0 只要求核心 Reader 完整、可靠、可发布，不要求 AI/知识库/插件架构最终化。

### 4. 当前发布出口明显落后于 main 的开发跨度

当前稳定 Release 仍为 v0.10.14，而 `main` 已经领先多轮结构和 UI 改动。`release-status.json` 仍记录：

- old version update：blocked；
- Authenticode：blocked；
- 部分镜像发布条件仍存在外部依赖。

因此继续增加大功能会让“未真正以安装包验证的代码跨度”继续扩大。

### 5. 旧版 → 新版自动更新实机闭环比 Authenticode 更适合作为 v1.0 硬要求

Authenticode 取决于代码签名证书成本和 Secret 条件。没有证书时可以明确披露“未 Authenticode 签名”，同时保留 updater 签名和 SHA-256 核验。

但从真实用户安全角度，至少成功跑通一次：

```text
旧版本安装
→ 检查更新
→ 下载
→ updater 签名校验
→ 替换安装
→ 重启
→ 新版本启动
```

应该是 v1.0 前必须获得的真实证据。

### 6. 阅读位置应该从 Reading Inbox 前置设计中提升为 Reader Core

当前阅读位置主要使用 `{ path, scrollTop }`，并有有限历史容量。这对于长期阅读大量文档、正文结构发生变化或未来文章库并不稳健。

因此 `Resilient Reading Anchor` 被提前到 v0.12，第一阶段采用：

```text
path
headingId
relativeOffset / progressRatio
scrollTop fallback
updatedAt
```

第一版不强制保存正文 quote/context；如未来需要文本锚点，先做隐私和持久化设计。

### 7. Properties 的真实风险在 frontmatter 无损写回

当前 Properties 只读逻辑和 Rust 元数据提取主要使用轻量字符串规则。这足以做展示/索引，但不足以证明复杂 YAML 可以安全编辑。

因此未来 v1.2 必须先做 frontmatter round-trip safety spike，再逐步开放顶层 scalar/简单数组写回；复杂对象、注释、anchors、特殊 YAML 结构无法安全 patch 时保持只读或源码编辑。

### 8. Reading Inbox 比 Daily Note 更符合项目的长期差异化

Reading Inbox 的正确形态不是重新造一个在线文章 App，而是：

```text
远程来源
→ 受控抓取/清洗
→ 普通本地 Markdown
→ 现有 Reader
→ 阅读位置 / 批注 / 书签 / 搜索
```

它强化的是“Reader”，并且可以继续保持本地真源、默认离线和低锁定。

因此 v1.1 优先考虑 Reader+；Daily Note 不再自动进入主线。

### 9. CI/治理已经足够强，不再继续扩治理系统

当前仓库已经有 unit/lint/type-aware/Playwright/a11y/desktop E2E/Rust/release/docs/architecture/action pin 等多层门禁。

后续新增 CI Gate 必须能够回答：**它要阻止哪一种真实回归？**

不能再因为“治理看起来更完整”增加新的 state machine、approval JSON、task digest 或第二套任务板。

## 新的版本主线

### v0.11 — 收口

```text
A07 命令面板
→ A08 右侧上下文 Tab / ARIA
→ A09 顶栏 IA / Windows DPI
→ A10 CSS / 主题 / 小型视觉基线
→ A11 Workspace Session / 工作区生命周期
→ A12 稳定错误码契约
→ A13 v0.11 RC / 发布预检
```

### v0.12 — 可靠性证明

```text
B01 大工作区 benchmark
B02 大文件边界与降级
B03 Resilient Reading Anchor
B04 Tauri/URL/路径负向安全测试
B05 真实主流程 UX 回归
B06 本地诊断摘要
→ v0.12 Exit Gate
```

### v0.13 — Freeze / Compatibility / RC

- 设置 / IPC / 快捷键兼容矩阵；
- 文件异常恢复矩阵；
- 发布链路与安全披露；
- v1.0 RC 稳定化；
- 不增加大型产品面。

### v1.0

目标：可靠的 Windows x64 本地阅读工作台，而不是“所有未来想法已经实现”。

明确不要求：Reading Inbox、Daily Note、Properties 表格、AI、RAG、MCP、插件 SDK、插件市场、跨平台。

## v1.0 后优先级

### v1.1 — Reader+

优先验证 Reading Inbox：手动 URL → 本地 Markdown → 现有 Reader → 离线继续阅读。Queue/Digest/Offline assets 后置；RSS/AI/MCP 更后。

### v1.2 — Metadata / Knowledge

Quick Capture → frontmatter safety spike → 简单 Properties → 只读表格 → 安全写回。Daily Note/collection 按真实需求再立项。

### v1.3 — AI

先完成真实的选区解释/翻译动作，再从真实 streaming/cancel/error/consent/secret 需求提炼 `AiProvider` 等边界。

禁止：`mock AiProvider → 完整 provider 框架 → 再寻找用户功能`。

### v1.4+

PDF 文本提取、EPUB、声明式扩展、OpenAI-compatible/local provider、RAG、read-only MCP、RSS；第三方代码插件、插件市场、Agent 大规模写文件、云同步和跨平台继续更晚。

## 当前产品防跑偏检查

未来每个大功能立项前都回答：

1. 不使用这个新功能的用户，启动和核心阅读是否仍然一样轻？
2. 普通文件是否仍是真源？
3. 关闭联网/AI 后 Reader 是否完整？
4. 新功能是否能复用现有 Reader、文件安全和搜索，而不是建立第二套系统？
5. 是否存在一个真实用户动作，而不是只存在“以后可能需要”的架构假设？
6. 是否会扩大 `App.tsx` / `commands.rs` 等高耦合中心？如果会，是否先有明确职责边界？

只要其中关键问题答不上来，就先不进入实现队列。

## 文档真源规则

为了避免再次出现“计划文件互相矛盾”：

- 下一步做什么：`docs/AI-TASKS.md`
- 版本阶段：`docs/ROADMAP.md`
- 当前实现架构：`ARCHITECTURE.md`
- 工程禁止边界：`docs/DEVELOPMENT-ARCHITECTURE-CONTRACT.md`
- 长期候选：`docs/FUTURE-DEVELOPMENT-PLAN.md`
- 发布事实：`docs/release-status.json`
- 历史原因：ADR / handoff

Audit/handoff 只能解释历史和决策，不能成为第二套当前任务板。

## 后续待清理项

Issue #461 当前把 Reading Inbox 的完整规范指向 `docs/READING-INBOX-PLAN.md` 和 `docs/decisions/0014-opt-in-reading-inbox.md`。本次审计检查时，这些路径没有在当前 `main` 解析到对应文件。

在 Reading Inbox 真正进入实现前，应二选一：

1. 把 #461 本身设为 canonical spec，并删除失效文档引用；或
2. 恢复/重新提交对应规范文件，并确保路线只保留一个真源。

不需要为了“文档完整”现在重新造一套重复规范。

## 最终判断

项目不需要继续证明“还能加多少功能”，而需要证明：

> 现有功能在真实 Windows、真实大工作区、真实长文、真实异常和真实升级链路中都可靠。

当这一点成立后，Reading Inbox、Metadata、AI 和扩展才会成为建立在稳定 Reader 上的增量，而不是重新改变产品重心。