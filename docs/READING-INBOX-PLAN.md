# Reading Inbox / 每日文章精读：产品与技术实施总方案

> 状态：**长期规划已确认，当前不可直接跳过前置阶段实施**  
> 目标版本：v1.0 后优先推进；v0.14 仅提前稳定必要内部接缝  
> 产品定位：Moyang Reader 的**可选阅读工作台模块**，不是新的独立 App，也不是默认联网的内容平台  
> 适用平台：沿用当前产品边界，仅 Windows x64  
> 维护原则：本文是后续 AI 的实现规范；开始任何切片前仍必须先读 `AGENTS.md`、`docs/AI-TASKS.md`、`docs/AI-WORKFLOW.md`、`ARCHITECTURE.md` 与相关 ADR。

---

## 0. 一句话结论

不要另做一个“每日文章 App”。

在 Moyang Reader 内新增一个**默认关闭、显式启用、Local-first、可完全退回普通 Markdown 阅读器**的 `Reading Inbox` 模块：

```text
外部推荐 / 手动 URL / Digest JSON / 未来 RSS 或扩展
                     │
                     ▼
              Content Source Port
                     │
                     ▼
          Safe Fetch + Article Extract
                     │
                     ▼
           Ordinary Markdown File
              + local assets
              + .moyang sidecar
                     │
                     ▼
        现有 Reader / Search / Annotation
        Bookmark / History / Export Core
                     │
                     ▼
       未来 AiProvider / RAG / Knowledge
```

最重要的架构边界只有四条：

1. **网页获取不是 `DocumentAdapter` 的职责。** `DocumentAdapter` 负责“已经落到本地的文档格式”；网络来源必须经过独立的 Content Source / Article Import 接缝。
2. **文章正文不能只存在 SQLite 或私有数据库。** 导入完成后必须成为用户可见、可移动、可备份的普通文件；数据库若以后引入，只能做可重建索引/缓存。
3. **Reading Inbox 默认关闭且默认不后台联网。** 用户关闭功能后，已经保存的文章仍作为普通 Markdown 正常打开。
4. **每日推荐系统只负责提供候选内容，不拥有本地阅读状态。** 推荐、抓取、阅读、AI 分层，任何一层都可替换。

---

# 1. 本次架构审计：先修正哪些旧思路

## 1.1 审计结论

当前仓库已经具有：

- 本地工作区和普通文件真源；
- Markdown 阅读/编辑；
- 阅读位置、阅读历史；
- 书签、文本批注；
- 工作区索引、快速搜索；
- 三栏阅读布局；
- app settings / preferences；
- 文档 adapter registry；
- v0.14 规划中的 `IndexProvider`、`CommandService`、`SettingsNamespace`、`PermissionBroker`、`AiProvider`。

因此 Reading Inbox 应是**组合既有能力 + 增加内容获取层**，而不是第二套阅读器。

## 1.2 必须纠正的旧方案

### 错误 A：正文 Markdown/HTML + SQLite 作为核心状态库

这对全新 App 可以成立，但不适合 Moyang Reader 当前架构。

**纠正：**

- 正文：普通 `.md` 文件是真源；
- 可归档图片：用户选择后保存为普通本地资源；
- 工作区可迁移元数据：`.moyang/` sidecar；
- 设备相关 UI 状态：现有 app settings / local persistence；
- 搜索/语义向量/全文缓存：以后可以用数据库，但必须可删除重建。

### 错误 B：把 URL 当成一种 `DocumentAdapter`

URL 不是本地文档格式。

**纠正：**

```text
URL / RSS / Digest
    ↓
ContentSourceProvider
    ↓
ArticleImportService
    ↓
本地 article.md
    ↓
Markdown DocumentAdapter
```

不要实现 `UrlDocumentAdapter`，也不要让 `DocumentAdapter.canOpen()` 直接发网络请求。

### 错误 C：每日定时任务直接“推送进桌面数据库”

外部推荐系统与本地桌面 App 不应强耦合；ChatGPT、RSS、浏览器扩展、其他 AI 都可能成为来源。

**纠正：**先定义一个无账号、无服务器依赖的版本化导入协议 `moyang-reading-digest/v1`。第一阶段通过文件/剪贴板导入；以后才增加 custom URI、loopback bridge、MCP 或浏览器扩展。

### 错误 D：把“快速记录 Inbox”和“阅读 Inbox”混成一个概念

现有 v0.13 的 `Inbox 快速记录` 是**笔记捕获**；本方案 `Reading Inbox` 是**待读内容队列**。

**纠正命名：**

- `Quick Capture Inbox`：快速创建自己的 Markdown 笔记；
- `Reading Inbox`：外部文章候选、稍后阅读、阅读进度。

两者可以共享工作区，但 UI、状态和导入流程不得混写。

### 错误 E：仅保存 `scrollTop` 就视为文章长期进度方案

当前实现适合普通近期文档，但每日文章会快速超过现有容量，而且页面宽度、字体、重新抽取正文后绝对像素位置会漂移。

**纠正：**保留现有 `scrollTop` 作为兼容 fallback，同时升级为多锚点恢复模型：

```ts
export interface ReadingAnchorV1 {
  progressRatio: number;        // 0..1，最后兜底
  scrollTop: number;            // 兼容现有实现
  headingPath?: string[];       // 最近标题层级
  quote?: string;               // 当前位置附近短文本
  quotePrefix?: string;
  quoteSuffix?: string;
  contentFingerprint?: string;  // 判断正文是否已变化
  updatedAt: number;
}
```

