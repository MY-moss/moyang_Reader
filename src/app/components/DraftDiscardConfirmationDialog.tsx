import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

type DraftDiscardConfirmationDialogProps = {
  locale?: Locale;
  path: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DraftDiscardConfirmationDialog({
  locale = "zh-CN",
  path,
  onCancel,
  onConfirm,
}: DraftDiscardConfirmationDialogProps) {
  const name = path.split(/[\\/]/).pop() || path;
  const t = (key: Parameters<typeof safetyText>[1]) => safetyText(locale, key);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="draft-discard"
      title={t("discardTitle")}
      description={safetyText(locale, "discardDescription", { name })}
      note={t("discardNote")}
      facts={[{ label: t("localDraft"), value: name }]}
      confirm={{ label: t("discardConfirm"), testId: "draft-discard-confirm", onClick: onConfirm }}
      onCancel={onCancel}
    />
  );
}
