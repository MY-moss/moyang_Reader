# Moyang Reader AI 接手提示词

将下面内容完整复制给下一位 AI。它是当前仓库的最小接手上下文；如果与 GitHub 或代码现状冲突，以最新代码、Issue、CI 和发布资产为准。

```text
你现在接手 Moyang Reader 项目，请只完成一个垂直切片，不要顺手开发其他功能。

项目：MY-moss/moyang_Reader
本地目录：D:\AI-moyang\本地阅读工具
平台范围：只支持 Windows x64
当前稳定版本：v0.10.14
当前远程主线：main@47a0c60a5775962cfa99dbef1c47b33315549b0b
唯一 Ready 任务：#112 更新与 opener 文档收口（以 docs/NEXT.md 为准）

任务目标：
统一更新器、opener、镜像巡检和权限边界的用户/维护者说明，让更新失败、镜像不可用、文件关联或权限异常时都有准确的回退与排查路径。

必须完成：
1. 开始前检查 Issues、开放 PR 和当前 main；确认没有重复工作。
2. 不要直接使用本地根目录；根目录可能有用户未提交修改。请在项目内 .codex-worktrees/ 下创建干净工作树。
3. 先读取 docs/AI-WORKFLOW.md、docs/NEXT.md、docs/AI-HANDOFF.md 和本 Issue，只读取相关源码、配置、测试及一个相似实现；路线或清理问题才读取 docs/DEVELOPMENT-AUDIT.md、docs/WORKSPACE-CLEANUP.md、tasks/plan.md、tasks/todo.md。
4. 以当前更新器实现、`docs/release-status.json` 和现有工作流为事实源，先核对文档之间的结论。
5. 收口 GitHub Release、公开/静态镜像、签名 updater、NSIS Authenticode 和旧版本实机验证的区别。
6. 明确 opener 的工作区外路径、Windows 文件关联、权限失败和用户可见回退边界。
7. 增加针对性文档/链接检查，不把 Cloudflare Secret、旧版本安装或证书缺失写成通过。
8. 只改文档与必要的文档测试；若发现需要运行时代码修复，停止并重新拆分任务。

非目标：
- 不修改更新器、opener、镜像工作流、签名、安装包、用户工作区或发布资产。
- 不上传或索取凭据，不伪造旧版本安装、Cloudflare Secret 或 Authenticode 证据。
- 不新增业务功能、HTML 源码编辑、跨平台范围、依赖或 Release。

验收标准：
- `docs/UPDATE.md`、`docs/RELEASE-POLICY.md`、用户指南和交接说明对更新、镜像回退、opener 权限和文件关联保持一致。
- 文档明确下载完成/重启、GitHub 与镜像区别、签名 updater 与 Authenticode 边界及用户可见排查动作。
- 不把 #241/#51 的外部条件写成完成；通过文档链接、格式和 `git diff --check` 检查。
- 本切片不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。

Git/交付：
- 一个主要分支、一个 PR；分支名使用 codex/update-opener-docs-<date>。
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
