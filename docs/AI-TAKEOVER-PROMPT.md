# Moyang Reader AI 接手提示词

将下面内容完整复制给下一位 AI。它是当前仓库的最小接手上下文；如果与 GitHub 或代码现状冲突，以最新代码、Issue、CI 和发布资产为准。

```text
你现在接手 Moyang Reader 项目，请只完成一个垂直切片，不要顺手开发其他功能。

项目：MY-moss/moyang_Reader
本地目录：D:\AI-moyang\本地阅读工具
平台范围：只支持 Windows x64
当前稳定版本：v0.10.14
当前远程主线：main@740049dc9de36c73941c3efcc01790c199edeea7
唯一 Ready 任务：Issue #416
Issue：https://github.com/MY-moss/moyang_Reader/issues/416

任务目标：
解决“应用内部 Logo 已更新，但 Windows 安装包、可执行文件、桌面快捷方式、开始菜单、任务栏或 .md/.txt 文件关联仍显示旧图标”的不一致问题。

必须完成：
1. 开始前检查 Issues、开放 PR 和当前 main；确认没有重复工作。
2. 不要直接使用本地根目录；根目录可能有用户未提交修改。请在项目内 .codex-worktrees/ 下创建干净工作树。
3. 先读取 docs/AI-WORKFLOW.md、docs/NEXT.md、docs/AI-HANDOFF.md 和本 Issue，只读取相关源码、配置、测试及一个相似实现；路线或清理问题才读取 docs/DEVELOPMENT-AUDIT.md、docs/WORKSPACE-CLEANUP.md、tasks/plan.md、tasks/todo.md。
4. 检查 src/assets/moyang-reader-logo.png 与 src-tauri/icons/* 的实际来源、尺寸、格式和旧默认资源回退。
5. 在 src-tauri/tauri.conf.json 中显式声明实际存在的 Windows bundle icon 路径，不依赖隐式默认值。
6. 增加资源完整性/错误回退的自动检查和回归测试；不要用删除 Windows 图标缓存作为唯一修复。
7. 用 Windows 验证全新安装、覆盖升级、安装包/可执行文件图标、重新创建桌面快捷方式、开始菜单/任务栏和 .md/.txt 文件关联。
8. 明确记录 Windows Explorer/任务栏缓存无法由应用强制立即刷新的边界。

非目标：
- 不重新设计 Logo；不做 macOS/Linux/移动端图标。
- 不修改用户工作区、文档内容或更新签名密钥。
- 不从旧脏工作树打包；不在验收前创建 Release。

验收标准：
- 应用内与 Windows 打包资源使用同一视觉 Logo；不能出现旧字母 M 或 Tauri 默认图标回退。
- bundle.icon 指向存在、非空、格式正确的 Windows 图标文件。
- 自动检查能在资源缺失或错误回退时失败。
- 全新安装和覆盖升级均有真实 Windows 证据；快捷方式与 .md/.txt 关联图标可验证。
- 通过针对性测试、必要的 Windows 桌面 E2E、lint、format、build 和 release check。
- 只有用户可见修复验收通过后，才决定是否发布 v0.10.15；如发布，必须同步安装包、.sig、latest.json、GitHub Release、Cloudflare 镜像和 CHANGELOG。

Git/交付：
- 一个主要分支、一个 PR；分支名使用 codex/icon-identity-<date>。
- 提交前检查 git diff --check 和工作树状态。
- PR 必须写目标、非目标、Issue、测试结果、Windows 手动路径、发布判断和回滚方式。
- 合并条件：无真实冲突、Quality checks 全绿；满足后可直接合并。
- 完成代码、验证、PR、文档和交接后立即停止，不自动开始下一任务。

交接输出必须包含：
- 根因和修复边界；
- 修改文件；
- 测试和 Windows 验证结果；
- PR、合并提交和 CI run_id；
- 是否创建 v0.10.15 Release，以及安装包/镜像验证结果；
- 未完成事项和下一步 Ready 状态。
```

接手时只以 `docs/NEXT.md` 中的唯一 Ready 事项为准，不从历史聊天记录猜测需求。HTML 仍是规划项：当前只允许提出安全预览/源码回退方案，不执行任意网页脚本。
