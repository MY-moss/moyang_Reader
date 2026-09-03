# Moyang Reader 版本与发布政策

当前稳定基线：`v0.10.14`。该版本的 tag、Windows x64 安装包、签名和 manifest 已在线核验；公开 Pages 镜像的 v0.10.14 资产也已核验，但 Release workflow 的自动镜像 job `33555344560` 未执行部署步骤，仓库 Cloudflare Secrets 尚未对该工作流生效，不得误判为自动同步全绿。

## v0.10.14 已发布（2026-09-02）

- 发布代码：`main@ec76d3d0a812d1413a619c6b843972ffa57ffd47`；Release run `33555344560` 的质量门禁、Windows 构建、签名和 GitHub Release 发布成功。
- Windows x64 安装包：5,243,339 字节，SHA-256 `293b3884f2e66659e7ce2ab4f333dc01dcd0bf0a48ddd0ed8bbff42d661cce59`。
- 签名文件：428 字节，SHA-256 `fd832a5689c9064118dd0bb8e9c3ba3d88e0a75da0c061bbd6809b069ab70adf`；`latest.json` 1,413 字节，SHA-256 `dfb110ba23f248d6c374d714613888511f99a4aae2b038219caeea27350af8cc`。
- GitHub 和 Cloudflare Pages 资产均 HTTP 200，镜像安装包大小与 SHA-256 和 GitHub Release 一致；自动镜像仍需维护者配置 Secrets 后重跑验证。
- `docs/release-status.json` 记录当前版本、Windows x64 Release 三项资产、公开/静态镜像状态、旧版本更新与 Authenticode 外部结论，以及交接文件路径；`npm run release:status` 只读校验这些状态，不触发发布。

本文件是所有 AI、贡献者和维护者判断“是否升版本、是否生成安装包、是否创建 Release”的共同规则。功能切片可以快速合并，但不能长期只累积代码而不提供可用的稳定安装包。

## 平台范围

当前只发布 Windows x64 桌面版。公开 Release、NSIS 安装包、更新签名、`latest.json`、Cloudflare 镜像和旧版本自动更新验证都只针对 Windows x64；不生成 macOS/Linux/Windows ARM 安装包，也不为这些平台增加默认 CI 或桌面 E2E。浏览器版只用于开发预览和 UI 测试。

## 版本规则

Moyang Reader 使用 `MAJOR.MINOR.PATCH` 版本号。当前仍处于 `0.x` 阶段，但对用户可见的版本含义保持稳定：

| 变化类型                                                   | 版本动作                       | 示例              | 必须发布安装包 |
| ---------------------------------------------------------- | ------------------------------ | ----------------- | -------------- |
| 新增用户可见功能、完成一个路线中的功能里程碑、兼容性增强   | 升 `MINOR`                     | `0.8.1` → `0.9.0` | 是             |
| 重要 Bug、数据安全/更新链路/稳定性修复，且用户需要尽快升级 | 升 `PATCH`                     | `0.8.1` → `0.8.2` | 是             |
| 仅文档、测试、内部重构、CI 或不会进入安装包的工程调整      | 不升版本                       | 保持 `0.8.1`      | 否             |
| 破坏现有文件格式、更新链路或用户行为的变更                 | 先暂停并评估；必要时升 `MAJOR` | `0.x` → `1.0.0`   | 是             |

具体约束：

- 一个完整的用户功能小版本必须至少对应一个公开 Release；例如 v0.9.0 功能验收完成后，不能只合并到 `main` 而不生成 v0.9.0 安装包。
- 不需要为每个 commit、测试补丁或纯文档 PR 创建 Release；多个小切片可以合并成一个稳定版本，但达到目标版本验收后应立即发布，不再无限期等待大版本。
- 重要 Bug、更新器、签名、数据保存和安全修复可以脱离功能批次直接发布 patch 版本。
- 不跳过已经规划好的用户版本：除非维护者明确决定，否则不要从 v0.8.x 直接跳到 v1.0.0。
- 版本号、CHANGELOG、Git tag、GitHub Release、安装包和 `latest.json` 必须表示同一个版本。

## Release 必须包含的交付物

每个公开的 minor 或重要 patch Release 至少包含：

- GitHub Release：`vX.Y.Z`，非 Draft；
- Windows NSIS 安装包：`Moyang.Reader_X.Y.Z_x64-setup.exe`；
- 对应的 `.exe.sig` 签名文件；
- `latest.json`，版本、下载地址和签名与 Release 一致；
- Cloudflare Pages 镜像或镜像代理中的 Windows x64 资产可访问；
- CHANGELOG 中的用户可见说明；
- 旧版本检查更新、签名校验、下载、安装和重启验证记录；记录可以是 `verified`、`blocked` 或 `pending`，只有 `verified` 才能作为已完成验收，状态以 `docs/release-status.json` 为准。

私钥只允许存在于 GitHub Actions Secret 或本机安全位置，不进入仓库、Issue、PR、Release、镜像或 AI 上下文。

## 更新与 opener 安全边界

