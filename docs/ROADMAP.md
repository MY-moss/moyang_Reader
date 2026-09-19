# Moyang Reader 产品路线

路线图只描述产品阶段；当前可执行小任务统一维护在 [`AI-TASKS.md`](AI-TASKS.md)，长期候选见 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)，稳定发布事实见 `release-status.json`。

## 产品完成态

v1.0 的目标不是“功能最多”，而是一个可靠、离线、本地优先的 Windows x64 文档阅读工作台：文件安全、打开、阅读、编辑、搜索、关联、批注、导出、恢复和更新形成稳定闭环。

核心优势：

1. **轻量**：启动、打开、搜索、切换尽量快，大工作区和大文件有明确降级策略。
2. **本地真源**：Markdown/frontmatter/普通文件可被其他工具直接读取，不把正文锁进私有数据库。
3. **阅读优先**：阅读、定位、批注、搜索、恢复优先于继续堆知识库功能。
4. **文件安全**：外部修改、保存失败、异常退出、升级和恢复可解释、可回滚。
5. **可持续扩展**：未来 AI、远程内容和扩展从真实内置需求提炼接口，不侵入核心文件安全层。

## 2026-09-17 路线决策

项目主方向正确，但此前把知识库、AI 与扩展基础塞进 v1.0 前置链，范围过大。正式 `v0.11.0` Release 已发布；`main` 已完成 C01–C04 的兼容、恢复、发布安全与 RC 验证，同时 `App.tsx`、Rust command 层与导出系统仍有大型编排点，需要在 v1.0 前冻结继续膨胀。

因此执行：

- **v1.0 提前**：不等待轻量知识库、AiProvider、插件/扩展内核完成。
- **v0.11 负责收口**：桌面交互、职责拆分、稳定错误契约和 RC 预检。
- **v0.12 负责证明可靠**：性能、大文件、阅读位置、安全负向测试、真实主流程、本地诊断。
- **v0.13 = Freeze / Compatibility / RC**：只做兼容、恢复、发布链路、安全治理和阻断级缺陷，不加大型产品面。
- **v1.0 后再扩展**：Reader+ → Metadata/Knowledge → AI → Interop。
- **不为未来先造空接口**：先有真实内置用户动作/调用方，再提炼 DocumentAdapter、index、command、AI/permission 等长期边界。

当前主线：

```text
A07–A13 DONE
  → A14 v0.11.0 Release / Publish DONE
  → B01–B06 DONE
  → C01–C04 DONE
  → D00 v1.0 truth-source / onboarding freeze
  → v1.0 final RC
  → v1.0
```

当前最早可执行任务是 `D00`，具体任务以 [`AI-TASKS.md`](AI-TASKS.md) 为准。在 D00–Dxx 收口前，新产品想法可以记录到 Issue/长期计划，但默认只分析，不编码、不创建实现 PR。

## 已具备的 0.10.x 基线

已有能力包括：导航历史、书签、文本批注、回收站/上一版本恢复、阅读历史/统计、拼音文件名搜索、阅读位置基础保存、主要键盘/a11y 基线，以及旧审计中已关闭的问题。

后续从 current `main` 重新验证，不根据旧审计行号重复开发。

## v0.11：结构、桌面体验与 RC 收口

重点：

- A01–A07 作为已完成基线保留：TS↔Tauri contract、运行时响应校验、settings/document session 提取、首批 Rust command 拆分、搜索语义、命令面板键盘入口。
- A08：右侧 Context Panel 标准 Tab/ARIA/键盘交互。
- A09：顶栏高频动作 IA 与 Windows 100%/125%/150%/200% DPI 可读性。
- A10：CSS/主题收敛与小型视觉回归基线。
- A11：提取 Workspace Session / 扫描 / 切换 / 恢复 / watcher 生命周期，不追求机械行数目标。
- A12：高价值稳定错误码，优先文件访问、保存/恢复、工作区、导出和更新。
- A13：v0.11 RC / 发布预检，走通首次启动 → 阅读库 → 定位 → 阅读 → 搜索 → 批注/书签 → 编辑 → 保存 → 外部修改 → 关闭/恢复 → 导出，并核对安装/PDF/更新/恢复/版本事实。

### v0.11 Exit Gate

进入 v0.12 前必须满足：

- **A07–A13 完成**；
- 新功能不再默认把业务状态机继续堆进 `App.tsx`；
- 高频 TS↔Rust 错误依赖稳定 code，而不是自然语言关键词；
- 720/900/1240px 和常见 Windows DPI 下高频操作可用；
- v0.11 RC 主旅程有可追溯结果；
- 无法执行的真实 Windows/证书/仓库设置事项被精确记录为 `BLOCKED_EXTERNAL` 子项；
- GitHub Release metadata 权威源顺序有自动回归检查；
- desktop correctness smoke 与 performance benchmark 已分离。

## v0.12：可靠性、性能与真实使用

