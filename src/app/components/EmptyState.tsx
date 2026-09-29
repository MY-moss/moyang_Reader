import brandLogo from "../../assets/moyang-reader-logo.png";
import { translate, type Locale } from "../i18n";

type EmptyStateProps = {
  onOpen: () => void;
  onChooseWorkspace: () => void;
  hasWorkspace: boolean;
  showWorkspaceAction: boolean;
  onOpenGuide: () => void;
  locale: Locale;
};

export function EmptyState({
  onOpen,
  onChooseWorkspace,
  hasWorkspace,
  showWorkspaceAction,
  onOpenGuide,
  locale,
}: EmptyStateProps) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-mark" aria-hidden="true">
        <img className="empty-logo" src={brandLogo} alt="" aria-hidden="true" />
      </div>
      <h1 id="empty-title">{hasWorkspace ? t("empty.libraryTitle") : t("empty.welcomeTitle")}</h1>
      <p>{hasWorkspace ? t("empty.libraryDescription") : t("empty.welcomeDescription")}</p>
      <div className="empty-capabilities" aria-label={t("empty.formats")}>
        <span>MARKDOWN</span>
        <span>WORD</span>
        <span>PDF</span>
        <span>IMAGE</span>
      </div>
      <div className="empty-actions">
        <button type="button" className="empty-action" onClick={onOpen}>
          {t("empty.open")}
        </button>
        {showWorkspaceAction && (
          <button type="button" className="empty-action secondary" onClick={onChooseWorkspace}>
            {t("empty.addLibrary")}
          </button>
        )}
        <button type="button" className="empty-action secondary" onClick={onOpenGuide}>
          {t("empty.guide")}
        </button>
      </div>
      <p className="empty-hint">{hasWorkspace ? t("empty.libraryHint") : t("empty.welcomeHint")}</p>
    </section>
  );
}
