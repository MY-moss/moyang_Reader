import { Tabs } from "../../shell/components/Tabs";
import { UpdateNotice } from "../../shell/components/UpdateNotice";
import type { ReaderApplication } from "../useReaderApplication";
export function ReaderNavigation({
  model,
}: {
  model: Pick<
    ReaderApplication,
    | "documentState"
    | "setExternalChangePath"
    | "updateStatus"
    | "availableUpdate"
    | "setUpdateNoticeVisible"
    | "settingsNotice"
    | "updateNoticeVisible"
    | "updateProgress"
    | "updateError"
    | "installUpdate"
    | "relaunchUpdatedApp"
    | "dismissUpdateNotice"
    | "openTabs"
    | "handleSelectTab"
    | "handleCloseTab"
    | "handleCloseTabs"
    | "handleReorderTabs"
    | "error"
  >;
}) {
  const {
    documentState,
    setExternalChangePath,
    updateStatus,
    availableUpdate,
    setUpdateNoticeVisible,
    settingsNotice,
    updateNoticeVisible,
    updateProgress,
    updateError,
    installUpdate,
    relaunchUpdatedApp,
    dismissUpdateNotice,
    openTabs,
    handleSelectTab,
    handleCloseTab,
    handleCloseTabs,
    handleReorderTabs,
  } = model;
  return (
    <>
      <div className="navigation-strip">
        {settingsNotice && (
          <div className="settings-notice" role="status">
            {settingsNotice}
          </div>
        )}
        {updateNoticeVisible && updateStatus !== "idle" && updateStatus !== "checking" && (
          <UpdateNotice
            status={updateStatus}
            version={availableUpdate?.version ?? null}
            notes={availableUpdate?.body?.trim() || null}
            progress={updateProgress}
            error={updateError}
            onInstall={() => void installUpdate()}
            onRelaunch={() => void relaunchUpdatedApp()}
            onHide={() => setUpdateNoticeVisible(false)}
            onDismiss={dismissUpdateNotice}
          />
        )}
        <Tabs
          tabs={openTabs}
          activePath={documentState?.path ?? null}
          externallyModified={documentState?.externallyModified ?? false}
          onShowExternalChange={() => {
            if (documentState?.path) setExternalChangePath(documentState.path);
          }}
          onSelect={(path) => void handleSelectTab(path)}
          onClose={(path) => void handleCloseTab(path)}
          onCloseMany={(paths) => void handleCloseTabs(paths)}
          onReorder={handleReorderTabs}
        />
      </div>
    </>
  );
}
