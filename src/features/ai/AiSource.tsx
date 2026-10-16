import { useLayoutEffect, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { isTauriRuntime, openExternalUrl } from "../../platform/bridge";
import type { AiFields, AiRecord } from "../../shared/ai-types";
import { importAiFile, importAiPath, importAiWeb } from "./transfers";
export function AiSource({
  record,
  onChange,
  notify,
  initialIncoming,
}: {
  record: AiRecord;
  onChange: (r: AiRecord) => void;
  notify: (message: string, error?: boolean) => void;
  initialIncoming?: AiFields | null;
}) {
  const [incoming, setIncoming] = useState<AiFields | null>(null),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef({ sequence: 0 });
  useLayoutEffect(() => {
    const epoch = request.current;
    epoch.sequence++;
    setIncoming(initialIncoming ?? null);
    setBusy(false);
    return () => {
      epoch.sequence++;
    };
  }, [record.id, record.revision, initialIncoming]);
  const check = async (load: () => Promise<AiFields>) => {
    const sequence = ++request.current.sequence;
    setBusy(true);
    try {
      const next = await load();
      if (sequence !== request.current.sequence) return;
      if (!next.body.trim()) throw new Error("来源没有可读取的正文，已保留现有快照。");
      if (next.snapshot?.fingerprint && next.snapshot.fingerprint === record.snapshot?.fingerprint)
        notify("来源内容没有变化。");
      else setIncoming(next);
    } catch (e) {
      if (sequence === request.current.sequence) notify(String(e), true);
    } finally {
      if (sequence === request.current.sequence) setBusy(false);
    }
  };
  const uri = record.snapshot?.uri || record.source;
  return (
    <section className="ai-source">
      <strong>来源快照</strong>
      <span>{uri || "手动整理"}</span>
      {record.snapshot && <small>{new Date(record.snapshot.imported_at).toLocaleString()} 导入 · 与原文件独立</small>}
      <div className="ai-inline-actions">
        {uri && (
          <button
            onClick={() => {
              if (/^https?:\/\//.test(uri)) void openExternalUrl(uri).catch((e) => notify(String(e), true));
              else if (/^(?:[A-Z]:|\/|\\\\)/i.test(uri))
                window.dispatchEvent(new CustomEvent("moyang:open-ai-source", { detail: { path: uri } }));
              else notify("这份资料由文件选择器导入，请重新选择来源文件。");
            }}
          >
            打开来源
          </button>
        )}
        {record.kind === "knowledge" && (
          <button
            disabled={busy}
            onClick={() => {
              if (record.snapshot?.format === "web") void check(() => importAiWeb(uri));
              else if (isTauriRuntime() && /^(?:[A-Z]:|\/|\\\\)/i.test(uri))
                void check(() => importAiPath(uri, record.kind));
              else input.current?.click();
            }}
          >
            {busy ? "正在检查…" : "检查来源更新"}
          </button>
        )}
      </div>
      <input
        hidden
        type="file"
        accept=".md,.markdown,.txt,.docx,.pdf"
        ref={input}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void check(() => importAiFile(file, record.kind));
        }}
      />
      {incoming && (
        <div className="ai-source-update">
          <h3>比较来源更新</h3>
          <div className="version-compare">
            <section>
              <h4>当前快照</h4>
              <pre>{record.body}</pre>
            </section>
            <section>
              <h4>来源最新正文</h4>
              <pre>{incoming.body}</pre>
            </section>
          </div>
          <button onClick={() => setIncoming(null)}>保留现有快照</button>
          <button
            disabled={busy}
            onClick={async () => {
              const sequence = ++request.current.sequence;
              setBusy(true);
              try {
                const next = await aiRequest<AiRecord>("save", {
                  ...record,
                  body: incoming.body,
                  source: incoming.source,
                  snapshot: incoming.snapshot ? { ...incoming.snapshot, checked_at: Date.now() } : null,
                  expected_revision: record.revision,
                  reason: "检查差异后更新来源快照",
                });
                if (sequence !== request.current.sequence) return;
                setIncoming(null);
                onChange(next);
                notify("来源快照已更新，旧版本保留在历史中。");
              } catch (e) {
                notify(`来源「${record.title}」更新失败：${String(e)}`, true);
              } finally {
                if (sequence === request.current.sequence) setBusy(false);
              }
            }}
          >
            更新快照并保留历史
          </button>
        </div>
      )}
    </section>
  );
}
