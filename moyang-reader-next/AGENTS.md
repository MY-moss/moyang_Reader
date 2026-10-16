# 项目协作约定

本目录是独立的 Moyang Reader 重构工程。先阅读 README、docs/ARCHITECTURE.md、docs/FEATURE-MATRIX.md 和当前任务检查单。

- 只在本目录实现改动，父目录是保留的原工程。
- 沿用 `npm run dev`、`npm run desktop`、`npm run build`；未经需求变更不更换技术栈或文件真源。
- features 不依赖 application/shell，原生调用通过 platform/bridge。应用状态只能由明确的状态所有者创建。
- 磁盘操作保留授权、原子保存、外部修改冲突和草稿恢复。不能为了修复测试扩大文件权限。
- 每项任务定义用户场景、验收和验证；具体流程见 docs/DEVELOPMENT.md。
- 交互修改同步使用指南；架构修改记录决策；运行相关检查并记录实际结果。
- 构建失败后不继续使用旧 dist 作为验证依据。前端测试与桌面测试的构建顺序执行，避免同时覆盖 dist。
- 开发版没有正式更新源和文件关联。发布是单独任务，不能沿用父项目渠道直接发布。
