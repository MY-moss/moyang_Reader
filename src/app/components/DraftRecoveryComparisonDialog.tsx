import { useMemo, useRef } from "react";
import { buildDraftComparison, type DraftDiffLine } from "../draft-recovery-diff";
import { formatDraftRecoveryTime, type DraftSnapshot } from "../draft-recovery";
import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { useModalBehavior } from "./useModalBehavior";

export type RecoveryKind = "draft" | "previous-save";
export type RecoverySnapshot = Omit<DraftSnapshot, "savedAt"> & { savedAt?: number };

type DraftRecoveryComparisonDialogProps = {
  snapshot: RecoverySnapshot;
  locale?: Locale;
  comparisonSource: string | null;
  comparisonLabel: string;
  comparisonIsCurrent: boolean;
  comparisonStatus: "loading" | "ready" | "unavailable";
  comparisonError: string | null;
  currentDocumentModified: boolean;
  sourceChangedSinceDraft: boolean;
  actionLabel: string;
  onAction: () => void;
  onRetry?: () => void;
  onClose: () => void;
  recoveryKind?: RecoveryKind;
};

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function diffPrefix(line: DraftDiffLine): string {
  if (line.kind === "added") return "+";
  if (line.kind === "removed") return "−";
  if (line.kind === "notice") return "·";
  return " ";
}

function recoveryDecision(
  locale: Locale,
  comparison: ReturnType<typeof buildDraftComparison> | null,
  comparisonStatus: DraftRecoveryComparisonDialogProps["comparisonStatus"],
  comparisonIsCurrent: boolean,
  sourceChangedSinceDraft: boolean,
  recoveryKind: RecoveryKind,
  candidateLabel: string,
): { tone: "neutral" | "ready" | "warning"; title: string; description: string } {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  if (comparisonStatus === "loading") {
    return {
      tone: "neutral",
      title: t("comparisonLoadingTitle"),
      description: t("comparisonLoadingDescription"),
    };
  }
  if (comparisonStatus === "unavailable" || !comparison) {
    return {
      tone: "warning",
      title: t("comparisonUnavailableTitle"),
      description: safetyText(locale, "comparisonUnavailableDescription", { name: candidateLabel }),
    };
  }
  if (!comparisonIsCurrent) {
    return {
      tone: "warning",
      title: t("comparisonNeedsCurrentTitle"),
      description: safetyText(locale, "comparisonNeedsCurrentDescription", { name: candidateLabel }),
    };
  }
  if (!comparison.hasChanges) {
    return {
      tone: "neutral",
      title: t("comparisonSameTitle"),
      description: safetyText(locale, "comparisonSameDescription", { name: candidateLabel }),
    };
  }
  if (sourceChangedSinceDraft && recoveryKind === "draft") {
    return {
      tone: "warning",
      title: t("comparisonChangedTitle"),
      description: t("comparisonChangedDescription"),
    };
  }
  return {
    tone: "ready",
    title: recoveryKind === "previous-save" ? t("comparisonReadyPreviousTitle") : t("comparisonReadyDraftTitle"),
    description:
      recoveryKind === "previous-save" ? t("comparisonReadyPreviousDescription") : t("comparisonReadyDraftDescription"),
  };
}

