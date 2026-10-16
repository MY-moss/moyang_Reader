import { isEditableDocument } from "../../features/documents/rendering/document-adapters";
import { isTauriRuntime } from "../../platform/bridge";
import { MAX_MOUNTED_WORKSPACES } from "../../platform/storage";
import { TopBar } from "../../shell/components/TopBar";
import type { ReaderApplication } from "../useReaderApplication";
export function ReaderToolbar({
  model,
  settingsOpen,
  onSettingsClose,
  navigation,
}: {
  navigation?: import("react").ReactNode;
  settingsOpen?: boolean;
  onSettingsClose?: () => void;
  model: Pick<
    ReaderApplication,
    | "preferences"
    | "focusMode"
    | "sidebarCollapsed"
    | "rightPanelOpen"
    | "documentState"
    | "mode"
    | "canEdit"
    | "setExternalChangePath"
    | "searchOpen"
    | "searchQuery"
    | "searchResultCount"
    | "searchResultIndex"
    | "theme"
    | "locale"
    | "setReadingZoom"
    | "setReaderPreferences"
    | "exportPortableSettings"
    | "importPortableSettings"
    | "setGuideOpen"
    | "settingsPersistenceStatus"
    | "openSelectedFile"
    | "handleChooseWorkspace"
    | "workspacePath"
    | "mountedWorkspaces"
    | "setQuickOpen"
    | "draftSnapshots"
    | "setDraftRecoveryOpen"
    | "setSidebarCollapsed"
    | "setFocusMode"
    | "toggleReadingEditing"
    | "toggleDocumentMode"
    | "canUndo"
    | "canRedo"
    | "undoEditor"
    | "redoEditor"
    | "setRightPanelOpen"
    | "setCommandPaletteOpen"
    | "saveDocument"
    | "handleCopy"
    | "copyFeedback"
    | "handleExport"
    | "handlePreviewPrint"
    | "handleExportMarkdown"
    | "handleExportHtml"
    | "handleExportDocx"
    | "setSearchOpen"
    | "updateStatus"
    | "availableUpdate"
    | "setUpdateNoticeVisible"
    | "checkForUpdates"
    | "setSearchQuery"
    | "setSearchResultIndex"
    | "moveSearchResult"
    | "cycleTheme"
    | "setLocale"
  >;
}) {
  const {
    preferences,
    focusMode,
    sidebarCollapsed,
    rightPanelOpen,
    documentState,
    mode,
    canEdit,
    setExternalChangePath,
    searchOpen,
    searchQuery,
    searchResultCount,
    searchResultIndex,
    theme,
    locale,
    setReadingZoom,
    setReaderPreferences,
    exportPortableSettings,
    importPortableSettings,
    setGuideOpen,
    settingsPersistenceStatus,
    openSelectedFile,
    handleChooseWorkspace,
    workspacePath,
    mountedWorkspaces,
    setQuickOpen,
    draftSnapshots,
    setDraftRecoveryOpen,
    setSidebarCollapsed,
    setFocusMode,
    toggleReadingEditing,
    toggleDocumentMode,
    canUndo,
    canRedo,
    undoEditor,
    redoEditor,
    setRightPanelOpen,
    setCommandPaletteOpen,
    saveDocument,
    handleCopy,
    copyFeedback,
    handleExport,
    handlePreviewPrint,
    handleExportMarkdown,
    handleExportHtml,
    handleExportDocx,
    setSearchOpen,
    updateStatus,
    availableUpdate,
    setUpdateNoticeVisible,
    checkForUpdates,
    setSearchQuery,
    setSearchResultIndex,
    moveSearchResult,
    cycleTheme,
    setLocale,
  } = model;
  return (
    <>
      <TopBar
        navigation={navigation}
        settingsOpen={settingsOpen}
        onSettingsClose={onSettingsClose}
        fileName={documentState?.name ?? null}
        mode={mode}
        documentKind={documentState?.kind ?? null}
        canEdit={canEdit}
        modified={documentState?.modified ?? false}
        externallyModified={documentState?.externallyModified ?? false}
        onShowExternalChange={() => {
          if (documentState?.path) setExternalChangePath(documentState.path);
        }}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchResultCount={searchResultCount}
        searchResultIndex={searchResultIndex}
        theme={theme}
        locale={locale}
        readingZoom={preferences.readingZoom}
        readingWidth={preferences.readingWidth}
        readingFont={preferences.readingFont}
        editorFont={preferences.editorFont}
        exportTemplate={preferences.exportTemplate}
        onReadingFontChange={(readingFont) => setReaderPreferences({ readingFont })}
        onEditorFontChange={(editorFont) => setReaderPreferences({ editorFont })}
        onExportTemplateChange={(exportTemplate) => setReaderPreferences({ exportTemplate })}
        exportPaper={preferences.exportPaper}
        exportOrientation={preferences.exportOrientation}
        exportMargin={preferences.exportMargin}
        onReadingZoomChange={setReadingZoom}
        onReadingWidthChange={(width) => setReaderPreferences({ readingWidth: width })}
        onExportPaperChange={(paper) => setReaderPreferences({ exportPaper: paper })}
        onExportOrientationChange={(orientation) => setReaderPreferences({ exportOrientation: orientation })}
        onExportMarginChange={(margin) => setReaderPreferences({ exportMargin: margin })}
        allowRemoteResources={preferences.allowRemoteResources}
        startupUpdateCheck={preferences.startupUpdateCheck}
        onAllowRemoteResourcesChange={(allowed) => setReaderPreferences({ allowRemoteResources: allowed })}
        onStartupUpdateCheckChange={(enabled) => setReaderPreferences({ startupUpdateCheck: enabled })}
        onExportSettings={() => void exportPortableSettings()}
        onImportSettings={importPortableSettings}
        onOpenGuide={() => setGuideOpen(true)}
        settingsPersistenceStatus={settingsPersistenceStatus}
        onOpen={() => void openSelectedFile()}
        onAddWorkspace={() => void handleChooseWorkspace()}
        workspaceOpen={Boolean(workspacePath)}
        workspaceLimitReached={mountedWorkspaces.length >= MAX_MOUNTED_WORKSPACES}
        onQuickOpen={() => setQuickOpen(true)}
        draftCount={draftSnapshots.length}
        onOpenRecovery={() => setDraftRecoveryOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((current) => !current)}
        onToggleMode={toggleReadingEditing}
        onCycleMode={toggleDocumentMode}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undoEditor}
        onRedo={redoEditor}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={() => setRightPanelOpen((current) => !current)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onSave={() => void saveDocument()}
        onCopy={() => void handleCopy()}
        copyFeedback={copyFeedback}
        onExport={() => void handleExport()}
        exportLabel={
          documentState?.kind === "pdf"
            ? "打开 PDF"
            : documentState?.kind === "image"
              ? "打开图片"
              : isTauriRuntime()
                ? "保存 PDF"
                : "打印 / PDF"
        }
        canPreviewPrint={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
        onPreviewPrint={() => void handlePreviewPrint()}
        canExportMarkdown={Boolean(documentState && isEditableDocument(documentState.kind))}
        canExportHtml={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
        canExportDocx={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
        canCopy={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
        onExportMarkdown={() => void handleExportMarkdown()}
        onExportHtml={() => void handleExportHtml()}
        onExportDocx={() => void handleExportDocx()}
        onToggleSearch={() => setSearchOpen((current) => !current)}
        updateStatus={updateStatus}
        updateVersion={availableUpdate?.version ?? null}
        onCheckUpdates={() => {
          if (updateStatus === "downloading") setUpdateNoticeVisible(true);
          else void checkForUpdates(true);
        }}
        onSearchQueryChange={(query) => {
          setSearchQuery(query);
          setSearchResultIndex(0);
        }}
        onSearchPrevious={() => moveSearchResult(-1)}
        onSearchNext={() => moveSearchResult(1)}
        onCloseSearch={() => {
          setSearchOpen(false);
          setSearchQuery("");
        }}
        onCycleTheme={cycleTheme}
        onLocaleChange={setLocale}
      />
    </>
  );
}
