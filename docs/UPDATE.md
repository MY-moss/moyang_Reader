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

当前生产镜像默认使用 `scripts/mirror-worker.js` 提供轻量代理：它从 GitHub 最新 Release 读取 `latest.json`，把 Windows 安装包 URL 改写为镜像路径，再代理安装包和 `.sig` 下载，不在 Pages 中重复保存 4MB 以上的安装包。这样 GitHub Release 发布后镜像可以自动跟随最新版本，不需要每次重新上传大文件。

`.github/workflows/mirror-release.yml` 发布后会验证镜像版本、签名字段和安装包可访问性。如果配置了 Cloudflare Secrets，工作流仍支持把完整静态资产上传到 Pages；未配置时会快速验证现有代理，不再因缺少凭据而把镜像任务标记为失败。

镜像 Worker 源码位于 `scripts/mirror-worker.js`；如需重新部署代理，应使用 Cloudflare Pages Direct Upload 或 Wrangler 部署该文件。

如果希望使用完整静态资产镜像，而不是轻量代理，需要在 GitHub 仓库的 Actions Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`：仅授予 Pages 项目部署权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。

这两个值只存在于 GitHub Secrets，不要提交到仓库或发到聊天中。即使未配置或镜像部署失败，GitHub Release 仍然保留，客户端也会继续使用第二个 GitHub 更新端点。

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
- 若使用完整静态镜像，GitHub Secrets 已配置；使用轻量代理时确认 `latest.json` 在线版本正确。
- Release 不是 Draft，且 latest.json 已上传。
- Release 中存在 NSIS 安装包、对应的 `.exe.sig` 签名文件，以及 tauri-action 上传的 `latest.json`。
- 新安装包能正常打开 Markdown、添加整个文件夹和读取图片附件。
- 从旧版本点击“更新”能检测到新版本并完成重启。

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
