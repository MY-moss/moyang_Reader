import type { Update } from "../platform/updater";
import { useRef, useState } from "react";
import { useDocumentSessions } from "./useDocumentSessions";
import { type ReaderContextTarget } from "../features/reader/components/ReaderContextMenu";
import { DocumentCache } from "../features/reader/document-cache";
import { loadDraftSnapshots, type DraftSnapshot } from "../features/recovery/draft-recovery";
import {
  loadAppSettingsSnapshot,
  type AppSettingsSnapshot,
  type SettingsPersistenceStatus,
} from "../features/settings/app-settings";
import { loadLocale, type Locale } from "../features/settings/i18n";
import { hasSeenGettingStarted } from "../features/settings/onboarding";
import { loadReaderPreferences, type ReaderPreferences } from "../features/settings/preferences";
import { type WorkspaceKindFilter } from "../features/workspace/workspace-filter";
import { isTauriRuntime } from "../platform/bridge";
import {
  loadContextPanelOpen,
  loadContextPanelTab,
  loadMountedWorkspaces,
  loadPaneWidths,
  loadRecentFiles,
  loadRecentWorkspaces,
  loadSidebarCollapsed,
} from "../platform/storage";
import { type UpdateStatus } from "../platform/updater";
import type {
  ContextPanelTab,
  RecentFile,
  RecentWorkspace,
  ThemeMode,
  WorkspaceDirectory,
  WorkspaceEntryDetails,
  WorkspaceExportFailure,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceSearchResult,
} from "../shared/types";
import {
  BrowserDocument,
  CachedWorkspace,
  PdfBatchExportState,
  PendingAppSettingsWrite,
  PrintPreviewState,
  readSavedTheme,
  WorkspaceExportProgress,
} from "./support";

