# Moyang Reader 更新与发布

## 更新链路

Moyang Reader 使用 Tauri 官方 updater 插件、Cloudflare Pages 镜像和 GitHub Releases：

1. 发布者给 main 打一个 vX.Y.Z 形式的版本标签，例如 v0.5.3。
2. GitHub Actions 在 Windows runner 上运行测试、构建并生成 NSIS 安装包。
3. 构建时使用 GitHub Secrets 中的私钥给更新包签名。
4. tauri-action 将安装包、.sig 签名和 latest.json 上传到 Release。
5. 用户开启启动更新检查时，已安装的应用会在启动后检查一次；用户也可以随时点击顶部的“更新”按钮。
6. 发现新版本后，用户确认“下载并安装”，应用会校验签名、安装并自动重启。

下载中的更新提示可以隐藏，下载会继续在后台运行；顶部更新入口会显示“下载中…”，再次点击可恢复查看进度。隐藏不等于取消，也不会重新开始下载。当前 Tauri updater API 没有可靠的取消信号，因此界面不提供虚假的“取消下载”操作。

“启动时检查更新”只在应用启动时读取一次。运行期间修改该偏好只保存设置，不立即触发检查；需要重新启动应用后才按新设置执行。

更新器会先访问 Cloudflare Pages 镜像，失败时再回退到 GitHub Release：

https://moyang-reader-mirror.pages.dev/latest.json

https://github.com/MY-moss/moyang_Reader/releases/latest/download/latest.json

没有有效签名的更新包不会安装。

## 开发期与稳定批次

功能切片可以先在分支上快速开发、测试、同步文档并合并，不需要为每个 commit 或纯文档/测试改动创建 Release。但完成一个用户功能小版本后必须及时公开发布，例如 v0.8.1 的下一组稳定功能完成后发布 v0.9.0；重要 Bug、保存、更新、签名或安全修复可以直接发布 patch 版本，例如 v0.8.1 → v0.8.2。

不能长期只更新 `main` 而不提供安装包。稳定版本发布时，版本号、CHANGELOG、GitHub Release、NSIS 安装包、`.sig`、`latest.json` 和 Cloudflare 镜像必须同步到同一个版本，并验证旧版本自动更新。完整规则见 [`docs/RELEASE-POLICY.md`](RELEASE-POLICY.md)。

## 首次配置 GitHub Secrets

更新私钥不能提交到仓库，也不能写进 workflow 文件。

在 GitHub 仓库的 Settings → Secrets and variables → Actions 添加：

- TAURI_SIGNING_PRIVATE_KEY：粘贴本机安全保存的私钥文件完整内容。
- TAURI_SIGNING_PRIVATE_KEY_PASSWORD：填写生成签名密钥时设置的密码；不要把密码写进仓库、脚本或命令行参数。

当前公钥已经写入 src-tauri/tauri.conf.json，公钥可以公开，私钥和密码绝不能公开。

## Cloudflare Pages 镜像

当前镜像项目为 `moyang-reader-mirror`，生产地址为：

https://moyang-reader-mirror.pages.dev

当前生产镜像以 Cloudflare Pages 静态资产为主：每次 GitHub Release 发布后，`.github/workflows/mirror-release.yml` 下载该 Release 的安装包、`.sig` 和 `latest.json`，使用 `scripts/prepare-mirror.mjs` 生成版本目录，再通过 Wrangler 上传到 Pages。镜像会保留 `/vX.Y.Z/` 版本目录，根路径 `latest.json` 指向最新稳定版本。

镜像工作流只使用 Release `published` 和手动按版本同步两个入口，不再同时监听 `workflow_run`，避免同一版本重复部署。正式同步缺少 Cloudflare 凭据时会直接失败，不能以“只验证旧镜像”的绿色状态结束；GitHub Release 仍保留，客户端会回退到第二个 GitHub 更新端点。

`scripts/mirror-worker.js` 保留为手动应急回滚方案，不是当前默认发布路径。静态镜像部署完成后，工作流会重试检查根 manifest、版本目录 manifest、安装包和 `.sig`，并校验版本、HTTP 状态和安装包大小。

`.github/workflows/mirror-health.yml` 每 6 小时以及手动触发一次，比较 GitHub 最新 Release 与 Cloudflare 镜像；发现版本落后、manifest 不完整、安装包不可访问或签名文件缺失时会让巡检失败。