恢复优先级：

1. quote + prefix/suffix 精确/近似定位；
2. headingPath 下寻找 quote；
3. progressRatio；
4. scrollTop；
5. 从顶部开始。

不要为了进度在 Markdown 正文中插入大量私有 block id。

---

# 2. 产品边界

## 2.1 用户价值

用户每天收到文章后，应能完成如下闭环：

```text
发现文章
  ↓
保存 / 稍后阅读
  ↓
离线正文
  ↓
继续上次位置
  ↓
高亮 / 批注 / 书签
  ↓
完成 / 归档
  ↓
以后搜索、回看、AI 关联
```

用户不应需要：

- 在 ChatGPT 对话里翻历史链接；
- 手工复制全文；
- 记得昨天看到哪；
- 为了使用文章阅读功能注册 Moyang 账号；
- 开启 AI 才能使用 Reading Inbox。

## 2.2 非目标

第一阶段明确不做：

- 不做公共内容社区；
- 不做推荐算法平台；
- 不做云账号/云同步；
- 不做版权内容绕过、登录墙绕过或付费墙绕过；
- 不执行网页脚本来绕过站点限制；
- 不默认缓存所有远程图片；
- 不做常驻后台爬虫；
- 不默认自动总结每篇文章；
- 不把用户阅读行为上传；
- 不在 v1.0 前引入第三方插件 ABI；
- 不把 Reading Inbox 作为 v1.0 发布阻塞项。

---

# 3. 可选功能模型：不需要的人完全感觉不到它

## 3.1 设置 key

在稳定设置层准备以下命名空间；真正实现时必须通过当时已经完成的 settings controller / `SettingsNamespace`，不要继续在多个组件里直接散写 localStorage。

```ts
interface ReadingInboxSettingsV1 {
  enabled: boolean;
  libraryPath: string | null;
  allowNetworkImport: boolean;
  autoDownloadDigestItems: boolean;
  archiveRemoteImages: boolean;
  showTodaySection: boolean;
}
```

建议 key：

```text
features.readingInbox.enabled
readingInbox.libraryPath
readingInbox.allowNetworkImport
readingInbox.autoDownloadDigestItems
readingInbox.archiveRemoteImages
readingInbox.showTodaySection
```

默认值：

```text
enabled = false
libraryPath = null
allowNetworkImport = false
autoDownloadDigestItems = false
archiveRemoteImages = false
showTodaySection = true
```

**注意：**`allowRemoteResources` 与 `allowNetworkImport` 不是同一个权限。

- `allowRemoteResources`：阅读正文时是否允许渲染远程资源；
- `allowNetworkImport`：是否允许主动从 URL 获取网页正文。

不能因为用户打开了远程图片，就自动允许抓取 URL；反过来也一样。

## 3.2 开启流程

设置 → 功能 → Reading Inbox：

1. 用户打开 `Reading Inbox`；
2. 如果未设置 `libraryPath`，显示目录选择器；
3. 只允许用户选择可写的工作区目录；
4. 在该目录下创建或选择一个普通子目录，例如 `Reading Inbox/`；
5. 显示第二个独立开关：“允许从网页导入正文”；
6. 只有打开网络导入后，URL 输入框和“保存网页”命令才可执行。

用户取消目录选择：

- `enabled` 不提交；
- 不创建半成品目录；
- 不改现有工作区。

## 3.3 关闭流程

关闭 Reading Inbox 后：

- 隐藏 Today / Inbox 专用 UI；
- 禁止新的后台/手动网络抓取；
- Reading Inbox 专用命令 `visible=false` 或 `enabled=false`；
- 不删除任何已保存 Markdown；
- 不删除批注、书签、历史；
- 用户仍可从文件树打开这些 `.md`；
- 再次开启后恢复队列视图。

**禁止：**关闭功能时自动清空文章。

---

# 4. UI / 信息架构

## 4.1 不新增第二套阅读页面

必须复用现有三栏：

```text
┌──────────────────────┬──────────────────────────────┬──────────────────────┐
│ 左：Library / Inbox  │ 中：现有 Reader             │ 右：现有 Context     │
│                      │                              │                      │
│ Today                │ 标题 / 来源 / 正文          │ Outline              │
│ Inbox                │ 阅读进度                    │ Properties           │
│ Reading              │ 高亮/批注                   │ Bookmarks            │
│ Finished             │                              │ Annotations          │
│ Files                │                              │ 未来 AI contribution │
└──────────────────────┴──────────────────────────────┴──────────────────────┘
```

不要创建 `ArticleReader.tsx` 并复制 Markdown Reader 的渲染/搜索/批注逻辑。

## 4.2 左栏导航

Reading Inbox 开启后，在工作区导航里增加一个可折叠“阅读”区域：

- `今日`：今日 Digest 进入的项目；
- `收件箱`：未开始；
- `阅读中`：已有有效进度、未完成；
- `已完成`：用户手动完成；
- `全部文章`：按保存时间；
- `文件`：原文件树仍是一等入口。

第一阶段不做十几个筛选页。收藏、标签等优先作为过滤器，不作为永久导航项。

## 4.3 Article Card 最小信息

每张卡只显示：

