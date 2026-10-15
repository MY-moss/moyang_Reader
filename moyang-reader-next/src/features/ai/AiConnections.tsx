import { useEffect, useRef, useState } from "react";
import { aiConnection, aiRequest } from "../../platform/ai-bridge";
import type { AiConnection, AiSemantic, AiStats } from "../../shared/ai-types";
import { exportAiBackup } from "./transfers";
import { AiClientConnections } from "./AiClientConnections";
export const agentGuide = `开始任务时，用 recall_context 按当前项目和任务检索相关知识、记忆和技能。只读取需要的详情。
优先沿用生命周期钩子提供的原始 checkpoint_id；没有钩子时用 task_checkpoint 建立本轮检查点。
任务结束用 conclude_task 保存有证据的长期结论；没有新信息就提交 decisions=[] 和原因，不存整段聊天、进度或猜测。钩子补充回合继续使用原检查点。
发现过时信息时，先 get_record 读取当前版本，再用 expected_revision 修订；不要直接覆盖其他 Agent 的更新。
用 search(kind="skill") 发现方法，再按需读取技能和资源。使用后可用 memory_feedback 标记帮助程度。
相近记忆经过核对后用 merge_memories 合并；不再适用的内容归档。每次任务积累有用信息，而不是反复堆积重复记录。`;
export function AiConnections({
  stats,
  refresh,
  notify,
}: {
  stats: AiStats | null;
  refresh: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [info, setInfo] = useState<AiConnection | null>(null);
  const [config, setConfig] = useState<AiSemantic>(
    stats?.semantic ?? { enabled: false, endpoint: "http://127.0.0.1:11434", model: "qwen3-embedding:0.6b" },
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [modelStatus, setModelStatus] = useState<{ running: boolean; model_ready: boolean } | null>(null);
  const stop = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void aiConnection()
      .then(setInfo)
      .catch((e) => notify(String(e), true));
    return () => {
      stop.current = true;
    };
  }, [notify]);
  useEffect(() => {
    if (info?.native)
      void aiRequest<{ running: boolean; model_ready: boolean }>("local_model", { action: "status" })
        .then(setModelStatus)
        .catch((e) => notify(String(e), true));
  }, [info?.native, notify]);
  const copy = (text: string) =>
    void navigator.clipboard
      .writeText(text)
      .then(() => notify("已复制。"))
      .catch((e) => notify(String(e), true));
  const server = info ? { command: info.executable, args: ["--data-dir", info.directory] } : null;
  const json = JSON.stringify({ mcpServers: { "moyang-ai": server } }, null, 2);
  const toml = info
    ? `[mcp_servers.moyang-ai]\ncommand = ${JSON.stringify(info.executable)}\nargs = ["--data-dir", ${JSON.stringify(info.directory)}]`
    : "";
  async function index() {
    setBusy(true);
    stop.current = false;
    try {
      await aiRequest("semantic_config", config);
      while (!stop.current) {
        const result = await aiRequest<{ processed: number; remaining: number }>("semantic_index");
        setProgress(`本批完成 ${result.processed} 段，剩余 ${result.remaining} 段`);
        refresh();
        if (!result.remaining) {
          notify("语义索引已就绪。");
          break;
        }
      }
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  }
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
        {info?.native && <AiClientConnections available={info.available} notify={notify} />}
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
      <section>
        <h2>
          语义检索 <span className="ai-muted">可选</span>
        </h2>
        <p>基础检索无需模型。已有 Ollama 时，可建立语义索引，让不同说法也能找到相关内容。</p>
        {info?.native && (
          <div className="ai-model-setup">
            <p>
              {modelStatus?.model_ready
                ? "本地嵌入模型已安装"
                : modelStatus?.running
                  ? "Ollama 已运行，等待安装嵌入模型"
                  : "本地模型服务尚未运行"}
            </p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setProgress("正在准备本地模型，首次下载约 639 MB…");
                try {
                  const status = await aiRequest<{ running: boolean; model_ready: boolean }>("local_model", {
                    action: "install",
                  });
                  setModelStatus(status);
                  if (status.model_ready)
                    setConfig({ enabled: true, endpoint: "http://127.0.0.1:11434", model: "qwen3-embedding:0.6b" });
                  setProgress("模型已就绪，可建立或补齐索引。");
                  refresh();
                } catch (e) {
                  notify(String(e), true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {modelStatus?.model_ready ? "启动并使用本地模型" : "准备本地模型"}
            </button>
          </div>
        )}
        <fieldset disabled={!info?.native || busy}>
          <label className="ai-checkbox">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            启用 Ollama 语义检索
          </label>
          <div className="ai-form-grid">
            <label>
              服务地址
              <input value={config.endpoint} onChange={(e) => setConfig({ ...config, endpoint: e.target.value })} />
            </label>
            <label>
              已安装的嵌入模型
              <input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
            </label>
          </div>
          <p className="ai-muted">
            模型需先在 Ollama 中安装。服务地址指定为远程时，建立索引和检索会将相应文本发送到该地址。
          </p>
          <div className="ai-inline-actions">
            <button
              onClick={() =>
                void aiRequest("semantic_config", config)
                  .then(() => {
                    refresh();
                    notify("检索设置已保存。");
                  })
                  .catch((e) => notify(String(e), true))
              }
            >
              保存设置
            </button>
            <button className="ai-primary" disabled={!config.enabled} onClick={() => void index()}>
              建立 / 补齐索引
            </button>
          </div>
        </fieldset>
        {busy && (
          <button
            onClick={() => {
              stop.current = true;
              setProgress("当前批次完成后停止。");
            }}
          >
            停止后续批次
          </button>
        )}
        <p aria-live="polite">
          {progress || `当前模型已索引 ${stats?.embedded_chunks ?? 0} / ${stats?.indexed_chunks ?? 0} 段`}
        </p>
        <p className="ai-muted">
          编辑后自动补齐语义索引，也可以手动检查；未索引内容仍能通过关键词找到。本地模型与关键词检索均可离线使用。
        </p>
      </section>
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
          <button onClick={() => importRef.current?.click()}>导入备份</button>
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
