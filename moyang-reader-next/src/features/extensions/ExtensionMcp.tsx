import { useState } from "react";
import type { InstalledExtension } from "../../shared/extension-types";
import { configureExtensionMcp, type McpInstallResult } from "../../platform/extensions";
import { isTauriRuntime } from "../../platform/bridge";
import { validateMcp } from "./package";
import type { ExtensionManager } from "./useExtensions";

export function ExtensionMcp({ installed, manager }: { installed: InstalledExtension; manager: ExtensionManager }) {
  const [config, setConfig] = useState(() => JSON.stringify(installed.mcpOverride ?? installed.package.mcp, null, 2));
  const [client, setClient] = useState<"codex" | "claude">("codex");
  const [result, setResult] = useState<McpInstallResult | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const action = async (operation: "preview" | "install" | "remove") => {
    setBusy(true);
    setNotice("");
    try {
      const parsed = validateMcp(JSON.parse(config));
      if (operation === "install" && !(await manager.updateMcp(installed.package.id, parsed))) return;
      const response = await configureExtensionMcp(installed.package.id, client, operation, parsed);
      setResult(response);
      setNotice(response.message);
    } catch (cause) {
      setNotice(String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="extension-mcp" aria-label="MCP 连接设置">
      <h3>连接你的 Agent</h3>
      <p>填写所需路径或环境变量后预览配置。安装会备份原文件，实际连接和信任由客户端完成。</p>
      <label>
        连接定义
        <textarea
          aria-label="MCP 连接定义"
          spellCheck={false}
          disabled={busy}
          value={config}
          onChange={(e) => {
            setConfig(e.target.value);
            setResult(null);
          }}
        />
      </label>
      <div className="extension-actions">
        <button
          disabled={busy || manager.busy}
          onClick={() => {
            try {
              void manager.updateMcp(installed.package.id, JSON.parse(config)).then((ok) => {
                if (ok) setNotice("连接定义已保存在本机。");
              });
            } catch (e) {
              setNotice(String(e));
            }
          }}
        >
          保存定义
        </button>
        <button
          onClick={() => {
            void (async () => {
              try {
                const parsed = validateMcp(JSON.parse(config));
                await navigator.clipboard.writeText(
                  JSON.stringify({ mcpServers: { [`moyang-ext-${installed.package.id}`]: parsed } }, null, 2),
                );
                setNotice("已复制通用 MCP 配置。");
              } catch (e) {
                setNotice(String(e));
              }
            })();
          }}
        >
          复制通用配置
        </button>
      </div>
      {isTauriRuntime() ? (
        <>
          <label>
            目标客户端
            <select
              value={client}
              disabled={busy}
              onChange={(e) => {
                setClient(e.target.value as "codex" | "claude");
                setResult(null);
                setNotice("");
              }}
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude Code</option>
            </select>
          </label>
          <div className="extension-actions">
            <button disabled={busy} onClick={() => void action("preview")}>
              预览安装配置
            </button>
            {result && (
              <button disabled={busy || manager.busy} onClick={() => void action("install")}>
                备份并安装到客户端
              </button>
            )}
            {result?.installed && (
              <button disabled={busy} onClick={() => void action("remove")}>
                移除此客户端连接
              </button>
            )}
          </div>
          {result && (
            <details open>
              <summary>{result.installed ? "客户端已存在连接定义" : "将添加连接定义"}</summary>
              <p className="extension-path">{result.path}</p>
              <pre>{result.content}</pre>
            </details>
          )}
        </>
      ) : (
        <p>请在桌面版安装到 Codex 或 Claude Code；此处可以保存和复制配置。</p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