```text
标题
来源域名 · 作者（有则显示） · 预计阅读时长
状态 / 进度条
保存时间或发布日期
```

可选：推荐理由最多 2 行。

不要在列表里塞完整 AI 摘要。

## 4.4 主要交互

文章卡：

- 单击：打开；
- 双击：不定义额外行为；
- Enter：打开；
- Space：未来可考虑 quick preview，第一版不做；
- 右键/更多：标记稍后、完成、未读、打开来源、删除本地副本。

阅读页：

- 打开后自动恢复进度；
- 用户滚动时只更新内存，debounce/flush 持久化；
- 切换文档、窗口失焦/关闭时 flush；
- 到达正文 95% **不自动标记完成**，只出现轻量“标记为已读”提示；
- 用户可手动改回未读/阅读中。

## 4.5 Settings UI

建议放在：

```text
Settings
└─ Features
   └─ Reading Inbox
      ├─ Enable Reading Inbox
      ├─ Reading library folder [Choose…]
      ├─ Allow web imports
      ├─ Download article images for offline use
      └─ Automatically download imported digest items
```

`Automatically download imported digest items` 只有：

- Reading Inbox enabled；
- allowNetworkImport=true；

才可交互。

默认关闭。

## 4.6 命令 ID

为未来 `CommandService` 固定语义，建议：

```text
readingInbox.open
readingInbox.importUrl
readingInbox.importDigest
readingInbox.markUnread
readingInbox.markReading
readingInbox.markFinished
readingInbox.openSource
readingInbox.removeFromQueue
readingInbox.deleteLocalCopy
readingInbox.retryImport
```

不要把按钮逻辑各自写一份。TopBar、Command Palette、context menu 都调用同一 command。

---

# 5. 本地文件与数据格式

## 5.1 推荐目录

用户选择的阅读库：

```text
<ReadingLibrary>/
├─ Reading Inbox/
│  ├─ 2026/
│  │  ├─ 09/
│  │  │  ├─ 2026-09-05--article-title--a1b2c3.md
│  │  │  └─ 2026-09-05--another-title--d4e5f6.md
│  └─ assets/
│     ├─ a1b2c3/
│     └─ d4e5f6/
└─ .moyang/
   └─ reading-inbox/
      ├─ queue.v1.json
      └─ imports.v1.json
```

注意：

- `.md` 是正文真源；
- `assets/` 是普通可访问文件；
- `.moyang/` 只存状态/来源补充信息，不存唯一正文；
- 不要求用户知道 `.moyang` 才能阅读文章。

## 5.2 文件名

规则：

```text
YYYY-MM-DD--<sanitized-slug>--<short-id>.md
```

`short-id` 来自稳定 `articleId` 前 6～10 个 hex 字符，避免同名冲突。

Windows 文件名必须：

- 删除 `< > : " / \\ | ? *`；
- 删除结尾空格和点；
- 避免 CON/PRN/AUX/NUL/COM1..9/LPT1..9；
- 控制文件名长度，完整标题留在 frontmatter；
- 冲突时依赖 articleId，不用 `(1)(2)` 猜测。

## 5.3 Markdown frontmatter schema

建议 schema：`moyang-article/1`。

```yaml
---
moyang_article_schema: "moyang-article/1"
moyang_article_id: "sha256:..."
title: "Example article"
author: "Example Author"
source_url: "https://example.com/article?utm_source=..."
canonical_url: "https://example.com/article"
source_domain: "example.com"
published_at: "2026-09-05T08:00:00Z"
saved_at: "2026-09-05T13:20:00Z"
language: "zh-CN"
estimated_minutes: 18
content_fingerprint: "sha256:..."
imported_by: "manual-url"
---

# Example article

正文……
```

### 必填字段

```text
moyang_article_schema
moyang_article_id
title
source_url
saved_at
```

### 可选字段

```text
canonical_url
author
source_domain
published_at
language
estimated_minutes
content_fingerprint
imported_by
```

### 不写入 frontmatter 的字段

以下是频繁变化状态，不应每滚动一下就重写正文文件：

```text
progress
lastReadAt
readingSeconds
queueStatus
UI selected/filter state
AI conversation
API key/token
```

## 5.4 articleId

优先：

```text
SHA-256(normalizedCanonicalUrl)
```

没有 canonical URL 时：

```text
SHA-256(normalizedFinalUrl)
```

URL normalization 至少：

- scheme/host 小写；
- 删除 fragment；
- 默认端口折叠；
- 可删除明确 tracking 参数 `utm_*`, `fbclid`, `gclid`；
- **不要**随意排序/删除未知 query，因为 query 可能决定正文。

如果两个不同页面错误声明同一 canonical URL：

- 先比较 `contentFingerprint`；
- 内容明显不同则提示冲突，不静默覆盖。

## 5.5 queue sidecar

建议：`.moyang/reading-inbox/queue.v1.json`

```json
{
  "schema": "moyang-reading-queue/1",
  "items": {
    "sha256:...": {
      "relativePath": "Reading Inbox/2026/09/2026-09-05--example--a1b2c3.md",
      "status": "unread",
      "favorite": false,
      "addedAt": 1788600000000,
      "finishedAt": null,
      "digestDate": "2026-09-05"
    }
  }
}
```

`status` 只允许：

```text
unread
reading
finished
archived
```

状态转换：

```text
unread -> reading -> finished
   ^         |          |
   └─────────┴──────────┘ 用户可手动回退
任何状态 -> archived
archived -> unread/reading/finished（恢复）
```

