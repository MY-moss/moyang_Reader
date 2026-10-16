# Moyang Reader Next

本地文档阅读器与个人 AI 工作台。当前工程已提升到仓库根目录，原 `moyang-reader-next/` 不再作为开发入口。保留 Windows 桌面应用与原有启动命令；旧工程、工作副本和历史程序已归档到仓库外。整理方式见[目录维护与恢复](WORKSPACE.md)。

本次根目录迁移、运行验证和清理边界见 [整合验证报告](docs/VALIDATION-CONSOLIDATION.md)。

最新[界面与记忆召回复核](docs/VALIDATION-USABILITY-RECALL.md)修复置顶记忆遗漏任务相关片段、窄窗导航焦点、AI 首次使用提示、帮助主题、目录失败重试及长扩展名显示。

0.12.0 新增[插件市场](docs/EXTENSIONS.md)：阅读插件、主题、Agent Skills 与 MCP 连接，可安装、更新、停用和回退；同时修复全局导航与 Windows 并发备份问题。功能核对、真实测试与剩余边界见[本轮深度检查报告](docs/VALIDATION-EXTENSIONS.md)，参考项目与取舍见[扩展研究](docs/RESEARCH-EXTENSIONS.md)。

新增独立 **AI 空间**：知识库、长期记忆和技能库，与日常笔记分开；外部 Agent 通过本机 MCP 读写、召回和整理。使用方法见 [AI 空间指南](docs/AI-USER-GUIDE.md)，研究与取舍见 [开源研究](docs/research/AI-RESEARCH.md)。

本轮补充研究并采用 TencentDB Agent Memory 与 OpenViking 的任务检查点、来源历史和按需读取思路，详见 [补充研究与取舍](docs/RESEARCH-AGENT-MEMORY-2026-10.md)。[MCP 接口指南](docs/MCP-GUIDE.md)、[实际验收结果](docs/VALIDATION-WORKBENCH.md) 和 [剩余检查单](tasks/workbench-upgrade.md) 随源码维护。两个真实客户端仍有授权/模型服务门槛，因此当前为候选版，未宣称全部验收完成。

## 开始使用

本轮候选版本为 0.12.0。本机可双击根目录的 **启动阅读器.cmd**，或执行 `npm start` 打开最新成功打包的应用。首次克隆源码后先执行 `npm ci`，然后 `npm run package` 生成便携包。本机生成的便携包放在 `release/<版本与构建时间>/`，`release/latest.json` 记录最新成功打包的目录。打开其中的 `Moyang Reader Next.exe`，保留同目录的 `moyang-ai-mcp.exe`；如打包时已安装本地模型，`ollama` 文件夹也一并保留。每个包内有 `使用说明.txt`。GitHub 保存源码与文档，便携包、模型和个人数据不提交到仓库。

在本目录打开终端，首次执行：

```powershell
npm ci
npm run desktop
```

桌面启动会同时构建本地 MCP 程序。生成便携包使用 `npm run package`；它先完成正常优化构建，再输出独立的新目录，保留旧包及正在运行的 Agent 连接。启用新版 MCP 时，从新应用重新安装连接后重启客户端。

桌面开发需要 Node.js、Rust MSVC 工具链、Visual Studio C++ Build Tools 和 WebView2。Windows x64 是当前维护目标。环境检查与启动故障处理见 [开发指南](docs/DEVELOPMENT.md)。

只预览界面：

```powershell
npm run dev
```

访问终端显示的本机地址，默认 `http://127.0.0.1:1420`。浏览器预览支持选择文件，但没有桌面文件夹授权、原位保存、监听与文件关联能力。不要同时启动两个服务占用 1420 端口。

## 阅读流程

1. 在左侧选择“阅读空间”，打开文档或添加阅读库。
2. Markdown 默认直接编辑；TXT 保持纯文本，Word/PDF 以阅读为主。右侧提供目录、属性和关联内容。
3. 单击文件临时预览，双击或编辑后保留标签；双窗格可以各自打开文档、阅读和定位。
4. 停止输入约 1.2 秒后自动保存，中文组词期间暂停；Ctrl+S 立即保存。遇到外部修改可比较、合并或另存。
5. Ctrl+P 快速打开，Ctrl+F 查找当前文档；左侧进入全文搜索、收藏、保存视图和恢复中心。
6. 左侧切换“AI 空间”，独立管理知识、长期记忆和技能。在“接入与备份”连接 Agent。
7. 侧栏底部的“插件市场”提供阅读插件、主题、AI 技能和 MCP 服务；支持本地导入、自定义目录、启停、更新与回退。见 [扩展使用与开发](docs/EXTENSIONS.md)。

