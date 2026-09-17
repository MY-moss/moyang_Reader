# Moyang Reader 产品路线

路线图只描述产品阶段；当前可执行小任务统一维护在 [`AI-TASKS.md`](AI-TASKS.md)，长期候选和架构方向见 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)，稳定发布事实见 `release-status.json`。

## 产品完成态

v1.0 的目标不是“功能最多”，而是成为一个可靠、离线、本地优先的 Windows x64 文档阅读工作台：文件安全、打开、阅读、编辑、搜索、关联、批注、导出、恢复和更新形成稳定闭环。

核心优势固定为：

1. **轻量**：启动、打开、搜索、切换尽量快，大工作区和大文件有明确降级策略。
2. **本地真源**：Markdown/frontmatter/普通文件仍能被其他工具直接读取，不把正文锁进私有数据库。
3. **阅读优先**：高频阅读、定位、批注、搜索、恢复比“再增加一个知识库功能”优先。
4. **文件安全**：外部修改、保存失败、异常退出、升级和恢复都必须可解释、可回滚。
5. **可持续扩展**：未来 AI、远程内容和扩展通过真实需求提炼出的受控接口进入，不侵入核心文件安全层。

## 当前路线决策（2026-09-17 深度复查）

项目主方向正确，但 v1.0 前原计划承载的知识库、AI 和扩展基础过多。当前正式 Release 仍为 0.10.x，而 `main` 已积累多轮架构、UI 和测试改动；同时 `App.tsx`、Rust `commands.rs`、`export.ts` 等仍是大型编排点。

因此从本次复查起执行以下调整：

- **v1.0 提前**：不再等待轻量知识库、AiProvider、插件/扩展内核完成后才发布 1.0。
- **v0.11 负责收口**：完成桌面交互、第二轮职责拆分、稳定错误契约和 RC 预检。
- **v0.12 负责证明可靠**：性能、大文件、阅读位置、安全负向测试、真实主流程和本地诊断。
- **v0.13 改为 Freeze / Compatibility / RC**：只做兼容、恢复、发布链路、安全文档和阻断级缺陷，不再加入大型产品面。
- **v1.0 后再扩展**：Reading Inbox 优先于 Daily Note/表格数据库；Metadata/Knowledge 次之；AI 再后；插件、RAG、MCP 和第三方运行时代码继续后置。
- **不为未来先造空接口**：必须先有一个真实内置用户动作或真实调用方，再提炼 `DocumentAdapter`、`IndexProvider`、`AiProvider`、`PermissionBroker` 等边界。

当前推荐主线：

```text
A07 → A08 → A09 → A10
  → A11 Workspace/App 职责拆分
  → A12 稳定错误契约
  → A13 v0.11 RC / 发布预检
  → v0.11 正式版
  → B01…B06 可靠性验证
  → v0.12 Exit Gate
  → v0.13 Freeze / Compatibility / RC
  → v1.0
```

在这条主线完成前，新的产品想法可以记录到 Issue 或长期计划，但默认只分析、不编码、不创建实现 PR。

## 已具备的 0.10.x 基线

以下能力已经存在，不再重复作为“未来功能”开发：文档返回历史、书签、文本批注、回收站/上一版本恢复、阅读历史/统计、拼音文件名搜索、阅读位置基础保存、主要键盘/a11y 基线和旧审计中已经关闭的问题。

后续工作从当前 `main` 重新验证，不根据旧审计行号重复造轮子。

## v0.11：结构、桌面体验与 RC 收口

重点：

- TS ↔ Tauri 命令契约集中化与首批运行时响应校验保持为已完成基线。
- 完成命令面板、右侧上下文页签、顶栏信息架构、Windows DPI 和小型视觉回归基线。
- 在设置控制器、文档会话控制器之后，按稳定职责提取工作区会话/扫描/切换/恢复协调；不追求把 `App.tsx` 机械拆到某个行数。
- Rust `commands.rs` 继续只按真实职责小步拆分；没有明确收益的拆分不作为版本阻塞项。
- 完成 #111 的高价值稳定错误码切片：文件访问、保存/恢复、工作区、导出、更新优先。
- 建立 v0.11 RC / 发布预检：完整主旅程、安装包、PDF 落盘、更新器、恢复与外部修改路径必须有真实结果或明确外部阻塞记录。

### v0.11 Exit Gate

进入 v0.12 前应满足：

- A07–A12 完成；
- 新功能不再需要默认把业务状态机继续堆进 `App.tsx`；
- 高频 TS↔Rust 错误可以依赖稳定 code，而不是自然语言关键词；
- 720/900/1240px 和常见 Windows DPI 下高频操作可用；
- v0.11 RC 完整主旅程已执行，无法执行的真实 Windows 项明确记录为外部条件，而不是伪装成通过。

## v0.12：可靠性、性能与真实使用

重点：

