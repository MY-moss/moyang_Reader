# Moyang Reader AI 开发规则

## 产品边界

- Windows x64 本地阅读工作台；React + TypeScript + Vite + Tauri 2/Rust。
- 本地优先，用户文件安全优先；Markdown 与用户原文件保持可直接读取，不建立强绑定私有内容格式。
- 浏览器构建只用于开发预览与 UI 测试。
- v1.0 前不扩展 macOS、Linux、移动端、云同步或第三方脚本插件。
- 不提交密钥、令牌、签名私钥、用户文档、安装包、构建产物或本地缓存。

## AI 接手流程

1. `git status --short --branch`，不要覆盖已有未提交改动。
2. 阅读 `docs/AI-TASKS.md`，优先处理第一个未完成且没有开放 PR 的任务。
3. 检查 GitHub Issues / PR，避免重复开发。
4. 从最新 `main` 创建一个 `codex/<scope>-<date>` 分支；一个任务一个 PR。
5. 只读取当前任务相关源码、测试和一个相似实现，不全仓无目的通读。
6. 完成后运行与改动匹配的测试，把结果写进 PR，并更新 `docs/AI-TASKS.md` 的任务状态和一句交接。

## 开发原则

- 一个 PR 只解决一个清晰问题；发现范围外问题，记录到任务清单或 Issue，不顺手扩大。
- Bug 先补复现测试；UI 改动补至少一个相关 E2E；Rust / 文件 / IPC 改动补对应 Rust 或 desktop smoke。
- 不为了拆文件而拆文件；重构必须保持行为等价，并有可回滚边界。
- 不伪造测试、真机、签名、发布或外部服务验证结果。
- 删除用户文件、修改迁移格式、发布 Release/Tag、处理密钥时必须明确说明风险；普通代码、IPC、UI、重构不需要额外审批凭证。

## 最小验证

按改动选择，不要求每个小 PR 都跑完整门禁：

- 文档/工具：相关检查 + `git diff --check`
- TS/React：相关单测 + `npm run lint`，必要时 `npm run build`
- UI：上述 + 对应 Playwright E2E
- Rust/IPC/文件路径：相关前端测试 + Rust test/clippy 或 desktop smoke
- 发布/更新器/签名：完整 CI + 真实 Windows 验证（能做多少写多少，不能做就明确标记未验证）

`main` 的 GitHub `Quality checks` 仍是最终合并门禁。

## 交接

PR 描述保持短而完整：

- 目标 / 用户价值
- 做了什么
- 没做什么
- 测试结果
- 风险与回滚
- 下一步（如有）

长期路线看 `docs/ROADMAP.md`；当前可执行任务只看 `docs/AI-TASKS.md`；稳定版本和外部阻塞看 `docs/AI-HANDOFF.md`。