删除本地副本与 archived 是不同动作。

## 5.6 设备阅读锚点

短期优先扩展现有 reading-position 存储；不要立即为了 Reading Inbox 建数据库。

未来结构可升级为：

```json
{
  "path": "C:\\...\\article.md",
  "anchor": {
    "progressRatio": 0.734,
    "scrollTop": 8421,
    "headingPath": ["第二部分", "局限"],
    "quote": "The fundamental problem is...",
    "quotePrefix": "...",
    "quoteSuffix": "...",
    "contentFingerprint": "sha256:...",
    "updatedAt": 1788600000000
  }
}
```

### 容量修正

现有 `MAX_READING_POSITIONS = 32` 对文章库明显不足。

实现 Reading Inbox 前必须单独做一个迁移切片：

- 改为合理容量，例如 512 或基于 LRU/时间；
- 或迁移到统一 settings/native persistence；
- 旧 `{path, top}` 必须无损读取；
- 新格式不可导致 v0.10.x 用户升级后位置全部清零。

具体容量必须在真实数据规模测试后定，不要直接把数字改到“无限”。

---

# 6. Daily Digest 导入协议

## 6.1 目标

让 ChatGPT 定时任务、其他 AI、RSS 聚合器、脚本都能生成同一种**中立 manifest**。

第一版不要求它们能直接写用户磁盘。

## 6.2 Schema

```json
{
  "schema": "moyang-reading-digest/1",
  "generatedAt": "2026-09-05T09:00:00+08:00",
  "source": {
    "id": "chatgpt-daily-reading",
    "label": "每日精选阅读"
  },
  "items": [
    {
      "title": "文章标题",
      "url": "https://example.com/article",
      "author": "作者",
      "publishedAt": "2026-09-04T12:00:00Z",
      "category": "culture",
      "estimatedMinutes": 18,
      "reason": "为什么值得今天读",
      "tags": ["城市", "文化"]
    }
  ]
}
```

## 6.3 Validation

必须：

- `schema === "moyang-reading-digest/1"`；
- `items` 是数组；
- 每项 `title` 非空；
- 每项 `url` 只允许 `http:` / `https:`；
- 单个 manifest 设置合理条目上限，例如 100；
- title/reason/tag 等字段设长度上限；
- 未知字段忽略，不能导致整个导入失败；
- 单项失败不阻断其他合法项；
- 展示导入摘要：新增、重复、无效、待抓取。

## 6.4 第一阶段入口

支持：

1. `Import Digest…` 选择 JSON 文件；
2. 粘贴 JSON；
3. 粘贴单个 URL。

暂不支持：

- 公开 HTTP webhook；
- 无鉴权 loopback server；
- 浏览器扩展直接写文件；
- ChatGPT 直接操作本地磁盘。

## 6.5 后续自动接入

优先顺序：

```text
File/Clipboard Manifest
        ↓
Custom URI with explicit confirmation
        ↓
Authenticated local bridge / MCP (read/write scope separated)
        ↓
Browser Extension / ContentSourceProvider package
```

无论哪种方式，最后都必须调用同一个 `importDigest()` application service。

---

# 7. 网络抓取与安全边界

## 7.1 原则

网页导入是 Reading Inbox 最危险的新能力，因为它让桌面应用开始主动访问用户提供的 URL。

网络请求必须集中在 Tauri/Rust 受控边界，不允许 React 组件到处自由 fetch。

## 7.2 推荐分层

```text
React URL Import Dialog
        │
        ▼
ArticleImportService (TS application layer)
        │
        ▼
article_fetch command / FetchPort
        │
        ▼
Rust safe HTTP client
        │
        ▼
FetchedHtml
        │
        ▼
ArticleExtractor (detached DOM)
        │
        ▼
HTML -> Markdown normalizer
        │
        ▼
Atomic file write
```

Tauri 2 官方 HTTP plugin / 其 Rust reqwest re-export 可以作为实现候选；也可以直接在 Rust 层使用审计后的 HTTP client。**不要为了方便把宽泛 `http:*` 权限直接暴露给 webview。**

## 7.3 SSRF 防护

必须拒绝：

- `file:`、`ftp:`、`data:`、`javascript:` 等非 http(s)；
- URL 中用户名/密码；
- localhost；
- loopback；
- link-local；
- private IPv4；
- private/reserved IPv6；
- metadata service 地址；
- DNS 重绑定后解析到私网的目标。

每次 redirect 都必须重新验证新地址。

### 最低限制建议

```text
connect timeout: 10s
request total timeout: 30s
redirects: <= 5
HTML body: <= 8 MiB（先测后定）
manifest item count: <= 100
user-agent: 明确标识 Moyang Reader
```

数字是默认候选，不是永久 ABI；实现时必须有测试覆盖边界。

## 7.4 Content-Type

正文抓取第一阶段只接受：

```text
text/html
application/xhtml+xml
text/plain（可直接保存）
```

PDF/DOCX 不走文章 extractor；它们回到现有文件下载/打开能力或以后独立设计。

## 7.5 登录墙 / 付费墙

行为必须是：

- 正常 HTTP 返回多少就解析多少；
- 解析不到正文则标记 `extraction_failed`；
- 提供“打开原网页”；
- 不执行绕过登录/付费墙脚本；
- 不自动携带浏览器 cookies；
- 不读取用户浏览器 session。

