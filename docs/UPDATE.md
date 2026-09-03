# Moyang Reader 更新与发布

## 更新链路

Moyang Reader 使用 Tauri 官方 updater 插件、Cloudflare Pages 镜像和 GitHub Releases：

1. 发布者给 main 打一个 vX.Y.Z 形式的版本标签，例如 v0.5.3。
2. GitHub Actions 在 Windows runner 上运行测试、构建并生成 NSIS 安装包。
3. 构建时使用 GitHub Secrets 中的私钥给更新包签名。
4. tauri-action 将安装包、.sig 签名和 latest.json 上传到 Release。
5. 用户开启启动更新检查时，已安装的应用会在启动后检查一次；用户也可以随时点击顶部的“更新”按钮。
6. 发现新版本后，用户确认“下载并安装”，应用会校验签名并完成安装；安装完成后停在“已更新”状态，用户可继续当前工作并在方便时手动重启。

更新入口固定在顶部“更多”操作栏。状态为“有更新”时再次点击只打开当前更新提示，不会重新检查或销毁更新对象；状态为“下载中…”或“已更新”时同样只恢复当前进度或重启提示。下载中的更新提示可以隐藏，下载会继续在后台运行；隐藏不等于取消，也不会重新开始下载。当前 Tauri updater API 没有可靠的取消信号，因此界面不提供虚假的“取消下载”操作。

下载完成后不会强制退出或自动重启应用。用户可以继续阅读或编辑，确认工作已保存后再点击“重启应用”；如果把完成提示隐藏，可从“更多 → 已更新”重新打开。真实旧版本的下载、签名校验、替换和重启闭环仍由 #241 的 Windows 实机矩阵跟踪。

“启动时检查更新”只在应用启动时读取一次。运行期间修改该偏好只保存设置，不立即触发检查；需要重新启动应用后才按新设置执行。

更新器会先访问 Cloudflare Pages 镜像，失败时再回退到 GitHub Release：

https://moyang-reader-mirror.pages.dev/latest.json

https://github.com/MY-moss/moyang_Reader/releases/latest/download/latest.json

没有有效签名的更新包不会安装。

更新提示中的“签名”是 Tauri updater 对 manifest/安装包的公钥校验，不等同于 Windows NSIS Authenticode 证书。当前 Authenticode 证书条件仍按 [`release-status.json`](release-status.json) 记录为 `blocked`，不能把 updater 签名当成 Windows 代码签名结论。

## 用户侧更新与打开器排查

### 更新状态

- 从顶部 `更多 → 更新` 可以随时手动检查；“启动时检查更新”只在下一次启动读取，运行中修改设置不会打断当前阅读或立即下载。
- “发现新版本”时选择“下载并安装”。下载前不替换当前应用文件，下载后会校验 Tauri updater 签名。
- “下载中…”可以隐藏，下载会继续；稍后从 `更多 → 下载中…` 恢复进度。隐藏不是取消，也不会重新开始下载。
- “已更新”只表示安装文件已准备好，不会强制退出或自动重启。确认文档和设置已经保存后，选择“重启应用”；如果暂时不方便，可继续当前工作。

### 更新失败时

