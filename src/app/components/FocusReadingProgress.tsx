import { translate, type Locale } from "../i18n";

type FocusReadingProgressProps = {
  locale: Locale;
  progress: number;
  currentHeading: string | null;
};

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function FocusReadingProgress({ locale, progress, currentHeading }: FocusReadingProgressProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const percentage = Math.round(clampProgress(progress) * 100);

  return (
    <div className="focus-reading-progress" aria-label={t("reader.focusProgress")}>
      <div
        className="focus-reading-progress-track"
        role="progressbar"
        aria-label={t("reader.focusProgress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      <div className="focus-reading-progress-copy">
        <span className="focus-reading-progress-value">
          {percentage}% {t("reader.progressRead")}
        </span>
        <span className="focus-reading-progress-heading" title={currentHeading ?? undefined}>
          {currentHeading ?? t("reader.documentStart")}
        </span>
      </div>
    </div>
  );
}
