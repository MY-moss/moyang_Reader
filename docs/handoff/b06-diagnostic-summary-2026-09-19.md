# B06 本地诊断摘要交接

日期：2026-09-19

## 交付范围

- 设置 → 诊断 → 导出诊断摘要；命令面板也提供同一动作。
- Tauri 桌面端通过已有 `choose_save_path` / `write_text_file` 保存 JSON；浏览器预览下载 `moyang-reader-diagnostics.json`。
- `src/app/diagnostics.ts` 负责报告结构、环境归一化、性能摘要和当前会话错误 code 环形记录。
- `ipc-contract.ts` 在保留原有错误行为的同时记录 IPC 错误 code；窗口级未处理异常只记录稳定 code 和安全操作标签。

## 报告边界

报告包含：应用版本、运行时、操作系统类别、浏览器/WebView 引擎类别、界面语言、视口、在线状态、能力开关、主题/模式、工作区数量、活动文档类型与字节数、导航/内存可用指标、最近错误 code。

报告明确声明并通过测试保证：

- 不包含 Markdown、文本、PDF、DOCX 或图片正文；
- 不包含完整工作区路径、文档路径或错误 message/details；
- 不包含 API Key、令牌、私钥；
- 不发送网络请求或默认遥测；
- 错误记录只保留当前会话最近 20 条，并在内存中存在，不写入设置或工作区。

## 验证

- Vitest：104 个测试文件、451 个测试通过。
- `npm run lint`：通过。
- `npm run build`：通过；仅保留既有大 chunk 提示。
- `npm run format:check`：通过。
- Playwright：诊断 JSON 下载与隐私字段回归通过。
- Playwright axe：设置面板无 critical/serious 违规，诊断入口可见。

## 后续边界

报告是用户主动导出的本机摘要，不替代真实 Windows 安装/升级、签名、发布镜像或性能 benchmark 证据；这些继续按 `docs/release-status.json` 和 v0.12/v1.0 外部条件记录。
