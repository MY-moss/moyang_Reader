import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

type CloseConfirmationDialogProps = {
  locale?: Locale;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void;
  onSaveAndClose: () => void;
};

export function CloseConfirmationDialog({
  locale = "zh-CN",
  fileName,
  onCancel,
  onConfirm,
  onSaveAndClose,
}: CloseConfirmationDialogProps) {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="close-confirm"
      title={t("closeTitle")}
      description={t("closeDescription")}
      note={`${t("closeExitNote")} ${t("closeSaveNote")}`}
      facts={[
        { label: t("closeFile"), value: fileName || t("currentFile") },
        { label: t("unsavedEdits"), value: t("closeEdits") },
        { label: t("localDraft"), value: t("closeDraft") },
      ]}
      secondary={{ label: t("closeExit"), testId: "close-confirm-confirm", onClick: onConfirm }}
      confirm={{ label: t("closeSave"), testId: "close-confirm-save", onClick: onSaveAndClose }}
      onCancel={onCancel}
    />
  );
}
