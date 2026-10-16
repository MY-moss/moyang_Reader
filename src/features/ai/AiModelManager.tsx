import { useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { openExternalUrl } from "../../platform/bridge";
import type { AiSemantic } from "../../shared/ai-types";
type Status = {
  directory: string;
  model: string;
  endpoint: string;
  running: boolean;
  model_ready: boolean;
  runtime_available: boolean;
  can_stop: boolean;
  directory_verified: boolean;
  installed: Array<{ name: string; size: number }>;
  presets: Array<{ id: string; name: string; bytes: number; description: string; url: string }>;
  download: { state: string; status?: string; total?: number; completed?: number };
};
export function AiModelManager({
  onUse,
  notify,
}: {
  onUse: (c: AiSemantic) => void;
  notify: (s: string, error?: boolean) => void;
}) {
  const [status, setStatus] = useState<Status | null>(null),
    [directory, setDirectory] = useState(""),
    [model, setModel] = useState("qwen3-embedding:0.6b"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void aiRequest<Status>("model_status")
      .then((s) => {
        if (alive) {
          setStatus(s);
          setDirectory(s.directory);
          setModel(s.model);
        }
      })
      .catch((e) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (status?.download.state !== "downloading") return;
    let alive = true;
    const timer = setInterval(() => {
      void aiRequest<Status>("model_status")
        .then((s) => {
          if (alive) setStatus(s);
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    }, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [status?.download.state]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: string) => {
    if (["download", "use", "start"].includes(action)) await aiRequest("model_config", { model, directory });
    const s = await aiRequest<Status>("model_action", { action });
    setStatus(s);
    if (action === "use") {
      onUse({ enabled: true, protocol: "ollama", provider: "", endpoint: s.endpoint, model: s.model });
      notify("已选择本地模型；索引将按新模型补齐。");
    }
  };
  const downloading = status?.download.state === "downloading";
  return (
    <details className="ai-model-setup">
      <summary>本地模型目录与下载</summary>
      <p>
        按设备能力选择嵌入模型，也可填写其他已支持的 Ollama
        嵌入模型名称。下载体积不等于运行内存；较大的模型通常需要更多内存或显存。
      </p>
      {error && <p role="alert">{error}</p>}
      {!status && !error && <p role="status">正在检查本机模型…</p>}
      {status && (
        <>
          <div className="ai-model-options" role="group" aria-label="模型强度">
            {status.presets.map((p) => (
              <label key={p.id} className="ai-model-option">
                <input
                  type="radio"
                  name="embedding-model"
                  checked={model === p.id}
                  disabled={busy || downloading}
                  onChange={() => setModel(p.id)}
                />
                <span>
                  <strong>
                    {p.name} · 约{" "}
                    {p.bytes >= 1e9 ? `${(p.bytes / 1e9).toFixed(1)} GB` : `${Math.round(p.bytes / 1e6)} MB`}
                  </strong>
                  <small>{p.description}</small>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void openExternalUrl(p.url).catch((error) => setError(String(error)));
                    }}
                  >
                    查看官方模型目录
                  </a>
                </span>
              </label>
            ))}
          </div>
          <label>
            模型名称
            <input value={model} disabled={busy || downloading} onChange={(e) => setModel(e.target.value)} />
          </label>
          <label>
            模型保存目录
            <input value={directory} disabled={busy || downloading} onChange={(e) => setDirectory(e.target.value)} />
          </label>
          <div className="ai-inline-actions">
            <button
              disabled={busy || downloading}
              onClick={() =>
                void run(async () => {
                  const chosen = await aiRequest<string | null>("model_choose_directory");
                  if (chosen) setDirectory(chosen);
                })
              }
            >
              选择模型目录
            </button>
            <button
              disabled={busy || downloading}
              onClick={() =>
                void run(async () => setStatus(await aiRequest<Status>("model_config", { model, directory })))
              }
            >
              保存选择
            </button>
          </div>
          <small>
            目录变更用于后续下载。已有模型可在“设置 →
            存储位置”迁移，或选择已有模型目录。应用使用独立端口，不修改你已有的 Ollama 设置。
          </small>
          <p>实际配置目录：{status.directory}</p>
          {status.running && !status.directory_verified && (
            <p role="status">当前端口的运行目录与此选择尚未核对一致。请先停止原服务，再从这里启动。</p>
          )}
          {!status.runtime_available && (
            <p>
              未找到 Ollama 运行程序。
              <a
                href="https://ollama.com/download/windows"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  void openExternalUrl("https://ollama.com/download/windows").catch((error) => setError(String(error)));
                }}
              >
                下载并安装 Ollama
              </a>{" "}
              后刷新本页，模型文件仍可保存在你选择的磁盘。
            </p>
          )}
          {status.installed.length > 0 && (
            <label>
              此目录已安装的模型
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) setModel(e.target.value);
                }}
                disabled={busy || downloading}
              >
                <option value="">选择已安装模型</option>
                {status.installed.map((m) => (
                  <option key={m.name}>{m.name}</option>
                ))}
              </select>
            </label>
          )}
          <div className="ai-inline-actions">
            <button
              disabled={busy || downloading || !status.runtime_available}
              onClick={() => void run(() => act("download"))}
            >
              {["failed", "cancelled"].includes(status.download.state) ? "继续下载 / 重试" : "下载所选模型"}
            </button>
            <button
              disabled={busy || downloading || !status.runtime_available}
              onClick={() => void run(() => act("use"))}
            >
              使用所选模型
            </button>
            {downloading && (
              <button disabled={busy} onClick={() => void run(() => act("cancel"))}>
                取消下载
              </button>
            )}
            {status.running && (
              <button disabled={busy || !status.can_stop} onClick={() => void run(() => act("stop"))}>
                停止本应用的模型服务
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => void run(async () => setStatus(await aiRequest<Status>("model_status")))}
            >
              刷新模型
            </button>
          </div>
          {status.download.state !== "idle" && (
            <div role="status">
              <p>{status.download.status}</p>
              {downloading && !!status.download.total && (
                <progress
                  aria-label="模型下载进度"
                  max={status.download.total}
                  value={status.download.completed ?? 0}
                />
              )}
            </div>
          )}
        </>
      )}
    </details>
  );
}
