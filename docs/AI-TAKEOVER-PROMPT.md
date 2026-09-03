# Moyang Reader AI 接手提示词

将下面内容完整复制给下一位 AI。它是当前仓库的最小接手上下文；如果与 GitHub 或代码现状冲突，以最新代码、Issue、CI 和发布资产为准。

```text
你现在接手 Moyang Reader 项目，请只完成一个垂直切片，不要顺手开发其他功能。

项目：MY-moss/moyang_Reader
本地目录：D:\AI-moyang\本地阅读工具
平台范围：只支持 Windows x64
当前稳定版本：v0.10.14
当前远程主线：main@c8884859068642705761d6b398dbef869fddfc9e
唯一 Ready 任务：G-03 构建缓存预算提示（以 docs/NEXT.md 为准）

任务目标：
在现有清理器中增加只读的构建缓存大小/闲置时间预算提示，及时发现缓存膨胀并给出可审计的清理建议。

必须完成：
1. 开始前检查 Issues、开放 PR 和当前 main；确认没有重复工作。
2. 不要直接使用本地根目录；根目录可能有用户未提交修改。请在项目内 .codex-worktrees/ 下创建干净工作树。
3. 先读取 docs/AI-WORKFLOW.md、docs/NEXT.md、docs/AI-HANDOFF.md 和本 Issue，只读取相关源码、配置、测试及一个相似实现；路线或清理问题才读取 docs/DEVELOPMENT-AUDIT.md、docs/WORKSPACE-CLEANUP.md、tasks/plan.md、tasks/todo.md。
4. 保持默认命令为只读预览，预算提示不得自动删除任何路径。
5. 明确区分活动/受保护 Cargo target 与可清理生成物，保护 D:\AI-moyang\本地阅读工具-build-cache 约定。
6. 用确定性 fixture 覆盖大小、闲置时间、预算超限和受保护路径。
7. 增加针对性测试与清理文档，验证建议包含路径、大小和下一步动作。
8. 记录不改变构建目标路径、不删除正在使用 target 的边界。

非目标：
- 不自动删除正在使用的 Cargo target，不改变构建目标路径。
- 不修改用户工作区、用户文档内容或发布资产，不读取/提交凭据。
- 不新增业务功能、跨平台范围、依赖或 Release。

验收标准：
- 默认清理命令仍为只读 dry-run，活动或受保护 target 只报告不删除。
- 可通过测试固定预算阈值和闲置时间，超限提示包含明确路径、实际大小、年龄和建议动作。
- 不改变 D 盘构建缓存路径、构建行为或工作树保护规则。
- 通过定向工作流测试、lint、format 和 diff 检查；本切片不需要安装包、Release 或桌面 E2E。

Git/交付：
- 一个主要分支、一个 PR；分支名使用 codex/g03-cache-budget-<date>。
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
