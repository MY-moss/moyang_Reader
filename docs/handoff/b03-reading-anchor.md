# B03 — 稳健阅读位置 / Resilient Reading Anchor

## 结果

- 阅读位置由仅保存 `{ path, top }` 扩展为可选的 `headingId`、`relativeOffset`、`progressRatio` 和 `updatedAt`，仍保留 `top` 作为最终回退。
- 恢复顺序为：匹配标题及其视口偏移、按正文滚动比例恢复、按旧的绝对 `top` 恢复；正文尚未完成渐进渲染时会等待可用尺寸或标题。
- 旧版 `{ path, top }` 记录无需迁移脚本即可读取；无效锚点字段会被丢弃，历史容量从 32 条扩大到 256 条。
- 未保存正文 quote/context，不复制用户正文内容。

## 验证

- `npm test -- --run`：103 个测试文件、437 个测试通过。
- `npm run lint`：通过。
- `npx tsc -b`：通过。
- `npm run build`：通过。
- `npm run format:check`：通过。
- `npm run test:e2e:desktop -- --skip-benchmark`：17 条 Windows desktop smoke 通过；包含前置正文插入后的标题锚点恢复。

## 边界

- 本次只调整前端阅读位置记录、恢复和便携设置兼容；不修改索引算法、拼音匹配、IPC 或 Rust 文件行为。
- 浏览器预览文档继续不写入本地阅读位置。
