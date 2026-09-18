# B01 大工作区性能基准记录

日期：2026-09-18

## 实现边界

- 基准位于 Rust 测试模块的 ignored 入口 `benchmarks_large_workspaces`，不改变扫描、索引或搜索算法。
- 默认固定生成 5,000 和 20,000 个 Markdown 文件，每 500 个文件进入一个确定性目录；每个文件约 2 KiB，只有最后一个文件包含查询词 `needle`。
- 每个规模按多轮记录扫描、首次冷搜索和缓存暖搜索；报告同时保留原始样本和 min/median/p95/max 统计。
- `MOYANG_WORKSPACE_BENCHMARK_SIZES`、`MOYANG_WORKSPACE_BENCHMARK_ROUNDS`、`MOYANG_WORKSPACE_BENCHMARK_WARM_SAMPLES` 和 `MOYANG_WORKSPACE_BENCHMARK_REPORT` 可由 scheduled/manual workflow 控制。
- PR correctness CI 不执行 ignored benchmark，也不把单轮毫秒值当作阻断阈值；workflow 只上传 JSON 供跨运行比较。

## 本机 smoke

命令使用 5k/20k、各 1 轮、每轮 3 次暖搜索，结果如下。数值是本机基线，不是 required gate：

| 文件数 | 扫描 p95 | 冷搜索 p95 | 暖搜索 p95 |
| ---: | ---: | ---: | ---: |
| 5,000 | 214.91 ms | 2,457.34 ms | 29.49 ms |
| 20,000 | 1,113.79 ms | 10,272.85 ms | 64.21 ms |

报告包含 `schemaVersion: 1`、每轮原始样本和结果计数；测试结束后本机临时报告已清理。后续优化应在相同语料、相同轮数和可比环境下比较趋势，不因一次共享 Runner 抖动直接修改 correctness gate。