## 7.6 远程图片

正文离线与图片离线分开。

默认：

- 保存正文；
- 图片 URL 保留或根据现有 remote-resource policy 不显示；
- UI 标注“正文已离线，图片未归档”。

用户显式打开 `archiveRemoteImages` 后：

- 仅 http(s)；
- 同样做 SSRF 校验；
- MIME allowlist：常见 raster/webp/svg（SVG 需按现有安全策略处理）；
- 单图和总下载量限额；
- 下载成功后把 Markdown URL 改为相对路径；
- 失败不应导致正文导入整体失败。

---

# 8. 正文抽取技术路线

## 8.1 候选依赖，不提前锁版本

后续实现任务开始时再确认当前稳定版本、安全公告和许可证。

候选：

- `@mozilla/readability`：正文主体抽取；
- `turndown` + 必要 GFM rule：HTML → Markdown；
- 现有 sanitize/Markdown pipeline：最终渲染仍遵循 Moyang Reader 现有安全规则。

不要在本规划 PR 中提前把依赖写入 `package.json`。

## 8.2 为什么不自己用正则解析 HTML

禁止实现：

```text
replace(/<script.*?>.*?<\/script>/g, "")
replace(/<p>/g, "...")
```

网页结构、实体、嵌套、代码块、表格、链接都不适合正则级转换。

## 8.3 抽取流程

```text
Fetched HTML
  ↓
DOMParser 创建 detached Document
  ↓
禁止执行 script / event handlers
  ↓
读取 metadata/canonical/author/date
  ↓
Readability clone.parse()
  ↓
Sanitize extracted fragment
  ↓
Turndown -> Markdown
  ↓
normalize Markdown
  ↓
quality checks
  ↓
atomic save
```

### 质量检查

至少检查：

- 标题非空；
- 正文字符数达到最小阈值；
- 正文不是几乎全导航链接；
- 不出现大量重复菜单文本；
- 输出没有 `<script>`、event handler、危险 URI；
- Markdown 能通过现有 parser；
- code/table/link/image 基本 fixture 不丢失关键结构。

## 8.4 Extraction Result

```ts
export type ArticleExtractionResult =
  | {
      ok: true;
      article: ExtractedArticle;
      warnings: ArticleImportWarning[];
    }
  | {
      ok: false;
      code: ArticleImportErrorCode;
      message: string;
    };

export interface ExtractedArticle {
  title: string;
  author?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  language?: string;
  markdown: string;
  estimatedMinutes?: number;
  contentFingerprint: string;
  images: ExtractedImageRef[];
}
```

---

# 9. 内部接口：给后续 AI 的明确接缝

## 9.1 不要建立一个“万能 Provider”

至少分开：

### `ContentSourceProvider`

职责：提供候选元数据，不负责渲染本地文档。

```ts
export interface ContentSourceProvider {
  readonly id: string;
  readonly label: string;
  list(input: ContentSourceListInput, signal: AbortSignal): Promise<ContentSourcePage>;
}
```

未来实现可能是：

```text
manual-digest
rss
browser-extension
mcp-bridge
custom-provider
```

### `ArticleFetchPort`

职责：安全获取一个 URL 的原始响应。

```ts
export interface ArticleFetchPort {
  fetch(url: string, options: ArticleFetchOptions, signal: AbortSignal): Promise<FetchedArticleSource>;
}
```

### `ArticleExtractor`

职责：无网络副作用，把 HTML 转成结构化正文。

```ts
export interface ArticleExtractor {
  extract(source: FetchedArticleSource): Promise<ArticleExtractionResult>;
}
```

### `ReadingInboxRepository`

职责：保存/读取 queue 元数据，不保存正文 blob。

```ts
export interface ReadingInboxRepository {
  list(): Promise<ReadingInboxItem[]>;
  get(articleId: string): Promise<ReadingInboxItem | null>;
  upsert(item: ReadingInboxItem): Promise<void>;
  remove(articleId: string): Promise<void>;
}
```

### `ArticleImportService`

职责：应用层 orchestration。

```ts
export interface ArticleImportService {
  importUrl(input: ImportArticleInput, signal: AbortSignal): Promise<ImportArticleResult>;
  importDigest(input: DigestManifestV1, signal: AbortSignal): Promise<ImportDigestResult>;
}
```

## 9.2 与既有端口的关系

```text
DocumentAdapter      -> 打开已保存 article.md
IndexProvider        -> 搜索 article.md
CommandService       -> 暴露 import/status/openSource 命令
SettingsNamespace    -> Reading Inbox 设置
PermissionBroker     -> 未来第三方 source 请求网络/文件权限
AiProvider           -> 未来解释/翻译/问答
ConsentScope         -> AI 发送选区/全文的显式范围
```

不要让 `AiProvider` 负责抓网页；不要让 `ArticleImportService` 负责 AI 总结。

---

# 10. 建议代码目录

在相关前置重构完成后，新代码按职责放置；不要继续全部堆 `App.tsx`。

