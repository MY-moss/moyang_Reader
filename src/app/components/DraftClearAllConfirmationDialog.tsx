import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

type DraftClearAllConfirmationDialogProps = {
  locale?: Locale;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DraftClearAllConfirmationDialog({
  locale = "zh-CN",
  onCancel,
  onConfirm,
}: DraftClearAllConfirmationDialogProps) {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="draft-clear-all"
      title={t("clearTitle")}
      description={t("clearDescription")}
      note={t("clearNote")}
      confirm={{ label: t("clearConfirm"), testId: "draft-clear-all-confirm", onClick: onConfirm }}
      onCancel={onCancel}
    />
  );
}
