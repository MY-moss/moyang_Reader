import { useMemo, useState } from "react";
import type { ChatSource } from "../../shared/chat-types";
export function AttachmentPicker({
  source,
  onConfirm,
  onClose,
}: {
  source: ChatSource;
  onConfirm: (source: ChatSource) => void;
  onClose: () => void;
}) {
  const sections = useMemo(() => {
    const result: { title: string; start: number; end: number }[] = [];
    let offset = 0,
      fence = "";
    for (const line of source.text.split(/(?<=\n)/)) {
      const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (delimiter) {
        if (!fence) fence = delimiter[1][0];
        else if (fence === delimiter[1][0]) fence = "";
      }
      const heading = !fence && line.match(/^ {0,3}#{1,6}\s+(.+)/);
      if (heading) {
        if (result.length) result[result.length - 1].end = offset;
        result.push({ title: heading[1].trim(), start: offset, end: source.text.length });
      }
      offset += line.length;
    }
    return result;
  }, [source.text]);
  const [mode, setMode] = useState(
    source.selectionText ? "selection" : source.text.length <= 12000 ? "document" : sections.length ? "0" : "document",
  );
  const [selected, setSelected] = useState("");
  const section = sections[Number(mode)];
  const text =
    mode === "selection"
      ? (source.selectionText ?? "")
      : mode === "document"
        ? source.text
        : source.text.slice(section?.start, section?.end);
  const chosen = selected || text;
  return (
    <section className="chat-context-preview" aria-label="选择文档引用">
      <header>
        <strong>引用 · {source.title}</strong>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </header>
      <label>
        内容范围
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setSelected("");
          }}
        >
          {source.selectionText && <option value="selection">阅读器中的选区</option>}
          <option value="document">整篇文档</option>
          {sections.map((s, i) => (
            <option key={i} value={String(i)}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <p>可在下面选中一段文字，仅引用选区。每次最多 12,000 字符。</p>
      <textarea
        aria-label="引用原文"
        readOnly
        value={text}
        onSelect={(e) => {
          const el = e.currentTarget;
          setSelected(el.value.slice(el.selectionStart, el.selectionEnd));
        }}
      />
      <p>
        {selected ? "选区" : "当前范围"} · {chosen.length.toLocaleString()} 字符
        {chosen.length > 12000 ? "，请选择较短章节或选区。" : ""}
      </p>
      <button
        type="button"
        disabled={!chosen.trim() || chosen.length > 12000}
        onClick={() =>
          onConfirm({
            ...source,
            title: `${source.title}（${selected || mode === "selection" ? "选区" : (section?.title ?? "全文")}）`,
            text: chosen,
            selectionText: undefined,
            kind: "document",
          })
        }
      >
        添加引用
      </button>
    </section>
  );
}
