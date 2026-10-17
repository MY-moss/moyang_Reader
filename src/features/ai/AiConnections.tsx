import { useEffect, useRef, useState } from "react";
import { aiConnection, aiRequest } from "../../platform/ai-bridge";
import { isTauriRuntime } from "../../platform/bridge";
import type { AiConnection, AiStats } from "../../shared/ai-types";
import { exportAiBackup } from "./transfers";
import { AiClientConnections } from "./AiClientConnections";
import { AiRetrievalSettings } from "./AiRetrievalSettings";
export const agentGuide = `开始任务时，用 recall_context 按当前项目和任务检索相关知识、记忆和技能。只读取需要的详情。
优先沿用生命周期钩子提供的原始 checkpoint_id；没有钩子时用 task_checkpoint 建立本轮检查点。
任务结束用 conclude_task 保存有证据的长期结论；没有新信息就提交 decisions=[] 和原因，不存整段聊天、进度或猜测。钩子补充回合继续使用原检查点。
用 read_context 按 L0 目录、L1 概览、L2 正文、L3 历史逐步读取；用 patch_record 和 expected_revision 只修改必要字段。
用 recall_context 的 kinds=["skill"] 发现方法，再按需读取技能和资源。保留原有共享范围，不反复堆积重复记录。
仅当已读内容仍在当前上下文时回传 receipt；上下文压缩、重启、项目切换或 Agent 交接后使用新的 context_id 并重新召回。`;
export function AiConnections({
  active = true,
  dataVersion = 0,
  stats,
  refresh,
  notify,
}: {
  active?: boolean;
  dataVersion?: number;
  stats: AiStats | null;
  refresh: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [info, setInfo] = useState<AiConnection | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void aiConnection()
      .then(setInfo)
      .catch((e) => notify(String(e), true));
  }, [notify]);
  const copy = (text: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => notify("已复制。"))
      .catch((e) => notify(String(e), true));
  const server = info
    ? { command: info.executable, args: ["--data-dir", info.directory, "--profile", "compact"] }
    : null;
  const json = JSON.stringify({ mcpServers: { "moyang-ai": server } }, null, 2);
  const toml = info
    ? `[mcp_servers.moyang-ai]\ncommand = ${JSON.stringify(info.executable)}\nargs = ["--data-dir", ${JSON.stringify(info.directory)}, "--profile", "compact"]`
    : "";
  return (
    <div className="ai-connections">
      <h1>接入与备份</h1>
      <p className="ai-lede">知识、记忆和技能保存在本机。支持 MCP 的 Agent 可以共享这份积累。</p>
      <section>
        <h2>连接你的 Agent</h2>
        <p>
          {info?.native
            ? info.available
              ? "本地 MCP 程序已找到。将配置复制到客户端，重启或重新连接即可使用；不需要一直打开阅读器。"
              : "尚未找到 MCP 可执行文件。请在本项目运行 npm run build:mcp，再刷新此页。"
            : "浏览器预览使用独立存储。请启动桌面版，获取可用的本机连接配置。"}
        </p>
        {info?.native && (
          <AiClientConnections active={active} dataVersion={dataVersion} available={info.available} notify={notify} />
        )}
        {info?.native && (
          <>
            <div className="ai-config-heading">
              <strong>通用 MCP 配置</strong>
              <button disabled={!info.available} onClick={() => copy(json)}>
                复制 JSON 配置
              </button>
            </div>
            <pre className="ai-config">{json}</pre>
            <details>
              <summary>Codex 配置格式</summary>
              <pre className="ai-config">{toml}</pre>
              <button disabled={!info.available} onClick={() => copy(toml)}>
                复制 TOML 配置
              </button>
            </details>
            <p className="ai-muted">
              将服务项合并到已有配置中，保留其他服务。此页检测程序与数据位置；客户端是否连接成功，以客户端显示为准。
            </p>
          </>
        )}
        <details>
          <summary>让 Agent 主动积累记忆</summary>
          <p>Codex 和 Claude Code 的钩子会带入这些约定。其他 MCP 客户端可把它们加入项目说明或长期指令。</p>
          <pre className="ai-guide">{agentGuide}</pre>
          <button onClick={() => copy(agentGuide)}>复制使用约定</button>
        </details>
      </section>
      {stats ? (
        <AiRetrievalSettings stats={stats} native={Boolean(info?.native)} refresh={refresh} notify={notify} />
      ) : (
        <p role="status">正在读取检索配置…</p>
      )}
      <section>
        <h2>数据与备份</h2>
        <p className="ai-storage-path">{stats?.database_path}</p>
        <p>完整备份包含知识、记忆、技能资源和修订历史。恢复时跳过同编号记录，不覆盖现有内容。</p>
        <div className="ai-inline-actions">
          <button
            onClick={() =>
              void exportAiBackup()
                .then((ok) => {
                  if (ok) notify("完整备份已导出。");
                })
                .catch((e) => notify(String(e), true))
            }
          >
            导出完整备份
          </button>
          <button
            onClick={() => {
              if (!isTauriRuntime()) {
                importRef.current?.click();
                return;
              }
              void aiRequest<{ imported: number; skipped: number; skipped_activity?: number } | null>("import_archive")
                .then((result) => {
                  if (result) {
                    refresh();
                    notify(
                      `导入 ${result.imported} 条，跳过 ${result.skipped} 条已有记录。${result.skipped_activity ? `另有 ${result.skipped_activity} 项活动与本地版本不一致，已跳过。` : ""}`,
                    );
                  }
                })
                .catch((e) => notify(String(e), true));
            }}
          >
            导入备份
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 100_000_000) throw new Error("备份超过 100 MB，请使用数据库文件迁移。");
                const result = await aiRequest<{ imported: number; skipped: number }>(
                  "import",
                  JSON.parse(await f.text()),
                );
                refresh();
                notify(`导入 ${result.imported} 条，跳过 ${result.skipped} 条已有记录。`);
              } catch (error) {
                notify(String(error), true);
              }
            }}
          />
        </div>
        <p className="ai-muted">本库与日常笔记分开。只有你明确导入的资料或 Agent 写入的内容会进入这里。</p>
      </section>
    </div>
  );
}
