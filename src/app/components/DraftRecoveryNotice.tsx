import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import { buildDraftComparison } from "../draft-recovery-diff";
import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";

type DraftRecoveryNoticeProps = {
  snapshot: DraftSnapshot;
  locale?: Locale;
  currentSource: string;
  onPreview: () => void;
  onLater: () => void;
  onDiscard: () => void;
};

export function DraftRecoveryNotice({
  snapshot,
  locale = "zh-CN",
  currentSource,
  onPreview,
  onLater,
  onDiscard,
}: DraftRecoveryNoticeProps) {
  const comparison = buildDraftComparison(currentSource, snapshot.draft);
  const characterDelta = comparison.characterDelta > 0 ? `+${comparison.characterDelta}` : comparison.characterDelta;
  const diffSummary = comparison.hasChanges
    ? safetyText(locale, "noticeDiff", {
        added: comparison.addedLineCount,
        removed: comparison.removedLineCount,
        hunks: comparison.changeHunkCount,
        delta: characterDelta,
      })
    : safetyText(locale, "noticeSame");

  return (
    <div className="external-change-notice draft-recovery-notice" role="status">
      <span className="draft-recovery-copy">
        <strong>
          {safetyText(locale, "noticeDraft", {
            name: snapshot.path.split(/[\\/]/).pop() ?? snapshot.path,
            time: formatDraftRecoveryTime(snapshot.savedAt, Date.now(), locale),
          })}
        </strong>
        <small className="draft-recovery-source-note">{safetyText(locale, "noticeDraftSource")}</small>
        <small>{diffSummary}</small>
      </span>
      <div>
        <button
          type="button"
          data-testid="draft-recovery-preview"
          aria-label={safetyText(locale, "noticePreviewAria")}
          onClick={onPreview}
        >
          {safetyText(locale, "preview")}
        </button>
        <button type="button" className="notice-dismiss" onClick={onLater}>
          {safetyText(locale, "later")}
        </button>
        <button type="button" className="notice-dismiss" onClick={onDiscard}>
          {safetyText(locale, "discard")}
        </button>
      </div>
    </div>
  );
}
