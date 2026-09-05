# ADR 0014: Reading Inbox 使用可选 Local-first 内容导入层

- 状态：Accepted
- 日期：2026-09-05
- 相关：`docs/READING-INBOX-PLAN.md`、ADR 0001、ADR 0012、`docs/ROADMAP.md`

## 背景

Moyang Reader 未来希望支持“每日精选文章 → 保存到本地 → 继续阅读 → 批注/书签 → 后续 AI 精读”的闭环。

当前项目已经以普通文件、本地优先、Windows x64、受控内部能力端口为核心，并已有 Markdown reader、阅读历史、阅读位置、批注、书签和工作区索引。

如果为每日文章重新建立独立阅读器、私有数据库或默认联网入口，会造成：

- 与现有 reader/search/annotation 重复实现；
- 普通 Markdown 用户被迫承受不需要的功能复杂度；
- 内容被锁进私有存储；
- URL 抓取扩大 renderer 网络权限；
- 推荐系统、网页抓取、AI 和阅读状态互相耦合；
- 后续第三方来源难以替换。

## 决策

### 1. Reading Inbox 是可选 feature，不是新的产品核心依赖

- 默认关闭；
- 默认不联网；
- 只有用户显式开启后才显示专用 UI；
- 关闭后已经导入的文章仍作为普通 Markdown 正常打开。

### 2. 导入后的普通文件是真源

网页正文成功导入后必须落为普通 Markdown 文件，可由用户移动、备份、版本控制和其他工具读取。

`.moyang` sidecar 可以保存队列、来源和工作区状态；未来 SQLite/FTS/vector store 只能作为可删除重建的派生索引或缓存，不得成为正文、批注或关键用户内容的唯一真源。

### 3. 网络来源与 DocumentAdapter 分层

`DocumentAdapter` 只负责已经存在的本地文档格式。

URL、Digest、RSS、浏览器扩展和未来 MCP/provider 属于 Content Source / Article Import 层：

```text
Content Source
  -> safe fetch
  -> extract
  -> ordinary local Markdown
  -> existing DocumentAdapter / Reader
```

禁止实现通过网络副作用打开文档的 `UrlDocumentAdapter`。

### 4. 网络访问必须经过受控 native 边界

React 组件不得持有宽泛任意 URL fetch 权限。

网络导入需经过应用服务和 Tauri/Rust 受控命令，至少提供：

- http(s) allowlist；
- SSRF / private address 防护；
- redirect 逐跳复验；
- timeout；
- response size；
- content-type；
- 稳定 error code；
- 可取消操作。

### 5. 推荐、导入、阅读、AI 四层解耦

- Daily Digest / RSS 等负责“发现候选”；
- Article Import 负责“安全保存为本地文件”；
- Reader Core 负责“阅读、进度、批注、书签”；
- AiProvider 负责“用户主动请求的解释、翻译、问答”。

任何一层都不能成为其他层的硬依赖。

### 6. 第一外部协议为版本化 Digest manifest

优先采用 `moyang-reading-digest/1` JSON 文件/剪贴板导入，避免一开始建立公开 webhook、后台服务、浏览器扩展或账号服务器。

后续自动化桥接必须复用同一个 `importDigest()` application service。

## 结果

### 正面

- 最大化复用现有 reader、workspace、annotation、bookmark、search；
- 保持 Local-first 与可迁移；
- 非目标用户不会被新增网络/AI 功能打扰；
- 未来 ChatGPT、RSS、浏览器扩展和其他 source 可替换；
- 安全边界集中且可测试；
- 关闭功能或回滚版本后，用户文件仍可读。

### 代价

- 需要额外的 Article Import / Content Source 分层；
- 需要处理普通文件被用户移动、删除、编辑后的 reconcile；
- sidecar 与普通文件之间需要稳定 article id；
- 自动化体验不会在第一阶段做到“远程服务直接无感推送到本机”。

这些代价优于引入账号、云数据库、后台 daemon 或第二套 reader。

## 被拒绝方案

### 独立新 App

拒绝：重复 reader/editor/search/annotation 基础设施，长期形成两个产品。

### SQLite-first 文章库

拒绝：违背普通文件真源；用户脱离 App 后难以直接读取和迁移。

### URL DocumentAdapter

拒绝：把文档格式与网络来源混为一谈，并让打开文档产生网络副作用。

### 默认开启 Reading Inbox

拒绝：并非所有用户需要每日文章、网络导入或 AI；默认必须保持现有轻量阅读器体验。

### 自动把所有新文章发送给 AI 总结

拒绝：隐私、成本、网络依赖和产品目标均不合适；AI 必须是后续显式行为。

## 后续约束

任何实现 Reading Inbox 的 PR 必须：

1. 先读 `docs/READING-INBOX-PLAN.md`；
2. 只做一个垂直切片；
3. 保证 feature off 时没有 Reading Inbox 专用网络请求和后台轮询；
4. 不创建第二套 reader；
5. 不把正文放进私有数据库作为唯一真源；
6. 新网络命令必须有负向安全测试；
7. 已导入 Markdown 在该功能关闭后仍可正常打开。