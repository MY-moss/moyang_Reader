import { useCallback, useEffect, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";

interface ClientStatus {
  client: "codex" | "claude";
  configured: boolean;
  hooks_configured: boolean;
  profile?: "compact" | "full";
  needs_reconnect?: boolean;
  service?: {
    at: number;
    build: { version: string; revision: string; dirty: boolean };
    profile: string;
    tool_count: number;
  } | null;
  config_path: string;
  hook_path: string;
  trust_hint: string;
  receipts: { mcp_at: number | null; hook_at: number | null; completed_at: number | null };
  historical_receipts?: { completed_at: number | null };
}
export function AiClientConnections({
  active = true,
  dataVersion = 0,
  available,
  notify,
}: {
  active?: boolean;
  dataVersion?: number;
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
    if (!active) return;
    void refresh();
  }, [active, dataVersion, refresh]);
  async function change(client: string, action: string) {
    setBusy(client);
    try {
      await aiRequest("client_connection", { client, action });
      await refresh();
      notify(
        action === "install"
          ? "配置已合并并备份。请在客户端完成钩子确认，然后开始一次任务。"
          : action.startsWith("profile_")
            ? "工具模式已更新。请重新连接 MCP，当前连接不会自动换成新版工具目录。"
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
          <label>
            工具模式
            <select
              aria-label={`${client.client} 工具模式`}
              disabled={!available || !!busy}
              value={client.profile ?? "full"}
              onChange={(e) => void change(client.client, `profile_${e.target.value}`)}
            >
              <option value="compact">常用工具 · 8 项</option>
              <option value="full">完整工具 · 含管理功能</option>
            </select>
          </label>
          <dl className="ai-connection-status">
            <div>
              <dt>MCP</dt>
              <dd>
                {client.configured
                  ? client.needs_reconnect
                    ? "已配置 · 请重连以确认当前工具"
                    : client.receipts.mcp_at
                      ? "已连接"
                      : "已配置 · 等待客户端连接"
                  : "未配置"}
              </dd>
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
                  : client.historical_receipts?.completed_at
                    ? `旧连接 · ${new Date(client.historical_receipts.completed_at).toLocaleString()}`
                    : "尚无完成记录"}
              </dd>
            </div>
          </dl>
          {client.service && (
            <p className="ai-muted">
              最近接入服务：{client.service.build.version} · {client.service.build.revision.slice(0, 8)}
              {client.service.build.dirty ? "（开发构建）" : ""} ·{" "}
              {client.service.profile === "compact" ? "常用" : "完整"}模式 · {client.service.tool_count} 个工具。
              {!client.receipts.mcp_at || client.profile !== client.service.profile
                ? "配置已改变，等待客户端重新连接。"
                : ""}
            </p>
          )}
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
