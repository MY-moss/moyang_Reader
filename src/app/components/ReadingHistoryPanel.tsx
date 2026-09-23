import type { CSSProperties } from "react";
import { formatReadingDuration, summarizeReadingHistory, type ReadingHistoryEntry } from "../reading-history";
import { translate, type Locale } from "../i18n";

type ReadingHistoryPanelProps = {
  entries: readonly ReadingHistoryEntry[];
  onRequestClear: () => void;
  locale?: Locale;
};

export function ReadingHistoryPanel({ entries, onRequestClear, locale = "zh-CN" }: ReadingHistoryPanelProps) {
  const summary = summarizeReadingHistory(entries);
  const scale = Math.max(1, summary.maxDaySeconds);
  const hasHistory = entries.length > 0;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const duration = (seconds: number) => {
    if (locale === "zh-CN") return formatReadingDuration(seconds);
    const minutes = Math.floor(seconds / 60);
    if (minutes <= 0) return seconds > 0 ? "<1 min" : "0 min";
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
  };

  return (
    <section className="reading-history-panel" aria-labelledby="reading-history-title">
      <div className="reading-history-heading">
        <div>
          <h3 id="reading-history-title">{t("workspace.history")}</h3>
        </div>
        <span className="reading-history-range">{t("history.range")}</span>
      </div>

      <div
        className="reading-history-metrics"
        aria-label={t("history.summary")
          .replace("{count}", String(summary.documentCount))
          .replace("{duration}", duration(summary.totalSeconds))}
      >
        <div className="reading-history-metric">
          <strong>{summary.documentCount}</strong>
          <span>{t("history.documents")}</span>
        </div>
        <div className="reading-history-metric">
          <strong>{duration(summary.totalSeconds)}</strong>
          <span>{t("history.duration")}</span>
        </div>
      </div>

      <div className="reading-history-days" aria-label="本周每日阅读时长">
        {summary.days.map((day) => {
          const percent = day.seconds > 0 ? Math.max(4, Math.round((day.seconds / scale) * 100)) : 0;
          const barStyle = { "--reading-history-bar-height": `${percent}%` } as CSSProperties;
          return (
            <div className={`reading-history-day${day.isToday ? " is-today" : ""}`} key={day.key}>
              <div
                className="reading-history-bar-track"
                role="progressbar"
                aria-label={t("history.dailyDuration").replace("{day}", day.key)}
                aria-valuemin={0}
                aria-valuemax={summary.maxDaySeconds || 1}
                aria-valuenow={day.seconds}
                aria-valuetext={duration(day.seconds)}
              >
                <span className="reading-history-bar" style={barStyle} />
              </div>
              <span className="reading-history-day-label">
                {locale === "zh-CN" ? day.label : ["M", "T", "W", "T", "F", "S", "S"][summary.days.indexOf(day)]}
              </span>
              <span className="reading-history-day-value">{duration(day.seconds)}</span>
            </div>
          );
        })}
      </div>

      {!hasHistory && (
        <p className="reading-history-empty" role="status">
          {t("history.empty")}
        </p>
      )}
      {hasHistory && summary.totalSeconds <= 0 && (
        <p className="reading-history-empty" role="status">
          {t("history.emptyWeek")}
        </p>
      )}

      <button
        type="button"
        className="quiet-button reading-history-clear"
        data-testid="reading-history-clear"
        onClick={onRequestClear}
        disabled={!hasHistory}
      >
        {t("history.clear")}
      </button>
    </section>
  );
}
