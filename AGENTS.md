# Moyang Reader AI 开发规则

## 产品边界

- Windows x64 本地阅读工作台；React + TypeScript + Vite + Tauri 2/Rust。
- 本地优先，用户文件安全优先；Markdown 与用户原文件保持可直接读取，不建立强绑定私有内容格式。
- 浏览器构建只用于开发预览与 UI 测试。
- v1.0 前不扩展 macOS、Linux、移动端、云同步或第三方任意脚本插件。
- 不提交密钥、令牌、签名私钥、用户文档、安装包、构建产物或本地缓存。

## AI 接手流程

1. `git status --short --branch`，不要覆盖已有未提交改动。
2. 阅读 `docs/AI-TASKS.md`，优先处理第一个未完成且没有开放 PR 的普通任务。
3. 检查 GitHub Issues / PR，避免重复开发。**GitHub 当前状态优先于任务板；发现冲突先同步任务板。**
4. 从目标 base 创建 `codex/<scope>-<date>` 分支或独立 worktree；一个 PR 一个 coherent slice。
5. 只读取当前任务相关源码、测试和一个相似实现，不全仓无目的通读。
6. 完成后运行与改动匹配的测试，把实际结果写进 PR；普通任务同步 `docs/AI-TASKS.md` 状态。

状态与“什么才算真的完成”统一遵循 `docs/AI-EXECUTION-CONTRACT.md`：

- `TODO`：没有同主题开放实现 PR；
- `IN_PROGRESS — PR #N`：PR 已创建但尚未合入目标 base；
- `DONE — PR #N`：PR 已合入目标 base 且验收/测试可验证；
- AI 自称完成、旧聊天或单纯 Issue 勾选都不能替代 merged PR / target branch 事实。

如果目标明确标记为 #464 / `MOD-XX` Modernization，再额外阅读 `docs/MODERNIZATION-TASKS.md` 与 `docs/MODERNIZATION-CAMPAIGN.md`；涉及 UI 时再读 `docs/UI-NEXT-SPEC.md`。

## 开发原则

- 一个 PR 只解决一个清晰问题；发现范围外问题，记录到任务清单或 Issue，不顺手扩大。
- **允许多个互不冲突的 Modernization Track 并行，但每个 slice 必须声明 Track / Risk lane / Write-set / Depends on。**
- 并行 PR 不得未经协调同时修改 shared conflict files；不要把并行变成最后集中解决 merge conflict。
- Bug 先补复现测试；UI 改动补至少一个相关 E2E；Rust / 文件 / IPC 改动补对应 Rust 或 desktop smoke。
- Internal API 在 Modernization 中允许 breaking；用户普通文件、settings、`.moyang`、批注、书签、草稿、恢复和默认离线不得无迁移破坏。
- 重构使用可逐步替换和回滚的边界，不复制一整套 `AppV2` / `ReaderV2` 长期并行。
- 不伪造测试、真机、签名、发布或外部服务验证结果。
- 不为了“现代化”盲目更换 React/Tauri 技术栈或引入大型 UI/状态框架。

## 风险与确认

不使用 T0–T3、`AWAITING_APPROVAL`、批准队列、approval digest 或 `ai:*` 状态机。

- **Green**：普通 UI、内部 TS 重构、样式、测试、文档；相关验证通过即可提交，不需要额外人工审批。
- **Yellow**：Rust/IPC、向后兼容迁移、权限、可选网络；补定向负向/Rust/desktop/兼容测试，不恢复审批票据。
- **Red**：真实用户数据不可逆操作、高风险权限扩大、密钥/证书/签名、正式 Release/Tag、关闭已有恢复保护；必须明确说明风险并由维护者确认。

## 最小验证

按改动选择，不要求每个小 PR 都跑完整门禁：

- 文档/工具：相关检查 + `git diff --check`
- TS/React：相关单测 + `npm run lint`，必要时 `npm run build`
- UI：上述 + 对应 Playwright E2E
- Rust/IPC/文件路径：相关前端测试 + Rust test/clippy 或 desktop smoke
- 持久化迁移：增加旧 fixture 向后兼容测试
- 发布/更新器/签名：完整 CI + 真实 Windows 验证（能做多少写多少，不能做就明确标记未验证）

`main` 的完整 GitHub checks 仍是最终稳定门禁；scope-aware CI 落地后，PR 只运行与改动相关的最小充分矩阵，无法安全判断时回退 full lane。

## 交接

PR 描述保持短而完整：

- Slice / Track / Risk / Write-set（适用时）
- 目标 / 用户价值
- 做了什么
- 没做什么
- Compatibility
- 实际测试结果
- 风险与回滚
- 下一步（如有）

长期路线看 `docs/ROADMAP.md`；当前普通可执行任务看 `docs/AI-TASKS.md`；完成确认契约看 `docs/AI-EXECUTION-CONTRACT.md`；Modernization 看 `docs/MODERNIZATION-TASKS.md` / `docs/MODERNIZATION-CAMPAIGN.md`；稳定版本和外部阻塞看 `docs/AI-HANDOFF.md`。
