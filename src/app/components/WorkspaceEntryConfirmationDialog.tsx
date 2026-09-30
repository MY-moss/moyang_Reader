import { translate, type Locale, type MessageKey } from "../i18n";
import type { WorkspaceEntryAction, WorkspaceEntryConfirmationRequest } from "../workspace-entry-operations-controller";
import { safetyText } from "./safety-dialog-copy";
import { SafetyConfirmationDialog } from "./SafetyConfirmationDialog";

const actionKeys: Record<WorkspaceEntryAction, MessageKey> = {
  rename: "workspaceEntry.actionRename",
  delete: "workspaceEntry.actionDelete",
  move: "workspaceEntry.actionMove",
  copy: "workspaceEntry.actionCopy",
};

export function WorkspaceEntryConfirmationDialog({
  locale,
  request,
  onDecision,
}: {
  locale: Locale;
  request: WorkspaceEntryConfirmationRequest;
  onDecision: (accepted: boolean) => void;
}) {
  const t = (key: Parameters<typeof safetyText>[1], values?: Record<string, string>) => safetyText(locale, key, values);
  const deleting = request.type === "delete";
  const action = deleting ? "" : translate(locale, actionKeys[request.action]);
  return (
    <SafetyConfirmationDialog
      locale={locale}
      id="workspace-entry-confirm"
      title={deleting ? t("workspaceDeleteTitle") : t("workspaceSaveTitle", { action })}
      description={
        deleting
          ? t(request.kind === "folder" ? "workspaceDeleteFolder" : "workspaceDeleteFile")
          : t("workspaceSaveDescription")
      }
      note={
        deleting
          ? t("workspaceDeleteNote")
          : t(request.action === "delete" ? "workspaceSaveDeleteNote" : "workspaceSaveNote")
      }
      facts={[
        {
          label: deleting ? t(request.kind === "folder" ? "workspaceFolder" : "workspaceFile") : t("currentFile"),
          value: request.path,
        },
      ]}
      confirm={{
        label: deleting ? t("workspaceDeleteConfirm") : t("workspaceSaveConfirm", { action }),
        testId: "workspace-entry-confirm-confirm",
        onClick: () => onDecision(true),
      }}
      onCancel={() => onDecision(false)}
    />
  );
}
