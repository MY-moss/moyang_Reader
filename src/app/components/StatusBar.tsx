import { translate, type Locale } from "../i18n";
import type { DocumentKind } from "../types";

type StatusBarProps = {
  locale: Locale;
  documentPath: string | null;
  documentKind: DocumentKind | null;
  characterCount: number | null;
  externallyModified: boolean;
  currentVersion: string | null;
  onShowExternalChange: () => void;
};

export function StatusBar({
  locale,
  documentPath,
  documentKind,
  characterCount,
  externallyModified,
  currentVersion,
  onShowExternalChange,
}: StatusBarProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const documentSummary =
    documentKind === "pdf"
      ? t("status.pdf")
      : documentKind === "image"
        ? t("status.image")
        : characterCount === null
          ? null
          : `${characterCount.toLocaleString(locale)} ${t("status.characters")}`;

  return (
    <footer className="statusbar" aria-label={t("status.label")}>
      <div className="statusbar-document">
        <span className="statusbar-path" title={documentPath ?? undefined}>
          {documentPath ?? t("status.waiting")}
        </span>
        {documentSummary && <span className="statusbar-kind">{documentSummary}</span>}
      </div>
      <div className="statusbar-actions">
        {externallyModified && (
          <button type="button" className="statusbar-external-change" onClick={onShowExternalChange}>
            {t("status.externalChange")}
          </button>
        )}
        <span className="statusbar-version">{currentVersion ? `v${currentVersion}` : "Moyang Reader"}</span>
      </div>
    </footer>
  );
}
