import { useEffect, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { chatRequest } from "../../platform/chat";
import type { AiSemantic, AiStats } from "../../shared/ai-types";
import type { ChatProvider } from "../../shared/chat-types";
import { AiModelManager } from "./AiModelManager";
export function AiRetrievalSettings({
  stats,
  native,
  refresh,
  notify,
}: {
  stats: AiStats | null;
  native: boolean;
  refresh: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [config, setConfig] = useState<AiSemantic>(
    stats?.semantic ?? { enabled: false, endpoint: "http://127.0.0.1:11434", model: "qwen3-embedding:0.6b" },
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [providers, setProviders] = useState<ChatProvider[]>([]);
  const stop = useRef(false);
  const testId = useRef<string | null>(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    void chatRequest<ChatProvider[]>("providers")
      .then(setProviders)
      .catch((e) => notify(String(e), true));
    return () => {
      stop.current = true;
      if (testId.current) void aiRequest("cancel_search", { request_id: testId.current }).catch(() => undefined);
    };
  }, [notify]);
  async function index() {
    setBusy(true);
    stop.current = false;
    try {
      await aiRequest("semantic_config", config);
      if (stop.current) return;
      await aiRequest("semantic_resume");
      setProgress("");
      refresh();
      if (stop.current) {
        await aiRequest("semantic_pause");
        return;
      }
      while (!stop.current) {
        const result = await aiRequest<{
          processed: number;
          remaining: number;
          busy?: boolean;
          paused?: boolean;
          changed?: boolean;
        }>("semantic_index");
        if (stop.current) break;
        if (result.paused || result.changed) break;
        if (result.busy) {
          setProgress(`后台正在建立索引，剩余 ${result.remaining} 段`);
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
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
    <section>
      <h2>
        语义检索 <span className="ai-muted">可选</span>
      </h2>
      <p>基础检索无需模型。选择本地模型或自己的嵌入 API，让不同说法也能找到相关内容。</p>
      {native && (
        <AiModelManager
          onUse={(c) => {
            setConfig(c);
            refresh();
          }}
          notify={notify}
        />
      )}
      <fieldset disabled={!native || busy}>
        <label className="ai-checkbox">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          启用语义检索
        </label>
        <div className="ai-form-grid">
          <label>
            嵌入方式
            <select
              value={config.protocol || "ollama"}
              onChange={(e) => setConfig({ ...config, protocol: e.target.value as "ollama" | "openai" })}
            >
              <option value="ollama">本地或远程 Ollama</option>
              <option value="openai">我的嵌入 API（OpenAI 兼容）</option>
            </select>
          </label>
          {config.protocol === "openai" ? (
            <label>
              嵌入 API 服务
              <select
                value={config.provider || ""}
                onChange={(e) => {
                  const p = providers.find((p) => p.id === e.target.value);
                  setConfig({ ...config, provider: e.target.value, endpoint: p?.baseUrl ?? "" });
                }}
              >
                <option value="">请先在设置 → AI 服务与整理中添加服务</option>
                {providers
                  .filter((p) => p.protocol === "openai")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              服务地址
              <input value={config.endpoint} onChange={(e) => setConfig({ ...config, endpoint: e.target.value })} />
            </label>
          )}
          <label>
            嵌入模型名称
            <input value={config.model} onChange={(e) => setConfig({ ...config, model: e.target.value })} />
          </label>
        </div>
        <p className="ai-muted">
          外部 API
          建立索引和检索会发送对应文本，并可能产生服务用量。它与聊天、后台整理分别选模型；后台整理的每日额度不包含嵌入
          API。模型改变后使用独立索引，期间关键词检索仍可用。
        </p>
        <div className="ai-inline-actions">
          <button
            onClick={() => {
              const id = crypto.randomUUID();
              testId.current = id;
              setTesting(true);
              setBusy(true);
              const timer = setTimeout(() => {
                void aiRequest("cancel_search", { request_id: id }).catch(() => undefined);
              }, 30000);
              void aiRequest<{ dimensions: number; model: string }>("semantic_test", { config, request_id: id })
                .then((r) => notify(`连接成功：${r.model} 返回 ${r.dimensions} 维中文向量。未修改检索配置或索引。`))
                .catch((e) => notify(String(e), true))
                .finally(() => {
                  clearTimeout(timer);
                  testId.current = null;
                  setTesting(false);
                  setBusy(false);
                });
            }}
          >
            测试嵌入连接
          </button>
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
      {testing && busy && (
        <button
          onClick={() =>
            void aiRequest("cancel_search", { request_id: testId.current }).catch((e) => notify(String(e), true))
          }
        >
          停止连接测试
        </button>
      )}
      <small>连接测试只发送一条固定中文短句；外部 API 可能产生少量用量，不会发送库内资料。</small>
      {config.enabled && (
        <button
          onClick={() => {
            stop.current = true;
            void aiRequest("semantic_pause")
              .then(() => {
                setProgress("已暂停索引；当前批次完成后停止。点击建立 / 补齐索引继续。");
                refresh();
              })
              .catch((e) => notify(String(e), true));
          }}
        >
          停止后续批次
        </button>
      )}
      <p aria-live="polite">
        {!busy && stats?.semantic_paused
          ? "已暂停自动索引；点击建立 / 补齐索引继续。"
          : progress || `当前模型已索引 ${stats?.embedded_chunks ?? 0} / ${stats?.indexed_chunks ?? 0} 段`}
      </p>
      <p className="ai-muted">
        编辑后自动补齐语义索引，也可以手动检查；未索引内容仍能通过关键词找到。本地模型与关键词检索均可离线使用。
      </p>
    </section>
  );
}
