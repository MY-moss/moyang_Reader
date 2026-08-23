# Moyang Reader 更新与发布

## 更新链路

Moyang Reader 使用 Tauri 官方 updater 插件和 GitHub Releases：

1. 发布者给 main 打一个 vX.Y.Z 形式的版本标签，例如 v0.5.1。
2. GitHub Actions 在 Windows runner 上运行测试、构建并生成 NSIS 安装包。
3. 构建时使用 GitHub Secrets 中的私钥给更新包签名。
4. tauri-action 将安装包、.sig 签名和 latest.json 上传到 Release。
5. 已安装的应用启动后会静默检查一次；用户也可以点击顶部的“更新”按钮。
6. 发现新版本后，用户确认“下载并安装”，应用会校验签名、安装并自动重启。

更新地址固定为：

https://github.com/MY-moss/moyang_Reader/releases/latest/download/latest.json

没有有效签名的更新包不会安装。

## 首次配置 GitHub Secrets

更新私钥不能提交到仓库，也不能写进 workflow 文件。

在 GitHub 仓库的 Settings → Secrets and variables → Actions 添加：

- TAURI_SIGNING_PRIVATE_KEY：粘贴本机安全保存的私钥文件完整内容。
- TAURI_SIGNING_PRIVATE_KEY_PASSWORD：当前密钥未设置密码，暂时留空；正式公开发布前建议重新生成带密码的密钥并更新公钥。

当前公钥已经写入 src-tauri/tauri.conf.json，公钥可以公开，私钥和密码绝不能公开。

如果私钥丢失，旧版本将无法验证后续更新。若密钥已经泄露，应立即停止发布，生成新密钥，并在还没有公开用户之前更新配置；一旦已有用户安装旧公钥版本，换钥匙需要专门的密钥轮换机制，不能直接覆盖。

## 发布新版本

确认代码已经合并到 main 后：

~~~powershell
git tag -a v0.5.1 -m "Release v0.5.1"
git push origin main
git push origin v0.5.1
~~~

只推送版本标签会触发 Release workflow。建议先推送 main，确认 CI 通过，再推送标签。

发布前必须检查：

- package.json、src-tauri/Cargo.toml 和 src-tauri/tauri.conf.json 的版本一致。
- GitHub Secrets 已配置。
- Release 不是 Draft，且 latest.json 已上传。
- Release 中存在 NSIS 安装包、对应的 `.exe.sig` 签名文件，以及 tauri-action 上传的 `latest.json`。
- 新安装包能正常打开 Markdown、添加整个文件夹和读取图片附件。
- 从旧版本点击“更新”能检测到新版本并完成重启。

## 回滚

不要把坏版本直接降回较低版本号。更新器默认只接受更高版本号。

如果发布出现问题，推荐：

1. 立即停止继续发布。
2. 修复问题并发布更高的 patch 版本，例如 v0.5.1。
3. 在 GitHub Release 中标记问题版本，并在 Release notes 说明推荐升级到的版本。
4. 如果需要手动兜底，保留旧版安装包和 GitHub Release，不要删除 latest.json。

## 本地验证签名构建

普通本地构建不需要私钥：

~~~powershell
npm run tauri -- build
~~~

模拟正式更新构建时，使用 Tauri CLI 支持的环境变量，不要把私钥写进项目：

~~~powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "C:\Users\HUAWEI\.moyang-reader\moyang-reader.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri -- build --config src-tauri/tauri.release.conf.json
~~~

签名更新产物位于 src-tauri/target/release/bundle/ 下。key、pem 和 sig 文件已经加入 .gitignore，但仍应在提交前检查 staged diff。