import type { SourceLocation } from "../shared/bookroom-types";
export function useReaderState() {
  const [sourceLocation, setSourceLocation] = useState<SourceLocation | null>(null);
  const [storedAppSettings] = useState<AppSettingsSnapshot | null>(() => loadAppSettingsSnapshot());

  const {
    documentSessions,
    sessionSnapshot,
    documentState,
    setDocumentState,
    mode,
    setMode,
    sourceDraft,
    setSourceDraft,
    editorHistory,
    setEditorHistory,
    documentStateRef,
    sourceDraftRef,
    editorHistoryRef,
  } = useDocumentSessions();

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [searchResultCount, setSearchResultCount] = useState(0);

  const [searchResultIndex, setSearchResultIndex] = useState(0);

  const [theme, setTheme] = useState<ThemeMode>(() => storedAppSettings?.theme ?? readSavedTheme());

  const [locale, setLocale] = useState<Locale>(() => storedAppSettings?.locale ?? loadLocale());

  const [focusMode, setFocusMode] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => storedAppSettings?.sidebarCollapsed ?? loadSidebarCollapsed(),
  );

  const [rightPanelOpen, setRightPanelOpen] = useState(
    () => storedAppSettings?.rightPanelOpen ?? loadContextPanelOpen(),
  );

  const [activeContextTab, setActiveContextTab] = useState<ContextPanelTab>(
    () => storedAppSettings?.activeContextTab ?? loadContextPanelTab(),
  );

  const [paneWidths, setPaneWidths] = useState(() => storedAppSettings?.paneWidths ?? loadPaneWidths());

  const [preferences, setPreferences] = useState<ReaderPreferences>(
    () => storedAppSettings?.preferences ?? loadReaderPreferences(),
  );

  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);

  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceDirectory[]>([]);

  const [workspaceIndex, setWorkspaceIndex] = useState<WorkspaceIndexEntry[]>([]);

  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(loadRecentFiles);

  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);

  const [mountedWorkspaces, setMountedWorkspaces] = useState<RecentWorkspace[]>(loadMountedWorkspaces);

  const [workspaceQuery, setWorkspaceQuery] = useState("");

  const [workspaceResults, setWorkspaceResults] = useState<WorkspaceSearchResult[]>([]);

  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false);

  const [workspaceExporting, setWorkspaceExporting] = useState(false);

  const [workspaceExportProgress, setWorkspaceExportProgress] = useState<WorkspaceExportProgress | null>(null);

  const [workspaceExportFailures, setWorkspaceExportFailures] = useState<WorkspaceExportFailure[]>([]);

  const [workspaceExportNotice, setWorkspaceExportNotice] = useState<string | null>(null);

  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  const [settingsPersistenceStatus, setSettingsPersistenceStatus] = useState<SettingsPersistenceStatus>("idle");

  const [nativeSettingsReady, setNativeSettingsReady] = useState(() => !isTauriRuntime());

  const [guideOpen, setGuideOpen] = useState(() => isTauriRuntime() && !hasSeenGettingStarted());

  const [copyFeedback, setCopyFeedback] = useState(false);

  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");

  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);

  const [updateProgress, setUpdateProgress] = useState<number | null>(null);

  const [updateError, setUpdateError] = useState<string | null>(null);

  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);

  const updateRef = useRef<Update | null>(null);

  const updateCheckInFlightRef = useRef(false);

  const initialStartupUpdateCheckRef = useRef(preferences.startupUpdateCheck);

  const workspaceExportAbortRef = useRef<AbortController | null>(null);

  const pdfBatchExportRef = useRef<PdfBatchExportState | null>(null);

  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [workspaceIndexLoading, setWorkspaceIndexLoading] = useState(false);

  const [workspaceRevision, setWorkspaceRevision] = useState(0);

  const [workspaceWatchError, setWorkspaceWatchError] = useState<string | null>(null);

  const [externalChangePath, setExternalChangePath] = useState<string | null>(null);

  const [externalOverwriteConfirmationOpen, setExternalOverwriteConfirmationOpen] = useState(false);

  const [draftRecovery, setDraftRecovery] = useState<DraftSnapshot | null>(null);

  const [draftSnapshots, setDraftSnapshots] = useState<DraftSnapshot[]>(loadDraftSnapshots);

  const [draftRecoveryOpen, setDraftRecoveryOpen] = useState(false);

  const [draftDiscardRequest, setDraftDiscardRequest] = useState<{ path: string; fromCenter: boolean } | null>(null);

  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [selectedFileKind, setSelectedFileKind] = useState<WorkspaceKindFilter>("all");

  const [graphOpen, setGraphOpen] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [workspaceEntryDetails, setWorkspaceEntryDetails] = useState<WorkspaceEntryDetails | null>(null);

  const [readerContextMenu, setReaderContextMenu] = useState<ReaderContextTarget | null>(null);

  const [printPreview, setPrintPreview] = useState<PrintPreviewState | null>(null);

  const [readingProgress, setReadingProgress] = useState(0);

  const [currentHeading, setCurrentHeading] = useState<string | null>(null);

  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);

  const [openTabs, setOpenTabs] = useState<RecentFile[]>([]);

  const [readingZoomNotice, setReadingZoomNotice] = useState<number | null>(null);

  const [tabSessionReady, setTabSessionReady] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const contentAreaRef = useRef<HTMLElement>(null);

  const articleRef = useRef<HTMLElement>(null);

  const readingPositionRef = useRef<{ path: string; top: number } | null>(null);

  const browserDocumentsRef = useRef(new Map<string, BrowserDocument>());

  const browserDocumentSequenceRef = useRef(0);

  const previewUrlsRef = useRef(new Map<string, string>());

  const closeConfirmationOpenRef = useRef(false);

  const preferencesRef = useRef<ReaderPreferences>(preferences);

  const workspacePathRef = useRef<string | null>(workspacePath);

  const openTabsRef = useRef<RecentFile[]>(openTabs);

  const readingZoomNoticeTimerRef = useRef<number | null>(null);

  const workspaceRestorePendingRef = useRef(false);

  const mountedWorkspaceCacheRef = useRef(new Map<string, CachedWorkspace>());

  const documentCacheRef = useRef(new DocumentCache());

  const pendingWorkspaceMountsRef = useRef(new Set<string>());

  const workspaceLoadRequestRef = useRef(0);

  const workspaceRefreshRequestRef = useRef(0);

  const workspaceReloadTimerRef = useRef<number | null>(null);

  const pendingWorkspacePathsRef = useRef(new Set<string>());

  const selfWritingPathsRef = useRef(new Set<string>());

  const selfWrittenPathsRef = useRef(new Map<string, number>());

  const sourceRenderRequestRef = useRef(0);

  const pendingHeadingRef = useRef<string | null>(null);

  const nativeSettingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  const pendingAppSettingsWriteRef = useRef<PendingAppSettingsWrite | null>(null);

  const appSettingsFlushTimerRef = useRef<number | null>(null);

  const lastNativeSettingsWriteRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const settingsWriteRevisionRef = useRef(0);

  const settingsCloseInFlightRef = useRef(false);
  return {
    sourceLocation,
    setSourceLocation,
    documentSessions,
    sessionSnapshot,
    storedAppSettings,
    documentState,
    setDocumentState,
    mode,
    setMode,
    sourceDraft,
    setSourceDraft,
    editorHistory,
    setEditorHistory,
    loading,
    setLoading,
    error,
    setError,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    setDebouncedSearchQuery,
    searchResultCount,
    setSearchResultCount,
    searchResultIndex,
    setSearchResultIndex,
    theme,
    setTheme,
    locale,
    setLocale,
    focusMode,
    setFocusMode,
    sidebarCollapsed,
    setSidebarCollapsed,
    rightPanelOpen,
    setRightPanelOpen,
    activeContextTab,
    setActiveContextTab,
    paneWidths,
    setPaneWidths,
    preferences,
    setPreferences,
    workspacePath,
    setWorkspacePath,
    workspaceFiles,
    setWorkspaceFiles,
    workspaceFolders,
    setWorkspaceFolders,
    workspaceIndex,
    setWorkspaceIndex,
    recentFiles,
    setRecentFiles,
    recentWorkspaces,
    setRecentWorkspaces,
    mountedWorkspaces,
    setMountedWorkspaces,
    workspaceQuery,
    setWorkspaceQuery,
    workspaceResults,
    setWorkspaceResults,
    workspaceSearchLoading,
    setWorkspaceSearchLoading,
    workspaceExporting,
    setWorkspaceExporting,
    workspaceExportProgress,
    setWorkspaceExportProgress,
    workspaceExportFailures,
    setWorkspaceExportFailures,
    workspaceExportNotice,
    setWorkspaceExportNotice,
    settingsNotice,
    setSettingsNotice,
    settingsPersistenceStatus,
    setSettingsPersistenceStatus,
    nativeSettingsReady,
    setNativeSettingsReady,
    guideOpen,
    setGuideOpen,
    copyFeedback,
    setCopyFeedback,
    currentVersion,
    setCurrentVersion,
    updateStatus,
    setUpdateStatus,
    availableUpdate,
    setAvailableUpdate,
    updateProgress,
    setUpdateProgress,
    updateError,
    setUpdateError,
    updateNoticeVisible,
    setUpdateNoticeVisible,
    updateRef,
    updateCheckInFlightRef,
    initialStartupUpdateCheckRef,
    workspaceExportAbortRef,
    pdfBatchExportRef,
    workspaceLoading,
    setWorkspaceLoading,
    workspaceIndexLoading,
    setWorkspaceIndexLoading,
    workspaceRevision,
    setWorkspaceRevision,
    workspaceWatchError,
    setWorkspaceWatchError,
    externalChangePath,
    setExternalChangePath,
    externalOverwriteConfirmationOpen,
    setExternalOverwriteConfirmationOpen,
    draftRecovery,
    setDraftRecovery,
    draftSnapshots,
    setDraftSnapshots,
    draftRecoveryOpen,
    setDraftRecoveryOpen,
    draftDiscardRequest,
    setDraftDiscardRequest,
    closeConfirmationOpen,
    setCloseConfirmationOpen,
    selectedTag,
    setSelectedTag,
    selectedFileKind,
    setSelectedFileKind,
    graphOpen,
    setGraphOpen,
    quickOpen,
    setQuickOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    workspaceEntryDetails,
    setWorkspaceEntryDetails,
    readerContextMenu,
    setReaderContextMenu,
    printPreview,
    setPrintPreview,
    readingProgress,
    setReadingProgress,
    currentHeading,
    setCurrentHeading,
    currentHeadingId,
    setCurrentHeadingId,
    openTabs,
    setOpenTabs,
    readingZoomNotice,
    setReadingZoomNotice,
    tabSessionReady,
    setTabSessionReady,
    inputRef,
    contentAreaRef,
    articleRef,
    readingPositionRef,
    browserDocumentsRef,
    browserDocumentSequenceRef,
    previewUrlsRef,
    documentStateRef,
    closeConfirmationOpenRef,
    sourceDraftRef,
    editorHistoryRef,
    preferencesRef,
    workspacePathRef,
    openTabsRef,
    readingZoomNoticeTimerRef,
    workspaceRestorePendingRef,
    mountedWorkspaceCacheRef,
    documentCacheRef,
    pendingWorkspaceMountsRef,
    workspaceLoadRequestRef,
    workspaceRefreshRequestRef,
    workspaceReloadTimerRef,
    pendingWorkspacePathsRef,
    selfWritingPathsRef,
    selfWrittenPathsRef,
    sourceRenderRequestRef,
    pendingHeadingRef,
    nativeSettingsWriteQueueRef,
    pendingAppSettingsWriteRef,
    appSettingsFlushTimerRef,
    lastNativeSettingsWriteRef,
    settingsWriteRevisionRef,
    settingsCloseInFlightRef,
  };
}