- **镜像不可用或网络超时**：更新器先尝试公开 Cloudflare Pages 地址，再使用 GitHub Release 回退地址。检查网络后重试；仍失败时可从 [GitHub Release](https://github.com/MY-moss/moyang_Reader/releases/latest) 手动下载当前 Windows x64 安装包。
- **签名校验失败**：安装会停止。只从仓库的 GitHub Release 页面重新下载可信安装包，不使用聊天、文档或第三方页面提供的 `.exe`、`.sig` 或私钥。
- **权限或文件被占用**：保留当前版本，先关闭正在运行的旧实例或占用安装目录的程序，再重试；也可以从 GitHub Release 手动安装。不要删除用户文档、修改注册表来绕过文件关联，也不要关闭 Windows 安全策略或运行未知脚本。
- **上次更新没有完成**：当前版本会保留。不要降级覆盖；等待更高的补丁版本发布后再重试，应用启动时可能显示恢复提示。

### 外部链接、工作区路径和文件关联

- `moyang-wiki:`、相对 Markdown 链接和章节锚点留在应用内处理；外部链接只允许 `http:`、`https:`、`mailto:` 和 `tel:`，交给 Windows 默认程序打开。`javascript:`、`file:` 和未知协议会被拦截，主窗口不会直接导航到外部页面。
- 本地文档链接使用当前已授权的阅读库或用户选择的文件路径。工作区外的本地路径不会通过外部 opener 打开；如果目标未经过用户选择或授权，桌面端会拒绝读取并要求重新选择文件或添加阅读库。
- Windows 安装包会注册 Markdown、文本、Word、PDF 和常见图片扩展名，但 Windows 可能保留用户当前选择的默认程序。双击没有交给 Moyang Reader 时，请在 Windows“默认应用”或“打开方式”中重新选择，不要删除文档或绕过系统权限。

## #416 Windows 图标一致性记录（已合并，未单独发布）

- 代码基线：从 `main@b11539ea85bc816dbb9f002021084755d7c826b2` 的干净工作树完成；范围仅为 Windows x64 图标资源、Tauri bundle 配置和发布前门禁。
- 修复内容：显式声明全部 Windows `bundle.icon` 资源；校验 PNG 尺寸/哈希、ICO 目录和同源图像，并阻止旧字母 M 图标或不安全路径进入发布流程。
- 本地验收：release-check 单测 11/11，Tauri Windows x64 无安装包构建和 NSIS 本地验收包通过；全新安装与覆盖升级后，可执行文件、安装器、桌面/开始菜单快捷方式以及 `.md/.txt` 文件关联均解析到同一可执行文件图标。
- Windows 边界：Explorer/任务栏可能继续显示系统缓存的旧缩略图；应用和安装器不能安全地强制删除系统缓存，重新创建快捷方式、刷新 Explorer、重新登录或重启属于用户侧缓存处理，不是本切片的唯一修复依赖。
- 发布边界：本记录不代表 v0.10.15 已发布；没有创建 GitHub Release、签名文件、`latest.json` 或 Cloudflare 镜像，v0.10.14 稳定资产保持不变。若进入稳定批次，必须按发布政策重新生成并核验全部资产。

## v0.10.14 发布记录（2026-09-02）

- GitHub Release：[v0.10.14](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.14) 已公开，发布代码为 `main@ec76d3d0a812d1413a619c6b843972ffa57ffd47`。
- Windows x64 安装包：`Moyang.Reader_0.10.14_x64-setup.exe`，5,243,339 字节，SHA-256 `293b3884f2e66659e7ce2ab4f333dc01dcd0bf0a48ddd0ed8bbff42d661cce59`。
- 签名文件：`Moyang.Reader_0.10.14_x64-setup.exe.sig`，428 字节，SHA-256 `fd832a5689c9064118dd0bb8e9c3ba3d88e0a75da0c061bbd6809b069ab70adf`；`latest.json` 1,413 字节，SHA-256 `dfb110ba23f248d6c374d714613888511f99a4aae2b038219caeea27350af8cc`。
- GitHub Release 的 manifest、安装包和签名均 HTTP 200；Cloudflare Pages 的 `latest.json`、同版本安装包和签名也均 HTTP 200，镜像安装包大小和 SHA-256 与 GitHub Release 一致。
- Release workflow run `33555344560` 的 Quality checks 和 Windows 构建发布成功；镜像子任务未执行部署步骤，仓库 Cloudflare Secrets 尚未生效，因此不能把自动镜像门禁记为全绿。本轮没有上传任何私钥或 API Token。

## v0.10.13 发布记录（2026-08-29）

- GitHub Release：[v0.10.13](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.13) 已公开，tag 指向 `main@5c016e2ddf71c589de3191383b3595af4c6e7705`。
- Windows x64 安装包：`Moyang.Reader_0.10.13_x64-setup.exe`，5,046,081 字节，SHA-256 `2bd6097e9952e7c6c74365a4a1751290470586a16e28b54df8e4a994b642782f`。
- 签名文件：`Moyang.Reader_0.10.13_x64-setup.exe.sig`，428 字节，SHA-256 `7b031ce4636b48d1774d118c4a6b2cbcff716bccb4038a07d072ff760088482c`。
- `latest.json` 版本为 `0.10.13`，包含 Windows x64/NSIS 签名更新入口；GitHub Release、Cloudflare Pages 的 manifest、安装包和签名均已公开可访问。
- Cloudflare 镜像安装包与签名均 HTTP 200，大小和 SHA-256 与 GitHub Release 一致；Release workflow run `33245475550` 的自动镜像 job 仍因 Cloudflare Actions Secret 缺失失败，不能把自动同步门禁记为全绿。本轮没有上传任何凭据。
- 合并后的 main Quality checks run `33245189679`、Rust dependency audit run `33245189698` 均成功；Release Windows 构建与发布 job 成功。真实旧版本安装/更新闭环继续由 #241 跟踪。

## v0.10.12 发布记录（2026-08-29）

- GitHub Release：[v0.10.12](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.12) 已公开，包含 Windows x64 安装包、`.sig` 和 `latest.json`。
- 安装包：4,976,921 字节，SHA-256 `de577b06d78eabc837df87da4e20ab5f127c8ddcd15fcd8d62e1f4ac558d8e74`；签名文件 428 字节，SHA-256 `fcedb0c65194abb42838ba079458506e98b5e6fbeb2207309108b7b36bdec65d`。
- Cloudflare Pages 的 `latest.json` 已返回 `0.10.12`，镜像安装包和签名 HTTP 200，大小与 SHA-256 和 GitHub Release 一致。
- Release 的静态镜像 job 因缺少 Cloudflare Actions Secrets 失败；公开镜像当前可用，但自动同步链路仍需维护者安全配置 Secret 后重跑验证。本轮未上传任何凭据。
- PR #307 已修复 Windows PDF 导出在高负载下偶发未及时落盘的问题，Quality checks 全绿；该修复随下一稳定批次发布。

## v0.10.10 发布记录（2026-08-28）

- 发布范围：PR [#296](https://github.com/MY-moss/moyang_Reader/pull/296) 增加工作区内文件/文件夹剪切、复制、粘贴和编辑器“粘贴为纯文本”；版本准备 PR [#297](https://github.com/MY-moss/moyang_Reader/pull/297) 同步版本号、CHANGELOG 和发布文档。
- 发布结果：tag `v0.10.10` 指向 `main@369411206b6bfd8b4a75cd70e37d81c91b20f5d7`；GitHub Release [v0.10.10](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.10) 已公开。
- 已核验：Release workflow [33153221247](https://github.com/MY-moss/moyang_Reader/actions/runs/33153221247) 的 Windows 构建/发布 job [98789862805](https://github.com/MY-moss/moyang_Reader/actions/runs/33153221247/job/98789862805) 成功；安装包 4,904,672 字节，SHA-256 `e49ccf9f689bad64b966d9513761e236c52d784d1869020ee55b0149890cf91c`；`.sig` 428 字节，SHA-256 `5c1c072418adef0e3209acdb5b456f39f62b52b763eac127dbfd4c079147e9fe`；`latest.json` 1,413 字节，SHA-256 `bcbf62897a32f6a95a215377a9668f87d97f1de98d5542cca4a0a6c6c8dce1de`。
- 在线核验：GitHub Release 和 Cloudflare Pages 的 `latest.json`、Windows x64 安装包及签名均 HTTP 200；两处安装包大小和 SHA-256 一致，manifest 版本均为 `0.10.10`，签名内容一致。
- 镜像边界：Release workflow 静态镜像子 job [98791213977](https://github.com/MY-moss/moyang_Reader/actions/runs/33153221247/job/98791213977) 失败，当前仓库仍缺少 Cloudflare 部署 Secret；公开 Pages 镜像代理可用，客户端仍保留 GitHub Release 回退。本轮未上传任何凭据。

### #241 当前验证记录

- 在干净 `main@b36619c358b86c9cef950898a1add30fad9d3bab` 上完成真实 Windows Tauri PDF 文件落盘 smoke，目标用例 `1/1` 通过；输出文件存在、可读取，文件头为 `%PDF-` 且包含 `%%EOF`。
- 本轮未重新执行旧安装版本到 v0.10.10 的检查更新、签名校验、替换和重启；历史 v0.9.3→v0.9.4 实机升级记录仍保留，#241 不因本次 PDF 子场景通过而关闭。
- 桌面 smoke 构建时必须设置 `VITE_MOYANG_DESKTOP_E2E=1`，否则测试桥接不会被打包进 exe，可能出现启动阶段 `core.invoke not available`，这不是 PDF 文件断言失败。

## v0.10.7 发布记录（2026-08-28）

- 发布范围：PR [#284](https://github.com/MY-moss/moyang_Reader/pull/284) 修复 Windows Edge headless PDF 异步落盘，确认有效 PDF 后再执行原子替换；版本准备 PR [#285](https://github.com/MY-moss/moyang_Reader/pull/285) 已同步版本号和 CHANGELOG。
- 发布结果：v0.10.7 tag 指向 main@c1bf7d739afa1bfb31507564af3377e77bb088b5；GitHub Release [v0.10.7](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.7) 已公开。
- 已核验：Release workflow [33129082220](https://github.com/MY-moss/moyang_Reader/actions/runs/33129082220) 的 Windows 构建/发布 job [98714111104](https://github.com/MY-moss/moyang_Reader/actions/runs/33129082220/job/98714111104) 成功；安装包 4,901,397 字节，SHA-256 ae6a803c9b4e8e6c343278e0780eedbaaee9f3ec1a10da135d3169c553637629；.sig 428 字节，SHA-256 913815eef12d5519b8c1177cd3efa0e8c9b340dcccce0a7b52875364d2e02da4；latest.json 1,411 字节，SHA-256 02047ae696f6c207159e9d4971f8c53b982568e691c292af8b4711e5146e2ed7。
- 在线核验：GitHub Release 和 Cloudflare 动态镜像的 latest.json、Windows x64 安装包及签名均 HTTP 200；镜像安装包和签名 SHA-256 与 Release 一致；镜像 manifest 版本为 0.10.7，签名、公钥字段一致，并将下载地址重写到 Pages 版本目录。
- 镜像边界：Release workflow 的静态镜像子 job [98715331213](https://github.com/MY-moss/moyang_Reader/actions/runs/33129082220/job/98715331213) 失败，原因是仓库仍未配置 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID；本轮未上传任何凭据。动态镜像可用，客户端仍保留 GitHub Release 回退。
- 未完成：#241 的旧版本自动更新提示、下载、签名校验、替换和重启实机回归仍保持 open；#232 的其余桌面交互待办不在本次补丁内。

## v0.10.6 发布记录（2026-08-28）

- 发布范围：PR #281 已合并的文件/文件夹右键复制、相对路径复制、文件夹展开/折叠，以及 Markdown/TXT 源文本与 WYSIWYG 的清除格式、任务列表和日期插入。
- 发布结果：版本准备 PR [#282](https://github.com/MY-moss/moyang_Reader/pull/282) 已合并，v0.10.6 tag 指向 main@ec64aa7909f62c99ba25a6720080fdeeb8a7d84d；GitHub Release [v0.10.6](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.6) 已公开。
- 已核验：Release workflow [33121420237](https://github.com/MY-moss/moyang_Reader/actions/runs/33121420237) 的 Windows 构建/发布 job [98688939326](https://github.com/MY-moss/moyang_Reader/actions/runs/33121420237/job/98688939326) 成功；安装包 4,900,782 字节，SHA-256 `799cc6b826dae0c67882e764505279247439941d69e49ec7d65f59bf983b43f1`；`.sig` 428 字节，SHA-256 `fb432b0cc3e8af2077d9d8a181237e1a66cb6df914e2929069be0e39e17b8f99`；`latest.json` 1,411 字节，SHA-256 `37ffcbeee4f07532c5188e4193b545b4142bd2e17213d83f14afee77e6fadbeb`。
- 在线核验：GitHub Release 的安装包、`.sig` 和 `latest.json` 均 HTTP 200；Cloudflare 动态镜像 `latest.json` 返回版本 `0.10.6`，`/v0.10.6/` 安装包和 `.sig` 均 HTTP 200，大小和 SHA-256 与 GitHub 资产一致。
- 镜像边界：Release workflow 的静态镜像子 job [98690424253](https://github.com/MY-moss/moyang_Reader/actions/runs/33121420237/job/98690424253) 因仓库缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在凭据检查阶段失败；本轮未上传任何凭据。动态镜像可用，客户端仍保留 GitHub Release 回退。
- 未完成：PDF 文件落盘与旧版本更新器实机回归继续由 #241 跟踪；#232 继续承载更大范围的桌面交互待办。

## v0.10.5 发布记录（2026-08-28）

- 发布范围：文件/文件夹右键打开、重命名、删除、资源管理器定位、路径复制，以及 Markdown/TXT 编辑器的撤销、重做、剪切、复制、粘贴和全选。
- 发布结果：版本准备 PR #279 已合并，`v0.10.5` tag 指向 `main@d9c0a5967f673af0152746130a46a551994628df`；GitHub Release [v0.10.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.5) 已公开。
- 已核验：Release workflow [33110395454](https://github.com/MY-moss/moyang_Reader/actions/runs/33110395454) 的 Windows 构建/发布 job [98651395153](https://github.com/MY-moss/moyang_Reader/actions/runs/33110395454/job/98651395153) 成功；安装包 4,900,301 字节，SHA-256 `83a06f1cd88fef435cea0c486b6c99c5e99f2fb9661d4fe24bf6e6b99ae8d36c`；`.sig` 428 字节，SHA-256 `fd3a547c358c20381c425bec5cb527f7345502a3034fc3973b56b4572edc3912`；`latest.json` 1,411 字节，SHA-256 `5f899d3fa81986b001a24f422cf178936d4f8d9a08cfebe4925ee717eb62e830`。
- 在线核验：GitHub Release 三个资产均已公开；Cloudflare 动态镜像 `latest.json` 返回 `0.10.5`，`/v0.10.5/` 安装包和 `.sig` 均 HTTP 200，大小分别为 4,900,301 和 428 字节。
- 发布边界：静态镜像子任务 [98653318098](https://github.com/MY-moss/moyang_Reader/actions/runs/33110395454/job/98653318098) 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在凭据检查阶段失败；动态镜像可用，客户端会回退到 GitHub Release。#241 保持 open，旧版本自动更新重启尚未在本轮执行。

## 开发期与稳定批次

功能切片可以先在分支上快速开发、测试、同步文档并合并，不需要为每个 commit 或纯文档/测试改动创建 Release。但完成一个用户功能小版本后必须及时公开发布，例如 v0.8.1 的下一组稳定功能完成后发布 v0.9.0；重要 Bug、保存、更新、签名或安全修复可以直接发布 patch 版本，例如 v0.8.1 → v0.8.2。

## v0.10.3 发布记录（2026-08-27）

- 发布范围：首次使用“快速上手”教程、设置保存状态、统一设置快照、Windows 应用配置文件原子兜底和关闭前等待配置写入。
- 发布结果：版本准备 PR #273 已合并，`v0.10.3` tag 指向 `main@33c171c32aa81c291b1606203b500ef4ed9e861f`；GitHub Release [v0.10.3](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.3) 已公开。
- 已核验：Release workflow [33084715056](https://github.com/MY-moss/moyang_Reader/actions/runs/33084715056) 的 Windows 构建/发布 job [98561110937](https://github.com/MY-moss/moyang_Reader/actions/runs/33084715056/job/98561110937) 成功；安装包 4,873,988 字节，SHA-256 `4d20950202aa71e319c848635a105fc93cda6b5a0514bd6cd4c135cae861fdc3`；`.sig` 428 字节，SHA-256 `2b3b0350ad1b1f136b820e65a6c6a6cff00bd5ad02fbcfeb13d0538fdb4ab082`；GitHub `latest.json` 1,411 字节，SHA-256 `6616538994de3dcbee3f30f5a778fa6141e29e9fbc5c431c1cfa8ddd36767ddd`。
- 在线核验：GitHub 根 manifest、Cloudflare 根 manifest、Cloudflare `/v0.10.3/` manifest、安装包和 `.sig` 均 HTTP 200，manifest 版本均为 `0.10.3`；Cloudflare 版本目录的安装包为 4,873,988 字节、`.sig` 为 428 字节，SHA-256 与 GitHub Release 完全一致，签名字段存在且下载地址有效。
- 发布边界：Release 总 run 因静态镜像子任务 [98564736672](https://github.com/MY-moss/moyang_Reader/actions/runs/33084715056/job/98564736672) 缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 而显示 failure；动态 Cloudflare 镜像已经可用，但不能把静态自动同步记为全绿，#241 保持 open。旧版本自动下载、替换和重启回归尚未在本轮执行。

## v0.10.2 发布记录（2026-08-27）

- 发布范围：#187 的已验收子切片——Windows 最小窗口宽度 720px，以及工具栏真实横向溢出提示；完整响应式断点体系继续保持 open。
- 当前状态：功能 PR #269 和版本准备 PR #270 已合并，`v0.10.2` tag 指向 `main@38973bd1a72f1d61bb50ea26ee6a1014934f7fce`；GitHub Release 已公开，包含 Windows x64 NSIS 安装包、签名和 `latest.json`。
- 已核验：Release workflow [33069798614](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614) 的 Windows 发布 job [98508812457](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614/job/98508812457) 成功；安装包 4,873,310 字节，SHA-256 `626df63dadb79b2a9b564a505b4bbacf140a44c88e7ba7899e319d5b7a7ad36d`；`.sig` 428 字节，SHA-256 `0a22446928e600dc3ef854ac500d538f56027f8f074888ed0775e25a64c27748`；`latest.json` 1,411 字节。
- 在线核验：GitHub 根/版本 manifest 和 Cloudflare 根/版本 manifest 均 HTTP 200，版本均为 `0.10.2`；GitHub 与 Cloudflare 安装包、签名均 HTTP 200，安装包和签名 SHA-256 一致，签名字段存在且下载地址有效。
- 发布边界：只生成 Windows x64 NSIS 安装包；Release 总 run 因静态镜像子任务失败而显示 failure，原因是仓库 Actions 尚未配置 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。动态 Cloudflare 镜像仍可用，版本目录 manifest 当前回退到 GitHub 资产地址；不能把静态镜像子任务记为全绿。旧 v0.10.1 安装实例的完整自动更新重启回归尚未执行。

## v0.10.1 发布记录（2026-08-27）

- 发布范围：#104 大工作区搜索性能验收，以及撤回/重做后保持阅读位置的稳定性修复。
- 当前状态：版本文件已统一为 `0.10.1`，`v0.10.1` 标签已指向 `main@0e8b4e9d5ea2471b6a318fec6335f8e7a2dc000d`，Windows x64 Release 已公开。
- 已核验：Release workflow [33057606371](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371) 的 Windows 构建/发布 job [98468201360](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371/job/98468201360) 成功；安装包 4,876,807 字节、SHA-256 `2e386893e2026986c684ede967d9758b0e52c0c990adc1d65ad7ef6171395a10`；`.sig` 428 字节、SHA-256 `03ba73d07dab409ce2bf16b0b3de76d40fca40690ecf8ee8613299ec06c671f8`；`latest.json` 1,411 字节、SHA-256 `f1ea49a293ef785d428e8fb5e3a1472341da2bd0d4053e3deda1a67d50caf0cc`。
- 在线核验：GitHub 和 Cloudflare 的根 manifest、`/v0.10.1/` 安装包及 `.sig` 均 HTTP 200，manifest 版本均为 `0.10.1`，签名字段存在且下载地址有效。
- 发布边界：只生成 Windows x64 NSIS 安装包；本轮未在已登记旧安装实例上自动点击更新并重启，因此不把完整旧版本桌面升级回归记为完成。

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

当前公开地址由已部署的轻量 Cloudflare Pages Worker/Functions 动态代理提供：`scripts/mirror-worker.js` 读取 GitHub 最新 Release 的 `latest.json`，将 Windows 下载地址改写到镜像的 `/vX.Y.Z/` 路径，并代理安装包和 `.sig`。截至 `v0.10.14`，公开动态镜像的 manifest、安装包和签名可访问；这表示公开回退入口可用，不表示静态镜像工作流已经完成。

镜像工作流只使用 Release `published` 和手动按版本同步两个入口，不再同时监听 `workflow_run`，避免同一版本重复部署。当前 `v0.10.14` 的静态镜像子任务因可复用工作流缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在步骤前失败；公开动态镜像仍可用，GitHub Release 仍保留，客户端也会在镜像无法取得可用 manifest 时回退到第二个更新端点。结构化事实以 [`release-status.json`](release-status.json) 为准，静态镜像为 `blocked` 时不能写成发布成功。

`scripts/mirror-worker.js` 保留为手动应急回滚方案，不是当前默认发布路径。静态镜像部署完成后，工作流会重试检查根 manifest、版本目录 manifest、安装包和 `.sig`，并校验版本、HTTP 状态和安装包大小。

`.github/workflows/mirror-health.yml` 每 6 小时以及手动触发一次，比较 GitHub 最新 Release 与 Cloudflare 镜像；发现版本落后、manifest 不完整、安装包不可访问或签名文件缺失时会让巡检失败。

要启用自动静态镜像，需要在 GitHub 仓库的 Actions Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`：仅授予 Pages 项目部署权限的 API Token。
- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。

这两个值只存在于 GitHub Secrets，不要提交到仓库或发到聊天中。Cloudflare 静态部署失败时 GitHub Release 仍然保留，当前动态代理仍可提供最新公开资产；配置 Secrets 后应重新执行镜像 workflow，并将静态自动部署重新核验为全绿。

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
- v0.9.3 已完成版本同步、Release、manifest、签名和公开镜像资产核验；仍需补齐 Cloudflare Secrets 并让镜像 workflow 全绿，才能把自动镜像链路记为完成。

## v0.9.3 在线核验记录（2026-08-27）

- GitHub Release：[v0.9.3](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.3)，发布 workflow [33025181022](https://github.com/MY-moss/moyang_Reader/actions/runs/33025181022) 的 Windows 构建与发布 job 成功。
- `latest.json`：1,401 字节，SHA-256 `7fd5a1250a8fa192a3e66bf7d59c4dd92d02e3724e5bf9c8cb4a90f7650f10c2`。
- Windows x64 NSIS 安装包：4,856,795 字节，SHA-256 `255ccfb5236b1516ea0c31c9ca66c34bfe896571984be77a5ebb1bb575af0b3c`；`.sig`：424 字节，SHA-256 `45f8aa9ebb017dd83a7b6a4bb29db3bf33691cb97bfd1e448065fac22c4c0d5d`。
- Cloudflare Pages 的根 manifest、`/v0.9.3/` 安装包和 `.sig` 均 HTTP 200；镜像安装包与签名 SHA-256、文件大小均与 GitHub Release 一致。
- 已登记的 v0.9.2 Windows 安装实例已通过应用内更新升级到 v0.9.3；注册表 `DisplayVersion`、文件 `ProductVersion` 和运行进程版本均为 v0.9.3，更新前后进程 PID 不同。
- Release 镜像子任务 [98365959782](https://github.com/MY-moss/moyang_Reader/actions/runs/33025181022) 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在凭据检查阶段失败；公开镜像当前可用不等于本次自动部署 workflow 全绿，#241 暂不关闭。

## v0.9.4 在线核验记录（2026-08-27）

- GitHub Release：[v0.9.4](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.4)，发布 workflow [33030470944](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 的 Windows 构建/发布 job 成功；质量门禁和 Rust 依赖审计也已通过。
- `latest.json`：1,401 字节，SHA-256 `c12f59118f31ce2a4638e14d691b36d90079bbf119bdf9fcc1aef726919b804`。
- Windows x64 NSIS 安装包：4,867,204 字节，SHA-256 `dd59f1f7b70b77df118672e4ce0ffe5af92f5895e5b54fcb962067a08418fe6b`；`.sig`：424 字节，SHA-256 `4cc07d181afa855172f3ffdb688c0bb110c0ccd48fe166cbb94b3a138e457838`。
- Cloudflare Pages 的根 manifest、`/v0.9.4/` 安装包和 `.sig` 均 HTTP 200；镜像安装包和签名的大小及 SHA-256 与 GitHub Release 一致，镜像 manifest 版本为 `0.9.4`，下载地址指向镜像。
- 已登记的 v0.9.3 Windows 安装实例已通过应用内更新升级到 v0.9.4；签名校验、替换和自动重启成功，注册表 `DisplayVersion`、文件 `ProductVersion`、运行进程和页面版本均为 v0.9.4。
- Release 镜像子任务 [98382698574](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败；公开镜像当前可用不等于本次自动部署 workflow 全绿，#241 暂不关闭。

## v0.9.5 在线核验记录（2026-08-27）

- GitHub Release：[v0.9.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.5)，发布 workflow [33036785808](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808) 的 Windows 构建/发布 job [98401073429](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98401073429) 成功。
- `latest.json`：1,401 字节，SHA-256 `1da1a9971b33a72cc1ad90e5b91fd61e41df9dc37ec411a08d4845e2d7fafa7f`，版本为 `0.9.5`。
- Windows x64 NSIS 安装包：4,868,087 字节，SHA-256 `8af02aa74e4b2bea5a02ec07feb7c9a1d215c8b822d790e92a11129125dababd`；`.sig`：424 字节，SHA-256 `7f069913d679fde7e0a63b0c730d15a38f667e505568906b843e576239d8da93`。
- Cloudflare Pages 根 manifest、`/v0.9.5/` 安装包和 `.sig` 均 HTTP 200；镜像 manifest 版本为 `0.9.5`，安装包 4,868,087 字节且 SHA-256 与 GitHub 一致，`.sig` 424 字节且 SHA-256 与 GitHub 一致，下载地址指向镜像。
- 当前登记的 Windows 安装实例为 v0.9.4；本轮已完成 GitHub/Cloudflare 更新资源和签名资产核验，但尚未自动点击 v0.9.4→v0.9.5 并重启，不能把完整旧版本桌面升级回归记为已完成。
- Release 镜像子任务 [98402066927](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98402066927) 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败；公开镜像当前可用不等于自动部署 workflow 全绿，#241 暂不关闭。

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

签名更新产物位于受管 Cargo 缓存的 `release/bundle/` 下（Windows 默认是 `%LOCALAPPDATA%\\Moyang Reader\\build-cache\\cargo-target`），项目目录不会生成 `src-tauri/target`。清理器会识别旧版按路径分组的缓存，使用 `npm run cleanup:workspace -- --apply --prune-targets` 回收它们。key、pem 和 sig 文件已经加入 .gitignore，但仍应在提交前检查 staged diff。
