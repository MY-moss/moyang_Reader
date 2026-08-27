# Moyang Reader 版本路线

当前稳定基线：`v0.10.2`，下一开发目标：`v0.10.3`。Moyang Reader 当前只支持 Windows x64 桌面版；v0.9.5 已发布三栏导航、侧栏滚动和窄屏布局修复，以及可调宽面板交互。#104 的索引快速路径、ASCII 子串候选、工作区文件列表缓存、文件级 LRU、正式 5000 文档 P95 与长文档回退验收已在 PR #257、#259、#261、#264、#266 完成并关闭 Issue；v0.10.1 已完成 Windows x64 稳定发布。撤回/重做阅读位置修复已由 PR #262 合并并随 v0.10.1 发布。PR #269 已合并 v0.10.2 的首个 UI 切片，PR #270 已完成版本准备并发布 Windows x64 安装包；#187 的完整响应式断点验收仍保持 open。GitHub 与 Cloudflare 动态公开资产已核验可用，但静态镜像部署仍因仓库 Actions Secrets 未配置而失败。每个版本可以包含多个功能切片；达到一个用户功能版本的验收标准后必须生成安装包和公开更新，不为每个 commit 创建 Release。

## 平台范围收敛

- 产品、发布、文件关联、自动更新和真实桌面 E2E 只覆盖 Windows x64。
- 浏览器版只作为本地预览和 Playwright UI 测试环境，不承诺独立平台支持。
- macOS/Linux/Windows ARM/移动端不进入 v1.0 主线；不新增跨平台构建矩阵、安装包或桌面回归。
- RustSec 依赖审计可继续在 Ubuntu runner 执行，因为它是低频的平台无关安全检查，不是 Linux 产品构建。

| 版本    | 目标                                                                                                                                                                                                                                                               | 关联 Issues                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| v0.8.3  | 重要视觉缺陷 patch：系统暗色模式下文档内搜索高亮可读性修复                                                                                                                                                                                                         | #170                                                            |
| v0.9.0  | 已发布：三栏 UI、状态边界、多阅读库并存、直接 WYSIWYG 编辑入口和 Windows 无控制台桌面启动                                                                                                                                                                          | #16、#103、#111、#221                                           |
| v0.9.1  | 已发布：搜索索引预算回退、编辑器保真、统一撤销/重做历史、WYSIWYG 渲染性能、阅读位置稳定性、Windows 桌面启动/编辑/保存与无冲突外部刷新 smoke、模态键盘契约、草稿切换与恢复安全、a11y/i18n 稳定化；GitHub 与 Cloudflare 当前资产已核验，发布工作流镜像调用改造已合并 | #88、#104、#119、#111、#165、#164、#177、#180、#184、#185、#186 |
| v0.9.2  | 已发布：渲染异常恢复边界；阅读/WYSIWYG/HTML 导出的 h4 层级与列表节奏；顶栏菜单外点/Esc 关闭；此前已完成的桌面 watcher/refresh、导出写盘、关闭确认、更新提示与外部修改安全切片随本批次发布                                                                          | #174、#188、#231、#178、#192                                    |
| v0.9.3  | 已发布：Windows PDF 文件真实落盘、旧版本更新器 v0.9.2→v0.9.3 实机回归、Release/manifest/签名和 Cloudflare v0.9.3 公开资产核验；自动镜像 workflow 仍等待 Cloudflare Secrets 配置后全绿                                                                              | #241                                                            |
| v0.9.4  | 已发布：标签页文档缓存；按路径、文件大小和修改时间校验，最多 32 条且总内存预算 64 MiB，监听变更/保存/关闭时失效；已完成 Release、镜像资产和旧版自动更新核验，自动镜像 Secrets 仍由 #241 跟踪                                                                       | #183、#241                                                      |
| v0.9.5  | 已发布：修复右侧目录在中央滚动容器中的跳转、清理侧栏嵌套滚动条、补齐左右侧栏拖拽/键盘调宽、快捷键开关和本机布局记忆；#187 的完整响应式断点验收仍保持 open                                                                                                          | #187                                                            |
| v0.9.6  | 已合并、未单独发布：撤回/重做后保持中央阅读区和编辑器内部滚动位置，避免 Ctrl+Z 打断阅读；该修复已随 v0.10.1 稳定安装包发布                                                                                                                                         | 用户反馈、#165（编辑器覆盖相关）                                |
| v0.10.0 | 双链补全、嵌入、显式块 ID、块引用、属性和关系图筛选                                                                                                                                                                                                                | #109                                                            |
| v0.10.1 | 已发布：#104 的索引快速路径、ASCII 子串候选、工作区文件列表缓存、文件级 LRU 淘汰及正式验收，合并撤回/重做阅读位置修复；提供 Windows x64 安装包、签名、`latest.json` 和在线更新地址                                                                                 | #104                                                            |
| v0.10.2 | 已发布：#187 Windows 紧凑窗口最小宽度 720px、响应式工具栏横向滚动和真实溢出提示已由 PR #269 合并；完整断点体系仍需后续验收，并已提供 Windows x64 安装包、签名和 manifest                                                                                           | #187                                                            |
| v0.11.0 | Worker/分批导出、取消、分页和分享模板                                                                                                                                                                                                                              | #87                                                             |
| v0.12.0 | Windows 发布稳定性：镜像巡检、manifest 完整性、更新器回归、签名评估和安装包体验                                                                                                                                                                                    | #112、#33、#51                                                  |
| v1.0.0  | Windows x64 核心功能冻结、长期兼容性维护和稳定更新链路                                                                                                                                                                                                             | #52                                                             |

