import { buildDraftComparison } from "../draft-recovery-diff";
import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";

type PreviousVersionNoticeProps = {
  path: string;
  locale?: Locale;
  currentSource: string;
  previousSource: string;
  onPreview: () => void;
  onDismiss: () => void;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export function PreviousVersionNotice({
  path,
  locale = "zh-CN",
  currentSource,
  previousSource,
  onPreview,
  onDismiss,
}: PreviousVersionNoticeProps) {
  const comparison = buildDraftComparison(currentSource, previousSource);
  const characterDelta = comparison.characterDelta > 0 ? `+${comparison.characterDelta}` : comparison.characterDelta;
  const diffSummary = comparison.hasChanges
    ? safetyText(locale, "previousDiff", {
        added: comparison.addedLineCount,
        removed: comparison.removedLineCount,
        hunks: comparison.changeHunkCount,
        delta: characterDelta,
      })
    : safetyText(locale, "previousSame");

  return (
    <div className="external-change-notice draft-recovery-notice previous-version-notice" role="status">
      <span className="draft-recovery-copy">
        <strong>{safetyText(locale, "previousNotice", { name: fileName(path) })}</strong>
        <small className="draft-recovery-source-note">{safetyText(locale, "previousSource")}</small>
        <small>{diffSummary}</small>
      </span>
      <div>
        <button
          type="button"
          data-testid="previous-version-preview"
          aria-label={safetyText(locale, "previousPreviewAria")}
          onClick={onPreview}
        >
          {safetyText(locale, "preview")}
        </button>
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          {safetyText(locale, "ignore")}
        </button>
      </div>
    </div>
  );
}
