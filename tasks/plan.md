# Windows x64 单平台收敛计划

## 目标

Moyang Reader 只把 Windows x64 桌面版作为产品、发布和默认质量门禁范围，集中资源优化本地阅读、Markdown 热编辑、文件夹工作区、导出、更新和 Windows 文件关联体验。

## 明确边界

- 支持：Windows x64、Tauri 桌面版、NSIS 安装包、GitHub Release、Cloudflare 镜像和签名更新。
- 保留：浏览器版仅作为本地开发预览和 Playwright UI 测试环境，不作为独立产品平台承诺。
- 不做：macOS/Linux 安装包、跨平台桌面 E2E、跨平台文件关联、公证、AppImage、移动端和跨平台自动更新。
- 不删除：现有 Rust/Tauri 跨平台抽象和安全审计代码；除非它们成为实际维护成本或影响 Windows 构建，否则不做无收益清理。
- 安全例外：Rust 依赖审计可继续使用 Ubuntu runner，因为它是平台无关的供应链检查，不代表支持 Linux 产品。

## 分阶段任务

### Task 1：平台边界与工程文档

**验收标准：**

- [x] README、需求、路线图、发布政策、平台说明和 AI 交接文档都明确 Windows x64 单平台范围。
- [x] 新 ADR 记录范围收敛的原因、收益、代价和未来重新开放条件。
- [x] 旧计划不再把 macOS/Linux 构建或发布列为近期目标。

**验证：**搜索文档中的平台承诺；检查 Markdown 格式。

**预计文件：**README.md、docs/REQUIREMENTS.md、docs/ROADMAP.md、docs/PLATFORMS.md、docs/RELEASE-POLICY.md、docs/AI-HANDOFF.md、docs/decisions/0008-windows-only-scope.md。

### Task 2：默认 CI 收敛到 Windows

**验收标准：**

- [x] 默认 CI 只保留 Windows quality checks，包含前端、真实桌面、Rust、审计和发布元数据检查。
- [x] 删除 macOS/Linux 的重复构建与 Tauri preflight，减少每个 PR 的 runner 消耗。
- [x] Rust 依赖安全审计保留为独立、低频、平台无关的检查。

**验证：**YAML 解析/格式检查；本地运行与 Windows 质量门禁匹配的检查；确认工作流没有发布非 Windows 产物。

**预计文件：**.github/workflows/ci.yml。

### Task 3：Issue 与交接状态同步

**验收标准：**

- [x] 纯跨平台 Issue #110 标记为 `not planned` 并说明可重新开放的条件。
- [x] Windows 发布、安全、签名和更新相关 Issue 不因范围收敛被误关闭。
- [x] tasks/todo.md 和 AI handoff 给出下一位 AI 的唯一 Windows 任务入口。

**验证：**复查 GitHub Issue 状态、分支、工作区和交接文档。

## 检查点

- 文档与 CI 修改完成后运行 `npm run format:check`。
- 运行 `npm run lint`、`npm test -- --run`、`npm run build`。
- 不创建安装包或 Release；这是范围与流程收敛切片。
- PR 检查全绿后合并，下一功能切片从最新 `main` 创建 Windows 专用分支。

## 后续 Windows 优先路线

1. v0.9.1：编辑器保真、撤销/重做、外部修改、草稿恢复、Windows 桌面回归。
2. v0.9.2：PDF 文件落盘、更新器桌面回归、导出和关闭确认。
3. v0.10：双链嵌入、块引用、属性和关系图筛选。
4. v0.10.x：大工作区性能、字体和 UI 微交互；先测量再优化。
5. v0.11：分批导出、取消、Word 模板和分享体验。
6. v1.0：Windows x64 核心功能冻结、长期维护和稳定更新链路。
