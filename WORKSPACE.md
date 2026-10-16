# 目录维护与恢复

从本仓库根目录开发，不再进入 `moyang-reader-next/`。应用标识、个人阅读库和 AI 数据位置保持不变。

## 常用入口

| 目的           | 入口                                  |
| -------------- | ------------------------------------- |
| 打开当前便携版 | 双击 `启动阅读器.cmd`，或 `npm start` |
| 桌面开发       | `npm run desktop`                     |
| 浏览器开发     | `npm run dev`                         |
| 构建前端       | `npm run build`                       |
| 生成新便携包   | `npm run package`                     |
| 查看可清理文件 | `npm run clean:preview`               |
| 清理常规产物   | `npm run clean`                       |
| 预览旧发布归档 | `npm run archive:preview`             |
| 校验归档旧发布 | `npm run archive`                     |

首次获取源码先执行 `npm ci`。便携包不提交 Git，需要本机构建。清理命令仅删除 `dist`、`coverage`、`test-results`、`playwright-report`、`logs` 和根目录日志，先检查全部目标，发现链接目录就停止；不删除依赖、源码、模型、发布包和个人数据。清理后浏览器预览需要重新构建。

## 目录约定

| 目录                            | 内容                                     |
| ------------------------------- | ---------------------------------------- |
| `src`、`src-tauri`、`crates`    | 前端、桌面及共享 AI 内核                 |
| `public`、`examples`            | 应用资源与示例                           |
| `scripts`、`e2e`、`desktop-e2e` | 开发脚本和测试                           |
| `docs`、`tasks`                 | 设计、使用、验证记录和实施清单           |
| `release`                       | 便携程序；`latest.json` 指向最新成功包   |
| `.local/ollama`                 | 本机模型和运行程序，不提交 Git           |
| `artifacts`                     | 本地验证证据，不提交 Git                 |
| `node_modules`                  | 当前工程唯一依赖目录，可用 `npm ci` 重建 |

Cargo 缓存由现有共享缓存脚本统一管理，不放进源码目录。需要完整释放原生构建缓存时，先关闭编译任务，再运行 `npm run rust -- clean`；下次桌面构建需要重新编译。不要直接清理整个系统临时目录或其他项目的依赖缓存。

生成新包后先验证，再将 Agent 连接迁移到新包并重启客户端。确认旧包不再被使用后，将需要保留的旧包归档到仓库外再删除；清理命令不会自动替你删除发布包。

新版验证通过后，可运行 `npm run archive`。它只处理 `release` 下的旧发布目录，保留 `latest.json` 指向的当前包及当前签名下载包，拒绝处理仍在运行的旧包或目录链接。每个旧包归档到项目旁的 `本地阅读工具-归档/日期/`，逐文件校验后才移除原目录；与 `.local/ollama` 完全相同的模型文件不重复压缩，其原路径、校验值与复用位置记在 ZIP 的 `_archive-manifest.json`。恢复旧包时，解压程序，再按清单复制模型文件；独有的旧模型会直接存入 ZIP。

`release-archive-index.json` 记录归档校验值与原始大小。`.local/release-signing` 是更新签名材料，`.local/ollama` 是本机模型与运行程序；这两处不是构建垃圾。旧验证日志与私人恢复材料移到仓库外保存，不提交 GitHub。

## 2026-10-16 整理与恢复

本机旧工程和工作副本归档于项目旁的 `本地阅读工具-归档/2026-10-16/`。归档含个人配置备份，仅供本机恢复，不上传 GitHub。

- `archive-index.json`：每份源码快照的原路径、文件数、大小及 SHA-256。
- `original-root.zip`、`current-project-before-promotion.zip`、`worktree-*.zip`：旧根目录、迁移前当前工程与各工作副本；ZIP 内还有逐文件校验清单。
- `repository-history.bundle`：完整 Git 引用与提交历史，可用 `git clone <bundle路径> <新的空目录>` 恢复。
- `original-working.patch`、`original-index.patch`：迁移前原工程的未提交差异。
- `old-portable-programs.zip`：旧程序及文档；重复模型未打入归档，本机保留当前模型。
- `personal-data-backup`：一致性 AI 数据快照与客户端配置备份。恢复前另存当前数据，不直接覆盖后来新增内容。

需要旧工程时解压到新的空目录，重新安装依赖。缓存、依赖和旧测试产物不属于恢复必需品。旧阶段文档中的子目录路径和构建编号属于历史证据，当前操作以本页为准。

自动审批拒绝删除的展开件保留在归档目录。`retained-linked-worktrees` 含原有目录链接，恢复请使用 ZIP；不要把这些展开件交给 Git 递归清理，也不要沿链接遍历或备份当前工程的依赖。具体残留和释放空间以归档目录的整理报告为准。

源码清理不会自动删除 `%APPDATA%/com.moyang.reader.next`、阅读库和其中的 `.moyang` 恢复资料。客户端信任及 Claude 模型服务的真实任务验收仍按用户决定延后。