1. **B01 大工作区 benchmark**：5k/20k 文件扫描、冷搜索、暖搜索，固定语料、多轮和 JSON 报告。
2. **B02 大文件降级**：1MB/10MB Markdown 的首次可读、编辑、搜索、保存、内存与交互延迟；超过边界时明确降级而不是卡死。
3. **B03 Resilient Reading Anchor**：从 `{ path, scrollTop }` 演进为兼容式 `headingId + relative offset/progress ratio + scrollTop fallback + updatedAt`；第一版不必复制正文 quote。
4. **B04 Tauri 权限库存与负向测试**：危险 URL scheme、未授权路径、opener/process/updater capability 边界。
5. **B05 当前 main 真实主流程 UX 回归 DONE**：窄窗口上下文抽屉补齐遮罩、Esc 取消和焦点归还；只追加可复现且值得修的小任务。
6. **B06 本地诊断摘要 DONE**：用户主动导出、默认无遥测，不包含正文、完整私人路径或秘密；诊断摘要边界和验证记录见 handoff。

### v0.12 Exit Gate

只有以下条件满足后进入 Freeze：

- 20k 文件工作区有已测量、可解释的行为边界；
- 10MB Markdown 有明确且不会卡死/丢数据的降级策略；
- 阅读位置不再只依赖有限数量绝对 scrollTop；
- 危险协议、越权路径和关键 capability 有负向测试；
- 完整真实用户旅程重新走通；
- 无未处理的高严重度文件安全问题；
- 阻断级产品问题已修复或有明确延期理由。

## v0.13：Freeze / Compatibility / RC（已完成）

v0.13 不承担知识库或 AI 大功能。

重点：

- C01 设置 / IPC / 快捷键兼容矩阵、C02 文件异常恢复矩阵、C03 发布链路与安全披露、C04 v1.0 RC 稳定化均已完成；交接证据和外部状态见 [`docs/AI-TASKS.md`](AI-TASKS.md) 与 `docs/handoff/`。
- 冻结设置 key/schema、关键 IPC 名称、核心快捷键、command ids 和主要保存行为；
- 覆盖旧配置、损坏配置、异常退出、磁盘满、只读文件、外部删除/修改、临时文件残留与恢复；
- 验证安装、卸载、重装、旧版本升级、恢复和更新清单一致性；
- SECURITY.md 与私密漏洞披露可发现性进入发布治理；
- RC 只接受阻断发布的缺陷修复，不新增大型产品面或“顺便重构”；
- Authenticode 有证书则接入；无证书则明确披露限制，保留 updater `.sig` 与 SHA-256 核验，不无限期冻结 v1.0。

## v1.0：可靠发布出口

- Windows x64 安装、卸载、升级、恢复和自动更新至少完成一次可追溯实机闭环；
- Release、安装包、updater `.sig`、`latest.json`、镜像和 SHA-256 一致；
- 文件安全、恢复、浏览器 E2E、真实 desktop E2E、a11y、性能与发布检查达到冻结版本标准；
- 公开说明 Windows-only、本地优先、普通文件真源和签名状态。

v1.0 **不要求** Reading Inbox、Daily Note、Properties 表格、AI provider、RAG、MCP、插件 SDK、插件市场或跨平台安装包。

## v1.1：Reader+

优先验证与“阅读器”最接近的扩展，例如轻量 Reading Inbox / URL 导入：

```text
手动 URL / Digest
  → 受控抓取与清洗
  → 普通本地 article.md + assets
  → 现有 Reader
  → 阅读位置 / 批注 / 书签 / 搜索
```

原则：默认关闭/默认不联网；Content Source 与 DocumentAdapter 分离；导入后的普通 Markdown 仍是真源；不建立第二套 Reader。

RSS、浏览器扩展、MCP、自动推荐和 AI 精读晚于“一个 URL → 本地 Markdown → 离线阅读”的基本闭环。

## v1.2：Metadata / Knowledge

候选顺序：

1. Quick Capture / Inbox，仍创建普通 Markdown；
2. frontmatter round-trip safety spike；
3. 顶层简单 scalar/array 的安全 Properties 编辑；
4. 复杂 YAML 保持只读或回退源码模式；
5. 只读属性/标签表格；
6. 安全 patch 模型成熟后才评估表格单元格写回。

Daily Note、saved search、collection、模板不自动进入主线，有真实需求再立项。

## v1.3：AI

AI 第一步必须是一个真实用户动作，而不是 provider/mock 平台。

推荐顺序：

1. 选中文本解释或翻译；
2. 明确显示发送范围、用途、provider/model；
3. 一个真实 provider 跑通 streaming/cancel/error；
4. 出现第二个真实调用方/实现后再提炼 AiProvider、consent、secret/permission 边界；
5. 当前文档问答、摘要和写作辅助继续逐个小切片扩展。

任何写回遵循 `candidate → preview/diff → user apply → core safe write`。

## v1.4+：Interop / 受控扩展

按真实需求评估：PDF 安全文本提取、EPUB 只读 adapter、声明式扩展包、更多 provider、可选 semantic/RAG、read-only MCP、RSS/浏览器导入等。

更晚才评估 sidecar/WASM 插件、Agent 写文件、插件市场、自建云同步、跨平台安装包和任意第三方代码执行。

## 长期边界

v1.0 前明确不投入：账号、云同步、实时协作、移动端、macOS/Linux/Windows ARM 安装包、第三方任意脚本插件、DOCX/PDF 原格式回写、常驻后台服务、内置大模型、RAG、插件市场。

任何长期候选只有在阶段 Gate 满足、current main 重新验证仍有真实价值后，才拆成 `AI-TASKS.md` 中 0.5–3 天的小任务。