要启用自动静态镜像，需要在 GitHub 仓库的 Actions Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`：仅授予 Pages 项目部署权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。

这两个值只存在于 GitHub Secrets，不要提交到仓库或发到聊天中。Cloudflare 部署失败时 GitHub Release 仍然保留，客户端会继续使用第二个 GitHub 更新端点，但发布流程必须修复镜像后才能视为完成。

如果私钥丢失，旧版本将无法验证后续更新。若密钥已经泄露，应立即停止发布，生成新密钥，并在还没有公开用户之前更新配置；一旦已有用户安装旧公钥版本，换钥匙需要专门的密钥轮换机制，不能直接覆盖。

## 发布新版本

确认代码已经合并到 main、版本号已经同步且 CI 全绿后：

```powershell
git tag -a v0.9.0 -m "Release v0.9.0"
git push origin v0.9.0
```

推送版本标签会触发 Release workflow。不要在版本号未同步或 CI 未通过时推送 tag；手动发布也必须把 `version` 输入设为与项目版本完全一致的值。

发布前必须检查：

- package.json、src-tauri/Cargo.toml 和 src-tauri/tauri.conf.json 的版本一致。
- GitHub Secrets 已配置，且镜像工作流实际执行了静态资产上传。
- Release 不是 Draft，且 latest.json 已上传。
- Release 中存在 NSIS 安装包、对应的 `.exe.sig` 签名文件，以及 tauri-action 上传的 `latest.json`。
- 新安装包能正常打开 Markdown、添加整个文件夹和读取图片附件。
- 从旧版本点击“更新”能检测到新版本并完成重启。

## Windows 旧版本升级实机回归（2026-08-27）

- 使用 GitHub Release 提供的 Windows x64 v0.8.0 NSIS 安装包，将实例安装到 Windows 注册表登记的安装位置。
- 从 v0.8.0 启动应用，手动检查到 v0.9.2；确认更新提示后完成下载、签名校验、替换安装和自动重启。
- 重启后注册表 `DisplayVersion`、应用文件 `ProductVersion` 和界面版本均为 v0.9.2，进程路径仍为同一登记安装位置，且重启前后进程 PID 不同。
- 不把未写入 Windows 卸载注册表的旧副本当作安装更新回归结果；更新器遵循登记安装位置，这是 Windows NSIS 安装实例的有效验证边界。
- v0.9.3 仍需单独完成版本同步、Release、manifest、签名、Cloudflare 镜像和旧版本升级复核后再对外发布。

## v0.8.2 在线核验记录

- GitHub Release：[v0.8.2](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.8.2)，Release workflow [32900250651](https://github.com/MY-moss/moyang_Reader/actions/runs/32900250651) 全部通过。
- GitHub 与 Cloudflare 镜像的 `latest.json` 均 HTTP 200，版本均为 `0.8.2`，包含 Windows x64 NSIS 更新项。
- GitHub 与镜像安装包均为 4,862,485 字节，SHA-256 均为 `4eed2a25b81c7cb148e80fdf242afc89f4162f4ac24a79787d16fb9f2c592a23`；`.sig` 均为 424 字节且 SHA-256 均为 `19d7d860f395d67e3861b729d252f4ccf4ad6c18f628804718d1ef08fb1fed24`。
- 镜像工作流 [32902095328](https://github.com/MY-moss/moyang_Reader/actions/runs/32902095328) 通过；未配置 Cloudflare Secret 时会跳过静态资产上传，使用已部署的轻量代理并验证公开资产，不影响更新器回退到 GitHub。
- 本次已确认本机存在 `v0.8.1` 安装实例，但未自动点击旧版本更新并重启；完整旧版本实机升级仍是下一次 Windows 回归项。

## 回滚

不要把坏版本直接降回较低版本号。更新器默认只接受更高版本号。

如果发布出现问题，推荐：

1. 立即停止继续发布。
2. 修复问题并发布更高的 patch 版本，例如 v0.5.4。
3. 在 GitHub Release 中标记问题版本，并在 Release notes 说明推荐升级到的版本。
4. 如果需要手动兜底，保留旧版安装包和 GitHub Release，不要删除 latest.json。

## 本地验证签名构建

普通本地构建不需要私钥：

```powershell
npm run tauri -- build
```

模拟正式更新构建时，使用 Tauri CLI 支持的环境变量，不要把私钥写进项目：

```powershell
$privateKeyPath = Read-Host "请输入本机私钥文件路径"
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -LiteralPath $privateKeyPath
$securePassword = Read-Host "请输入签名私钥密码" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
npm run tauri -- build --config src-tauri/tauri.release.conf.json
```

签名更新产物位于 src-tauri/target/release/bundle/ 下。key、pem 和 sig 文件已经加入 .gitignore，但仍应在提交前检查 staged diff。
