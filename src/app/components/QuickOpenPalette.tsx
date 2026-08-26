import { useEffect, useMemo, useRef, useState } from "react";
import { rankQuickOpenItems, type QuickOpenCandidate } from "../quick-open";
import { useModalBehavior } from "./useModalBehavior";

type QuickOpenPaletteProps = {
  items: QuickOpenCandidate[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
};

function kindLabel(kind: string | undefined): string {
  if (kind === "markdown") return "MD";
  if (kind === "text") return "TXT";
  if (kind === "docx") return "DOCX";
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "IMG";
  return "FILE";
}

export function QuickOpenPalette({ items, onClose, onOpenFile }: QuickOpenPaletteProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => rankQuickOpenItems(items, query), [items, query]);

  useModalBehavior({ containerRef: dialogRef, initialFocusRef: inputRef, onClose });

  useEffect(() => {
    setActiveIndex(0);
  }, [items, query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
        return;
      }
      if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        onOpenFile(results[activeIndex].path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onClose, onOpenFile, results]);

  return (
    <div
      className="quick-open-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="quick-open-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-open-title"
        tabIndex={-1}
      >
        <div className="quick-open-header">
          <div>
            <div className="quick-open-kicker">QUICK OPEN</div>
            <h2 id="quick-open-title">快速打开</h2>
          </div>
          <kbd>ESC</kbd>
        </div>
        <label className="quick-open-input-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            aria-label="快速打开文档"
            placeholder="输入文件名或路径…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Ctrl P</kbd>
        </label>
        <div className="quick-open-results" role="listbox" aria-label="快速打开结果">
          {results.length === 0 ? (
            <div className="quick-open-empty">
              <strong>{items.length ? "没有匹配的文档" : "还没有可打开的文档"}</strong>
              <span>{items.length ? "换个文件名或路径试试" : "先打开文件，或添加一个阅读库文件夹"}</span>
            </div>
          ) : (
            results.map((item, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`quick-open-item ${index === activeIndex ? "active" : ""}`}
                key={item.path}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onOpenFile(item.path)}
              >
                <span className="quick-open-kind">{kindLabel(item.kind)}</span>
                <span className="quick-open-copy">
                  <strong>{item.name}</strong>
                  <small>{item.relativePath || item.path}</small>
                </span>
                {item.isRecent && <span className="quick-open-recent">最近</span>}
              </button>
            ))
          )}
        </div>
        <footer className="quick-open-footer">
          <span>↑↓ 选择</span>
          <span>Enter 打开</span>
          <span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  );
}
