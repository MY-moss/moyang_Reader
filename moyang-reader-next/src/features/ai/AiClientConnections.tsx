import { useCallback, useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";

interface ClientStatus {
  client: "codex" | "claude";
  configured: boolean;
  hooks_configured: boolean;
  config_path: string;
  hook_path: string;
  trust_hint: string;
  receipts: { mcp_at: number | null; hook_at: number | null; completed_at: number | null };
}
export function AiClientConnections({
  available,
  notify,
}: {
  available: boolean;
  notify: (message: string, error?: boolean) => void;
}) {
  const [clients, setClients] = useState<ClientStatus[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await Promise.all(
        ["codex", "claude"].map((client) => aiRequest<ClientStatus>("client_connection", { client, action: "status" })),
      );
      setClients(result);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function change(client: string, action: string) {
    setBusy(client);
    try {
      await aiRequest("client_connection", { client, action });
      await refresh();
      notify(
        action === "install"
          ? "配置已合并并备份。请在客户端完成钩子确认，然后开始一次任务。"
          : "已移除本应用的连接配置，其他配置已保留。",
      );
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="ai-client-connections">
      {error && (
        <p role="alert">
          {error} <button onClick={() => void refresh()}>重试</button>
        </p>
      )}
      {clients.map((client) => (
        <article key={client.client} className="ai-client-connection">
          <div className="ai-config-heading">
            <h3>{client.client === "codex" ? "Codex 桌面端 / CLI" : "Claude Code"}</h3>
            <button disabled={!available || !!busy} onClick={() => void change(client.client, "install")}>
              {busy === client.client ? "处理中…" : client.configured ? "修复连接配置" : "连接并开启自动沉淀"}
            </button>
          </div>
          <dl className="ai-connection-status">
            <div>
              <dt>MCP</dt>
              <dd>{client.configured ? (client.receipts.mcp_at ? "已连接" : "已配置 · 等待客户端连接") : "未配置"}</dd>
            </div>
            <div>
              <dt>自动沉淀</dt>
              <dd>
                {!client.hooks_configured
                  ? "未配置"
                  : client.receipts.hook_at
                    ? "钩子已运行"
                    : "等待客户端信任或下一次任务"}
              </dd>
            </div>
            <div>
              <dt>最近成功记录</dt>
              <dd>
                {client.receipts.completed_at
                  ? new Date(client.receipts.completed_at).toLocaleString()
                  : "尚无完成记录"}
              </dd>
            </div>
          </dl>
          {client.hooks_configured && !client.receipts.hook_at && <p>{client.trust_hint}</p>}
          <details>
            <summary>配置位置与移除</summary>
            <p className="ai-muted">修改前会在原配置旁保存带 moyang 标记的备份。移除只处理本应用写入的服务和钩子。</p>
            <p className="ai-config-path">
              {client.config_path}
              <br />
              {client.hook_path}
            </p>
            <button disabled={!!busy || !client.configured} onClick={() => void change(client.client, "uninstall")}>
              移除 Moyang 连接
            </button>
          </details>
        </article>
      ))}
    </div>
  );
}
