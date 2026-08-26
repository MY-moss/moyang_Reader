# Windows x64 单平台收敛清单

## 本次范围收敛切片

- [x] 更新 README、需求、路线图、发布政策和平台说明
- [x] 新增 ADR-0008：Windows x64 单平台产品边界
- [x] 将默认 CI 从 Windows + macOS/Linux preflight 收敛为 Windows quality checks
- [x] 保留独立 Rust 依赖安全审计，并说明它不代表 Linux 产品支持
- [x] 将纯跨平台 Issue #110 标记为 not planned
- [x] 更新 AI-HANDOFF.md 和本清单的下一步
- [x] 运行格式、lint、单测、构建和 Git diff 检查
- [x] 创建 PR；本切片不创建 Release 或安装包

## 明确保留与后续跟踪

- Windows x64 NSIS 安装包和签名更新
- Windows 文件关联、单实例、文件夹工作区、热编辑和桌面 E2E
- GitHub Release 与 Cloudflare 镜像的 Windows 资产验证
- [ ] #33 的 Windows 产物存在性/manifest 校验
- [ ] #51 的 Windows Authenticode/更新签名评估
- [ ] #112 的 Windows 相关安全加固

## 下一位 AI 的唯一下一步

从最新 `main` 创建 Windows 专用功能分支，优先继续 v0.9.1 的编辑器 round-trip、真实 Windows 桌面撤销/重做和更新器回归；不要重新开启跨平台构建或发布任务。
