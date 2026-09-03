# Moyang Reader 唯一下一步

- 状态：READY
- 当前切片：G-03 构建缓存预算提示；只扩展现有清理器的只读预算/闲置时间报告，不改变构建目标路径。
- 基线：远端 `main@c8884859068642705761d6b398dbef869fddfc9e`；开始前必须重新核验 G-03 是否已有重复 Issue/PR。
- 稳定版本与发布：当前稳定版 `v0.10.14`；G-03 属于内部工程治理，不生成安装包、Release、签名、`latest.json` 或 Cloudflare 镜像。
- 状态证据：`docs/release-status.json` 是当前版本、Release 资产、镜像状态、外部阻塞和交接路径的结构化事实源；不包含凭据。

## Task Context：G-03 构建缓存预算提示

- 目标：在现有 `cleanup:workspace` 预览输出中增加受控的大小/闲置时间预算提示与 dry-run 验证，让超预算构建缓存可被及时发现。
- 用户价值：避免构建缓存再次无提示地膨胀到系统盘或项目外副本，用户能看到明确、可审计的清理建议。
- 非目标：不自动删除正在使用的 Cargo target；不改变 D 盘缓存路径、构建命令、Rust/前端产物、业务功能、发布资产、工作树保护或跨平台范围。
- 验收标准：默认仍为只读预览；预算阈值和闲置时间提示可由测试固定；活动/受保护 target 只报告不删除；超过预算给出明确路径、大小和建议；定向工作流测试、Lint、格式和 `git diff --check` 通过。
- 涉及文件：现有 `scripts/cleanup-workspace.mjs` 与测试、必要的 `package.json`/清理文档、本文件和交接摘要；不新建重型依赖。
- 依赖：Node 文件系统、现有清理器和 D 盘缓存约定；无需凭据、网络、数据迁移或安装包。
- 风险：误判闲置时间或预算导致错误建议；用确定性 fixture、只读 dry-run 和受保护路径测试控制；不在代码中执行不可逆删除。
- 回滚：回退 G-03 PR 即可恢复现有清理预览输出，不影响缓存内容和用户文件。

## 完成后唯一下一步

- 合并 G-03 后重新核验计划顺序和开放 Issue/PR；若外部条件仍不足，推进 #112 文档边界或下一个无阻塞工程切片，不伪造 #241/#51 通过。

## 仍未开发的路线

- 条件项：[#241](https://github.com/MY-moss/moyang_Reader/issues/241) 更新/镜像/PDF 真机矩阵、[#51](https://github.com/MY-moss/moyang_Reader/issues/51) Windows 安装包签名、[#112](https://github.com/MY-moss/moyang_Reader/issues/112) 更新与 opener 文档；缺少旧版本、证书或 Cloudflare Secret 时只记录阻塞。
- 工程项：[#171](https://github.com/MY-moss/moyang_Reader/issues/171) 剩余主题边界、[#16](https://github.com/MY-moss/moyang_Reader/issues/16) `App.tsx` 拆分、[#194](https://github.com/MY-moss/moyang_Reader/issues/194) TS↔Rust 契约、[#227](https://github.com/MY-moss/moyang_Reader/issues/227) `SECURITY.md`、[#111](https://github.com/MY-moss/moyang_Reader/issues/111) i18n。
- HTML：先做 H-01 安全只读预览和 H-05 CSP/清洗门禁，再评估白名单 HTML、资源处理和源码编辑；禁止任意脚本、iframe、插件绕过或重型默认模块。
- 知识结构与分享：K-01～K-05、S-01～S-03，以及 v1.0 后评估的 AI/内部插件接口。

执行授权仍只有本文件；G-03 完成交接后停止，不自动开始下一批。