```text
src/app/reading-inbox/
├─ types.ts
├─ settings.ts
├─ digest-schema.ts
├─ article-import-service.ts
├─ article-extractor.ts
├─ article-markdown.ts
├─ reading-anchor.ts
├─ queue-repository.ts
├─ commands.ts
├─ selectors.ts
└─ *.test.ts

src/app/components/reading-inbox/
├─ ReadingInboxNav.tsx
├─ ReadingInboxList.tsx
├─ ReadingInboxCard.tsx
├─ ImportArticleDialog.tsx
├─ ImportDigestDialog.tsx
└─ *.test.tsx

src-tauri/src/
├─ ...现有按领域拆分后的结构
└─ article_fetch.rs     # 只有在 commands.rs 拆分阶段完成后创建
```

如果届时仓库已有新的 domain/service 目录结构，**服从当时主干结构**，不要为了照本文重新制造第二套目录。

---

# 11. Rust / IPC 契约建议

不要让组件直接 `invoke("fetch_article", ...)`。

应用层经 bridge 调用。

建议稳定命令语义：

```text
article_fetch
article_asset_fetch
```

第一阶段 `article_fetch` 输入：

```ts
interface ArticleFetchRequest {
  url: string;
  maxBytes: number;
}
```

输出：

```ts
interface ArticleFetchResponse {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string | null;
  bodyUtf8: string;
  etag: string | null;
  lastModified: string | null;
}
```

错误必须是稳定 code，不返回 Rust Debug 字符串作为 UI 契约。

建议 error codes：

```text
ARTICLE_INVALID_URL
ARTICLE_NETWORK_DISABLED
ARTICLE_BLOCKED_ADDRESS
ARTICLE_DNS_FAILED
ARTICLE_CONNECT_TIMEOUT
ARTICLE_REQUEST_TIMEOUT
ARTICLE_TOO_MANY_REDIRECTS
ARTICLE_RESPONSE_TOO_LARGE
ARTICLE_UNSUPPORTED_CONTENT_TYPE
ARTICLE_HTTP_STATUS
ARTICLE_EXTRACTION_FAILED
ARTICLE_EMPTY_CONTENT
ARTICLE_DUPLICATE
ARTICLE_WRITE_FAILED
ARTICLE_ASSET_FAILED
DIGEST_INVALID_SCHEMA
DIGEST_TOO_MANY_ITEMS
```

UI 文案由 i18n 映射，不把中文句子当 error code。

---

# 12. 阅读状态与批注复用

## 12.1 批注

现有批注已经具有 quote/prefix/suffix/start/end，这正好能支持文章正文小幅变化后的再锚定思路。

不要新建 `ArticleAnnotation` 类型。

如需增强：

- 扩展通用 annotation resolver；
- 让文章和普通 Markdown 共用；
- 不把批注嵌进正文。

## 12.2 书签

沿用现有 Bookmark 模型。

## 12.3 阅读历史

现有 reading history 按本地 path 统计，导入后文章也有稳定本地 path，因此可以直接计时。

需要单独评估：

- 256 条历史是否足够长期文章库；
- 366 天日统计是否符合产品；
- 是否要让用户选择“阅读统计保留多久”。

不要因为 Reading Inbox 直接改成无界数组。

---

# 13. 搜索与知识库

## 13.1 第一阶段

文章变成普通 Markdown 后，现有 workspace index 应自然索引正文。

可增加 metadata filter：

```text
moyang_article_schema
source_domain
saved_at
published_at
reading status（来自 sidecar，不直接依赖全文 index）
```

## 13.2 后续语义检索

必须遵循：

```text
ordinary files -> extractText -> chunk -> derived index
```

向量数据库是**派生缓存**，必须：

- 可删除；
- 可重建；
- 不成为批注/正文唯一来源；
- 用户可关闭；
- 本地 embedding 与远程 embedding 分开授权。

---

# 14. AI 精读阶段

Reading Inbox 能独立工作后，才接 AiProvider。

## 14.1 UI

不要第一版新增常驻聊天栏。

优先复用右侧 Context contribution：

```text
AI
├─ 解释选中内容
├─ 翻译选中内容
├─ 解释本段
├─ 总结当前章节
└─ 问关于当前文章的问题
```

## 14.2 ConsentScope

每次请求必须明确传递范围：

```ts
type ReadingAiScope =
  | { kind: "selection"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "section"; heading: string; text: string }
  | { kind: "document"; path: string; text: string };
```

默认从最小范围开始。

## 14.3 禁止默认自动总结

每日 Digest 可以有外部提供的推荐理由；Moyang Reader 不应默认在导入时把全文发送给 AI。

原因：

- 成本；
- 隐私；
- 网络；
- 用户真正目标是阅读而不是积累摘要；
- AI provider 不是 Reading Inbox 的硬依赖。

---

# 15. 分阶段开发路线

以下是**长期拆分模板**，不是要求现在一次性创建十几个 open PR。只有前置条件满足后，才把下一个切片复制到 `docs/AI-TASKS.md`。

## R0：前置条件（v0.14 及以前）

必须先完成或达到等价状态：

- settings controller/namespace 已稳定；
- document session 不再由新功能继续堆进巨型 App；
- CommandService 有最小内置使用者；
- DocumentAdapter 与 Content Source 概念在文档中分开；
- TS↔Rust 有稳定 error code / runtime validation 边界；
- Windows-only 边界未被误改。

### R0 验收

- Reading Inbox 后续无需直接新增大段逻辑到 App.tsx；
- URL fetch 不需要把任意网络权限暴露给整个 renderer；
- 新设置有唯一持久化入口。

---

## R1：Feature Toggle + 空壳 IA（0.5–2 天）

### 目标

