# Moyang Reader 安全策略

Moyang Reader 是 Windows x64、本地优先的文档阅读/编辑工具。安全问题优先按**不公开敏感细节、可复现、可协同修复**的方式处理。

## 支持范围

- 当前稳定版本：`v0.11.0`。以最新稳定 Windows x64 版本为主要支持对象。
- `main` 会接收尚未发布的安全修复，但不能把 `main` 的 CI 结果当作已发布版本已经修复的证据。
- 旧版本是否回补取决于漏洞影响、修复风险和发布条件；不要默认所有历史版本都会获得补丁。

## 当前报告渠道状态

- GitHub **Private Vulnerability Reporting** 当前仍是 `BLOCKED_EXTERNAL`：需要维护者在仓库 `Security` 设置中启用并实际确认 **Report a vulnerability** 入口；仓库文档不会把未核验的设置写成已开启。
- 在该私密入口确认可用前，只能创建不含漏洞细节的最小公开 Issue，请求维护者提供或开启私密渠道；不要在公开位置提交 PoC、用户内容、私有路径、令牌、证书或签名材料。

## 如何报告漏洞

首选 GitHub **Private Vulnerability Reporting**（仓库 `Security` 页面中的 **Report a vulnerability**），前提是该入口已经由维护者启用。

如果仓库暂时看不到私密漏洞报告入口：

- **不要**在公开 Issue、Pull Request、Discussion 或评论中粘贴利用细节、PoC、用户文件内容、私有路径、令牌、证书、签名材料或其他敏感信息。
- 可以创建一个不包含漏洞细节的最小公开 Issue，只说明“需要私密安全报告渠道”，由维护者先提供或开启私密入口。
- 在没有私密渠道前，不要通过公开附件变相上传敏感材料。

私密报告建议包含：

- 受影响版本或 commit；
- Windows 版本与复现环境；
- 漏洞影响和攻击前提；
- 最小复现步骤或 PoC；
- 已脱敏的日志/截图；
- 如果已知，建议修复方向与可能的回归风险。

## 响应目标

以下是维护目标，不构成商业 SLA：

- 7 个自然日内确认收到报告；
- 14 个自然日内给出初步分级、复现状态或下一步；
- 处理中的高价值问题尽量每 14 个自然日至少同步一次状态；
- 修复完成后再根据影响范围决定补丁版本、公告和是否需要协调披露。

## 协调披露

请在修复、缓解措施或双方约定的披露日期前，不公开可直接利用的技术细节。维护者也不会要求研究者删除合理的安全研究记录，但会优先保护尚未修复用户。

## 重点关注范围

尤其欢迎报告以下问题：

- 未经授权读取、覆盖、删除或移动用户文件；
- 路径穿越、符号链接/重解析点绕过、工作区授权边界绕过；
- 草稿恢复、外部修改检测、原子写入或备份流程导致的数据丢失；
- Tauri capability、IPC、`opener`、`process` 或 updater 权限绕过；
- 危险协议、远程资源或 WebView 导航导致的代码执行/敏感数据泄露；
- 自动更新、Release metadata、更新签名或镜像链路可被篡改/降级；
- 导出临时文件、缓存、日志或诊断信息泄露用户正文或秘密；
- 能稳定导致用户数据损坏或安全边界失效的崩溃问题。

## 通常不在安全漏洞范围

- 仅发生在未支持的操作系统/架构上的兼容性问题；
- 没有可利用路径、只转述第三方依赖公告的通用 CVE；
- 仅因为当前缺少 Windows Authenticode 证书而出现的 SmartScreen/“未知发布者”提示；
- 社会工程、撞库、垃圾信息或需要攻击者已经完全控制本机的场景；
- 以破坏公共服务、消耗资源或访问他人真实数据为目的的压力/破坏性测试。

如果第三方依赖漏洞可以通过 Moyang Reader 的真实输入路径触发，请报告实际可利用路径，而不是只提供 CVE 编号。

## 更新与签名边界

- Tauri updater 的 `.sig` 用于验证更新包完整性/来源，**不等同于** Windows NSIS 安装包的 Authenticode 代码签名。
- GitHub Release 的 `latest.json` 是 updater metadata 权威源；Cloudflare Pages 只作为备用镜像/分发源。
- 发布、镜像、签名与真实 Windows 升级验证要求见 [`docs/UPDATE.md`](docs/UPDATE.md) 与 [`docs/RELEASE-POLICY.md`](docs/RELEASE-POLICY.md)。
- 已知外部阻塞必须如实记录；不能用 CI 绿灯伪装真机升级、证书或外部设置已经完成。

## v0.11.0 发布事实

- GitHub Release、Windows x64 安装包、updater `.sig` 和 `latest.json` 已在线核验；精确 URL、大小和 SHA-256 以 [`docs/release-status.json`](docs/release-status.json) 为准。
- Cloudflare 静态镜像、`v0.10.14 → v0.11.0` 旧版本自动更新实机闭环和 NSIS Authenticode 仍记录为 `BLOCKED_EXTERNAL`。updater `.sig` 与 SHA-256 可用于更新链路核验，但不代表 Windows 代码签名已完成。

## 研究与测试约束

请只使用你拥有或明确获准测试的文件、工作区和环境。不要把真实第三方文档、密钥或个人数据作为公开复现材料。最小合成 fixture 足以证明问题时，优先使用合成数据。
