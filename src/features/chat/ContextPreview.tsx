import type { ChatSource } from "../../shared/chat-types";
export function ContextPreview({
  sources,
  excluded,
  toggle,
  close,
  onOpen,
}: {
  sources: ChatSource[];
  excluded: string[];
  toggle: (id: string) => void;
  close: () => void;
  onOpen?: (id: string) => void;
}) {
  const included = sources.filter((s) => !excluded.includes(s.id));
  const estimate = Math.ceil(included.reduce((sum, s) => sum + new TextEncoder().encode(s.text).length, 0) / 2);
  return (
    <section className="chat-context-preview" aria-label="本次参考资料">
      <header>
        <strong>本次参考资料 · {included.length} 项</strong>
        <button type="button" onClick={close}>
          收起
        </button>
      </header>
      <p>
        约 {estimate.toLocaleString()} tokens（仅资料的字节估算；实际用量以 API 返回为准）。发送时会检查资料是否更新。
      </p>
      {!sources.length && <p>没有找到相关资料。本次只发送对话内容。</p>}
      {sources.map((source) => (
        <div key={source.id}>
          <label>
            <input type="checkbox" checked={!excluded.includes(source.id)} onChange={() => toggle(source.id)} />
            {source.title}
          </label>
          <small>
            {source.layer?.toUpperCase() ?? "文档引用"} ·{" "}
            {source.project || (source.kind === "ai" ? "全局" : "本地文档")} · {source.source}
          </small>
          <details>
            <summary>查看本次内容 · {source.text.length} 字符</summary>
            <pre>{source.text}</pre>
          </details>
          {source.kind === "ai" && onOpen && (
            <button type="button" onClick={() => onOpen(source.id)}>
              打开原文
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
