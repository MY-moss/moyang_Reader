import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";

export type ExternalChangeKind = "modified" | "deleted";

type ExternalChangeNoticeProps = {
  fileName: string;
  locale?: Locale;
  changeKind?: ExternalChangeKind;
  onReload: () => void;
  onOverwrite: () => void;
  onSaveAs: () => void;
  onDismiss: () => void;
};

export function ExternalChangeNotice({
  fileName,
  locale = "zh-CN",
  changeKind = "modified",
  onReload,
  onOverwrite,
  onSaveAs,
  onDismiss,
}: ExternalChangeNoticeProps) {
  const deleted = changeKind === "deleted";

  return (
    <div className="external-change-notice" role="alert">
      <span>{safetyText(locale, deleted ? "externalDeleted" : "externalModified", { name: fileName })}</span>
      <div>
        {!deleted && (
          <>
            <button type="button" onClick={onReload}>
              {safetyText(locale, "externalReload")}
            </button>
            <button type="button" onClick={onOverwrite}>
              {safetyText(locale, "externalOverwrite")}
            </button>
          </>
        )}
        <button type="button" onClick={onSaveAs}>
          {safetyText(locale, "externalSaveAs")}
        </button>
        <button type="button" className="notice-dismiss" onClick={onDismiss}>
          {safetyText(locale, "later")}
        </button>
      </div>
    </div>
  );
}
