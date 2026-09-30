import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

type ReadingHistoryClearConfirmationDialogProps = {
  locale?: Locale;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReadingHistoryClearConfirmationDialog({
  locale = "zh-CN",
  onCancel,
  onConfirm,
}: ReadingHistoryClearConfirmationDialogProps) {
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="reading-history-clear"
      title={t("historyTitle")}
      description={t("historyDescription")}
      note={t("historyNote")}
      confirm={{ label: t("historyConfirm"), testId: "reading-history-clear-confirm", onClick: onConfirm }}
      onCancel={onCancel}
    />
  );
}