建立默认关闭的 Reading Inbox 产品入口，不联网、不抓网页。

### 用户价值

用户可自主选择是否使用；普通 Markdown 用户界面不被打扰。

### 非目标

- 不 URL fetch；
- 不 Digest；
- 不 AI；
- 不创建 provider 框架。

### 涉及文件（按届时主干调整）

```text
settings/preferences controller
TopBar / WorkspacePanel
Command registry
reading-inbox/settings.ts
ReadingInboxNav.tsx
```

### 验收

- 默认关闭；
- 老用户升级不显示新导航；
- 开启后要求选择目录；
- 关闭后文件仍可读；
- browser E2E：on/off 两条路径；
- a11y：toggle label/focus/keyboard 正常。

### 回滚

删除 UI contribution 和 setting reader；保留未知 setting key 不会影响旧版本。

---

## R2：Reading State + Resilient Anchor（1–3 天）

### 目标

升级通用阅读位置模型，使文章库规模和重排恢复可用。

### 用户价值

文章能稳定继续上次阅读位置。

### 非目标

- 不导入网页；
- 不改批注 schema；
- 不做跨设备同步。

### 验收

- 旧 `{path, top}` 可迁移；
- 新 quote/ratio anchor 单测；
- 宽度/字号变化后能落到合理位置；
- 容量策略有测试；
- 普通 Markdown 同样受益。

### 回滚

继续读取旧 top；新增字段可忽略。

---

## R3：Manual URL Import MVP（2–3 天）

### 目标

用户粘贴一个公开 http(s) URL，保存为普通 Markdown。

### 用户价值

第一次形成“网页 → 本地阅读”的完整闭环。

### 非目标

- 不自动下载 Digest；
- 不图片归档；
- 不登录网站；
- 不浏览器扩展。

### 验收

- 网络权限显式开启；
- SSRF/redirect/size/content-type 测试；
- 5–10 个本地 HTML fixtures 覆盖文章、代码、列表、表格、图片；
- 真实 URL 手动 smoke；
- 导入后断网仍可读正文；
- 重复 URL 不生成静默重复文件；
- 原 URL 可一键打开。

### 回滚

删除 import command/service；已生成 Markdown 保持可用。

---

## R4：Reading Inbox Queue UI（1–3 天）

### 目标

Today/Inbox/Reading/Finished 视图由 sidecar 状态驱动。

### 验收

- 状态切换可逆；
- 不改正文文件；
- 文件被外部重命名/删除时有 orphan handling；
- 列表可键盘操作；
- 大于 500 项仍可正常交互（如需虚拟化先 benchmark 再加）。

---

## R5：Digest Manifest Import（1–2 天）

### 目标

支持 `moyang-reading-digest/1` 文件/粘贴导入。

### 验收

- schema validation；
- partial success；
- duplicate summary；
- 默认只进入候选队列，不自动联网；
- 用户可批量选择下载正文；
- `autoDownloadDigestItems` 关闭时 0 网络请求。

---

## R6：Offline Assets（1–3 天）

### 目标

显式开启后下载文章图片到本地。

### 验收

- SSRF 同正文；
- MIME/size/count 限制；
- Markdown 改相对 URL；
- 图片失败不回滚正文；
- 删除文章时明确询问是否删除其本地 assets。

---

## R7：AI Reading Actions（每个动作单独 0.5–2 天）

顺序：

1. explain selection；
2. translate selection；
3. ask current section；
4. summarize current section；
5. document Q&A。

每个动作都复用 AiProvider + ConsentScope。

---

## R8：Source Providers（v1.x 后）

按真实需求逐个加：

```text
RSS
Browser Extension
OpenAI/ChatGPT-generated manifest bridge
MCP bridge
其他 provider
```

一次只实现一个 provider，不提前造 marketplace。

---

# 16. 测试策略

## 16.1 单元测试

必须覆盖：

```text
Digest schema parser
URL normalization
articleId
file-name sanitizer
frontmatter serializer/parser
queue state transitions
anchor migration/restore
HTML extraction fixtures
HTML -> Markdown fixtures
error-code mapping
settings migration
```

## 16.2 Rust 测试

必须覆盖：

```text
invalid scheme
localhost/private IP
redirect to private IP
response limit
redirect limit
timeout
unsupported content-type
atomic write failure
```

网络安全测试尽量用本地受控 test server，不依赖公网 CI。

## 16.3 Browser E2E

UI 切片至少覆盖：

```text
feature off -> no Reading Inbox UI
feature on -> nav appears
import dialog validation
queue state keyboard interaction
continue reading restores anchor
```

## 16.4 Desktop E2E

涉及真实 Tauri 网络/文件命令时至少增加一个真实 desktop slice：

```text
explicit opt-in
-> import controlled local test article
-> markdown created
-> open
-> progress saved
-> restart
-> continue
```

## 16.5 回归

Reading Inbox PR 仍必须保证：

- 普通 Markdown open/edit/save；
- workspace search；
- annotation；
- bookmark；
- export；
- remote resource default policy；
- app settings migration。

---

# 17. 外部文件变化与删除

## 17.1 用户手动改正文

这是允许的。

若 `contentFingerprint` 改变：

- 不覆盖用户修改；
- 进度恢复使用 quote/ratio fallback；
- “重新抓取”必须先预览或保存为新版本，不静默覆盖。

## 17.2 用户移动/重命名文章

