# Moyang Reader 产品演示

沿用仓库根目录 DESIGN.md 的暖白纸面、墨绿强调与本机字体。使用实际应用截图与虚构资料，聊天回答为固定演示内容；字幕说明用途，不将模拟对话表述为真实模型结果。

- 画布：1440 × 1000，26 秒，无声；GIF 供 README 自动播放，MP4 供清晰观看。
- 颜色：纸面 #f5f3ee，正文 #30352f，辅助文字 #686e63，强调 #3c6454 / #294d3d，浅强调 #e7eee4。
- 字体：界面和字幕用 Microsoft YaHei UI / Segoe UI；封面书页用 SimSun，标记 M 用 Georgia。
- 动效：温和交叠与轻微位移，停留时间用于看清实际界面；不用闪烁、夸张弹跳或网络字体。
- 顺序：阅读与写作 → 知识 / 长期记忆 / 技能 → 自有 API 聊天与 MCP → 下载提示。

生成画面：在仓库根目录运行 `npx vite preview --host 127.0.0.1 --port 4187 --strictPort`，再运行 `node docs/media/intro/capture.mjs`。只使用隔离浏览器的示例数据，不访问个人数据库或实际 API。

在本目录运行 `npm run check` 和 `npm run render -- --output ../moyang-intro.mp4`。转换 GIF 的参数见 `export.mjs`。