详细说明见 [使用指南](docs/USER-GUIDE.md)。

## 文档入口

最新代码、运行与依赖复查见 [代码复查报告](docs/VALIDATION-CODE-AUDIT.md)，包含本轮修复、真实桌面结果、性能对比及未完成的外部验收条件。

逐项完成度复查见 [功能与成本复查](docs/VALIDATION-COMPLETION-AUDIT.md)：来源定位、技能资源与历史、跨进程索引、反馈备份及云端桌面回归。

原规划新增能力和清理决策见 [深度重构交付清单](docs/ROADMAP-DELIVERY.md)：属性编辑、块引用与嵌入、关系图筛选、字体、命令搜索、导出模板、大目录渲染和可靠性修复。

| 文档                                         | 解决的问题                                 |
| -------------------------------------------- | ------------------------------------------ |
| [现状提炼](docs/PROJECT-ANALYSIS.md)         | 原项目是什么、核心价值、架构问题和重构依据 |
| [功能保留矩阵](docs/FEATURE-MATRIX.md)       | 哪些能力保留、哪些交互改变、如何验证       |
| [架构与决策](docs/ARCHITECTURE.md)           | 各层职责、数据流、目录和技术取舍           |
| [界面与交互规范](docs/DESIGN.md)             | 视觉规则、布局、状态和键盘交互             |
| [开发流程](docs/DEVELOPMENT.md)              | 环境、命令、变更步骤、质量门禁与发布流程   |
| [使用指南](docs/USER-GUIDE.md)               | 打开、阅读、编辑、保存、导出与恢复         |
| [迁移与回滚](docs/MIGRATION.md)              | 工程归档、数据迁移和恢复保护               |
| [最新验证报告](docs/VALIDATION-WORKBENCH.md) | 实际执行结果与尚未验证事项                 |
| [本轮实施检查单](tasks/workbench-upgrade.md) | 依赖顺序、验收标准与当前状态               |

## 工程结构

```text
src/
  application/        应用状态、业务编排、视图连接
  features/           documents / reader / editor / workspace / export / recovery / settings / ai
  platform/           桌面桥接、本地持久化、更新、路径规范化
  shared/             类型、弹层和基础组件
  shell/              欢迎页、工具栏、标签页、设置内容
  styles/             分职责样式和书房主题
src-tauri/src/
  commands/           十个桌面命令模块、共享模型和原有回归测试
  ai.rs               AI 空间与共享内核的桌面桥接
crates/
  ai-core/            SQLite、检索、记忆生命周期、技能和备份
  ai-mcp/             独立 stdio MCP 程序
e2e/                  浏览器交互与可访问性测试
desktop-e2e/          真实桌面测试
docs/                 产品、技术、开发和使用文档
```

性能变化及可靠性修复见 [优化记录](docs/PERFORMANCE.md)。

AI 模块的存储、召回、协议与开发流程见 [AI 架构](docs/AI-ARCHITECTURE.md)。

## 验证

```powershell
npm run check
npm run test:ai
npm run test:e2e
npm run rust -- test --manifest-path src-tauri/Cargo.toml --lib
npm run test:e2e:desktop
```

本次开发版使用独立桌面标识 `com.moyang.reader.next`，保留原文档文件格式，不自动导入旧应用设置。为避免重构版被旧版更新包替换，未配置正式更新源，也未注册文件关联。发布之前应按开发指南完成安装与发布验证。

## 0.11.0 的实施依据

全部确认的工作台选择见 [实施检查单](tasks/workbench-upgrade.md)。[Tencent 与 OpenViking 研究](docs/RESEARCH-AGENT-MEMORY-2026-10.md)、[中文检索实测](docs/VALIDATION-AI-SEARCH.md)和 [Agent 接入约定](docs/adr/0004-client-lifecycle.md)记录采用机制与实际边界。原阶段报告保留作为历史，最终可用性以本轮验证记录中的通过项为准。