## v0.9.3 已发布记录

- 已完成：当前文档的 Windows PDF 保存路径、Edge headless 渲染、有效 PDF 文件头校验、原子替换，以及真实 Tauri 桌面 smoke；已由 [PR #244](https://github.com/MY-moss/moyang_Reader/pull/244) 合并，远程 `main` 合并提交为 `ba81e9d12cab64a0270f231496e19e0a01a3417a`。
- 已完成：从已登记的 Windows x64 v0.8.0 安装实例启动，检查到 v0.9.2，并完成下载、签名校验、替换、自动重启和版本号确认；未登记的旧副本不计入回归。
- 已完成：v0.9.3 版本同步、GitHub Release、NSIS 安装包、`.sig`、`latest.json` 和在线资产校验；Release workflow `33025181022` 的 Windows 构建与发布 job 成功。
- 已完成：从同一已登记安装位置的 v0.9.2 实机检查到 v0.9.3，完成下载、签名校验、替换、自动重启；注册表版本、文件版本和运行进程均为 v0.9.3。
- 已核验：Cloudflare 根 manifest 和 `/v0.9.3/` 安装包、`.sig` 均 HTTP 200，资产大小与 SHA-256 和 GitHub Release 一致。
- 待处理：Release 镜像子任务 `98365959782` 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 在凭据预检阶段失败；#241 保持 open，待安全配置 Secrets 后重新执行并确认自动镜像 workflow 全绿。

## v0.9.4 已发布切片（#183）

- 已实现并由 [PR #250](https://github.com/MY-moss/moyang_Reader/pull/250) 合并：本地 Markdown、纯文本、Word、PDF 和图片文档使用“路径 + 文件大小 + 修改时间”作为会话缓存校验；命中时跳过重复磁盘读取，Markdown/TXT 跳过重复渲染，二进制预览在预算内复用字节和已准备内容。
- 已实现：缓存只存在当前进程内，最多 32 条、总估算内存 64 MiB；单个超预算文件不缓存，不把用户文档写入应用缓存或同步到云端。
- 已实现：工作区 watcher 变更、成功保存、关闭标签页和应用退出都会清理对应缓存；修改时间或大小不一致时自动丢弃旧条目，磁盘文件仍是唯一真源。
- 已验证：缓存/桥接针对性测试、前端完整测试 176 项、lint、format、前端构建、浏览器 E2E 38 项、Rust fmt/clippy 和 Rust 37 项测试均通过；真实 Windows 桌面 E2E 10 项也已通过。
- 已完成：该版本的用户可感知性能改进已随 v0.9.4 安装包发布；具体 Release、镜像和旧版更新结果见下方 v0.9.4 发布记录。

## v0.9.4 发布记录（#183）

- 已完成：标签页文档缓存功能由 [PR #250](https://github.com/MY-moss/moyang_Reader/pull/250) 合并，版本同步由 [PR #251](https://github.com/MY-moss/moyang_Reader/pull/251) 合并，`v0.9.4` tag 指向 `main` 合并提交 `2b35c83f6d03c7faaa20baa1b4771b1454958610`。
- 已完成：Release workflow [33030470944](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 的 Windows 发布 job 成功；Release [v0.9.4](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.4) 已上传 `latest.json`（1,401 字节）、Windows x64 NSIS 安装包（4,867,204 字节）和 `.sig`（424 字节）。
- 已核验：GitHub 安装包 SHA-256 为 `dd59f1f7b70b77df118672e4ce0ffe5af92f5895e5b54fcb962067a08418fe6b`，`.sig` 为 `4cc07d181afa855172f3ffdb688c0bb110c0ccd48fe166cbb94b3a138e457838`，`latest.json` 为 `c12f59118f31ce2a4638e14d691b36d90079bbf119bdf9fcc1aef726919b804`。
- 已核验：Cloudflare 根 manifest、`/v0.9.4/` 安装包和 `.sig` 均 HTTP 200；镜像安装包和 `.sig` 的大小及 SHA-256 与 GitHub 一致，镜像 manifest 版本为 `0.9.4` 并指向镜像 URL。
- 已完成：登记的 Windows x64 v0.9.3 安装实例通过应用内“更新”下载并安装 v0.9.4，签名校验、替换和自动重启成功；注册表、文件、进程和页面版本均为 `v0.9.4`。
- 限制：Release 镜像子任务 [98382698574](https://github.com/MY-moss/moyang_Reader/actions/runs/33030470944) 因缺少 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 失败；#241 保持 open，补齐 Secrets 后再重跑并确认自动镜像链路全绿。

## v0.9.5 发布记录（#187 部分范围）

- 已完成：三栏目录跳转、中央正文滚动边界、侧栏嵌套滚动清理、窄屏单栏布局、左右面板拖拽/键盘调宽、双击重置、快捷键开关和布局记忆由 [PR #253](https://github.com/MY-moss/moyang_Reader/pull/253) 合并；版本同步由 [PR #254](https://github.com/MY-moss/moyang_Reader/pull/254) 合并，`v0.9.5` tag 指向 `main@086888f6c5ce5a7e2219510d0de31a575564248d`。
- 已完成：Release workflow [33036785808](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808) 的 Windows 构建/发布 job [98401073429](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98401073429) 成功；[Release v0.9.5](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.9.5) 已上传 `latest.json`、Windows x64 NSIS 安装包和 `.sig`。
- 已核验：安装包 4,868,087 字节，SHA-256 `8af02aa74e4b2bea5a02ec07feb7c9a1d215c8b822d790e92a11129125dababd`；`.sig` 424 字节，SHA-256 `7f069913d679fde7e0a63b0c730d15a38f667e505568906b843e576239d8da93`；`latest.json` 1,401 字节，SHA-256 `1da1a9971b33a72cc1ad90e5b91fd61e41df9dc37ec411a08d4845e2d7fafa7f`。
- 已核验：Cloudflare 根 manifest、`/v0.9.5/` 安装包和 `.sig` 均 HTTP 200，版本为 `0.9.5`，安装包和签名的大小、SHA-256 与 GitHub 一致；自动镜像 job [98402066927](https://github.com/MY-moss/moyang_Reader/actions/runs/33036785808/job/98402066927) 因 #241 缺少 Secrets 失败。
- 未完成边界：当前登记的旧实例为 v0.9.4，本轮完成在线更新资源核验，尚未自动点击 v0.9.4→v0.9.5 并重启；#187 完整响应式断点体系仍保持 open。

## v0.10.1 已完成切片与发布记录（#104）

- 已完成：搜索索引在工作区文件快照未变化时复用现有索引，跳过重复的逐文件元数据检查和重复持久化；watcher、保存和显式刷新仍负责失效，搜索结果保持不变。由 [PR #257](https://github.com/MY-moss/moyang_Reader/pull/257) 合并，`main` 合并提交为 `2d2209e35a2e45b66a0455edfcfba7074f4036ff`。
- 已完成：ASCII 非完整词查询复用已有 posting 生成候选，最终仍按 substring 规则确认结果；读取失败文件进入回退集合，watcher 事件先失效 Rust 缓存，未启用 watcher 时保留直接文件修改检测。由 [PR #259](https://github.com/MY-moss/moyang_Reader/pull/259) 合并，`main` 合并提交为 `a1c986c1bf5f54bcd32468e4147ad9674129ddc6`。
- 已完成：工作区文件列表在快照未变化时复用 Rust 缓存，跳过重复逐文件读取；watcher、保存和显式刷新仍负责失效，并新增 5000 文档回归基准。由 [PR #261](https://github.com/MY-moss/moyang_Reader/pull/261) 合并，`main` 合并提交为 `b5e62e7b8d00634261aa1b269cec13fb8853500f`。
- 已完成并由 [PR #264](https://github.com/MY-moss/moyang_Reader/pull/264) 合并：索引达到 posting 预算时按文件最近使用顺序淘汰旧 posting，并将被淘汰文件保留在线性回退集合；搜索候选命中会更新文件 LRU，持久化索引同步记录访问序列并升级缓存版本。未改变搜索结果或引入新依赖，main 合并提交为 `d109baab2624735b64d2e60d19dc5a7113936cbb`。
- 已验证：PR #257/#259/#261 的针对性搜索/工作区测试、完整 Rust 测试、Rust fmt、clippy 与 Windows Quality checks 均通过；本轮新增 LRU 回归也通过，持久化索引格式升级为版本 4，旧缓存会安全重建。
- 已完成正式验收：5000 篇每篇至少 2 KiB、混合中英文的文档在暖缓存查询中执行 20 次 P95 计时；本机记录为 38 ms，测试门槛为 P95 <100 ms。超出单文件索引 token 上限的长文档保留在线性回退集合，短文档仍可使用倒排索引，索引不会被整体关闭；PR #266 已合并，#104 已关闭。
- 本切片只增加验收回归测试和交接记录，不改变搜索结果、用户文档格式、依赖或运行时产品功能；版本准备与稳定发布另行执行。
- 已发布：版本准备 [PR #267](https://github.com/MY-moss/moyang_Reader/pull/267) 已合并，`v0.10.1` tag 指向 `main@0e8b4e9d5ea2471b6a318fec6335f8e7a2dc000d`；[GitHub Release v0.10.1](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.1) 已公开。
- 已核验：Release workflow [33057606371](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371) 的 Windows 构建/发布 job [98468201360](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371/job/98468201360) 成功；安装包 4,876,807 字节，SHA-256 `2e386893e2026986c684ede967d9758b0e52c0c990adc1d65ad7ef6171395a10`；`.sig` 428 字节，SHA-256 `03ba73d07dab409ce2bf16b0b3de76d40fca40690ecf8ee8613299ec06c671f8`；`latest.json` 1,411 字节，SHA-256 `f1ea49a293ef785d428e8fb5e3a1472341da2bd0d4053e3deda1a67d50caf0cc`。
- 已核验：GitHub Release 和 Cloudflare 根 manifest、`/v0.10.1/` 安装包及 `.sig` 均 HTTP 200，manifest 版本均为 `0.10.1`，镜像 URL 指向当前版本；Cloudflare 公开地址实际通过轻量代理读取最新 GitHub Release。
- 限制：同一 Release 的镜像子任务 [98470047373](https://github.com/MY-moss/moyang_Reader/actions/runs/33057606371/job/98470047373) 在可复用工作流凭据预检前失败且没有执行步骤，原因是仓库尚未配置 #241 所跟踪的 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`；这不影响 GitHub 安装包或当前动态镜像，但自动静态部署链路仍未记为全绿。
- 未完成边界：本轮核验了 GitHub/Cloudflare 在线更新资源，尚未在已登记的旧 Windows 安装实例上自动点击 v0.9.5→v0.10.1 并重启；#187 完整响应式断点体系仍保持 open。回滚时保留 v0.9.5 Release，修复后发布更高 patch，不删除现有资产。

## v0.10.2 已发布切片（#187 部分范围）

- 已实现：`src-tauri/tauri.conf.json` 的 Windows 最小窗口宽度从 900px 调整为 720px；工具栏在实际 `scrollWidth > clientWidth` 时显示边缘提示和本地化标题，并继续支持横向滚动。
- 已验证：`npm run lint`、`npm run format:check`、`npm run build` 和 3 条相关 Playwright smoke（390px 溢出提示、390px 正文无横向溢出、顶部菜单互斥）通过；无新依赖，不改变 Markdown 真源、保存和编辑逻辑。
- 已合并：PR #269 合并到 `main`，版本准备 PR #270 随后合并，`v0.10.2` tag 指向 `main@38973bd1a72f1d61bb50ea26ee6a1014934f7fce`。
- 已发布：Release workflow [33069798614](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614) 的 Windows 发布 job [98508812457](https://github.com/MY-moss/moyang_Reader/actions/runs/33069798614/job/98508812457) 成功；[GitHub Release v0.10.2](https://github.com/MY-moss/moyang_Reader/releases/tag/v0.10.2) 已公开，包含 `latest.json`（1,411 字节）、Windows x64 安装包（4,873,310 字节）和 `.sig`（428 字节）。
- 已核验：安装包 SHA-256 为 `626df63dadb79b2a9b564a505b4bbacf140a44c88e7ba7899e319d5b7a7ad36d`，`.sig` SHA-256 为 `0a22446928e600dc3ef854ac500d538f56027f8f074888ed0775e25a64c27748`；GitHub 与 Cloudflare 安装包/签名均 HTTP 200，Cloudflare 安装包和签名哈希与 GitHub 一致，根 manifest 和版本 manifest 均报告 `0.10.2`。
- 发布边界：Release 总 run 因静态镜像子任务失败而显示 failure；Windows 发布 job 成功，Cloudflare 动态镜像可用，但版本目录 manifest 当前回退到 GitHub 资产地址。仓库尚未配置 Cloudflare Pages 静态部署 Secrets，不把该子任务记为全绿。
- 未完成边界：#187 的完整断点体系、720/840/640/360 全档桌面实机验收仍保持 open；本次发布只覆盖已验收的 720px 最小宽度和真实工具栏溢出提示，尚未在已登记旧 Windows 安装实例上执行 v0.10.1→v0.10.2 的完整自动更新重启回归。

## v0.9.6 撤回位置修复（已合并，随 v0.10.1 发布）

- 目标：撤回/重做时捕获并恢复中央 `.content-area` 以及 Milkdown/CodeMirror 内部滚动面，避免编辑器状态更新或重新聚焦把用户带回文档顶部。
- 边界：不改变撤回/重做历史、Markdown 真源、布局和依赖；文档切换时使用路径校验，延迟恢复不会污染新文档。
- 已合并：由 [PR #262](https://github.com/MY-moss/moyang_Reader/pull/262) 合并，`main` 合并提交为 `a76613b63d319a123d51cf98d7816a1492ca7e6d`；代码、测试、流程文档和路线图在同一功能 PR 中完成。
- 验证：定向编辑历史视口单测 2/2、相关 lint/format、一次新构建、undo/redo 浏览器 E2E 1/1、Windows 桌面 smoke、依赖/发布检查和 Rust 门禁均通过；本切片未单独生成安装包，修复已纳入 v0.10.1 稳定发布。

## UI 与交互深化方向（v0.10.3 候选切片）

按“先统一令牌、再做微交互、最后做高级动效”的顺序推进，每项独立成切片、可单独验收：

1. **设计令牌与字体统一**：把间距、圆角、阴影、字号、动效时长/曲线收敛为 `styles.css` 顶部的设计令牌变量；提供系统字体、无衬线阅读字体和等宽编辑字体的可选配置，明确回退链与本地优先原则；深色模式按对比度（WCAG AA）校准一遍变量表。这是后续所有 UI 工作的地基。
2. **微交互与状态反馈**：面板开合/补全浮层/命令面板加统一过渡（150–200ms、同一条缓动曲线）；保存状态从静默变为轻量 toast/状态点（保存中→已保存→失败可重试）。
3. **键盘流与焦点管理**：编辑器内 `/` 触发块级菜单（标题/列表/表格/代码块/引用）已完成最小切片；后续补齐命令面板拼音前缀与最近使用、全局快捷键一致性审计（同一动作在不同视图快捷键一致）。
4. **a11y 深化**：焦点循环（Tab/Shift+Tab 在面板内闭合）、`prefers-reduced-motion` 降级、补全浮层的 `aria-activedescendant` 跟随。
5. **性能感**：长列表虚拟化、打开文档的骨架屏、外部修改同步的乐观 UI（先显示再确认）。

## Issue 处理规则

- P0/P1：阻塞合并或稳定发布，必须优先处理。
- P2：进入对应版本，不因为暂时不影响日常阅读而关闭。
- P3：可标记 `deferred` 并写明计划版本，完成验收后再关闭。
- 关闭 Issue 时必须评论实际 PR、合并提交、验证结果和用户可见影响。

## 发布节奏

- 功能分支和交接文档及时推送，方便审查和接手。
- 多个完整切片可以合并为稳定批次，但每个用户功能 minor 版本至少生成一次 Release、安装包、签名和镜像；重要 Bug 或更新/安全修复可以单独生成 patch Release。
- 每个稳定批次都验证 GitHub Release、Cloudflare 镜像、manifest、SHA-256、签名和旧版本自动更新。
- 版本分类、目标版本和是否发布必须在 PR 模板与 `docs/AI-HANDOFF.md` 中明确；纯文档、测试和内部工具改动可以不发布。

版本号选择和发布交付物的唯一规则见 [`docs/RELEASE-POLICY.md`](RELEASE-POLICY.md)。
