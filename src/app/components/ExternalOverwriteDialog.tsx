import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

type ExternalOverwriteDialogProps = {
  locale?: Locale;
  fileName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ExternalOverwriteDialog({
  locale = "zh-CN",
  fileName,
  onCancel,
  onConfirm,
}: ExternalOverwriteDialogProps) {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="external-overwrite"
      title={t("overwriteTitle")}
      description={t("overwriteDescription")}
      note={t("overwriteNote")}
      facts={[
        { label: t("currentFile"), value: fileName || t("currentFile") },
        { label: t("comparisonCurrent"), value: t("overwriteDisk") },
        { label: t("unsavedEdits"), value: t("overwriteEdits") },
      ]}
      confirm={{ label: t("overwriteConfirm"), testId: "external-overwrite-confirm", onClick: onConfirm }}
      onCancel={onCancel}
    />
  );
}
