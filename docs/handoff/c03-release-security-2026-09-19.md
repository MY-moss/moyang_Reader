# C03 发布链路与安全披露收口

日期：2026-09-19

## 范围

C03 只收口发布事实、发布状态门禁和安全披露边界，不生成新版本、Tag、安装包、签名或 Release。

- `release-status-check` 继续核对 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、CHANGELOG 和结构化发布状态；对已发布版本额外要求 Release 证据、GitHub Release 证据、资产下载 URL 与 `vX.Y.Z` tag 一致。
- `SECURITY.md` 明确当前稳定版本、私密漏洞报告入口的 `BLOCKED_EXTERNAL` 状态、公开渠道禁发敏感细节的规则，以及 updater `.sig`、SHA-256 和 Windows Authenticode 的边界。
- `docs/UPDATE.md` 补齐 v0.11.0 的在线发布事实，并继续把 GitHub Release 作为 updater metadata 权威源、Cloudflare 作为备用源。

## v0.11.0 在线事实

- GitHub Release 为非 Draft、非 Pre-release，tag `v0.11.0` 指向 `main@286b1f597102881e577ddae3a7359ad15df422f7`。
- 安装包、updater `.sig` 和 `latest.json` 的版本、文件名、大小、SHA-256 和下载地址已通过 GitHub Release API/manifest 核对；精确值以 [`docs/release-status.json`](../release-status.json) 为准。
- Cloudflare 静态镜像因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 保持 `BLOCKED_EXTERNAL`。
- `v0.10.14 → v0.11.0` 旧版本自动更新实机闭环和 NSIS Authenticode 仍保持 `BLOCKED_EXTERNAL`；updater `.sig` 不等于 Windows 代码签名。
- GitHub Private Vulnerability Reporting 是否已开启仍需维护者在仓库 Security 设置中实际确认，仓库文档不预先声称已开启。

## 验证

- RED：新增资产 URL/tag 漂移测试在旧校验器上失败。
- GREEN：`node --test scripts/release-status-check.test.mjs scripts/documentation-check.test.mjs`：7 项通过。
- `git diff --check` 通过；完整 Vitest、Lint、Build、Prettier、Release/Workflow 检查和 GitHub Quality checks 在 PR 中继续执行。

## 风险与回滚

- 校验器只收紧已发布状态的记录一致性，不调用 GitHub、Cloudflare 或读取凭据；计划中的 pending 状态仍允许缺少未生成资产大小/哈希。
- 不具备证书、仓库设置或旧版安装环境时不伪造完成状态；回滚本 PR 可恢复原校验器和文档，不影响已发布 v0.11.0 资产。
