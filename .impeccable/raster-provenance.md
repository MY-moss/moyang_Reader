# 0.13 界面图像来源与证据边界

更新日期：2026-10-16。此记录用于区分当前界面证据、历史文档截图与产品素材；截图只是具体状态的记录，不代表全部交互或发布包验收。

本轮没有新增照片、插画或生成式栅格素材。导航与聊天图标来自本地打包的 Lucide SVG，代码入口为 `src/shared/components/Icon.tsx`，许可副本为 `docs/licenses/Lucide-ISC.txt`。既有应用品牌图标没有在本轮重新制作。

## 本轮设计审阅截图

以下文件在 `.impeccable/review/chat-updates/`，为本地审阅证据，不作为产品内插图或远程 API 的真实效果背书。文档交接已打开逐张检查。

| 文件                       | 来源及内容                                                         | 可用范围                                           |
| -------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `reader-1440.png`          | 本地 Chromium，1440×900，阅读空间首页                              | 导航分组、首页层级、图标                           |
| `reader-document-1440.png` | 本地 Chromium，1440×900，脚本创建的“城市里的小书房”示例            | 编辑正文、标签、右侧文档详情                       |
| `ai-1440.png`              | 本地 Chromium，1440×900，独立浏览器存储中的空知识库                | AI 导航、折叠筛选、空态                            |
| `chat-1440.png`            | 本地 Chromium，1440×900，安装书房聊天后的空对话                    | 可选助手入口与服务配置引导                         |
| `chat-720.png`             | 同一隔离浏览器，720×900                                            | 窄桌面导航与底部输入区；不代表手机支持             |
| `services-720.png`         | 同一隔离浏览器，720×900                                            | 单列配置与横向服务列表                             |
| `services-dark-1280.png`   | 同一隔离浏览器，系统深色模拟，1280×900                             | 深色服务表单与语义占位文字                         |
| `chat-message-1440.png`    | 1440×900，脚本拦截本机示例 API 并返回固定 SSE 文本                 | 消息排版、来源折叠与回答操作；不是实际模型质量测评 |
| `save-answer-1440.png`     | 从上述示例回答打开确认面板，1440×900                               | 遮罩、右侧面板与初始焦点                           |
| `updates-1440.png`         | 同一隔离浏览器，1440×900，设置中的应用更新分类                     | 设置布局与按钮外观；不证明线上发布源可用           |
| `storage-native-1280.png`  | 隔离数据的 Windows 原生桌面，150% 缩放，外窗 1280，客户区 1259×845 | 存储列表上半部、容量与长路径                       |
| `storage-native-720.png`   | 同一原生测试，外窗 720，客户区 699×845                             | 窄窗设置分类、路径换行与独立滚动                   |

前十张由本轮本地辅助脚本 `.local/capture-chat-review.mjs` 截取，内容为人工编写的示例文档与固定回答，不含个人笔记或真实 API 密钥。原生两张由桌面测试保存，使用临时数据目录，画面中的目录名与容量不代表用户资料库。

现有存储两图仍包含仅路径大小写不同而出现的兼容路径说明；当前源码已修正大小写比较，但此处不把修正冒称为截图结果。迁移目标、检查计划、执行状态和完成/失败结果尚无当前完整截图，最终包验收应补齐后再更新证据。`artifacts/workbench/release-storage.png` 在此交接时尚未验证；不把预定文件名作为已完成证据。

原六项修复及其限定判定见 `.impeccable/review/chat-updates/finish-review.md`。存储新增范围见同目录 `storage-extension-review.md`。不通过文档交接重新运行 detector 或扩大审美扫描。

## 仓库文档中的截图

`docs/screenshots/` 是应用界面的截图集合，不是界面依赖的纹理或图片；便携打包脚本排除了该目录。

- 本轮浏览器测试更新的 `reader-light.png`、`welcome-light.png`、`welcome-dark.png`、`compact-light.png`、`compact-dark.png` 来自 `e2e/refactor.spec.ts`。阅读内容由测试直接创建；首页是空库，浅深色分别由浏览器媒体偏好指定。桌面首页 1440×900，窄窗首页 720×700；阅读截图采用测试默认视口。
- `reader-dark.png`、`settings-light.png`、`settings-dark.png`、`compact-reader-light.png`、`compact-reader-dark.png` 为上一轮保留的界面截图；`scripts/capture-ui.mjs` 定义了这些文件的获取路径与虚构阅读文档，但本轮没有重新执行或验证其最终画面。它们不作为 0.13 新增页面的证据。
- `ai-knowledge-light.png`、`ai-knowledge-dark.png`、`ai-connections-light.png`、`ai-connections-dark.png` 为上一轮保留文件。本轮未确认原始捕获流程与数据来源，故不据此声明当前界面已验收，也不将其作为新增设计真源。

后续替换截图应使用隔离资料和示例服务，记录视口、主题、浏览器或原生运行环境，并明确发布包版本。图片中的成功提示不得代替服务连接、迁移或更新功能的实际验证。

## 收尾补充

`artifacts/workbench/quick-open-dark.png` 来自新增维护回归，720×800、系统深色、两份虚构 TXT；字号至少 12px、语义配色、键盘与 Axe 已通过。

`storage-plan-720-fixture.png` 与 `storage-result-720-fixture.png` 由 `.local/capture-storage-states.mjs` 在现有设置页截图，720×900，替换的只是存储接口模块：C:/Users/Example、D:/Moyang 和 E:/MoyangData 均为虚构路径。前者展示模型选项、迁移范围、容量和确认操作；后者展示结果、实际位置与兼容路径说明。主任务已查看两图。它们仅证明这些控件的布局，不证明原生迁移已经执行；真实迁移结果来自独立 PowerShell/MCP 测试。

最终路径比较沿用 `normalizePathKey`，处理大小写、Windows命名空间与尾分隔符；此前原生图中的重复说明仍属旧证据，最终便携烟测会核对当前源码。

2026-10-16 15:10（Asia/Shanghai），最终 0.13.0 便携包 `07-10-26.600Z-95e9de` 的 `artifacts/workbench/release-storage.png` 已由主任务查看：真实 Windows WebView、150% 缩放、隔离 D 盘测试资料；无迁移时不再显示重复的兼容路径说明。`release-desktop.png` 同批来源为隔离空 AI 库。实际保存/读取/正常退出结果见同目录 `release-smoke.json`。聊天并发首次初始化与失败重试另有原生和 Hook 回归；不将截图当成所有并发情况的证明。
