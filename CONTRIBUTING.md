# 参与 Moyang Reader

感谢提交问题、修复和功能建议。Moyang Reader 是 Windows 优先的本地阅读器，改动应优先保持启动快、离线可用和原文件不被意外覆盖。

## 开始开发

```powershell
npm install
npm run test
npm run build
npm run tauri dev
```

Rust 命令层测试：

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

依赖审计需要 npm 官方 registry：

```powershell
$env:NPM_CONFIG_REGISTRY = "https://registry.npmjs.org"
npm audit --audit-level=high
```

## 提交前检查

- 开始新任务前先查看 [Issues](https://github.com/MY-moss/moyang_Reader/issues)，避免重复修复。
- `npm test -- --run`、`npm run test:coverage`、`npm run build` 和 `npm run test:e2e` 全部通过。
- Rust 格式检查和测试通过。
- 不提交私钥、签名私钥密码、`.sig` 文件、本地工作区内容或构建产物。
- 用户可见行为、发布流程或架构变更要同步更新 README、CHANGELOG 或架构文档。

## 提交与 Pull Request

提交标题使用简短的 Conventional Commits 风格，例如 `fix: prevent stale document refresh`。Pull Request 请说明：

1. 改动解决的问题和对应 Issue。
2. 影响的文件类型、平台和兼容性。
3. 实际运行过的检查命令及结果。
4. 是否需要同步更新 Release、更新清单或用户文档。

主分支不接受强制推送。发布版本通过版本标签触发，详见 [`docs/UPDATE.md`](docs/UPDATE.md)。
