import { useState } from "react";
export function AiConflictPanel({
  local,
  remote,
  base,
  busy,
  onResolve,
}: {
  local: string;
  remote: string;
  base?: string;
  busy: boolean;
  onResolve: (body: string, copy?: boolean) => void;
}) {
  const [merged, setMerged] = useState(local);
  return (
    <section className="ai-conflict-panel" aria-label="比较 AI 内容冲突">
      <h2>这份内容已被其他窗口或 Agent 更新</h2>
      <p>你的草稿完整保留。对照差异后合并，或另存一份。</p>
      <div className="version-compare">
        <section>
          <h3>你的草稿</h3>
          <pre>{local}</pre>
        </section>
        <section>
          <h3>最新版本</h3>
          <pre>{remote}</pre>
        </section>
      </div>
      {base !== undefined && (
        <details>
          <summary>编辑前的版本</summary>
          <pre>{base}</pre>
        </details>
      )}
      <label>
        合并后的正文
        <textarea rows={8} value={merged} onChange={(e) => setMerged(e.target.value)} />
      </label>
      <div className="ai-inline-actions">
        <button disabled={busy} onClick={() => onResolve(merged)}>
          保存合并结果
        </button>
        <button disabled={busy} onClick={() => onResolve(local, true)}>
          草稿另存副本
        </button>
      </div>
    </section>
  );
}