1. **大工作区 benchmark**：5k / 20k 文件扫描、冷搜索、暖搜索使用固定语料和可重复报告。
2. **大文件降级**：测量 1MB / 10MB Markdown 的首次可读、编辑切换、搜索、保存、内存与交互延迟；超过边界时明确降级而不是卡死。
3. **稳健阅读位置**：从单一 `{ path, scrollTop }` 演进为兼容式 anchor，优先 `headingId + relative offset / progress ratio + scrollTop fallback`；第一版不必保存正文 quote。
4. **安全负向测试**：覆盖危险 URL scheme、未授权路径和 Tauri opener/process/updater 能力边界。
5. **真实主流程巡检**：首次启动 → 阅读库 → 定位 → 阅读 → 搜索 → 批注/书签 → 编辑 → 保存 → 外部修改 → 关闭/恢复 → 导出。
6. **本地诊断摘要**：用户主动导出，不默认遥测，不包含正文、完整私人路径或密钥。

### v0.12 Exit Gate

只有以下条件满足后才能进入 Freeze：

- 20k 文件工作区有已测量、可解释的行为边界；
- 10MB Markdown 即使不能完整编辑，也有明确且不会卡死的数据安全降级策略；
- 阅读位置不再只依赖有限数量的绝对 scrollTop；
- 危险协议、越权路径和关键 capability 有负向测试；
- 完整真实用户旅程重新走通；
- 无未处理的高严重度文件安全问题；
- 阻断级 P1/P2 产品问题已修复或有明确延期理由。

## v0.13：Freeze / Compatibility / Release Candidate

v0.13 不再承担知识库或 AI 大功能。目标是锁住 v1.0 公共行为并证明升级安全。

重点：

- 冻结设置 key/schema、关键 IPC 名称、核心快捷键、command ids 和主要保存行为。
- 覆盖旧配置、损坏配置、异常退出、磁盘满、只读文件、外部删除/修改、临时文件残留与恢复。
- 验证安装、卸载、重装、旧版本升级、恢复和更新清单一致性。
- 完成 SECURITY.md / 私密漏洞披露可发现性等低成本安全治理项。
- RC 阶段只接受阻断发布的缺陷修复；不新增大型产品面或“顺便重构”。
- Authenticode 有证书则接入；没有证书时明确披露限制、保留 updater 签名与 SHA-256 核验，不把证书缺失无限期作为 v1.0 阻塞。

## v1.0：可靠发布出口

- Windows x64 安装、卸载、升级、恢复和自动更新至少完成一次可追溯实机闭环。
- Release、安装包、updater `.sig`、`latest.json`、镜像和 SHA-256 一致。
- 文件安全、恢复、浏览器 E2E、真实桌面 E2E、a11y、性能与发布检查达到冻结版本标准。
- 公开说明 Windows-only、本地优先、普通文件真源和签名状态。

v1.0 **不要求**：Reading Inbox、Daily Note、Properties 表格、AI provider、RAG、MCP、插件 SDK、插件市场或跨平台安装包。

## v1.1：Reader+ / Reading Inbox（优先候选）

如果 v1.0 后继续扩展产品面，优先验证与“阅读器”最直接相关的闭环：

```text
手动 URL / Digest
  → 受控抓取与清洗
  → 普通本地 article.md + assets
  → 现有 Reader
  → 阅读位置 / 批注 / 书签 / 搜索
```

原则：默认关闭、默认不联网；远程来源与 `DocumentAdapter` 分离；导入后的普通 Markdown 仍是真源；不建立第二套 Reader。

RSS、浏览器扩展、MCP bridge、自动推荐和 AI 精读都必须晚于“一个 URL → 本地 Markdown → 离线阅读”的基本闭环。

## v1.2：Metadata / Knowledge（按真实需求）

候选顺序：

1. Quick Capture / Inbox（创建普通 Markdown）；
2. Frontmatter round-trip safety spike；
3. 顶层简单 scalar / array 的安全 Properties 编辑；
4. 复杂 YAML 保持只读或回退源码模式；
5. 只读属性/标签表格；
6. 只有安全 patch 模型成熟后才评估表格单元格写回。

Daily Note、saved search、collection 和模板不再自动进入主线，有真实使用需求再立项。

## v1.3：AI 阅读辅助

AI 的第一步必须是一个真实用户动作，而不是先做 provider 框架或 mock 平台。

推荐顺序：

1. 选中文本解释或翻译；
2. 明确显示将发送的范围、用途、provider/model；
3. 一个真实 provider 跑通 streaming / cancel / error；
4. 再从真实调用中提炼 `AiProvider`、`ConsentScope`、secret storage 等稳定边界；
5. 当前文档问答、摘要和写作辅助继续逐个小切片扩展。

任何写回继续使用 `candidate → preview/diff → user apply → core safe write`。

## v1.4+：互操作与受控扩展

按真实需求逐步评估：

- PDF 安全文本提取与页码来源；
- EPUB 只读 adapter；
- 声明式扩展包（模板、snippet、主题、prompt preset）；
- OpenAI-compatible / 本地 provider；
- 可选语义检索 / RAG；
- read-only MCP bridge；
- RSS / 浏览器导入来源。

更晚才评估：sidecar/WASM 插件、Agent 写文件、插件市场、自建云同步、跨平台安装包和任意第三方代码执行。

## 长期边界

v1.0 前明确不投入：账号、云同步、实时协作、移动端、macOS/Linux/Windows ARM 安装包、第三方任意脚本插件、DOCX/PDF 原格式回写、常驻后台服务、内置大模型、RAG、插件市场。

任何长期候选只有在前置条件满足、存在真实用户路径后，才拆成 `AI-TASKS.md` 中 0.5–3 天的小任务；不要为了“未来可能需要”提前制造大框架。