- 更新端点按配置顺序先尝试公开 Cloudflare Pages 动态镜像，再回退到 GitHub Release。动态镜像可访问不等于静态镜像工作流成功；静态部署必须由 `mirror-release.yml` 使用 Release 资产和 Cloudflare Secret 完成，并由 `mirror-health.yml` 巡检。
- Tauri updater 的 `.sig` 是更新 manifest/安装包的公钥签名校验，不是 Windows 的 `NSIS Authenticode` 证书。当前没有可用 Authenticode 证书时，`release-status.json` 必须保持 `blocked`，不能用 updater 签名替代证书结论。
- `opener:default` 只提供调用系统默认程序的能力，不代表允许任意 URI。阅读链接入口只把 `http:`、`https:`、`mailto:`、`tel:` 交给 Windows；`javascript:`、`file:`、未知协议以及未授权的本地路径必须拒绝，主窗口导航 guard 也不能被外部页面绕过。新增 opener 调用必须复用同一白名单；本切片不修改运行时代码。
- 本地相对链接必须落在用户已选择并登记的文件或阅读库范围内。权限失败、文件关联缺失或路径不在授权范围时，用户动作是重新选择/添加路径、调整 Windows 默认应用或重试，不是删除文件、修改注册表绕过权限或关闭安全策略。

## Cloudflare Secret 配置边界

Cloudflare 镜像只由 `.github/workflows/mirror-release.yml` 负责，并由 Release 工作流在安装包发布成功后调用。不要新增一个把仓库根目录 `.` 在每次 `main` 推送时直接部署到 Pages 的 `deploy.yml`；这会绕过 Release 资产准备，可能覆盖或破坏更新镜像目录。

维护者只需在仓库的 Settings → Secrets and variables → Actions 中配置以下两个 Secret：

- `CLOUDFLARE_API_TOKEN`：仅授予目标 Pages 项目部署权限的 API Token；
- `CLOUDFLARE_ACCOUNT_ID`：目标 Cloudflare 账户 ID。

工作流中只能使用 `${{ secrets.CLOUDFLARE_API_TOKEN }}` 和 `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}` 读取它们，真实值不得出现在 YAML、提交、Issue、PR、Release、日志或聊天中。任何已经粘贴到公开位置的 Token 都必须先撤销并重新生成，再配置到 GitHub Secret。配置完成后，可对同一版本手动重跑镜像工作流；GitHub Release 资产会保留，镜像失败不应被误报为成功。

## 标准流程

### 1. 功能 PR 阶段

每个 PR 必须在模板中填写：

- 版本分类：无 Release、minor 或 patch；
- 目标版本和判定理由；
- 是否需要更新安装包、`latest.json` 和镜像；
- 若暂不发布，说明对应的稳定批次或后续版本。

功能切片仍然先推送分支、同步代码/测试/文档并合并到 `main`。未达到稳定验收前不生成半成品安装包。

### 2. 稳定版本阶段

准备发布 `vX.Y.Z` 时，按以下顺序执行：

1. 检查 Issues、PR、CHANGELOG、`docs/NEXT.md`、`docs/AI-HANDOFF.md` 和 `docs/release-status.json`，确认唯一下一步、当前风险与稳定批次没有遗漏阻塞问题；运行 `npm run release:status -- --version=vX.Y.Z`，不通过时不得把外部阻塞记为已完成。
2. 在同一个发布提交中同步修改 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 的版本号。
3. 更新 CHANGELOG、README/路线图和交接文档中的稳定基线。
4. 运行前端、Rust、浏览器桌面 E2E、发布检查和 Release 测试。
5. 合并到 `main`，确认 CI 全绿后创建并推送 `vX.Y.Z` tag。
6. 由 `.github/workflows/release.yml` 构建签名安装包、`.sig` 和 `latest.json` 并创建 GitHub Release。
7. 由 Release 工作流直接调用镜像工作流，将 Release 资产静态上传到 Cloudflare Pages；缺少 Cloudflare Secret 时直接失败，不得静默改为只验证旧镜像。Release 由 `GITHUB_TOKEN` 创建时不依赖 `release` 事件，避免事件不触发造成漏同步。
8. 在线检查 GitHub 和镜像的 `latest.json`、版本目录、安装包 HTTP 状态、文件大小、SHA-256、签名和版本号；临时 522 等错误必须重试后再判定。
9. 由 `mirror-health.yml` 定时巡检最新 Release 与 Cloudflare 镜像；巡检失败时先修复镜像，再继续发布流程。
10. 使用旧版本验证自动更新；完成后更新 Release、Issue 状态和 AI 交接记录。

推荐的本地发布前检查：

```powershell
npm run lint
npm run format:check
npm test -- --run
npm run build
npm run test:e2e
npm run test:e2e:desktop
npm run release:check -- --version=vX.Y.Z
npm run release:status -- --version=vX.Y.Z
npm run test:release
npm run rust -- fmt --manifest-path src-tauri/Cargo.toml -- --check
npm run rust -- clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
npm run rust -- test --manifest-path src-tauri/Cargo.toml
```

确认 `main` 已包含发布提交且 CI 通过后，再推送 tag：

```powershell
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

详细的签名、镜像和自动更新操作见 [`docs/UPDATE.md`](UPDATE.md)。

## 不发布的情况

以下情况可以不生成安装包，但必须在 PR 和 AI 交接中明确写出“本次不发布”：

- 只修改测试、文档、Issue 模板、CI 或开发工具；
- 只做不会进入安装包的内部重构；
- 功能仍未达到目标版本验收，且已经记录下一步和预计版本。

如果改动已经影响用户行为、文件读写、导出、更新、启动稳定性或安全性，就不能仅以“改动很小”为理由跳过版本判断。

## 回滚

已发布版本不能通过低版本覆盖回滚。发现问题时保留原 Release，修复后发布更高的 patch 版本，并在问题版本的 Release 说明中指向推荐升级版本。若构建或镜像失败，先停止对外宣传和更新验证，修复流水线后重新发布同一目标版本或按规则递增 patch，不能复用含糊的 tag。
