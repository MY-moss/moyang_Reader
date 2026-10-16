import { useEffect, useMemo, useRef, useState } from "react";
import { rankQuickOpenItems, type QuickOpenCandidate } from "../../features/workspace/quick-open";
import { useModalBehavior } from "../../shared/components/useModalBehavior";
import { Icon } from "../../shared/components/Icon";
import { translate, type Locale, type MessageKey } from "../../features/settings/i18n";

type QuickOpenPaletteProps = {
  locale?: Locale;
  items: QuickOpenCandidate[];
  onClose: () => void;
  onOpenFile: (path: string) => void;
};

function kindLabel(kind: string | undefined, name: string): string {
  if (kind === "markdown") return "MD";
  if (kind === "text") return "TXT";
  if (kind === "docx") return "DOCX";
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "IMG";
  const extension = name.split(".").at(-1)?.toLowerCase();
  if (extension === "md" || extension === "markdown") return "MD";
  if (["txt", "text", "log"].includes(extension ?? "")) return "TXT";
  if (extension === "docx" || extension === "pdf") return extension.toUpperCase();
  return "FILE";
}

export function QuickOpenPalette({ items, onClose, onOpenFile, locale = "zh-CN" }: QuickOpenPaletteProps) {
  const t = (key: MessageKey) => translate(locale, key);
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
            <h2 id="quick-open-title">{t("quick.title")}</h2>
          </div>
          <kbd>ESC</kbd>
        </div>
        <label className="quick-open-input-wrap">
          <Icon name="search" />
          <input
            ref={inputRef}
            type="search"
            aria-label={t("quick.search")}
            placeholder={t("quick.placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Ctrl P</kbd>
        </label>
        <div className="quick-open-results" role="listbox" aria-label={t("quick.results")}>
          {results.length === 0 ? (
            <div className="quick-open-empty">
              <strong>{t(items.length ? "quick.noMatch" : "quick.empty")}</strong>
              <span>{t(items.length ? "quick.tryAnother" : "quick.openFirst")}</span>
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
                <span className="quick-open-kind">{kindLabel(item.kind, item.name)}</span>
                <span className="quick-open-copy">
                  <strong>{item.name}</strong>
                  <small>{item.relativePath || item.path}</small>
                </span>
                {item.isRecent && <span className="quick-open-recent">{t("quick.recent")}</span>}
              </button>
            ))
          )}
        </div>
        <footer className="quick-open-footer">
          <span>{t("quick.selectHint")}</span>
          <span>{t("quick.openHint")}</span>
          <span>{t("quick.closeHint")}</span>
        </footer>
      </section>
    </div>
  );
}
