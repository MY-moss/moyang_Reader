import { useRef } from "react";
import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { buildDraftComparison } from "../draft-recovery-diff";
import { isSameDocumentPath } from "../document-transition";
import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { useModalBehavior } from "./useModalBehavior";

type DraftRecoveryCenterProps = {
  snapshots: DraftSnapshot[];
  locale?: Locale;
  onOpen: (path: string) => void;
  onPreview: (path: string) => void;
  onDiscard: (path: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  activeDocumentPath?: string | null;
  activeDocumentSource?: string | null;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function draftPreview(draft: string, locale: Locale): string {
  const preview = draft.replace(/\s+/g, " ").trim();
  return preview.length > 100 ? `${preview.slice(0, 100)}…` : preview || safetyText(locale, "emptyDocument");
}

export function DraftRecoveryCenter({
  snapshots,
  locale = "zh-CN",
  onOpen,
  onPreview,
  onDiscard,
  onClearAll,
  onClose,
  activeDocumentPath,
  activeDocumentSource,
}: DraftRecoveryCenterProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);

  return (
    <div
      className="quick-open-backdrop draft-recovery-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="quick-open-dialog draft-recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-recovery-title"
        tabIndex={-1}
      >
        <header className="quick-open-header">
          <div>
            <h2 id="draft-recovery-title">{t("centerTitle")}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="quiet-button"
            onClick={onClose}
            aria-label={t("centerCloseAria")}
          >
            {t("close")}
          </button>
        </header>
        <div className="draft-recovery-list">
          {snapshots.map((snapshot) => (
            <div className="draft-recovery-item" key={snapshot.path}>
              {(() => {
                const isCurrentDocument = Boolean(
                  activeDocumentPath && isSameDocumentPath(activeDocumentPath, snapshot.path),
                );
                const currentComparison =
                  isCurrentDocument && activeDocumentSource !== null && activeDocumentSource !== undefined
                    ? buildDraftComparison(activeDocumentSource, snapshot.draft)
                    : null;
                const characterDelta =
                  currentComparison && currentComparison.characterDelta > 0
                    ? `+${currentComparison.characterDelta}`
                    : (currentComparison?.characterDelta ?? 0);
                const diffSummary = currentComparison
                  ? currentComparison.hasChanges
                    ? safetyText(locale, "centerDiff", {
                        added: currentComparison.addedLineCount,
                        removed: currentComparison.removedLineCount,
                        hunks: currentComparison.changeHunkCount,
                        delta: characterDelta,
                        qualifier: currentComparison.precise ? "" : t("centerQuick"),
                      })
                    : t("centerSame")
                  : t("centerPending");

                return (
                  <>
                    <button
                      type="button"
                      className="draft-recovery-open"
                      onClick={() => onOpen(snapshot.path)}
                      aria-label={safetyText(locale, "centerOpenAria", { name: fileName(snapshot.path) })}
                    >
                      <strong>{fileName(snapshot.path)}</strong>
                      <span title={snapshot.path}>{snapshot.path}</span>
                      <small>
                        {formatDraftRecoveryTime(snapshot.savedAt, undefined, locale)} ·{" "}
                        {draftPreview(snapshot.draft, locale)}
                      </small>
                      <small className="draft-recovery-source-note">{t("centerCurrent")}</small>
                      <small className="draft-recovery-diff-summary">{diffSummary}</small>
                    </button>
                    <div className="draft-recovery-actions">
                      <button
                        type="button"
                        className="draft-recovery-preview"
                        onClick={() => onPreview(snapshot.path)}
                        aria-label={safetyText(locale, "centerPreviewAria", { name: fileName(snapshot.path) })}
                      >
                        {t("preview")}
                      </button>
                      <button
                        type="button"
                        className="draft-recovery-discard"
                        onClick={() => onDiscard(snapshot.path)}
                        aria-label={safetyText(locale, "centerDiscardAria", { name: fileName(snapshot.path) })}
                      >
                        {t("discard")}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
        <footer className="quick-open-footer draft-recovery-footer">
          <span>{t("centerFooter")}</span>
          <button type="button" className="quiet-button" onClick={onClearAll}>
            {t("centerClear")}
          </button>
        </footer>
      </section>
    </div>
  );
}
