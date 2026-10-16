import { createPortal } from "react-dom";
import { PrintPreview } from "../../features/export/components/PrintPreview";
import { CloseConfirmationDialog } from "../../features/recovery/components/CloseConfirmationDialog";
import { DraftDiscardConfirmationDialog } from "../../features/recovery/components/DraftDiscardConfirmationDialog";
import { DraftRecoveryCenter } from "../../features/recovery/components/DraftRecoveryCenter";
import { ExternalOverwriteDialog } from "../../features/recovery/components/ExternalOverwriteDialog";
import { RelationGraph } from "../../features/workspace/components/RelationGraph";
import { WorkspaceEntryDetailsDialog } from "../../features/workspace/components/WorkspaceEntryDetailsDialog";
import { CommandPalette } from "../../shell/components/CommandPalette";
import { GettingStartedDialog } from "../../shell/components/GettingStartedDialog";
import { QuickOpenPalette } from "../../shell/components/QuickOpenPalette";
import type { ReaderApplication } from "../useReaderApplication";
export function ReaderOverlays({
  model,
}: {
  model: Pick<
    ReaderApplication,
    | "locale"
    | "setQuickOpen"
    | "draftSnapshots"
    | "setDraftRecoveryOpen"
    | "setCommandPaletteOpen"
    | "handleSelectTab"
    | "currentIndexEntry"
    | "setGraphOpen"
    | "inputRef"
    | "handleBrowserFiles"
    | "graphOpen"
    | "workspaceIndex"
    | "workspaceEntryDetails"
    | "setWorkspaceEntryDetails"
    | "printPreview"
    | "handlePrintPreview"
    | "handleClosePrintPreview"
    | "quickOpen"
    | "quickOpenItems"
    | "commandPaletteOpen"
    | "commandItems"
    | "executeCommand"
    | "draftRecoveryOpen"
    | "openDraftSnapshot"
    | "requestDraftDiscardByPath"
    | "clearAllDrafts"
    | "draftDiscardRequest"
    | "cancelDraftDiscard"
    | "confirmDraftDiscard"
    | "closeConfirmationOpen"
    | "cancelCloseConfirmation"
    | "confirmClose"
    | "externalOverwriteConfirmationOpen"
    | "cancelExternalOverwrite"
    | "confirmExternalOverwrite"
    | "guideOpen"
    | "closeGettingStarted"
    | "openDocumentFromGuide"
    | "addWorkspaceFromGuide"
  >;
}) {
  const {
    locale,
    setQuickOpen,
    draftSnapshots,
    setDraftRecoveryOpen,
    setCommandPaletteOpen,
    handleSelectTab,
    currentIndexEntry,
    setGraphOpen,
    inputRef,
    handleBrowserFiles,
    graphOpen,
    workspaceIndex,
    workspaceEntryDetails,
    setWorkspaceEntryDetails,
    printPreview,
    handlePrintPreview,
    handleClosePrintPreview,
    quickOpen,
    quickOpenItems,
    commandPaletteOpen,
    commandItems,
    executeCommand,
    draftRecoveryOpen,
    openDraftSnapshot,
    requestDraftDiscardByPath,
    clearAllDrafts,
    draftDiscardRequest,
    cancelDraftDiscard,
    confirmDraftDiscard,
    closeConfirmationOpen,
    cancelCloseConfirmation,
    confirmClose,
    externalOverwriteConfirmationOpen,
    cancelExternalOverwrite,
    confirmExternalOverwrite,
    guideOpen,
    closeGettingStarted,
    openDocumentFromGuide,
    addWorkspaceFromGuide,
  } = model;
  return createPortal(
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".md,.markdown,.mdown,.mkd,.txt,.text,.log,.docx,.pdf,.avif,.gif,.jpeg,.jpg,.png,.svg,.webp,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/*"
        hidden
        onChange={(event) => {
          void handleBrowserFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      {graphOpen && (
        <RelationGraph
          current={currentIndexEntry}
          entries={workspaceIndex}
          onClose={() => setGraphOpen(false)}
          onOpenFile={(path) => void handleSelectTab(path)}
        />
      )}
      {workspaceEntryDetails && (
        <WorkspaceEntryDetailsDialog details={workspaceEntryDetails} onClose={() => setWorkspaceEntryDetails(null)} />
      )}
      {printPreview && (
        <PrintPreview
          title={printPreview.title}
          html={printPreview.html}
          actionLabel={printPreview.actionLabel}
          actionHint={printPreview.actionHint}
          paper={printPreview.paper}
          orientation={printPreview.orientation}
          margin={printPreview.margin}
          onPrint={handlePrintPreview}
          onClose={handleClosePrintPreview}
        />
      )}
      {quickOpen && (
        <QuickOpenPalette
          items={quickOpenItems}
          onClose={() => setQuickOpen(false)}
          onOpenFile={(path) => {
            setQuickOpen(false);
            void handleSelectTab(path);
          }}
        />
      )}
      {commandPaletteOpen && (
        <CommandPalette
          commands={commandItems}
          onClose={() => setCommandPaletteOpen(false)}
          onExecute={executeCommand}
        />
      )}
      {draftRecoveryOpen && draftSnapshots.length > 0 && (
        <DraftRecoveryCenter
          snapshots={draftSnapshots}
          onOpen={(path) => void openDraftSnapshot(path)}
          onDiscard={requestDraftDiscardByPath}
          onClearAll={clearAllDrafts}
          onClose={() => setDraftRecoveryOpen(false)}
        />
      )}
      {draftDiscardRequest && (
        <DraftDiscardConfirmationDialog
          path={draftDiscardRequest.path}
          onCancel={cancelDraftDiscard}
          onConfirm={confirmDraftDiscard}
        />
      )}
      {closeConfirmationOpen && <CloseConfirmationDialog onCancel={cancelCloseConfirmation} onConfirm={confirmClose} />}
      {externalOverwriteConfirmationOpen && (
        <ExternalOverwriteDialog onCancel={cancelExternalOverwrite} onConfirm={confirmExternalOverwrite} />
      )}
      {guideOpen && (
        <GettingStartedDialog
          locale={locale}
          onClose={closeGettingStarted}
          onOpenDocument={openDocumentFromGuide}
          onAddWorkspace={addWorkspaceFromGuide}
        />
      )}
    </>,
    document.body,
  );
}
