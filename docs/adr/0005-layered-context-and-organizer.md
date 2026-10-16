# ADR 0005：分层读取与有额度的后台整理

日期：2026-10-16。状态：已批准，正在实施。

## 背景

检索与活动接口重复正文、整条读取增加无效上下文；用户希望 AI 更易读取和更新个人记忆，并允许选择 API 预算逐渐整理新旧资料。保留 SQLite 与普通笔记隔离，避免引入完整外部记忆服务。

## 决定

L0 目录 → L1 概览 → L2 原文 → L3 历史是读取方式，不复制四份原文。生成内容绑定输入指纹，不能覆盖手写摘要或原文；原文索引一直可查。上下文回执仅对可确认连续的上下文有效，未知状态退回精简全量。

新连接八工具模式，未指定模式的旧连接仍提供完整工具。共享 API 能力不依赖聊天插件。桌面与 MCP 共用持久队列和额度，单整理任务并发；无需安装第三个常驻服务。预留输入估算和输出上限，缺 usage 仍按估算计入，重试收费也计额度。

同义合并只处理同范围、相容条件的长期记忆；新建结果并归档原文，保留来源、历史、替代关系和整组撤回。数字、否定、版本、时间和主体不同不能静默合并。知识和技能不由该合并器改写。

## 取舍

增加派生内容、队列、额度和撤回状态的维护成本，换取减少反复读取及可控的 API 使用。旧的 ADR 0003 / 0004 中“不增加独立总结模型”的原则保留；本决定允许用户主动配置外部 API 整理，不默认启用、也不增加新的本地总结模型。

模型与存储由用户选择。本地嵌入提供明确大小和下载目标，外部 embedding API 是替代选择；切换模型需建立对应索引。凭据不进入普通知识备份，迁移不得丢失旧 ID、修订和共享范围，也不得恢复运行锁或伪造客户端信任。

## 依据

- [OpenViking 分层](https://docs.openviking.ai/en/concepts/03-context-layers) 与[读取账本](https://github.com/volcengine/OpenViking/blob/main/openviking/retrieve/context_assembler/ledger.py)：借鉴渐进读取，不搬入服务体系。
- [QMD MCP](https://github.com/tobi/qmd/blob/main/src/mcp/server.ts)：按行、批量与预算读取。
- [TencentDB 候选去重](https://github.com/TencentCloud/TencentDB-Agent-Memory/blob/feat/server_team/MemoryCore/src/core/record/l1-dedup.ts)：同范围候选成批判断。
- [claude-mem 渐进读取](https://docs.claude-mem.ai/progressive-disclosure) 与 [Mem0 写入](https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py)：已整理结论直接写入，避免重复总结完整对话。
- [Ollama Qwen3 嵌入档位](https://ollama.com/library/qwen3-embedding) 与 [模型目录设置](https://docs.ollama.com/faq)：0.6b / 4b / 8b 下载大小约 639 MB / 2.5 GB / 4.7 GB，大小不是运行内存或本机质量承诺。