export function DraftRecoveryComparisonDialog({
  snapshot,
  locale = "zh-CN",
  comparisonSource,
  comparisonLabel,
  comparisonIsCurrent,
  comparisonStatus,
  comparisonError,
  currentDocumentModified,
  sourceChangedSinceDraft,
  actionLabel,
  onAction,
  onRetry,
  onClose,
  recoveryKind = "draft",
}: DraftRecoveryComparisonDialogProps) {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  const candidateLabel = recoveryKind === "previous-save" ? t("previousSave") : t("draft");
  const candidateDescription =
    recoveryKind === "previous-save" ? t("comparisonPreviousDescription") : t("comparisonDraftDescription");
  const candidateDetail =
    recoveryKind === "previous-save"
      ? t("comparisonPreviousDetail")
      : safetyText(locale, "comparisonDraftDetail", {
          time: snapshot.savedAt ? formatDraftRecoveryTime(snapshot.savedAt, Date.now(), locale) : t("unknownTime"),
        });
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const comparison = useMemo(
    () =>
      comparisonStatus === "ready" && comparisonSource !== null
        ? buildDraftComparison(comparisonSource, snapshot.draft)
        : null,
    [comparisonSource, comparisonStatus, snapshot.draft],
  );
  const decision = recoveryDecision(
    locale,
    comparison,
    comparisonStatus,
    comparisonIsCurrent,
    sourceChangedSinceDraft,
    recoveryKind,
    candidateLabel,
  );

  useModalBehavior({ containerRef: dialogRef, initialFocusRef: closeButtonRef, onClose });

  return (
    <div className="quick-open-backdrop draft-comparison-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="quick-open-dialog draft-comparison-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-comparison-title"
        aria-describedby="draft-comparison-description"
        tabIndex={-1}
      >
        <header className="quick-open-header draft-comparison-header">
          <div>
            <h2 id="draft-comparison-title">{t("comparisonTitle")}</h2>
            <p className="draft-comparison-file" title={snapshot.path}>
              {fileName(snapshot.path)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="quiet-button"
            onClick={onClose}
            aria-label={safetyText(locale, "comparisonCloseAria", { name: candidateLabel })}
          >
            {t("close")}
          </button>
        </header>

        <div className="draft-comparison-body" tabIndex={0} role="region" aria-label={t("comparisonDetailsAria")}>
          <p id="draft-comparison-description" className="draft-comparison-intro">
            {safetyText(locale, "comparisonIntro", {
              candidate: candidateLabel,
              description: candidateDescription,
              baseline: comparisonLabel,
            })}
          </p>

          <div
            className="draft-comparison-sources"
            aria-label={safetyText(locale, "comparisonSourcesAria", { name: candidateLabel })}
          >
            <div className="draft-comparison-source current">
              <strong>{t("comparisonCurrent")}</strong>
              <span>{comparisonLabel}</span>
            </div>
            <div className="draft-comparison-source draft">
              <strong>{candidateLabel}</strong>
              <span>{candidateDetail}</span>
            </div>
          </div>

          <div className="draft-comparison-key" aria-label={t("comparisonLegendAria")}>
            <span>
              <b className="removed" aria-hidden="true">
                −
              </b>
              {safetyText(locale, "comparisonRemoved", { name: candidateLabel })}
            </span>
            <span>
              <b className="added" aria-hidden="true">
                +
              </b>
              {safetyText(locale, "comparisonAdded", { name: candidateLabel })}
            </span>
          </div>

          <div className={`draft-comparison-decision ${decision.tone}`} data-testid="draft-comparison-decision">
            <strong>{decision.title}</strong>
            <span>{decision.description}</span>
          </div>

          {comparison && (
            <div
              className="draft-comparison-stats"
              aria-label={safetyText(locale, "comparisonStatsAria", { name: candidateLabel })}
            >
              <div>
                <span>{comparisonIsCurrent ? t("comparisonCurrentLines") : t("comparisonBaselineLines")}</span>
                <strong>{comparison.baselineLineCount}</strong>
              </div>
              <div>
                <span>{safetyText(locale, "comparisonCandidateLines", { name: candidateLabel })}</span>
                <strong>{comparison.draftLineCount}</strong>
              </div>
              <div>
                <span>{t("comparisonAddedLines")}</span>
                <strong className="draft-comparison-added">+{comparison.addedLineCount}</strong>
              </div>
              <div>
                <span>{t("comparisonRemovedLines")}</span>
                <strong className="draft-comparison-removed">−{comparison.removedLineCount}</strong>
              </div>
              <div>
                <span>{t("comparisonCharacters")}</span>
                <strong>{signedNumber(comparison.characterDelta)}</strong>
              </div>
              <div>
                <span>{t("comparisonHunks")}</span>
                <strong>{comparison.changeHunkCount}</strong>
              </div>
              <div>
                <span>
                  {recoveryKind === "previous-save" ? t("comparisonBackupSource") : t("comparisonDraftSaved")}
                </span>
                <strong>
                  {recoveryKind === "previous-save"
                    ? t("savedBefore")
                    : snapshot.savedAt
                      ? formatDraftRecoveryTime(snapshot.savedAt, Date.now(), locale)
                      : t("unknownTime")}
                </strong>
              </div>
            </div>
          )}

          {comparisonStatus === "loading" && (
            <div className="draft-comparison-state" data-testid="draft-comparison-loading" role="status">
              {t("comparisonReading")}
            </div>
          )}
          {comparisonStatus === "unavailable" && (
            <div className="draft-comparison-state error" data-testid="draft-comparison-error" role="alert">
              <strong>{t("comparisonReadError")}</strong>
              <span>{comparisonError || t("comparisonReadFallback")}</span>
              {onRetry && (
                <button type="button" className="quiet-button" data-testid="draft-comparison-retry" onClick={onRetry}>
                  {t("comparisonRetry")}
                </button>
              )}
            </div>
          )}

          {currentDocumentModified && comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="alert">
              {t("comparisonModifiedWarning")}
            </div>
          )}
          {sourceChangedSinceDraft && recoveryKind === "draft" && comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="note">
              {t("comparisonChangedWarning")}
            </div>
          )}
          {comparisonStatus === "ready" && !comparisonIsCurrent && (
            <div className="draft-comparison-warning" role="note">
              {safetyText(locale, "comparisonOldBaseWarning", { name: candidateLabel })}
            </div>
          )}

          {comparison && (
            <>
              <div
                className="draft-comparison-preview"
                aria-label={safetyText(locale, "comparisonPreviewAria", { name: candidateLabel })}
              >
                {comparison.preview.length > 0 ? (
                  comparison.preview.map((line, index) => (
                    <div
                      key={`${line.kind}-${line.lineNumber ?? "notice"}-${index}`}
                      className={`draft-diff-line ${line.kind}`}
                    >
                      <span className="draft-diff-marker" aria-hidden="true">
                        {diffPrefix(line)}
                      </span>
                      <span className="draft-diff-line-number" aria-hidden="true">
                        {line.lineNumber ?? ""}
                      </span>
                      <span className="draft-diff-text">{line.text || " "}</span>
                    </div>
                  ))
                ) : (
                  <div className="draft-comparison-empty">
                    {safetyText(locale, "comparisonNoDiff", { name: candidateLabel })}
                  </div>
                )}
              </div>
              {comparison.truncated && <p className="draft-comparison-footnote">{t("comparisonTruncated")}</p>}
              {!comparison.precise && <p className="draft-comparison-footnote">{t("comparisonApproximate")}</p>}
            </>
          )}
        </div>

        <footer className="quick-open-footer draft-comparison-actions">
          <button type="button" className="quiet-button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="toolbar-button primary"
            data-testid="draft-comparison-action"
            onClick={onAction}
            disabled={!comparison || !comparison.hasChanges || comparisonStatus !== "ready"}
          >
            {comparisonStatus === "loading"
              ? t("comparisonLoadingAction")
              : comparisonStatus === "unavailable"
                ? t("comparisonUnavailableAction")
                : actionLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
