# Moyang Reader 产品路线

路线图只描述产品阶段；当前可执行小任务统一维护在 [`AI-TASKS.md`](AI-TASKS.md)，插件、AI、MCP、数据分层和 v1.0 后扩展策略详见 [`FUTURE-DEVELOPMENT-PLAN.md`](FUTURE-DEVELOPMENT-PLAN.md)，稳定发布事实见 `release-status.json`。

## 产品完成态

v1.0 是可靠、离线、本地优先的 Windows x64 阅读工作台。文件安全、打开、阅读、编辑、搜索、关联、导出、恢复和更新构成稳定闭环。

核心方向不是堆功能，而是形成四个优势：

1. **轻量**：启动、打开、搜索、切换尽量快，大工作区也有明确降级策略。
2. **本地真源**：Markdown/frontmatter/普通文件仍能被其他工具直接读取，不把内容锁进私有数据库。
3. **交互顺手**：高频入口清楚、键鼠逻辑一致、Windows DPI 与主题下可读。
4. **可持续扩展**：代码按职责拆分、测试边界清楚，未来 AI / 插件通过受控接口进入，不侵入核心文件安全层。

## 已具备的 0.10.x 基线

以下能力已经存在，不再重复作为“未来功能”开发：文档返回历史、书签、文本批注、回收站/上一版本恢复、阅读历史与本机统计、拼音文件名搜索、阅读位置迁移、主要键盘/a11y 基线和旧审计 #357–#366 中已关闭问题。

后续工作从当前 `main` 重新验证，不根据旧审计行号重复造轮子。

## v0.11：契约、模块化与使用体验

- 完成 TS ↔ Tauri 命令契约集中化和首批运行时响应校验。
- 渐进拆分 `App.tsx`：先设置/偏好，再文档会话和工作区生命周期。
- 分阶段拆 `commands.rs`，保持 IPC 名称、授权和文件行为不变。
- 明确快速打开、文内查找、阅读库搜索和命令面板的用途边界。
- 补齐命令面板活动项语义、右侧上下文页签键盘模型和焦点恢复。
- 审查顶栏/More/设置/导出的信息层级，避免高频动作被重复或藏得过深。
- 验证 Windows 100%/125%/150%/200% DPI 与 720/900/1240px 关键布局。
- 继续收敛 CSS 令牌，并只为稳定关键场景建立小型视觉回归基线。
- 完成 #111 剩余的 i18n / 稳定错误码契约，为未来 provider / extension 错误处理打基础。

目标不是追求某个文件行数，而是让每次修改只需要理解一个较小职责边界。

## v0.12：稳定性、性能与真实使用

- 建立 5k/20k 文件工作区的可重复扫描/搜索 benchmark。
- 测量 1MB/10MB Markdown 首次可读、编辑、搜索、保存和内存占用。
- 大文件超过安全阈值时明确降级，而不是卡死或静默失败。
- 直接从当前 `main` 跑“首次启动 → 打开阅读库 → 找文档 → 阅读 → 编辑 → 保存 → 恢复 → 导出”的真实主流程巡检；只处理可复现且明显影响使用的问题。
- 对 Tauri opener/process/updater 做权限库存与负向测试；先证明问题，再收权限。
- 规划可由用户主动导出的本地诊断摘要，不默认上传正文、路径或密钥。

## v0.13：轻量知识库

- Inbox 快速记录，继续创建普通 Markdown。
- Daily Note 按用户指定目录生成普通 Markdown。
- YAML frontmatter Properties 面板从只读升级为安全编辑。
- 属性 / 标签表格视图，Markdown 仍是真源。
- 搜索稳定后再评估 saved search / collection 和简单文件模板。

不复制 Notion/Obsidian 的全部功能；只吸收对阅读工作台真正高价值的能力。

## v0.14：内部扩展内核与 AI 接缝

- 将现有文档 adapter registry 逐步升级成真实可执行的 `DocumentAdapter` 内部接口。
- 建立 `IndexProvider`、`CommandService / CommandContribution`、`SettingsNamespace` 与 `PermissionBroker`。
- 建立 `AiProvider` 与 `ConsentScope`；先使用 mock 验证接口、取消、错误、流式输出和可见上下文范围。
- provider 普通配置与 secret 分离；API Key/token 不进入 portable settings 或工作区文件。
- 核心默认不联网；发送内容时展示范围、用途、provider/model；写回提供 diff。
- v1.0 前仍不加载任意脚本、iframe/WebView 插件，不承诺第三方 ABI。

## v0.15：冻结与兼容

- 冻结设置 key/schema、IPC 命令、核心快捷键、command ids 和主要保存行为。
- 覆盖损坏设置、异常退出、磁盘满、只读文件、外部删除/修改和大文件降级。
- 验证升级、重装、旧配置和旧版本数据兼容。
- 冻结 v1.0 所需的最小 DocumentAdapter / IndexProvider / AI provider 配置边界。
- 关闭所有高严重度缺陷；其余延期必须有明确理由。

## v1.0：发布出口

- Windows x64 安装、卸载、升级、恢复和自动更新完整验证。
- Release、安装包、updater `.sig`、`latest.json`、镜像和 SHA-256 一致。
- 有 Authenticode 证书则完成签名；没有时明确披露，不把 updater 签名描述成 Windows 代码签名。
- 完整前端、Rust、浏览器、真实桌面、安全和恢复矩阵通过。

## v1.0 后：按真实需求扩展

优先候选：

- AI 选区/当前文档解释、总结、翻译和问答；
- 一个远程 provider + 一个本地/OpenAI-compatible provider；
- 声明式扩展包（模板、snippet、主题、prompt preset），先不运行任意第三方 JS；
- EPUB 只读 adapter；
- saved search / collection；
- 词法搜索之上的可选语义检索/RAG；
- 受控的 read-only MCP bridge。

更晚再评估：受控 sidecar 插件、Agent 写文件、插件市场、自建云同步、跨平台安装包和任意第三方代码执行。

## 长期边界

v1.0 前暂不投入：账号、云同步、实时协作、移动端、macOS/Linux/Windows ARM 安装包、第三方任意脚本插件、DOCX/PDF 原格式回写、常驻后台服务或捆绑本地大模型。

任何长期候选只有在前置条件满足后，才拆成 `AI-TASKS.md` 中 0.5–3 天的小任务；不要为了“未来可能需要”提前制造大框架。
