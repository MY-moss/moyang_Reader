# Moyang Reader 唯一下一步

> 本文件是当前任务的唯一事实源，只保留一个 READY 切片。执行前仍须只读核对最新 `origin/main`、开放 PR 和对应 Issue；若事实变化，先修正本文件。

## 核验状态

- 最近核验：2026-08-30
- 上一切片：#234；[#342](https://github.com/MY-moss/moyang_Reader/pull/342)，CI 已通过，合并后不再启动本项以外的任务
- 稳定版本：`v0.10.13`
- 当前 milestone：`v0.11.0`
- 当前状态：READY（#234 本地与 CI 验收完成，合并状态以 GitHub 为准）

## 唯一下一步：#189 加强 TypeScript/ESLint/Rust 质量门禁与版本约束

- Issue：[#189](https://github.com/MY-moss/moyang_Reader/issues/189)
- 优先级：Must / P2
- 风险级别：T2（质量配置、真实 fallout 与完整门禁回归）
- 版本分类：不单独发布；验收结果进入 `v0.11.0`

### 用户价值

把类型安全和异步误用从“依赖自觉”变成低噪声、可复现的 CI 强制约束，降低后续回归概率。

### 本切片范围

- 仅在 `src` 的类型感知 ESLint 配置中评估并启用低噪声规则：`no-floating-promises`、`await-thenable`、`no-misused-promises`。
- 先量化现有 fallout，再逐项清理真实问题；保留已完成的 `any`、未使用变量、TypeScript 基础严格项和 Rust 版本约束。
- `scripts` 与 `desktop-e2e` 继续使用非类型感知配置，避免扩大无关范围。

### 非目标

- 不一次性启用所有高噪声实验规则，不为过门禁大范围改写业务逻辑。
- 不删除现有 lint、TypeScript、Rust、发布预检或 CI 检查。
- 不改变用户可见功能，不创建安装包、Tag、Release，不做数据迁移或云端部署。

### 验收标准

- [ ] `src` 新增显式 `any`、未使用变量和上述三项异步误用会被阻断；既有代码无误报堆积。
- [ ] 类型感知 ESLint 使用与当前 TypeScript 项目引用一致的 parser/project 配置，脚本和 desktop-e2e 边界清晰。
- [ ] TypeScript build、前端单测、Rust fmt/clippy/test、发布预检与 PR Quality checks 全绿。
- [ ] 补充规则探针或等价回归测试，记录 fallout 数量、修复边界和可回滚点。

### 依赖、风险与回滚

- 依赖：现有 `tsconfig`、ESLint、Cargo、GitHub Actions 版本和上一切片的基础门禁。
- 风险：类型感知配置可能暴露历史异步问题；必须先量化，再按小批次启用并验证。
- 回滚：按规则批次回退单一 PR；不得删除原有质量检查。

## 完成后

1. 把结果追加到 `docs/handoff/v0.11.md`，并更新 `docs/AI-HANDOFF.md`。
2. 若 Issue 仍有未完成 fallout，只归档已完成边界，不把未验收内容写成完成。
3. 更新 #189、PR 和 CI 单行记录，然后停止，不自动开始 #301。
4. 除非本文件明确要求稳定发布，不创建安装包、Tag 或 Release。

## 快速触发

```text
继续开发 Moyang Reader。严格读取并执行 docs/NEXT.md 中的唯一下一步，遵循 docs/AI-WORKFLOW.md，完成一个垂直切片、测试、PR 和交接后停止，不自动开始下一项。
```
