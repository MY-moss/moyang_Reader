# Moyang Reader 唯一下一步

- 状态：READY
- 当前切片：#112 更新与 opener 文档收口；只校正更新、打开器、镜像巡检和权限边界说明，不重复实现运行时功能。
- Issue：[#112](https://github.com/MY-moss/moyang_Reader/issues/112)（启动前必须重新核验是否已有重复 Issue/PR）。
- 基线：远端 `main@47a0c60a5775962cfa99dbef1c47b33315549b0b`；当前稳定版 `v0.10.14`，后续 milestone `v0.11.0`。
- 发布边界：#112 是文档切片，不生成安装包、GitHub Release、签名、`latest.json` 或 Cloudflare 镜像。
- 状态证据：`docs/release-status.json` 是 Release 资产、公开镜像和外部阻塞的事实源；不把受限环境写成通过。

## Task Context：#112 更新与 opener 文档收口

- 优先级：Should / P3
- 风险级别：T2/T3（只改文档；若发现需要运行时代码修复，停止并重新拆分）

### 目标

统一更新器、opener、镜像巡检和权限边界的用户/维护者说明，让更新失败、镜像不可用、文件关联或权限异常时都有准确的回退与排查路径。

### 用户价值

用户能在不中断当前工作的前提下理解更新状态并完成安全回退；维护者能区分 GitHub Release、公开静态镜像、签名更新包、Authenticode 和旧版本实机验证，不再被相互矛盾的文档误导。

### 非目标

- 不重复实现或改动更新器、opener、镜像工作流、签名、安装包和发布端点。
- 不上传或索取凭据，不伪造 Cloudflare Secret、旧版本安装或 Authenticode 证据。
- 不新增 HTML 源码编辑、脚本/插件、跨平台、云同步或其他业务功能。

### 验收标准

- [ ] `docs/UPDATE.md`、`docs/RELEASE-POLICY.md`、用户指南和相关交接说明对更新入口、下载完成、重启、镜像回退、opener 权限和文件关联保持一致。
- [ ] 明确 GitHub 回退与公开/静态镜像的区别、失败时的用户可见动作、签名 updater 与 NSIS Authenticode 的边界。
- [ ] 明确工作区外路径、Windows 文件关联和权限失败的安全边界；不建议删除用户文件或绕过系统权限。
- [ ] 逐项链接检查、文档格式检查和 `git diff --check` 通过；#241/#51 仍按 `docs/release-status.json` 记录为条件项。

### 涉及文件

- 文档：`docs/UPDATE.md`、`docs/RELEASE-POLICY.md`、`README.md`、`docs/USER-GUIDE.md`、必要的 `docs/UI-INTERACTION.md`。
- 交接：`docs/AI-HANDOFF.md`、`docs/handoff/v0.11.md`、`tasks/plan.md`、`tasks/todo.md`、本文件。
- 测试：现有文档/链接/发布状态检查；不新增运行时依赖。

### 依赖

- 当前代码中的更新状态与 opener 调用边界、`docs/release-status.json`、现有 Release/镜像工作流和 Windows x64 约束。
- 无外部凭据、实机、数据迁移或安装包依赖；若验收需要新的外部事实，先记录阻塞，不猜测。

### 风险

- 文档与代码或 Release 状态漂移会让用户执行错误回退；以当前实现、结构化状态和工作流为事实源，避免复制历史交接中的旧结论。
- #241 的旧版本更新/镜像静态 workflow 与 #51 的 Authenticode 仍可能受外部条件阻塞；本切片只同步限制和排查，不声称验证完成。

### 回滚方式

回退 #112 PR 即可恢复上一版文档；不触碰用户数据、构建缓存、运行时逻辑或发布资产。

## 完成后唯一下一步

完成 #112 后重新核验开放 Issue/PR 和 `tasks/plan.md` 顺序；若 #241/#51 条件仍不足，选择下一个无外部阻塞的独立任务，不自动开展 HTML 源码编辑。

## 长期边界

- HTML 当前仅为导出目标；必须先完成 H-05 CSP/清洗门禁和 H-01 安全只读预览，再评估白名单原生 HTML、资源处理和源码编辑。
- 禁止任意脚本执行、iframe/插件/URI 绕过安全边界，也不默认加载重型模块。
- K-01～K-05、S-01～S-03 以及 v1.0 后评估的 AI/内部插件接口继续按计划排序，不在本切片并行开发。

执行授权仍只有本文件；#112 完成交接后停止，不自动开始下一批。
