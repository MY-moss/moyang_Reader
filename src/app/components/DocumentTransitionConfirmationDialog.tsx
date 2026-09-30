import { useState } from "react";
import type { Locale } from "../i18n";
import type { DocumentTransitionAction, DocumentTransitionConfirmationRequest } from "../document-session-controller";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

const actionKeys = {
  open: "transitionOpen",
  switch: "transitionSwitch",
  back: "transitionBack",
  "new-document": "transitionNew",
  "open-draft": "transitionDraft",
  "close-tabs": "transitionClose",
  "switch-workspace": "transitionWorkspace",
  reload: "transitionReload",
} as const satisfies Record<DocumentTransitionAction, Parameters<typeof safetyText>[1]>;

export function DocumentTransitionConfirmationDialog({
  locale,
  request,
  onDecision,
}: {
  locale: Locale;
  request: DocumentTransitionConfirmationRequest;
  onDecision: (accepted: boolean) => void;
}) {
  // Quick Open or a menu may unmount its focused trigger before this modal closes.
  const [fallbackFocusTarget] = useState(() => document.querySelector<HTMLElement>(".tab-item.active .tab-label"));
  const t = (key: Parameters<typeof safetyText>[1], values?: Record<string, string | number>) =>
    safetyText(locale, key, values);
  const action = t(actionKeys[request.action]);
  const facts = [
    { label: t("currentFile"), value: request.path },
    { label: t("unsavedEdits"), value: t("transitionEdits") },
  ];
  if (request.draftSaved) facts.push({ label: t("localDraft"), value: t("closeDraft") });
  if (request.targets.length > 0 && request.action !== "close-tabs") {
    facts.push({
      label: t(request.action === "switch-workspace" ? "transitionWorkspaceTarget" : "transitionTarget"),
      value: request.targets[0],
    });
    if (request.targets.length > 1) facts.push({ label: t("transitionCount"), value: String(request.targets.length) });
  }
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="document-transition-confirm"
      fallbackFocusTarget={fallbackFocusTarget}
      title={t("transitionTitle", { action })}
      description={t(
        request.action === "reload"
          ? "transitionReloadDescription"
          : request.action === "close-tabs"
            ? "transitionCloseDescription"
            : "transitionDescription",
        { count: request.targets.length },
      )}
      note={t(request.draftSaved ? "transitionSavedNote" : "transitionUnsavedNote")}
      facts={facts}
      confirm={{ label: action, testId: "document-transition-confirm-confirm", onClick: () => onDecision(true) }}
      onCancel={() => onDecision(false)}
    />
  );
}