queue sidecar 的 relativePath 可能失效。

恢复策略：

1. 根据 `moyang_article_id` 在已索引 Markdown frontmatter 查找；
2. 找到唯一文件则修复 relativePath；
3. 多个候选则提示用户；
4. 找不到则标记 orphan，不自动删除状态。

## 17.3 用户删掉文章

队列显示“本地文件缺失”；提供：

- 从队列移除；
- 如果 source URL 还在且网络允许，重新导入。

---

# 18. 删除语义

必须区分三个动作：

### Archive

只改变 queue status；文件不动。

### Remove from Reading Inbox

从 queue sidecar 删除，Markdown 文件仍留在工作区。

### Delete local copy

删除 Markdown（走现有安全删除/回收站机制）以及用户确认的专属 assets。

不要把三个动作都叫“删除”。

---

# 19. 隐私与遥测

默认：

- 无账号；
- 无文章上传；
- 无阅读历史上传；
- 无推荐行为遥测；
- 不扫描浏览器历史；
- 不读取浏览器 cookies；
- 不向 AI provider 自动发送全文。

如果未来增加诊断导出：

- URL 默认可脱敏；
- 本地绝对路径默认隐藏；
- 正文默认不包含。

---

# 20. 性能预算

先 benchmark，再优化。

建议目标：

```text
Reading Inbox 500 项：列表交互无明显卡顿
Digest 100 项校验：< 200ms（普通开发机目标，不做硬 ABI）
已保存文章打开：继续使用现有文档打开预算
后台无任务时：Reading Inbox 不产生轮询
feature off：不得产生额外网络请求
```

不因为“以后可能 10 万篇”提前引入复杂数据库。

---

# 21. 与 v0.13 Quick Capture Inbox 的边界

| 项目 | Quick Capture Inbox | Reading Inbox |
|---|---|---|
| 目的 | 快速记自己的内容 | 保存外部待读文章 |
| 输入 | 用户文字 | URL / Digest / Provider |
| 文件 | 普通 Markdown | 普通 Markdown + article frontmatter |
| 网络 | 不需要 | 可选 |
| 状态 | 普通文件 | unread/reading/finished/archive |
| AI | 非必需 | 非必需 |
| 推荐 | 无 | 外部 provider 可提供 |

UI 可以在未来共享 “Inbox” 视觉组件，但 domain 名称和数据状态不能混在一起。

---

# 22. 后续 AI 开发时必须遵守的防跑偏清单

开始任何 Reading Inbox 切片前逐项确认：

- [ ] 我读过 `AGENTS.md`、`AI-TASKS.md`、`AI-WORKFLOW.md`、`ARCHITECTURE.md`、本文和 ADR 0014。
- [ ] 当前前置任务已满足；不是为了做未来功能跳过 v0.11–v1.0 当前主线。
- [ ] 本次只做一个 0.5–3 天垂直切片。
- [ ] 我没有新建第二个 reader/editor。
- [ ] 我没有把 URL 伪装成 DocumentAdapter。
- [ ] 我没有让 React 组件自由访问任意 URL。
- [ ] 我没有默认开启网络。
- [ ] 我没有自动发送正文给 AI。
- [ ] 我没有把正文只存到数据库。
- [ ] 我没有把 Quick Capture Inbox 与 Reading Inbox 混为一谈。
- [ ] 我没有直接在 App.tsx 堆大块新业务逻辑。
- [ ] 新命令复用 CommandService/统一 command id。
- [ ] 新设置走唯一 settings 层。
- [ ] 新网络能力有 SSRF、redirect、size、timeout 负向测试。
- [ ] feature off 时 UI/网络/后台任务均保持原行为。
- [ ] 已导入 Markdown 在功能关闭后仍可正常阅读。
- [ ] 涉及 UI 至少有一个 E2E。
- [ ] 涉及 Rust 网络/文件命令有定向 Rust 测试。
- [ ] 我写了回滚方式。
- [ ] 我更新了对应文档和 handoff。

若任一项答案不确定，先缩小任务，不要自行扩大架构。

---

# 23. PR 模板（未来每个切片复制）

```md
## 目标

## 用户价值

## 非目标

## 前置依赖

## 设计与数据流

## 接口变化

## 设置/权限变化

## 涉及文件

## 验收标准

- [ ]

## 测试

- [ ] unit
- [ ] browser E2E（UI 时）
- [ ] Rust targeted（Rust 时）
- [ ] desktop E2E（真实桌面边界时）

## 风险

## 回滚

## 文档 / handoff
```

---

# 24. 最终产品形态

长期目标不是“每天塞很多文章”，而是建立一个克制的个人阅读闭环：

```text
Discovery
  Daily Digest / RSS / URL / Browser
               ↓
Reading Inbox
  Today / Inbox / Reading / Finished
               ↓
Reader Core
  Progress / Bookmark / Annotation
               ↓
Knowledge
  Search / Backlink / Collection
               ↓
Optional Intelligence
  Explain / Translate / Ask / RAG
```

每一层都必须可独立使用。

最小成功标准不是“功能很多”，而是：

> 用户每天收到 3–7 篇值得读的文章，其中选一篇保存，离线读到一半关闭应用；第二天打开 Moyang Reader，能立即从正确位置继续阅读，并且整个过程不要求账号、云服务或 AI。

达到这个闭环后，再继续加 AI、RSS、浏览器扩展和长期阅读记忆。