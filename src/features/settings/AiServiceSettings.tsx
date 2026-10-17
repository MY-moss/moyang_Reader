import { useCallback, useEffect, useState } from "react";
import { chatRequest } from "../../platform/chat";
import { aiRequest } from "../../platform/ai-bridge";
import { isTauriRuntime } from "../../platform/bridge";
import { ProviderSettings } from "../chat/ProviderSettings";
import type { ChatProvider } from "../../shared/chat-types";
import type { AiStats } from "../../shared/ai-types";
import { AiRetrievalSettings } from "../ai/AiRetrievalSettings";
import { providerModels } from "../../shared/provider-models";

type Config = { enabled: boolean; provider: string; model: string; daily_tokens: number; auto_merge: boolean };
type Status = {
  config: Config;
  used: number;
  reserved: number;
  remaining: number;
  estimated: number;
  reset_at: number;
  counts: Record<string, number>;
  errors: Array<{ id: string; title: string; error: string }>;
};
const empty: Config = { enabled: false, provider: "", model: "", daily_tokens: 0, auto_merge: true };
export function AiServiceSettings({ onStorage }: { onStorage?: () => void }) {
  const [retrieval, setRetrieval] = useState(false);
  const [stats, setStats] = useState<AiStats | null>(null);
  const [providers, setProviders] = useState<ChatProvider[]>([]),
    [editing, setEditing] = useState(false);
  const [config, setConfig] = useState<Config>(empty),
    [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const native = isTauriRuntime();
  const notify = useCallback((text: string, failed?: boolean) => {
    if (failed) setError(text);
    else setMessage(text);
  }, []);
  const refreshRetrieval = useCallback(() => {
    void aiRequest<AiStats>("stats")
      .then(setStats)
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (retrieval) refreshRetrieval();
  }, [retrieval, refreshRetrieval]);
  const reloadProviders = useCallback(async () => setProviders(await chatRequest<ChatProvider[]>("providers")), []);
  const refresh = useCallback(async () => {
    if (native) setStatus(await aiRequest<Status>("organization_status"));
  }, [native]);
  useEffect(() => {
    let alive = true;
    void Promise.all([reloadProviders(), native ? aiRequest<Status>("organization_status") : Promise.resolve(null)])
      .then(([, s]) => {
        if (alive && s) {
          setStatus(s);
          setConfig(s.config);
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [native, reloadProviders]);
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh().catch((e) => setError(String(e)));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <ProviderSettings
        providers={providers}
        selectedId={config.provider}
        onSaved={reloadProviders}
        onClose={() => setEditing(false)}
        returnLabel="返回 AI 服务"
      />
    );
  return (
    <section className="settings-section ai-service-settings" aria-label="AI 服务与整理">
      <h3>AI 服务</h3>
      <p>服务配置共用，聊天、记忆整理和嵌入检索分别选模型。无需安装聊天插件，也能配置后台整理。</p>
      <ol className="ai-setup-steps">
        <li>
          <strong>先选磁盘</strong>
          <p>AI 库、聊天、配置、备份和模型可分别选择位置。下载模型前先确认目录。</p>
          {onStorage && <button onClick={onStorage}>查看与更改存储位置</button>}
        </li>
        <li>
          <strong>按用途选择</strong>
          <p>聊天和整理使用文本生成模型；语义检索使用嵌入模型。服务中的模型列表不会自动证明它具备这些能力。</p>
          <button onClick={() => setEditing(true)}>添加服务 / 测试聊天模型</button>
          <button aria-expanded={retrieval} onClick={() => setRetrieval(!retrieval)}>
            配置本地模型或嵌入 API
          </button>
        </li>
        <li>
          <strong>按需启用</strong>
          <p>
            聊天：在扩展市场启用“书房聊天”，每次对话独立选模型。整理：在下方选择服务、模型与每日额度。语义检索：测试连接后再建立索引。
          </p>
        </li>
      </ol>
      {retrieval &&
        (stats ? (
          <div className="ai-connections">
            <AiRetrievalSettings stats={stats} native={native} refresh={refreshRetrieval} notify={notify} />
          </div>
        ) : (
          <p role="status">正在读取检索配置…</p>
        ))}
      <p>{providers.length ? `已保存 ${providers.length} 个服务` : "尚未添加 API 服务"}</p>
      <button onClick={() => setEditing(true)}>管理 API 服务</button>
      <hr />
      <h3>记忆后台整理</h3>
      <p>生成可按需读取的概览，保留原文。桌面或 MCP 运行时继续处理，两者关闭后队列保留。</p>
      {!native && <p>浏览器预览可配置服务；共享后台队列与每日额度请在桌面版启用。</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const s = await aiRequest<Status>("organization_config", { ...config, enabled: true });
            setStatus(s);
            setConfig(s.config);
            setMessage("已保存并启用。队列按每日额度处理。");
          });
        }}
      >
        <label className="settings-select-option">
          <span>整理使用的服务</span>
          <select
            aria-label="整理使用的服务"
            value={config.provider}
            disabled={busy || !native}
            required
            onChange={(e) => {
              const p = providers.find((p) => p.id === e.target.value);
              setConfig({ ...config, provider: e.target.value, model: p?.model ?? "" });
            }}
          >
            <option value="">请选择 API 服务</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-select-option">
          <span>整理模型</span>
          <input
            aria-label="整理模型"
            required
            disabled={busy || !native}
            value={config.model}
            list="organizer-model-catalog"
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          />
          <datalist id="organizer-model-catalog">
            {providerModels(providers.find((p) => p.id === config.provider)).map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </label>
        <label className="settings-select-option">
          <span>每日 token 额度</span>
          <input
            aria-label="每日 token 额度"
            type="number"
            min="1"
            max="100000000"
            required
            disabled={busy || !native}
            value={config.daily_tokens || ""}
            placeholder="由你决定"
            onChange={(e) => setConfig({ ...config, daily_tokens: Number(e.target.value) })}
          />
        </label>
        <label className="settings-option">
          <input
            type="checkbox"
            checked={config.auto_merge}
            disabled={busy || !native}
            onChange={(e) => setConfig({ ...config, auto_merge: e.target.checked })}
          />
          <span>
            <strong>自动合并明确同义的长期记忆</strong>
            <small>范围和条件一致才合并；原记录归档并保留来源，整组可撤回。不确定项留待比较。</small>
          </span>
        </label>
        <div className="settings-actions">
          <button className="primary-action" disabled={busy || !native || !providers.length}>
            保存并启用
          </button>
          {status?.config.enabled && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const s = await aiRequest<Status>("organization_action", { action: "pause" });
                  setStatus(s);
                  setConfig(s.config);
                  setMessage("已暂停；正在完成的请求仍计入用量，其结果不会覆盖原文。");
                })
              }
            >
              暂停整理
            </button>
          )}
        </div>
      </form>
      {status && (
        <div aria-label="整理额度与队列">
          <p>
            <strong>{status.config.enabled ? "已启用" : "未启用或已暂停"}</strong> · 已用 {status.used.toLocaleString()}{" "}
            · 预留 {status.reserved.toLocaleString()} · 剩余 {Math.max(0, status.remaining).toLocaleString()}
          </p>
          <small>
            其中估算用量 {status.estimated.toLocaleString()}。缺少服务用量或中断时保留估算，不计作零。额度在{" "}
            {new Date(status.reset_at).toLocaleString()} 重置；不换算货币费用。
          </small>
          <p>
            待处理 {status.counts.pending ?? 0} · 正在处理 {status.counts.running ?? 0} · 已整理{" "}
            {status.counts.done ?? 0} · 失败 {status.counts.failed ?? 0}
          </p>
          <div className="settings-actions">
            <button disabled={busy} onClick={() => void run(refresh)}>
              刷新状态
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await aiRequest("organization_action", { action: "retry" });
                  await refresh();
                })
              }
            >
              重试失败与额度等待
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await aiRequest("organization_action", { action: "cancel_pending" });
                  await refresh();
                })
              }
            >
              取消待处理任务
            </button>
          </div>
          {status.errors.map((e) => (
            <p key={e.id}>
              {e.title}：{e.error}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
