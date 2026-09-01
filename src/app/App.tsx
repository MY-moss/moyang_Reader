import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { EmptyState } from "./components/EmptyState";
import { CommandPalette, type ReaderCommand } from "./components/CommandPalette";
import { CloseConfirmationDialog } from "./components/CloseConfirmationDialog";
import { ContextPanel } from "./components/ContextPanel";
import { AnnotationDialog } from "./components/AnnotationDialog";
import { FileDropOverlay } from "./components/FileDropOverlay";
import { DraftRecoveryNotice } from "./components/DraftRecoveryNotice";
import { DraftRecoveryCenter } from "./components/DraftRecoveryCenter";
import {
  DraftRecoveryComparisonDialog,
  type RecoveryKind,
  type RecoverySnapshot,
} from "./components/DraftRecoveryComparisonDialog";
import { PreviousVersionNotice } from "./components/PreviousVersionNotice";
import { DraftDiscardConfirmationDialog } from "./components/DraftDiscardConfirmationDialog";
import { ExternalChangeNotice } from "./components/ExternalChangeNotice";
import { ExternalOverwriteDialog } from "./components/ExternalOverwriteDialog";
import { GettingStartedDialog } from "./components/GettingStartedDialog";
import { ImagePreview } from "./components/ImagePreview";
import { PdfPreview } from "./components/PdfPreview";
import { PaneResizeHandle } from "./components/PaneResizeHandle";
import { PrintPreview } from "./components/PrintPreview";
import { ProgressiveReaderContent, type ProgressiveReaderContentHandle } from "./components/ProgressiveReaderContent";
import { QuickOpenPalette } from "./components/QuickOpenPalette";
import { ReaderContextMenu, type ReaderContextTarget } from "./components/ReaderContextMenu";
import { RelationGraph } from "./components/RelationGraph";
import { SourceEditor, type SourceEditorPasteContext } from "./components/SourceEditor";
import { Tabs } from "./components/Tabs";
import { TopBar } from "./components/TopBar";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { WorkspaceEntryDetailsDialog } from "./components/WorkspaceEntryDetailsDialog";
import { UpdateNotice } from "./components/UpdateNotice";
import { NotificationViewport } from "./components/NotificationViewport";
import { scheduleSourceRender } from "./source-render-scheduler";
import { createReadingPositionTracker } from "./reading-position";
import { readingHeadingFromElement, readingProgressPercent, type ReadingHeading } from "./reading-rail";
import { createSearchHighlightController, type SearchHighlightController } from "./search-highlighter";
import {
  createAnnotationHighlightController,
  type AnnotationHighlightController,
  type AnnotationLocation,
} from "./annotation-highlighter";
import {
  chooseDocumentPaths,
  chooseSavePath,
  chooseWorkspacePath,
  authorizeStoredPath,
  commitBinaryFile,
  closeWindow,
  createMarkdownFile,
  createWorkspaceFolder,
  createWorkspaceNote,
  duplicateWorkspaceEntry,
  copyWorkspaceEntry,
  moveWorkspaceEntry,
  exportPdfFile,
  fileExists,
  fileSize,
  fileMetadata,
  indexWorkspace,
  initialPaths,
  isTauriRuntime,
  listWorkspaceEntries,
  openExternalUrl,
  renameWorkspaceEntry,
  deleteWorkspaceEntry,
  discardBinaryFile,
  revealWorkspaceEntry,
  readBinaryFile,
  readAppSettings,
  readAnnotations,
  readPreviousVersion,
  readTextFile,
  refreshWorkspace,
  resolveOpenPaths,
  searchWorkspace,
  subscribeToFileDrop,
  subscribeToWorkspaceChanges,
  subscribeToCloseRequest,
  subscribeToOpenPaths,
  writeBinaryFile,
  writeBinaryFileChunk,
  writeAppSettings,
  writeAnnotations,
  writeTextFile,
  type FileDropEvent,
} from "./bridge";
import type { Update } from "@tauri-apps/plugin-updater";
import {
  checkForAppUpdate,
  describeUpdateError,
  getCurrentAppVersion,
  installAppUpdate,
  relaunchApp,
  type UpdateStatus,
} from "./updater";
import {
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
} from "./update-recovery";
import type {
  DocumentKind,
  ContextPanelTab,
  ExportMargin,
  ExportOrientation,
  ExportPaper,
  FileStamp,
  OpenPath,
  OpenDocument,
  ReaderMode,
  RecentFile,
  RecentWorkspace,
  ThemeMode,
  TocItem,
  WorkspaceExportFailure,
  WorkspaceDirectory,
  WorkspaceEntryDetails,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceListingStatus,
  WorkspaceSearchResult,
} from "./types";
import { DocumentCache } from "./document-cache";
import {
  appendNotification,
  removeNotification,
  type AppNotification,
  type NotificationLevel,
} from "./notification-queue";
import { nextReaderModeAfterOpen } from "./reader-mode";
import {
  READING_ZOOM_DEFAULT,
  READING_ZOOM_STEP,
  normalizeReadingZoom,
  readingScaleFromZoom,
  stepReadingZoom,
} from "./reading-zoom";
import { reorderTabs } from "./tab-order";
import { checkMarkdownEditorSafety } from "./markdown-editor-support";
import { shouldUseProgressiveReader } from "./progressive-render";
import { buildWikiLinkCandidates } from "./wiki-link-completion";
import {
  BATCH_EXPORT_CHUNK_SIZE,
  BATCH_EXPORT_MAX_ESTIMATED_BYTES,
  buildBatchHtmlExport,
  buildBatchHtmlExportAsync,
  buildDocxExport,
  buildHtmlExport,
  copyRichText,
  estimateBatchExportDocumentBytes,
  formatExportFailureReport,
  formatExportCancellationNotice,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExportTempSuffix,
  pathWithExtension,
  pathWithNameSuffix,
  printHtmlDocument,
  summarizeExportFailures,
  shouldFlushBatchExport,
  yieldToExportScheduler,
} from "./export";
import { streamDocxExportWithWorker } from "./docx-export-worker-client";
import {
  loadRecentFiles,
  MAX_MOUNTED_WORKSPACES,
  loadMountedWorkspaces,
  loadRecentWorkspaces,
  loadWorkspaceSessions,
  loadLastDocumentPath,
  loadOpenTabs,
  loadReadingPosition,
  loadSidebarCollapsed,
  loadContextPanelOpen,
  loadContextPanelTab,
  loadPaneWidths,
  loadWorkspacePath,
  rememberRecentFile,
  rememberMountedWorkspace,
  rememberRecentWorkspace,
  saveRecentFiles,
  saveLastDocumentPath,
  saveOpenTabs,
  saveReadingPosition,
  saveSidebarCollapsed,
  saveContextPanelOpen,
  saveContextPanelTab,
  savePaneWidths,
  saveMountedWorkspaces,
  saveWorkspaceSession,
  saveWorkspaceSessions,
  forgetWorkspaceSession,
  saveWorkspacePath,
} from "./storage";
import { isPathWithinEntry, rebaseWorkspacePath, workspaceEntryAbsolutePath } from "./workspace-entry";
import { loadReaderPreferences, saveReaderPreferences, type ReaderPreferences } from "./preferences";
import { createPortableSettingsBundle, parsePortableSettings, serializePortableSettings } from "./portable-settings";
import { loadLocale, saveLocale, type Locale } from "./i18n";
import {
  addAnnotation,
  createAnnotation,
  createSelectionAnchor,
  normalizeAnnotations,
  removeAnnotation,
  workspaceRelativePath,
  type AnnotationSelection,
  type TextAnnotation,
} from "./annotations";
import {
  createAppSettingsSnapshot,
  loadAppSettingsSnapshot,
  parseAppSettings,
  saveAppSettingsSnapshot,
  serializeAppSettings,
  type AppSettingsSnapshot,
  type SettingsPersistenceStatus,
} from "./app-settings";
import { hasSeenGettingStarted, markGettingStartedSeen } from "./onboarding";
import {
  documentKindFromPath,
  emptyRenderedDocument,
  imageMimeType,
  isEditableDocument,
  renderDocx,
  renderSource,
} from "../lib/document-adapters";
import {
  createBacklinkIndex,
  createLinkIndex,
  findBacklinks,
  findIndexEntry,
  findLinkedEntry,
} from "./workspace-index";
import type { QuickOpenCandidate } from "./quick-open";
import {
  applyWorkspaceFileDelta,
  applyWorkspaceFolderDelta,
  applyWorkspaceIndexDelta,
  isCurrentWorkspaceLoad,
  workspaceFilesMatch,
  workspaceFoldersMatch,
} from "./workspace-refresh";
import { resolveExternalChangeAction } from "./external-change";
import { normalizePathKey } from "./path-key";
import {
  addBookmark,
  createBookmark,
  hasBookmark,
  loadBookmarks,
  removeBookmark,
  saveBookmarks,
  type DocumentBookmark,
} from "./bookmarks";
import { clampPaneWidth, DEFAULT_PANE_WIDTHS, PANE_WIDTH_LIMITS, type PaneSide } from "./pane-layout";
import type { PaneWidths } from "./pane-layout";
import { scrollHeadingInContainer } from "./heading-navigation";
import { resolveProgrammaticScrollBehavior } from "./scroll-behavior";
import { matchesWorkspaceFilter, type WorkspaceKindFilter } from "./workspace-filter";
import {
  formatTransitionConfirmation,
  isSameDocumentPath,
  shouldConfirmDocumentReplacement,
  shouldConfirmWorkspaceSwitch,
} from "./document-transition";
import {
  clipboardAssetFileName,
  clipboardAssetPath,
  clipboardAssetReference,
  clipboardImageToPng,
  findClipboardImage,
  insertTextAtSelection,
  MAX_CLIPBOARD_IMAGE_BYTES,
} from "./clipboard-image";
import {
  clearAllDraftSnapshots,
  clearDraftSnapshot,
  getDraftSnapshotState,
  loadDraftSnapshots,
  saveDraftSnapshot,
  type DraftSnapshot,
  type DraftSaveResult,
} from "./draft-recovery";
import { areDraftSourcesEquivalent } from "./draft-recovery-diff";
import {
  canRedoEditorChange,
  canUndoEditorChange,
  createEditorHistory,
  redoEditorChange,
  recordEditorChange,
  undoEditorChange,
  type EditorHistoryState,
} from "./editor-history";
import { captureEditorViewport, restoreEditorViewport } from "./editor-history-viewport";
import {
  canGoBack,
  createNavigationHistory,
  getBackNavigationPath,
  goBack,
  goForward,
  pushNavigationPath,
  replaceNavigationPath,
  type NavigationHistoryState,
} from "./navigation-history";
import type { EditorInsertKind } from "./editor-insertion";
import {
  classifyFileDropPaths,
  hasFileDragPayload,
  idleFileDropState,
  type FileDropSource,
  type FileDropState,
} from "./file-drop";

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function duplicateEntryName(path: string, kind: "file" | "folder"): string {
  const name = fileNameFromPath(path);
  if (kind === "folder") return `${name} 副本`;
  const extensionIndex = name.lastIndexOf(".");
  if (extensionIndex > 0) return `${name.slice(0, extensionIndex)} 副本${name.slice(extensionIndex)}`;
  return `${name} 副本`;
}

function focusEditorSurface(surface: Element | null): void {
  if (!surface) return;
  const target = surface.matches('textarea, [contenteditable="true"], .cm-content')
    ? surface
    : surface.querySelector<HTMLElement>('.cm-content, [contenteditable="true"], textarea');
  if (target instanceof HTMLElement) target.focus();
}

async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("当前环境不支持访问剪贴板。");
  } finally {
    textarea.remove();
  }
}

const LazyMarkdownWysiwygEditor = lazy(() =>
  import("./components/MarkdownWysiwygEditor").then(({ MarkdownWysiwygEditor }) => ({
    default: MarkdownWysiwygEditor,
  })),
);

function fileTypeLabel(kind: DocumentKind): string {
  return kind === "markdown" ? "MD" : kind === "image" ? "IMG" : kind.toUpperCase();
}

function startsWithHeading(html: string): boolean {
  return /^\s*<h1(?:\s[^>]*)?>/i.test(html);
}

function comparablePath(path: string): string {
  return normalizePathKey(path);
}

function pathBelongsToWorkspace(path: string, workspacePath: string): boolean {
  const candidate = comparablePath(path);
  const root = comparablePath(workspacePath);
  return candidate === root || candidate.startsWith(`${root}\\`);
}

function resolveRelativePath(basePath: string, target: string): string | null {
  if (basePath.startsWith("browser://")) return null;

  const cleanTarget = target.split(/[?#]/, 1)[0].trim();
  if (!cleanTarget) return null;

  const normalizedTarget = cleanTarget.replace(/[\\/]+/g, "\\");
  const isAbsolute = /^[A-Za-z]:\\/.test(normalizedTarget) || normalizedTarget.startsWith("\\\\");
  const baseDirectory = basePath.replace(/[\\/][^\\/]*$/, "");
  return isAbsolute ? normalizedTarget : `${baseDirectory}\\${normalizedTarget}`;
}

function resolveWikiPath(basePath: string, target: string): string | null {
  const resolved = resolveRelativePath(basePath, target);
  if (!resolved) return null;

  return /\.[A-Za-z0-9]+$/.test(resolved) ? resolved : `${resolved}.md`;
}

function scrollToHeading(
  anchor: string,
  contentArea: HTMLElement | null,
  article: HTMLElement | null,
  onMissing?: () => void,
): void {
  let attempts = 0;
  let requestedReveal = false;
  const attempt = () => {
    if (scrollHeadingInContainer(anchor, contentArea, article)) return;
    if (!requestedReveal) {
      requestedReveal = true;
      onMissing?.();
    }
    if (attempts >= 30) return;
    attempts += 1;
    window.requestAnimationFrame(attempt);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(attempt);
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function currentHeadingFromElements(headings: HTMLElement[], contentArea: HTMLElement | null): ReadingHeading | null {
  if (headings.length === 0) return null;

  const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
  const isAtBottom = Boolean(contentArea && contentArea.scrollTop >= maxScrollTop - 2);
  let currentHeading: HTMLElement | undefined;
  if (isAtBottom) {
    currentHeading = headings[headings.length - 1];
  } else {
    const threshold = (contentArea?.getBoundingClientRect().top ?? 0) + 72;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= threshold) currentHeading = heading;
      else break;
    }
  }

  return readingHeadingFromElement(currentHeading ?? headings[0]);
}

function readSavedTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem("moyang-reader-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
  }
}

function downloadText(name: string, contents: string, mimeType = "text/markdown"): void {
  const blob = new Blob([contents], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBytes(name: string, contents: Uint8Array, mimeType: string): void {
  const buffer = contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

type BrowserDocument = {
  kind: DocumentKind;
  source?: string;
  bytes?: Uint8Array;
  previewUrl?: string;
};

type PrintPreviewState = {
  title: string;
  html: string;
  defaultPath?: string;
  actionLabel?: string;
  actionHint?: string;
  paper: ExportPaper;
  orientation: ExportOrientation;
  margin: ExportMargin;
};

type WorkspaceExportProgress = {
  current: number;
  total: number;
  fileName: string;
};

type PdfBatchExportState = {
  files: WorkspaceFile[];
  nextIndex: number;
  volumeNumber: number;
  exported: number;
  skippedFiles: WorkspaceExportFailure[];
  title: string;
  options: {
    paper: ExportPaper;
    orientation: ExportOrientation;
    margin: ExportMargin;
  };
};

type CachedWorkspace = {
  path: string;
  name: string;
  files: WorkspaceFile[];
  folders: WorkspaceDirectory[];
  index: WorkspaceIndexEntry[];
  listingStatus: WorkspaceListingStatus;
  indexReady: boolean;
  revision: number;
  selectedTag: string | null;
  selectedFileKind: WorkspaceKindFilter;
  searchQuery: string;
  tabs: RecentFile[];
  activeDocumentPath: string | null;
};

type DraftFlushOutcome = "not-needed" | "saved" | "unavailable" | "failed";

type DraftComparisonRequest = {
  snapshot: RecoverySnapshot;
  comparisonSource: string | null;
  comparisonLabel: string;
  comparisonIsCurrent: boolean;
  comparisonStatus: "loading" | "ready" | "unavailable";
  comparisonError: string | null;
  currentDocumentModified: boolean;
  isCurrentDocument: boolean;
  sourceChangedSinceDraft: boolean;
  recoveryKind: RecoveryKind;
};

type OpenPathsOutcome = {
  openedCount: number;
  failedCount: number;
  duplicateCount: number;
  cancelled: boolean;
};

type DocumentOpenNavigation = "sync" | "push" | "back" | "forward";

type PendingAppSettingsWrite = {
  snapshot: AppSettingsSnapshot;
  localSaved: boolean;
};

function updateCachedWorkspace(
  cache: Map<string, CachedWorkspace>,
  root: string,
  changes: Partial<Omit<CachedWorkspace, "path">>,
): void {
  const key = comparablePath(root);
  const current = cache.get(key);
  if (!current) return;
  cache.set(key, { ...current, ...changes });
}

function persistCachedWorkspaceSession(cache: Map<string, CachedWorkspace>, root: string): void {
  const cached = cache.get(comparablePath(root));
  if (!cached) return;
  saveWorkspaceSession({
    path: cached.path,
    tabs: cached.tabs,
    activeDocumentPath: cached.activeDocumentPath,
  });
}

function pruneWorkspaceCache(cache: Map<string, CachedWorkspace>, mounted: RecentWorkspace[]): void {
  const mountedKeys = new Set(mounted.map((workspace) => comparablePath(workspace.path)));
  for (const key of cache.keys()) {
    if (!mountedKeys.has(key)) cache.delete(key);
  }
}

function isContextMenuKeyboardEvent(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

function headingIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof HTMLElement)) return null;
  return target.closest<HTMLElement>("h1, h2, h3, h4, h5, h6")?.id ?? null;
}

export function App() {
  const [storedAppSettings] = useState<AppSettingsSnapshot | null>(() => loadAppSettingsSnapshot());
  const [documentState, setDocumentState] = useState<OpenDocument | null>(null);
  const [progressiveReaderReadyHtml, setProgressiveReaderReadyHtml] = useState<string | null>(null);
  const [mode, setMode] = useState<ReaderMode>("rendered");
  const [sourceDraft, setSourceDraft] = useState("");
  const [editorHistory, setEditorHistory] = useState<EditorHistoryState>(() => createEditorHistory("", ""));
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
  const [workspaceListingStatus, setWorkspaceListingStatus] = useState<WorkspaceListingStatus>({
    truncated: false,
    scannedTotal: 0,
  });
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [fileDropState, setFileDropState] = useState<FileDropState>(idleFileDropState);
  const [requestedInsertKind, setRequestedInsertKind] = useState<EditorInsertKind | null>(null);
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
  const [previousVersion, setPreviousVersion] = useState<{ path: string; source: string } | null>(null);
  const [draftComparison, setDraftComparison] = useState<DraftComparisonRequest | null>(null);
  const [draftDiscardRequest, setDraftDiscardRequest] = useState<{ path: string; fromCenter: boolean } | null>(null);
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFileKind, setSelectedFileKind] = useState<WorkspaceKindFilter>("all");
  const [graphOpen, setGraphOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [workspaceEntryDetails, setWorkspaceEntryDetails] = useState<WorkspaceEntryDetails | null>(null);
  const [readerContextMenu, setReaderContextMenu] = useState<ReaderContextTarget | null>(null);
  const [bookmarks, setBookmarks] = useState<DocumentBookmark[]>(loadBookmarks);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [annotationDialog, setAnnotationDialog] = useState<{
    relativePath: string;
    selection: AnnotationSelection;
  } | null>(null);
  const [annotationLocations, setAnnotationLocations] = useState<AnnotationLocation[]>([]);
  const [printPreview, setPrintPreview] = useState<PrintPreviewState | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentHeading, setCurrentHeading] = useState<string | null>(null);
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<RecentFile[]>([]);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryState>(() => createNavigationHistory());
  const [readingZoomNotice, setReadingZoomNotice] = useState<number | null>(null);
  const [tabSessionReady, setTabSessionReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const appShellRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const progressiveReaderRef = useRef<ProgressiveReaderContentHandle>(null);
  const searchHighlightRef = useRef<{
    root: HTMLElement;
    contentKey: string;
    controller: SearchHighlightController;
  } | null>(null);
  const annotationHighlightRef = useRef<{
    root: HTMLElement;
    contentKey: string;
    controller: AnnotationHighlightController;
  } | null>(null);
  const readerBodyRef = useRef<HTMLDivElement>(null);
  const pendingAnnotationIdRef = useRef<string | null>(null);
  const readingHeadingsRef = useRef<HTMLElement[]>([]);
  const readingHeadingObserverRef = useRef<IntersectionObserver | null>(null);
  const readingHeadingCandidatesRef = useRef(new Set<HTMLElement>());
  const readingPositionRef = useRef<{ path: string; top: number } | null>(null);
  const browserDocumentsRef = useRef(new Map<string, BrowserDocument>());
  const browserDocumentSequenceRef = useRef(0);
  const previewUrlsRef = useRef(new Map<string, string>());
  const documentStateRef = useRef<OpenDocument | null>(null);
  const navigationHistoryRef = useRef<NavigationHistoryState>(navigationHistory);
  const closeConfirmationOpenRef = useRef(false);
  const sourceDraftRef = useRef(sourceDraft);
  const editorHistoryRef = useRef(editorHistory);
  const preferencesRef = useRef<ReaderPreferences>(preferences);
  const paneWidthsRef = useRef<PaneWidths>(paneWidths);
  const workspacePathRef = useRef<string | null>(workspacePath);
  const openTabsRef = useRef<RecentFile[]>(openTabs);
  const readingZoomNoticeTimerRef = useRef<number | null>(null);
  const workspaceRestorePendingRef = useRef(false);
  const mountedWorkspaceCacheRef = useRef(new Map<string, CachedWorkspace>());
  const documentCacheRef = useRef(new DocumentCache());
  const pendingWorkspaceMountsRef = useRef(new Set<string>());
  const workspaceLoadRequestRef = useRef(0);
  const workspaceRefreshQueueRef = useRef<Promise<void>>(Promise.resolve());
  const workspaceReloadTimerRef = useRef<number | null>(null);
  const notificationSequenceRef = useRef(0);
  const pendingWorkspacePathsRef = useRef(new Set<string>());
  const selfWritingPathsRef = useRef(new Set<string>());
  const fileDropStateRef = useRef<FileDropState>(idleFileDropState);
  const fileDropDepthRef = useRef(0);
  const browserDropProcessingRef = useRef(false);
  const selfWrittenPathsRef = useRef(new Map<string, number>());
  const sourceRenderRequestRef = useRef(0);
  const pendingHeadingRef = useRef<string | null>(null);
  const nativeSettingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingAppSettingsWriteRef = useRef<PendingAppSettingsWrite | null>(null);
  const appSettingsFlushTimerRef = useRef<number | null>(null);
  const lastNativeSettingsWriteRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const settingsWriteRevisionRef = useRef(0);
  const settingsCloseInFlightRef = useRef(false);
  const draftComparisonRequestIdRef = useRef(0);
  const previousVersionRequestIdRef = useRef(0);
  const linkIndex = useMemo(() => createLinkIndex(workspaceIndex), [workspaceIndex]);
  const renderedHtml = documentState?.rendered.html ?? "";
  const progressiveReaderReady =
    !shouldUseProgressiveReader(renderedHtml) || progressiveReaderReadyHtml === renderedHtml;

  const notify = useCallback((message: string, level: NotificationLevel = "success") => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    const notification: AppNotification = {
      id: ++notificationSequenceRef.current,
      level,
      message: trimmedMessage,
    };
    setNotifications((current) => appendNotification(current, notification));
  }, []);

  const updateFileDropState = useCallback((source: FileDropSource, support: FileDropState["support"]) => {
    const next: FileDropState = { active: true, source, support };
    const current = fileDropStateRef.current;
    if (current.active && current.source === next.source && current.support === next.support) return;
    fileDropStateRef.current = next;
    setFileDropState(next);
  }, []);

  const resetFileDropState = useCallback(() => {
    fileDropDepthRef.current = 0;
    const current = fileDropStateRef.current;
    if (!current.active) return;
    fileDropStateRef.current = idleFileDropState;
    setFileDropState(idleFileDropState);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((current) => removeNotification(current, id));
  }, []);

  const setReadingHeading = useCallback((heading: ReadingHeading | null) => {
    const nextHeading = heading?.text ?? null;
    const nextHeadingId = heading?.id || null;
    setCurrentHeading((current) => (current === nextHeading ? current : nextHeading));
    setCurrentHeadingId((current) => (current === nextHeadingId ? current : nextHeadingId));
  }, []);

  const updateReadingRail = useCallback(() => {
    const contentArea = contentAreaRef.current;
    const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
    const nextProgress =
      maxScrollTop > 0 && contentArea ? Math.min(1, Math.max(0, contentArea.scrollTop / maxScrollTop)) : 0;
    const nextProgressPercent = readingProgressPercent(nextProgress);
    setReadingProgress((current) => (readingProgressPercent(current) === nextProgressPercent ? current : nextProgress));

    const headings = readingHeadingsRef.current;
    if (headings.length === 0) {
      setReadingHeading(null);
      return;
    }

    if (!contentArea || contentArea.scrollTop <= 1) {
      setReadingHeading(readingHeadingFromElement(headings[0]));
    } else if (contentArea.scrollTop >= maxScrollTop - 2) {
      setReadingHeading(readingHeadingFromElement(headings[headings.length - 1]));
    } else if (!readingHeadingObserverRef.current) {
      setReadingHeading(currentHeadingFromElements(headings, contentArea));
    }
  }, [setReadingHeading]);

  const scrollToReaderEdge = useCallback((edge: "top" | "bottom") => {
    const contentArea = contentAreaRef.current;
    if (!contentArea) return;
    contentArea.scrollTo({
      top: edge === "top" ? 0 : contentArea.scrollHeight,
      behavior: resolveProgrammaticScrollBehavior(),
    });
  }, []);

  const setPaneWidthCss = useCallback((side: PaneSide, width: number) => {
    const variable = side === "sidebar" ? "--sidebar-width" : "--context-width";
    appShellRef.current?.style.setProperty(variable, `${width}px`);
  }, []);

  const resizePane = useCallback(
    (side: PaneSide, delta: number) => {
      const current = paneWidthsRef.current;
      const nextWidth = clampPaneWidth(side, current[side] + delta);
      if (nextWidth === current[side]) return;
      const next = { ...current, [side]: nextWidth };
      paneWidthsRef.current = next;
      setPaneWidthCss(side, nextWidth);
      setPaneWidths(next);
    },
    [setPaneWidthCss],
  );

  const previewPaneResize = useCallback(
    (side: PaneSide, delta: number) => {
      const current = paneWidthsRef.current;
      const nextWidth = clampPaneWidth(side, current[side] + delta);
      if (nextWidth === current[side]) return;
      paneWidthsRef.current = { ...current, [side]: nextWidth };
      setPaneWidthCss(side, nextWidth);
    },
    [setPaneWidthCss],
  );

  const commitPaneResize = useCallback(() => {
    setPaneWidths(paneWidthsRef.current);
  }, []);

  const resetPane = useCallback(
    (side: PaneSide) => {
      const current = paneWidthsRef.current;
      const next = { ...current, [side]: DEFAULT_PANE_WIDTHS[side] };
      paneWidthsRef.current = next;
      setPaneWidthCss(side, next[side]);
      setPaneWidths(next);
    },
    [setPaneWidthCss],
  );

  const enqueueNativeSettingsWrite = useCallback((pending: PendingAppSettingsWrite): Promise<boolean> => {
    const revision = ++settingsWriteRevisionRef.current;
    const nativeWrite = nativeSettingsWriteQueueRef.current
      .catch(() => undefined)
      .then(() => writeAppSettings(serializeAppSettings(pending.snapshot)));
    const result = nativeWrite.then(
      () => {
        if (revision === settingsWriteRevisionRef.current) {
          setSettingsPersistenceStatus(pending.localSaved ? "saved" : "fallback");
        }
        return true;
      },
      () => {
        if (revision === settingsWriteRevisionRef.current) {
          setSettingsPersistenceStatus(pending.localSaved ? "fallback" : "error");
        }
        return false;
      },
    );
    nativeSettingsWriteQueueRef.current = result.then(() => undefined);
    lastNativeSettingsWriteRef.current = result;
    return result;
  }, []);

  const flushAppSettings = useCallback(async (): Promise<boolean> => {
    if (!isTauriRuntime()) return true;

    const timer = appSettingsFlushTimerRef.current;
    if (timer !== null) {
      window.clearTimeout(timer);
      appSettingsFlushTimerRef.current = null;
    }

    const pending = pendingAppSettingsWriteRef.current;
    if (pending) {
      pendingAppSettingsWriteRef.current = null;
      return enqueueNativeSettingsWrite(pending);
    }
    return lastNativeSettingsWriteRef.current;
  }, [enqueueNativeSettingsWrite]);

  const navigateToHeading = useCallback(
    (item: TocItem) => {
      pendingHeadingRef.current = item.id;
      if (mode !== "rendered") {
        setMode("rendered");
        return;
      }
      if (!progressiveReaderReady) {
        progressiveReaderRef.current?.revealAll();
        return;
      }
      pendingHeadingRef.current = null;
      scrollToHeading(item.id, contentAreaRef.current, articleRef.current, () =>
        progressiveReaderRef.current?.revealAll(),
      );
    },
    [mode, progressiveReaderReady],
  );

  const revealProgressiveReader = useCallback(() => {
    progressiveReaderRef.current?.revealAll();
  }, []);

  const handleProgressiveReaderReady = useCallback((html: string) => {
    setProgressiveReaderReadyHtml(html);
  }, []);

  const setReaderPreferences = useCallback((changes: Partial<ReaderPreferences>) => {
    const next = { ...preferencesRef.current, ...changes };
    preferencesRef.current = next;
    saveReaderPreferences(next);
    setPreferences(next);
  }, []);

  const announceReadingZoom = useCallback((zoom: number) => {
    setReadingZoomNotice(zoom);
    if (readingZoomNoticeTimerRef.current !== null) {
      window.clearTimeout(readingZoomNoticeTimerRef.current);
    }
    readingZoomNoticeTimerRef.current = window.setTimeout(() => {
      readingZoomNoticeTimerRef.current = null;
      setReadingZoomNotice(null);
    }, 1_200);
  }, []);

  const setReadingZoom = useCallback(
    (value: number) => {
      const nextZoom = normalizeReadingZoom(value);
      setReaderPreferences({ readingZoom: nextZoom, readingScale: readingScaleFromZoom(nextZoom) });
      announceReadingZoom(nextZoom);
    },
    [announceReadingZoom, setReaderPreferences],
  );

  const handleReaderWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      if (!event.ctrlKey || event.altKey || mode !== "rendered") return;
      const kind = documentStateRef.current?.kind;
      if (!kind || kind === "pdf" || kind === "image") return;
      const target = event.target instanceof Element ? event.target.closest(".reader-content") : null;
      if (!target) return;

      event.preventDefault();
      setReadingZoom(preferencesRef.current.readingZoom + (event.deltaY < 0 ? READING_ZOOM_STEP : -READING_ZOOM_STEP));
    },
    [mode, setReadingZoom],
  );

  useEffect(
    () => () => {
      if (readingZoomNoticeTimerRef.current !== null) window.clearTimeout(readingZoomNoticeTimerRef.current);
    },
    [],
  );

  const handleDraftSaveResult = useCallback(
    (result: DraftSaveResult): boolean => {
      if (!result.ok) {
        setError("草稿自动保存失败，仍保留在当前窗口中。请先手动保存文档。");
        return false;
      }

      const snapshots = result.snapshots;
      setDraftSnapshots(snapshots);
      if (result.prunedCount > 0) {
        notify(`草稿空间不足，仅保留最近 ${snapshots.length} 条。`, "info");
      }
      return true;
    },
    [notify],
  );

  const resetEditorHistory = useCallback((documentKey: string, source: string) => {
    const nextHistory = createEditorHistory(documentKey, source);
    editorHistoryRef.current = nextHistory;
    setEditorHistory(nextHistory);
  }, []);

  const applyEditorHistoryState = useCallback((nextHistory: EditorHistoryState, focusTarget?: Element | null) => {
    const activeEditor =
      focusTarget?.closest<HTMLElement>(".source-editor, .wysiwyg-editor") ??
      (typeof document !== "undefined"
        ? (document.activeElement?.closest<HTMLElement>(".source-editor, .wysiwyg-editor") ??
          document.querySelector<HTMLElement>(".source-editor, .wysiwyg-editor"))
        : null);
    const viewport = captureEditorViewport(contentAreaRef.current, activeEditor);
    const historyDocumentKey = nextHistory.documentKey;
    editorHistoryRef.current = nextHistory;
    setEditorHistory(nextHistory);
    sourceDraftRef.current = nextHistory.present;
    setSourceDraft(nextHistory.present);
    setDocumentState((current) =>
      current && isSameDocumentPath(current.path, nextHistory.documentKey)
        ? { ...current, modified: nextHistory.present !== current.source }
        : current,
    );
    const restoreViewport = () => {
      if (!isSameDocumentPath(documentStateRef.current?.path ?? "", historyDocumentKey)) return;
      restoreEditorViewport(viewport);
    };
    window.requestAnimationFrame(() => {
      if (!isSameDocumentPath(documentStateRef.current?.path ?? "", historyDocumentKey)) return;
      if (activeEditor) focusEditorSurface(activeEditor);
      restoreViewport();
      // Milkdown may rebuild its ProseMirror state in a passive effect after
      // the first frame; restore once more after that DOM update.
      window.requestAnimationFrame(() => {
        restoreViewport();
      });
    });
  }, []);

  const undoEditor = useCallback(
    (focusTarget?: Element | null) => {
      const current = documentStateRef.current;
      const history = editorHistoryRef.current;
      if (!current || !isEditableDocument(current.kind) || !isSameDocumentPath(history.documentKey, current.path))
        return;

      const nextHistory = undoEditorChange(history);
      if (nextHistory !== history) applyEditorHistoryState(nextHistory, focusTarget);
    },
    [applyEditorHistoryState],
  );

  const redoEditor = useCallback(
    (focusTarget?: Element | null) => {
      const current = documentStateRef.current;
      const history = editorHistoryRef.current;
      if (!current || !isEditableDocument(current.kind) || !isSameDocumentPath(history.documentKey, current.path))
        return;

      const nextHistory = redoEditorChange(history);
      if (nextHistory !== history) applyEditorHistoryState(nextHistory, focusTarget);
    },
    [applyEditorHistoryState],
  );

  const flushCurrentDraft = useCallback((): DraftFlushOutcome => {
    const current = documentStateRef.current;
    if (!current?.modified || !isEditableDocument(current.kind)) return "not-needed";
    if (current.path.startsWith("browser://")) return "unavailable";

    const result = saveDraftSnapshot({
      path: current.path,
      draft: sourceDraftRef.current,
      baseSource: current.source,
      savedAt: Date.now(),
    });
    return handleDraftSaveResult(result) ? "saved" : "failed";
  }, [handleDraftSaveResult]);

  const confirmDocumentReplacement = useCallback(
    (nextPaths: readonly string[], action: string) => {
      if (!shouldConfirmDocumentReplacement(documentStateRef.current, nextPaths)) return true;
      const outcome = flushCurrentDraft();
      if (outcome === "failed") return false;
      return window.confirm(formatTransitionConfirmation(action, outcome === "saved"));
    },
    [flushCurrentDraft],
  );

  const confirmWorkspaceSwitch = useCallback(
    (nextWorkspacePath: string, action: string) => {
      const currentDocument = documentStateRef.current;
      if (
        !shouldConfirmWorkspaceSwitch(Boolean(currentDocument?.modified), workspacePathRef.current, nextWorkspacePath)
      ) {
        return true;
      }
      const outcome = flushCurrentDraft();
      if (outcome === "failed") return false;
      return window.confirm(formatTransitionConfirmation(action, outcome === "saved"));
    },
    [flushCurrentDraft],
  );

  const cancelCloseConfirmation = useCallback(() => {
    closeConfirmationOpenRef.current = false;
    settingsCloseInFlightRef.current = false;
    setCloseConfirmationOpen(false);
  }, []);

  const confirmClose = useCallback(() => {
    closeConfirmationOpenRef.current = false;
    setCloseConfirmationOpen(false);
    settingsCloseInFlightRef.current = true;
    void (async () => {
      try {
        if (!(await flushAppSettings())) {
          notify("设置尚未成功写入本机，请稍后重试关闭窗口。", "error");
          return;
        }
        await closeWindow();
      } catch (cause) {
        notify(cause instanceof Error ? cause.message : "关闭窗口失败。", "error");
      } finally {
        settingsCloseInFlightRef.current = false;
      }
    })();
  }, [flushAppSettings, notify]);

  const exportPortableSettings = useCallback(async () => {
    try {
      const serialized = serializePortableSettings(
        createPortableSettingsBundle({
          preferences,
          locale,
          theme,
          workspacePath,
          lastDocumentPath: loadLastDocumentPath(),
          mountedWorkspaces,
          workspaceSessions: loadWorkspaceSessions(),
          openTabs,
        }),
      );
      if (isTauriRuntime()) {
        const targetPath = await chooseSavePath("Moyang Reader - settings.json", "json");
        if (!targetPath) return;
        await writeTextFile(targetPath, serialized);
        notify(`设置备份已保存：${fileNameFromPath(targetPath)}`);
      } else {
        downloadText("Moyang Reader - settings.json", serialized, "application/json");
        notify("设置备份已下载，不包含文档正文或私钥。");
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "设置备份导出失败。", "error");
    }
  }, [locale, mountedWorkspaces, notify, openTabs, preferences, theme, workspacePath]);

  const importPortableSettings = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      void file
        .text()
        .then((serialized) => {
          const bundle = parsePortableSettings(serialized);
          saveReaderPreferences(bundle.preferences);
          saveWorkspaceSessions([...bundle.workspaceSessions]);
          saveOpenTabs([...bundle.openTabs]);
          saveMountedWorkspaces([...bundle.mountedWorkspaces]);
          saveWorkspacePath(bundle.workspacePath);
          saveLastDocumentPath(bundle.lastDocumentPath);
          preferencesRef.current = bundle.preferences;
          setPreferences(bundle.preferences);
          setLocale(bundle.locale);
          saveLocale(bundle.locale);
          setTheme(bundle.theme);
          setMountedWorkspaces([...bundle.mountedWorkspaces]);
          notify("设置已导入；已保存的阅读库路径将在重新授权后恢复。");
        })
        .catch((cause: unknown) => {
          notify(cause instanceof Error ? cause.message : "设置备份导入失败。", "error");
        });
    };
    input.click();
  }, [notify]);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

  useEffect(() => {
    sourceDraftRef.current = sourceDraft;
  }, [sourceDraft]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    const root = workspacePath;
    if (!root || !preferences.annotationEnabled || !isTauriRuntime()) {
      setAnnotations([]);
      return;
    }

    let active = true;
    void readAnnotations(root)
      .then((stored) => {
        if (active) setAnnotations(normalizeAnnotations(stored));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setAnnotations([]);
        notify(cause instanceof Error ? cause.message : "阅读批注读取失败。", "error");
      });

    return () => {
      active = false;
    };
  }, [notify, preferences.annotationEnabled, workspacePath]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    void readAppSettings()
      .then((serialized) => {
        if (!active) return;
        const nativeSnapshot = serialized ? parseAppSettings(serialized) : null;
        if (nativeSnapshot && (!storedAppSettings || nativeSnapshot.savedAt > storedAppSettings.savedAt)) {
          preferencesRef.current = nativeSnapshot.preferences;
          setPreferences(nativeSnapshot.preferences);
          setTheme(nativeSnapshot.theme);
          setLocale(nativeSnapshot.locale);
          setSidebarCollapsed(nativeSnapshot.sidebarCollapsed);
          setRightPanelOpen(nativeSnapshot.rightPanelOpen);
          setActiveContextTab(nativeSnapshot.activeContextTab);
          paneWidthsRef.current = nativeSnapshot.paneWidths;
          setPaneWidths(nativeSnapshot.paneWidths);
        }
        setNativeSettingsReady(true);
      })
      .catch(() => {
        // Older installations may not have a native settings file yet. Legacy local storage remains usable.
        if (active) setNativeSettingsReady(true);
      });

    return () => {
      active = false;
    };
  }, [storedAppSettings]);

  useEffect(() => {
    if (!nativeSettingsReady) return;

    const snapshot = createAppSettingsSnapshot({
      preferences,
      theme,
      locale,
      sidebarCollapsed,
      rightPanelOpen,
      activeContextTab,
      paneWidths,
    });
    const localResult = saveAppSettingsSnapshot(
      {
        preferences,
        theme,
        locale,
        sidebarCollapsed,
        rightPanelOpen,
        activeContextTab,
        paneWidths,
      },
      snapshot.savedAt,
    );

    if (!isTauriRuntime()) {
      setSettingsPersistenceStatus(localResult.ok ? "saved" : "error");
      return;
    }

    pendingAppSettingsWriteRef.current = { snapshot, localSaved: localResult.ok };
    const timer = window.setTimeout(
      () => {
        appSettingsFlushTimerRef.current = null;
        const pending = pendingAppSettingsWriteRef.current;
        pendingAppSettingsWriteRef.current = null;
        if (pending) void enqueueNativeSettingsWrite(pending);
      },
      localResult.ok ? 220 : 0,
    );
    appSettingsFlushTimerRef.current = timer;
    setSettingsPersistenceStatus("saving");

    return () => {
      window.clearTimeout(timer);
      if (appSettingsFlushTimerRef.current === timer) appSettingsFlushTimerRef.current = null;
    };
  }, [
    activeContextTab,
    enqueueNativeSettingsWrite,
    locale,
    nativeSettingsReady,
    paneWidths,
    preferences,
    rightPanelOpen,
    sidebarCollapsed,
    theme,
  ]);

  useEffect(() => {
    documentCacheRef.current.clear();
  }, [preferences.allowRemoteResources]);

  useEffect(() => {
    if (settingsPersistenceStatus !== "error") return;
    notify("设置未能保存到本机，请稍后重试。", "error");
  }, [notify, settingsPersistenceStatus]);

  useEffect(() => {
    if (tabSessionReady) saveOpenTabs(openTabs);
  }, [openTabs, tabSessionReady]);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    saveContextPanelOpen(rightPanelOpen);
  }, [rightPanelOpen]);

  useEffect(() => {
    saveContextPanelTab(activeContextTab);
  }, [activeContextTab]);

  useEffect(() => {
    savePaneWidths(paneWidths);
  }, [paneWidths]);

  useEffect(() => {
    setWorkspaceExportFailures([]);
    setWorkspaceExportNotice(null);
  }, [selectedFileKind, selectedTag, workspacePath, workspaceQuery]);

  useEffect(() => {
    const path = documentState?.path;
    if (!path || path.startsWith("browser://") || mode !== "rendered") return;

    let frame: number | null = null;
    let attempts = 0;
    const maxRestoreAttempts = 60;
    const retryRestore = () => {
      if (attempts >= maxRestoreAttempts) return;
      attempts += 1;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        restorePosition();
      });
    };
    const restorePosition = () => {
      const contentArea = contentAreaRef.current;
      if (!contentArea) return;
      const storedTop = loadReadingPosition(path);
      const maxScrollTop = Math.max(0, contentArea.scrollHeight - contentArea.clientHeight);
      if (storedTop > 0 && maxScrollTop === 0) {
        retryRestore();
        return;
      }
      contentArea.scrollTop = Math.min(storedTop, maxScrollTop);
      readingPositionRef.current = { path, top: contentArea.scrollTop };
      if (storedTop > 0 && contentArea.scrollTop === 0) retryRestore();
    };
    const timer = window.setTimeout(restorePosition, 0);
    return () => {
      window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [documentState?.path, documentState?.rendered.html, mode, progressiveReaderReady]);

  useEffect(() => {
    const path = documentState?.path;
    const contentArea = contentAreaRef.current;
    if (!path || path.startsWith("browser://") || !contentArea) return;

    let timer: number | null = null;
    const initialTop =
      readingPositionRef.current?.path === path ? readingPositionRef.current.top : contentArea.scrollTop;
    const tracker = createReadingPositionTracker(path, initialTop, (trackedPath, top) => {
      readingPositionRef.current = { path: trackedPath, top };
      saveReadingPosition(trackedPath, top);
    });
    const persistPosition = () => {
      const top = contentArea.scrollTop;
      tracker.update(top);
      readingPositionRef.current = { path, top: tracker.current() };
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        tracker.flush();
      }, 180);
    };

    contentArea.addEventListener("scroll", persistPosition, { passive: true });
    return () => {
      contentArea.removeEventListener("scroll", persistPosition);
      if (timer !== null) window.clearTimeout(timer);
      const latestKnownTop =
        readingPositionRef.current?.path === path ? readingPositionRef.current.top : tracker.current();
      tracker.update(latestKnownTop);
      tracker.flush();
    };
  }, [documentState?.path]);

  useEffect(() => {
    const article = articleRef.current;
    const contentArea = contentAreaRef.current;
    const candidates = readingHeadingCandidatesRef.current;
    const canTrackHeadings =
      mode === "rendered" &&
      progressiveReaderReady &&
      documentState?.kind !== "pdf" &&
      documentState?.kind !== "image" &&
      Boolean(article && contentArea);

    readingHeadingObserverRef.current?.disconnect();
    readingHeadingObserverRef.current = null;
    candidates.clear();
    readingHeadingsRef.current = canTrackHeadings
      ? Array.from(article?.querySelectorAll<HTMLElement>("h1, h2, h3, h4") ?? [])
      : [];

    const headings = readingHeadingsRef.current;
    if (!canTrackHeadings || !contentArea || headings.length === 0) {
      setReadingHeading(null);
      return;
    }

    setReadingHeading(readingHeadingFromElement(headings[0]));
    if (typeof IntersectionObserver === "undefined") return;

    const headingBandHeight = Math.min(72, Math.max(1, contentArea.clientHeight));
    const bottomMarginPercent = 100 - (headingBandHeight / Math.max(1, contentArea.clientHeight)) * 100;
    const observer = new IntersectionObserver(
      (entries) => {
        const currentArea = contentAreaRef.current;
        const maxScrollTop = currentArea ? Math.max(0, currentArea.scrollHeight - currentArea.clientHeight) : 0;
        if (currentArea && currentArea.scrollTop <= 1) {
          setReadingHeading(readingHeadingFromElement(headings[0]));
          return;
        }
        if (currentArea && currentArea.scrollTop >= maxScrollTop - 2) {
          setReadingHeading(readingHeadingFromElement(headings[headings.length - 1]));
          return;
        }

        entries.forEach((entry) => {
          const heading = entry.target as HTMLElement;
          if (entry.isIntersecting) candidates.add(heading);
          else candidates.delete(heading);
        });

        for (let index = headings.length - 1; index >= 0; index -= 1) {
          const heading = headings[index];
          if (candidates.has(heading)) {
            setReadingHeading(readingHeadingFromElement(heading));
            return;
          }
        }

        setReadingHeading(currentHeadingFromElements(headings, currentArea));
      },
      { root: contentArea, rootMargin: `0px 0px -${bottomMarginPercent}% 0px`, threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    readingHeadingObserverRef.current = observer;
    return () => {
      observer.disconnect();
      candidates.clear();
      if (readingHeadingObserverRef.current === observer) readingHeadingObserverRef.current = null;
    };
  }, [
    documentState?.kind,
    documentState?.path,
    documentState?.rendered.html,
    mode,
    progressiveReaderReady,
    setReadingHeading,
  ]);

  useEffect(() => {
    const contentArea = contentAreaRef.current;
    if (!contentArea) return;

    let frame: number | null = null;
    const update = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        updateReadingRail();
      });
    };

    contentArea.addEventListener("scroll", update, { passive: true });
    updateReadingRail();
    return () => {
      contentArea.removeEventListener("scroll", update);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [documentState?.path, documentState?.rendered.html, mode, progressiveReaderReady, updateReadingRail]);

  useEffect(() => {
    if (mode !== "rendered") return;
    const pendingHeading = pendingHeadingRef.current;
    if (!pendingHeading || !progressiveReaderReady) return;

    pendingHeadingRef.current = null;
    scrollToHeading(pendingHeading, contentAreaRef.current, articleRef.current, revealProgressiveReader);
  }, [documentState?.path, documentState?.rendered.html, mode, progressiveReaderReady, revealProgressiveReader]);

  useEffect(() => {
    if (documentState && mode === "rendered" && documentState.kind !== "pdf" && documentState.kind !== "image") return;
    setReadingProgress(0);
    setCurrentHeading(null);
    setCurrentHeadingId(null);
  }, [documentState, mode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const current = documentStateRef.current;
      if (current?.modified && isEditableDocument(current.kind) && !current.path.startsWith("browser://")) {
        const result = saveDraftSnapshot({
          path: current.path,
          draft: sourceDraftRef.current,
          baseSource: current.source,
          savedAt: Date.now(),
        });
        handleDraftSaveResult(result);
      }
      if (isTauriRuntime() || !documentStateRef.current?.modified) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleDraftSaveResult]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let unlisten: (() => void) | null = null;
    const handleCloseRequest = () => {
      if (closeConfirmationOpenRef.current || settingsCloseInFlightRef.current) return;
      const current = documentStateRef.current;
      if (current?.modified && isEditableDocument(current.kind) && !current.path.startsWith("browser://")) {
        const result = saveDraftSnapshot({
          path: current.path,
          draft: sourceDraftRef.current,
          baseSource: current.source,
          savedAt: Date.now(),
        });
        if (!handleDraftSaveResult(result)) return;
      }
      if (current?.modified) {
        closeConfirmationOpenRef.current = true;
        setCloseConfirmationOpen(true);
        return;
      }
      settingsCloseInFlightRef.current = true;
      void (async () => {
        try {
          if (!(await flushAppSettings())) {
            if (active) notify("设置尚未成功写入本机，请稍后重试关闭窗口。", "error");
            return;
          }
          await closeWindow();
        } catch (cause) {
          if (active) notify(cause instanceof Error ? cause.message : "关闭窗口失败。", "error");
        } finally {
          settingsCloseInFlightRef.current = false;
        }
      })();
    };

    void subscribeToCloseRequest(handleCloseRequest).then((dispose) => {
      if (!active) {
        dispose?.();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [flushAppSettings, handleDraftSaveResult, notify]);

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs]);

  useEffect(() => {
    if (!workspacePath) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      selectedTag,
      selectedFileKind,
      searchQuery: workspaceQuery,
    });
  }, [selectedFileKind, selectedTag, workspacePath, workspaceQuery]);

  useEffect(() => {
    if (!workspacePath) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      tabs: openTabsRef.current.filter(
        (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, workspacePath),
      ),
    });
  }, [openTabs, workspacePath]);

  useEffect(() => {
    if (!workspacePath || !documentState?.path || !pathBelongsToWorkspace(documentState.path, workspacePath)) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      activeDocumentPath: documentState.path,
    });
  }, [documentState?.path, workspacePath]);

  useEffect(() => {
    if (!workspacePath) return;
    persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, workspacePath);
  }, [documentState?.path, openTabs, workspacePath]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
      browserDocumentsRef.current.clear();
      documentCacheRef.current.clear();
    },
    [],
  );

  const releaseDocumentResources = useCallback((path: string) => {
    documentCacheRef.current.remove(path);
    const cached = browserDocumentsRef.current.get(path);
    const previewUrl = previewUrlsRef.current.get(path) ?? cached?.previewUrl;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrlsRef.current.delete(path);
    }
    browserDocumentsRef.current.delete(path);
  }, []);

  const closePendingUpdate = useCallback(async () => {
    const pending = updateRef.current;
    updateRef.current = null;
    setAvailableUpdate(null);
    if (pending) await pending.close().catch(() => undefined);
  }, []);

  const checkForUpdates = useCallback(
    async (manual = true) => {
      if (!isTauriRuntime()) {
        if (manual) {
          setUpdateStatus("error");
          setUpdateError("浏览器预览模式不支持应用更新。");
          setUpdateNoticeVisible(true);
        }
        return;
      }

      if (updateCheckInFlightRef.current) return;
      updateCheckInFlightRef.current = true;
      setUpdateStatus("checking");
      setUpdateError(null);
      setUpdateProgress(null);
      if (manual) setUpdateNoticeVisible(false);

      try {
        const version = await getCurrentAppVersion();
        if (version) setCurrentVersion(version);
        await closePendingUpdate();

        const found = await checkForAppUpdate();
        if (!found) {
          setUpdateStatus(manual ? "up-to-date" : "idle");
          setUpdateNoticeVisible(manual);
          return;
        }

        updateRef.current = found;
        setAvailableUpdate(found);
        setUpdateStatus("available");
        setUpdateNoticeVisible(true);
      } catch (cause) {
        if (manual) {
          setUpdateStatus("error");
          setUpdateError(describeUpdateError(cause));
          setUpdateNoticeVisible(true);
        } else {
          setUpdateStatus("idle");
          setUpdateError(null);
          setUpdateNoticeVisible(false);
        }
      } finally {
        updateCheckInFlightRef.current = false;
      }
    },
    [closePendingUpdate],
  );

  const installUpdate = useCallback(async () => {
    const pending = updateRef.current;
    if (!pending) return;

    setUpdateStatus("downloading");
    setUpdateNoticeVisible(true);
    setUpdateError(null);
    setUpdateProgress(0);

    let downloaded = 0;
    let contentLength: number | undefined;
    try {
      await installAppUpdate(pending, (event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
          setUpdateProgress(contentLength ? 0 : null);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (contentLength) {
            setUpdateProgress(Math.min(1, downloaded / contentLength));
          }
        } else {
          setUpdateProgress(1);
        }
      });

      updateRef.current = null;
      setAvailableUpdate(null);
      await pending.close().catch(() => undefined);
      setUpdateStatus("ready");
      try {
        await relaunchApp();
      } catch {
        setUpdateError("更新已安装，但应用没有自动重启，请点击“重启应用”。");
      }
    } catch (cause) {
      setUpdateStatus("error");
      const reason = describeUpdateError(cause);
      const recovery = {
        attemptedVersion: pending.version,
        currentVersion,
        failedAt: Date.now(),
        reason,
      };
      saveUpdateRecovery(recovery);
      setUpdateError(reason);
      setUpdateNoticeVisible(true);
    }
  }, [currentVersion]);

  const relaunchUpdatedApp = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (cause) {
      setUpdateStatus("error");
      setUpdateError(describeUpdateError(cause));
      setUpdateNoticeVisible(true);
    }
  }, []);

  const dismissUpdateNotice = useCallback(() => {
    setUpdateNoticeVisible(false);
    void closePendingUpdate();
  }, [closePendingUpdate]);

  useEffect(
    () => () => {
      const pending = updateRef.current;
      updateRef.current = null;
      if (pending) void pending.close().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    void getCurrentAppVersion()
      .then((version) => {
        if (!active || !version) return;
        setCurrentVersion(version);
        const recovery = loadUpdateRecovery();
        if (!recovery) return;
        if (recovery.attemptedVersion.replace(/^v/i, "") === version.replace(/^v/i, "")) {
          clearUpdateRecovery();
          return;
        }
        setUpdateStatus("error");
        setUpdateError(formatUpdateRecoveryNotice(recovery));
        setUpdateNoticeVisible(true);
      })
      .catch(() => undefined);

    const timer = initialStartupUpdateCheckRef.current
      ? window.setTimeout(() => {
          if (active) void checkForUpdates(false);
        }, 1_200)
      : null;

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [checkForUpdates]);

  const refreshWorkspaceChanges = useCallback((root: string, paths: string[]): Promise<void> => {
    if (!isTauriRuntime() || paths.length === 0) return Promise.resolve();

    const loadRequestId = workspaceLoadRequestRef.current;
    const refresh = workspaceRefreshQueueRef.current.then(async () => {
      const isActiveWorkspace = () =>
        loadRequestId === workspaceLoadRequestRef.current &&
        comparablePath(workspacePathRef.current ?? "") === comparablePath(root);

      if (!isActiveWorkspace()) return;

      setWorkspaceIndexLoading(true);
      try {
        const delta = await refreshWorkspace(root, paths);
        if (!isActiveWorkspace()) return;

        if (delta.truncated) {
          setWorkspaceListingStatus((current) => {
            const next = {
              truncated: true,
              scannedTotal: Math.max(current.scannedTotal, delta.scannedTotal),
            };
            updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { listingStatus: next });
            return next;
          });
        }

        setWorkspaceFiles((current) => {
          const next = applyWorkspaceFileDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { files: next });
          return next;
        });
        setWorkspaceFolders((current) => {
          const next = applyWorkspaceFolderDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { folders: next });
          return next;
        });
        setWorkspaceIndex((current) => {
          const next = applyWorkspaceIndexDelta(current, delta);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { index: next });
          return next;
        });
        setWorkspaceRevision((current) => {
          const next = current + 1;
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { revision: next });
          return next;
        });
      } catch {
        if (isActiveWorkspace()) setWorkspaceWatchError("工作区增量刷新失败，目录仍可手动刷新。");
      } finally {
        if (isActiveWorkspace()) setWorkspaceIndexLoading(false);
      }
    });
    workspaceRefreshQueueRef.current = refresh.catch(() => undefined);
    return refresh;
  }, []);

  const loadWorkspace = useCallback(async (root: string, silent = false) => {
    if (!isTauriRuntime()) return;

    const mounted = loadMountedWorkspaces();
    const rootKey = comparablePath(root);
    const alreadyMounted = mounted.some((workspace) => comparablePath(workspace.path) === rootKey);
    const alreadyPending = pendingWorkspaceMountsRef.current.has(rootKey);
    if (
      !alreadyMounted &&
      !alreadyPending &&
      mounted.length + pendingWorkspaceMountsRef.current.size >= MAX_MOUNTED_WORKSPACES
    ) {
      setError(`最多同时挂载 ${MAX_MOUNTED_WORKSPACES} 个阅读库，请先从切换菜单移除一个。`);
      return;
    }
    const ownsPendingMount = !alreadyMounted && !alreadyPending;
    if (ownsPendingMount) pendingWorkspaceMountsRef.current.add(rootKey);

    const previousWorkspacePath = workspacePathRef.current;
    const storedSession = loadWorkspaceSessions().find(
      (session) => comparablePath(session.path) === comparablePath(root),
    );
    const switchedWorkspace =
      comparablePath(previousWorkspacePath ?? "") !== comparablePath(root) && Boolean(previousWorkspacePath);
    if (switchedWorkspace || (storedSession && !previousWorkspacePath)) {
      workspaceRestorePendingRef.current = true;
    }
    if (switchedWorkspace && previousWorkspacePath) {
      const currentDocument = documentStateRef.current;
      updateCachedWorkspace(mountedWorkspaceCacheRef.current, previousWorkspacePath, {
        tabs: openTabsRef.current.filter(
          (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, previousWorkspacePath),
        ),
        activeDocumentPath:
          currentDocument && pathBelongsToWorkspace(currentDocument.path, previousWorkspacePath)
            ? currentDocument.path
            : null,
      });
      persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, previousWorkspacePath);
    }

    const requestId = ++workspaceLoadRequestRef.current;
    setWorkspaceLoading(true);
    setWorkspaceIndexLoading(true);
    try {
      const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
      if (cached) {
        const switchedWorkspace = comparablePath(workspacePathRef.current ?? "") !== comparablePath(cached.path);
        workspacePathRef.current = cached.path;
        setWorkspacePath(cached.path);
        setWorkspaceFiles(cached.files);
        setWorkspaceFolders(cached.folders);
        setWorkspaceListingStatus(cached.listingStatus);
        setWorkspaceIndex(cached.index);
        setWorkspaceRevision(cached.revision);
        setWorkspaceQuery(cached.searchQuery);
        setSelectedTag(cached.selectedTag);
        setSelectedFileKind(cached.selectedFileKind);
        if (switchedWorkspace) {
          setWorkspaceResults([]);
          setOpenTabs(cached.tabs ?? []);
        }
        saveWorkspacePath(cached.path);
        setRecentWorkspaces(
          rememberRecentWorkspace({
            path: cached.path,
            name: cached.name,
          }),
        );
        const nextMountedWorkspaces = rememberMountedWorkspace({
          path: cached.path,
          name: cached.name,
        });
        pruneWorkspaceCache(mountedWorkspaceCacheRef.current, nextMountedWorkspaces);
        setMountedWorkspaces(nextMountedWorkspaces);
        if (!silent) setError(null);
        setWorkspaceLoading(false);

        void (async () => {
          try {
            const listing = await listWorkspaceEntries(cached.path);
            const { files, folders } = listing;
            if (
              !isCurrentWorkspaceLoad(requestId, workspaceLoadRequestRef.current, cached.path, workspacePathRef.current)
            ) {
              return;
            }
            const filesChanged = !workspaceFilesMatch(cached.files, files);
            const foldersChanged = !workspaceFoldersMatch(cached.folders, folders);
            const listingStatusChanged =
              cached.listingStatus.truncated !== listing.truncated ||
              cached.listingStatus.scannedTotal !== listing.scannedTotal;
            if (filesChanged) {
              setWorkspaceFiles(files);
              updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { files });
            }
            if (foldersChanged) {
              setWorkspaceFolders(folders);
              updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { folders });
            }
            if (listingStatusChanged) {
              const listingStatus = {
                truncated: listing.truncated,
                scannedTotal: listing.scannedTotal,
              };
              setWorkspaceListingStatus(listingStatus);
              updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { listingStatus });
            }
            if (filesChanged || foldersChanged) {
              setWorkspaceRevision((current) => {
                const next = current + 1;
                updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { revision: next });
                return next;
              });
            }
            if (cached.indexReady && !filesChanged) return;

            const index = await indexWorkspace(cached.path);
            if (
              !isCurrentWorkspaceLoad(requestId, workspaceLoadRequestRef.current, cached.path, workspacePathRef.current)
            ) {
              return;
            }
            setWorkspaceIndex(index);
            updateCachedWorkspace(mountedWorkspaceCacheRef.current, cached.path, { index, indexReady: true });
          } catch (cause) {
            if (requestId === workspaceLoadRequestRef.current && !silent) {
              setError(cause instanceof Error ? cause.message : "工作区刷新失败。");
            }
          } finally {
            if (requestId === workspaceLoadRequestRef.current) setWorkspaceIndexLoading(false);
          }
        })();
        return;
      }

      const listing = await listWorkspaceEntries(root);
      const { files, folders } = listing;
      if (requestId !== workspaceLoadRequestRef.current) return;

      const switchedWorkspace = comparablePath(workspacePathRef.current ?? "") !== comparablePath(root);
      const workspaceRecord = {
        path: root,
        name: fileNameFromPath(root.replace(/[\\/]+$/, "")) || root,
      };
      mountedWorkspaceCacheRef.current.set(comparablePath(root), {
        ...workspaceRecord,
        files,
        folders,
        listingStatus: {
          truncated: listing.truncated,
          scannedTotal: listing.scannedTotal,
        },
        index: [],
        indexReady: false,
        revision: 0,
        selectedTag: null,
        selectedFileKind: "all",
        searchQuery: "",
        tabs: storedSession?.tabs ?? [],
        activeDocumentPath: storedSession?.activeDocumentPath ?? null,
      });
      workspacePathRef.current = root;
      setWorkspacePath(root);
      setWorkspaceFiles(files);
      setWorkspaceFolders(folders);
      setWorkspaceListingStatus({ truncated: listing.truncated, scannedTotal: listing.scannedTotal });
      if (switchedWorkspace || !previousWorkspacePath) {
        setWorkspaceIndex([]);
        setWorkspaceResults([]);
        setWorkspaceQuery("");
        setSelectedTag(null);
        setSelectedFileKind("all");
        setOpenTabs(storedSession?.tabs ?? []);
      }
      setWorkspaceRevision((current) => {
        const next = current + 1;
        updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { revision: next });
        return next;
      });
      saveWorkspacePath(root);
      setRecentWorkspaces(rememberRecentWorkspace(workspaceRecord));
      const nextMountedWorkspaces = rememberMountedWorkspace(workspaceRecord);
      pruneWorkspaceCache(mountedWorkspaceCacheRef.current, nextMountedWorkspaces);
      setMountedWorkspaces(nextMountedWorkspaces);
      if (!silent) setError(null);
      setWorkspaceLoading(false);

      void indexWorkspace(root)
        .then((index) => {
          if (!isCurrentWorkspaceLoad(requestId, workspaceLoadRequestRef.current, root, workspacePathRef.current))
            return;
          setWorkspaceIndex(index);
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, { index, indexReady: true });
        })
        .catch((cause) => {
          if (requestId !== workspaceLoadRequestRef.current) return;
          setWorkspaceIndex([]);
          if (!silent) {
            setError(cause instanceof Error ? cause.message : "工作区索引失败。");
          }
        })
        .finally(() => {
          if (requestId === workspaceLoadRequestRef.current) setWorkspaceIndexLoading(false);
        });
    } catch (cause) {
      if (requestId !== workspaceLoadRequestRef.current) return;
      setWorkspaceLoading(false);
      setWorkspaceIndexLoading(false);
      if (silent) {
        setWorkspacePath(null);
        workspacePathRef.current = null;
        setWorkspaceFiles([]);
        setWorkspaceFolders([]);
        setWorkspaceListingStatus({ truncated: false, scannedTotal: 0 });
        setWorkspaceIndex([]);
        saveWorkspacePath(null);
        mountedWorkspaceCacheRef.current.delete(comparablePath(root));
        forgetWorkspaceSession(root);
        setMountedWorkspaces((current) => {
          const next = current.filter((workspace) => comparablePath(workspace.path) !== comparablePath(root));
          saveMountedWorkspaces(next);
          return next;
        });
      } else {
        setError(cause instanceof Error ? cause.message : "工作区读取失败。");
      }
    } finally {
      if (ownsPendingMount) pendingWorkspaceMountsRef.current.delete(rootKey);
    }
  }, []);

  const handleChooseWorkspace = useCallback(async () => {
    if (loadMountedWorkspaces().length + pendingWorkspaceMountsRef.current.size >= MAX_MOUNTED_WORKSPACES) {
      setError(`最多同时挂载 ${MAX_MOUNTED_WORKSPACES} 个阅读库，请先从切换菜单移除一个。`);
      return;
    }
    const selected = await chooseWorkspacePath();
    if (selected && confirmWorkspaceSwitch(selected, "切换阅读库")) {
      await loadWorkspace(selected);
    }
  }, [confirmWorkspaceSwitch, loadWorkspace]);

  const handleOpenRecentWorkspace = useCallback(
    async (path: string) => {
      try {
        const authorizedPath = await authorizeStoredPath(path, true);
        if (!confirmWorkspaceSwitch(authorizedPath, "切换阅读库")) {
          return;
        }
        await loadWorkspace(authorizedPath);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近阅读库无法打开，请重新选择文件夹。");
      }
    },
    [confirmWorkspaceSwitch, loadWorkspace],
  );

  const handleRemoveMountedWorkspace = useCallback((path: string) => {
    if (comparablePath(path) === comparablePath(workspacePathRef.current ?? "")) return;
    mountedWorkspaceCacheRef.current.delete(comparablePath(path));
    documentCacheRef.current.invalidate([path]);
    forgetWorkspaceSession(path);
    setMountedWorkspaces((current) => {
      const next = current.filter((workspace) => comparablePath(workspace.path) !== comparablePath(path));
      saveMountedWorkspaces(next);
      return next;
    });
  }, []);

  const openSource = useCallback(
    async (
      path: string,
      source: string,
      preserveMode = false,
      stamp?: FileStamp,
      renderedOverride?: OpenDocument["rendered"],
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const kind = documentKindFromPath(path);
        if (!kind || (kind !== "markdown" && kind !== "text")) {
          throw new Error("当前文件不是可编辑的 Markdown 或文本文件。");
        }
        const editorSafety = kind === "markdown" ? checkMarkdownEditorSafety(source) : { safe: false };
        const rendered =
          renderedOverride ??
          (await renderSource(path, source, {
            allowRemoteResources: preferencesRef.current.allowRemoteResources,
          }));
        releaseDocumentResources(path);
        if (path.startsWith("browser://")) {
          browserDocumentsRef.current.set(path, { kind, source });
        }
        setDocumentState({
          path,
          name: fileNameFromPath(path),
          kind,
          source,
          rendered,
          modified: false,
          externallyModified: false,
        });
        setExternalChangePath(null);
        setSourceDraft(source);
        sourceDraftRef.current = source;
        resetEditorHistory(path, source);
        const draftState = getDraftSnapshotState(path, source);
        setDraftRecovery(draftState.snapshot);
        setPreviousVersion(null);
        setDraftSnapshots(draftState.snapshots);
        setOpenTabs((current) =>
          current.some((tab) => tab.path === path) ? current : [...current, { path, name: fileNameFromPath(path) }],
        );
        if (!path.startsWith("browser://")) {
          setRecentFiles(rememberRecentFile({ path, name: fileNameFromPath(path) }));
          saveLastDocumentPath(path);
        }
        setMode((current) => nextReaderModeAfterOpen(current, preserveMode, kind, editorSafety.safe));
        if (kind === "markdown" && !editorSafety.safe) {
          notify(`该 Markdown 含有暂不支持的结构，编辑时已保留源码模式：${editorSafety.reason}`, "info");
        }
        if (stamp && !path.startsWith("browser://")) {
          documentCacheRef.current.set({
            path,
            name: fileNameFromPath(path),
            kind,
            source,
            rendered,
            stamp,
          });
        }
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档渲染失败。");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [notify, releaseDocumentResources, resetEditorHistory],
  );

  const openBinary = useCallback(
    async (
      path: string,
      bytes: Uint8Array,
      preserveMode = false,
      stamp?: FileStamp,
      renderedOverride?: OpenDocument["rendered"],
    ): Promise<boolean> => {
      const kind = documentKindFromPath(path);
      if (kind !== "docx" && kind !== "pdf" && kind !== "image") {
        throw new Error("当前文件不是可预览的文档。");
      }

      setLoading(true);
      setError(null);

      try {
        const rendered =
          renderedOverride ??
          (kind === "docx"
            ? await renderDocx(bytes, { allowRemoteResources: preferencesRef.current.allowRemoteResources })
            : emptyRenderedDocument());
        let previewUrl: string | undefined;
        if (kind === "pdf" || kind === "image") {
          const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          previewUrl = URL.createObjectURL(
            new Blob([binary], {
              type: kind === "pdf" ? "application/pdf" : imageMimeType(path),
            }),
          );
        }

        releaseDocumentResources(path);
        if (previewUrl) previewUrlsRef.current.set(path, previewUrl);
        if (path.startsWith("browser://")) {
          browserDocumentsRef.current.set(path, { kind, bytes, previewUrl });
        }

        setDocumentState({
          path,
          name: fileNameFromPath(path),
          kind,
          source: "",
          rendered,
          previewUrl,
          modified: false,
          externallyModified: false,
        });
        setExternalChangePath(null);
        setSourceDraft("");
        sourceDraftRef.current = "";
        resetEditorHistory(path, "");
        setDraftRecovery(null);
        setPreviousVersion(null);
        setDraftSnapshots(loadDraftSnapshots());
        setOpenTabs((current) =>
          current.some((tab) => tab.path === path) ? current : [...current, { path, name: fileNameFromPath(path) }],
        );
        if (!path.startsWith("browser://")) {
          setRecentFiles(rememberRecentFile({ path, name: fileNameFromPath(path) }));
          saveLastDocumentPath(path);
        }
        setMode((current) => nextReaderModeAfterOpen(current, preserveMode, kind));
        if (stamp && !path.startsWith("browser://")) {
          documentCacheRef.current.set({
            path,
            name: fileNameFromPath(path),
            kind,
            source: "",
            rendered,
            stamp,
            bytes,
          });
        }
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档预览失败。");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [releaseDocumentResources, resetEditorHistory],
  );

  const commitNavigationHistory = useCallback((next: NavigationHistoryState) => {
    if (next === navigationHistoryRef.current) return;
    navigationHistoryRef.current = next;
    setNavigationHistory(next);
  }, []);

  const commitDocumentOpenNavigation = useCallback(
    (path: string, navigation: DocumentOpenNavigation, previousPath: string | null) => {
      const current = navigationHistoryRef.current;
      let next: NavigationHistoryState;

      if (navigation === "push") {
        const baseline = previousPath ? replaceNavigationPath(current, previousPath) : current;
        next = pushNavigationPath(baseline, path);
      } else if (navigation === "back") {
        const candidate = goBack(current);
        next =
          candidate.current && isSameDocumentPath(candidate.current, path)
            ? candidate
            : replaceNavigationPath(current, path);
      } else if (navigation === "forward") {
        const candidate = goForward(current);
        next =
          candidate.current && isSameDocumentPath(candidate.current, path)
            ? candidate
            : replaceNavigationPath(current, path);
      } else {
        next = replaceNavigationPath(current, path);
      }

      commitNavigationHistory(next);
    },
    [commitNavigationHistory],
  );

  const openPath = useCallback(
    async (path: string, preserveMode = false, navigation: DocumentOpenNavigation = "sync"): Promise<boolean> => {
      const previousPath = documentStateRef.current?.path ?? null;
      try {
        let opened = false;
        if (path.startsWith("browser://")) {
          const cached = browserDocumentsRef.current.get(path);
          if (!cached) throw new Error("浏览器预览文件已失效，请重新选择。");
          if (cached.bytes) {
            opened = await openBinary(path, cached.bytes, preserveMode);
          } else if (cached.source !== undefined) {
            opened = await openSource(path, cached.source, preserveMode);
          }
        } else {
          const kind = documentKindFromPath(path);
          if (!kind) {
            throw new Error("不支持的文档类型，请选择 Markdown、文本、Word、PDF 或图片文件。");
          }
          const stamp = await fileMetadata(path);
          const cached = documentCacheRef.current.get(path, stamp);
          if (kind === "docx" || kind === "pdf" || kind === "image") {
            if (cached?.kind === kind && cached.bytes) {
              opened = await openBinary(path, cached.bytes, preserveMode, stamp, cached.rendered);
            } else {
              opened = await openBinary(path, await readBinaryFile(path), preserveMode, stamp);
            }
          } else if (cached?.kind === kind) {
            opened = await openSource(path, cached.source, preserveMode, stamp, cached.rendered);
          } else {
            opened = await openSource(path, await readTextFile(path), preserveMode, stamp);
          }
        }

        if (opened) commitDocumentOpenNavigation(path, navigation, previousPath);
        return opened;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文件打开失败。");
        return false;
      }
    },
    [commitDocumentOpenNavigation, openBinary, openSource],
  );

  const reloadExternalChange = useCallback(async () => {
    const current = documentStateRef.current;
    if (!current || !externalChangePath || !isSameDocumentPath(current.path, externalChangePath)) return;

    if (current.modified) {
      const draftResult = saveDraftSnapshot({
        path: current.path,
        draft: sourceDraftRef.current,
        baseSource: current.source,
        savedAt: Date.now(),
      });
      if (!handleDraftSaveResult(draftResult)) return;
      if (!window.confirm("重新载入会覆盖当前未保存修改，已先保留一份草稿恢复副本。继续吗？")) return;
    }

    setExternalChangePath(null);
    const opened = await openPath(current.path, true);
    if (!opened && documentStateRef.current?.path === current.path) {
      setExternalChangePath(current.path);
    }
  }, [externalChangePath, handleDraftSaveResult, openPath]);

  useEffect(() => {
    if (!workspacePath || !isTauriRuntime()) return;
    if (!workspaceRestorePendingRef.current) return;
    workspaceRestorePendingRef.current = false;

    const cached = mountedWorkspaceCacheRef.current.get(comparablePath(workspacePath));
    const targetPath = cached?.activeDocumentPath ?? null;
    const currentPath = documentStateRef.current?.path ?? null;
    const currentBelongs = currentPath ? pathBelongsToWorkspace(currentPath, workspacePath) : false;
    const targetBelongs = targetPath ? pathBelongsToWorkspace(targetPath, workspacePath) : false;

    if (currentPath && !currentBelongs) {
      releaseDocumentResources(currentPath);
      setDocumentState(null);
      setSourceDraft("");
      sourceDraftRef.current = "";
      setDraftRecovery(null);
      setExternalChangePath(null);
      setMode("rendered");
      setSearchQuery("");
      saveLastDocumentPath(null);
    }

    if (!targetPath || !targetBelongs || targetPath === currentPath) return;

    let active = true;
    void openPath(targetPath).then((opened) => {
      if (active && !opened) {
        updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, { activeDocumentPath: null });
        persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, workspacePath);
      }
    });
    return () => {
      active = false;
    };
  }, [openPath, releaseDocumentResources, workspacePath]);

  const handleOpenPaths = useCallback(
    async (paths: OpenPath[]): Promise<OpenPathsOutcome> => {
      const cancelledOutcome = (): OpenPathsOutcome => ({
        openedCount: 0,
        failedCount: 0,
        duplicateCount: 0,
        cancelled: true,
      });
      const workspacePaths = paths.filter((entry) => entry.kind === "workspace").map((entry) => entry.path);
      const workspacePathToConfirm = workspacePaths.find((path) =>
        shouldConfirmWorkspaceSwitch(Boolean(documentStateRef.current?.modified), workspacePathRef.current, path),
      );
      if (workspacePathToConfirm && !confirmWorkspaceSwitch(workspacePathToConfirm, "切换阅读库")) {
        return cancelledOutcome();
      }

      const currentModifiedPath = documentStateRef.current?.modified ? documentStateRef.current.path : null;
      const pathsToProcess = currentModifiedPath
        ? paths.filter((entry) => entry.kind !== "document" || !isSameDocumentPath(currentModifiedPath, entry.path))
        : paths;
      const documentPaths = pathsToProcess.filter((entry) => entry.kind === "document").map((entry) => entry.path);
      if (!confirmDocumentReplacement(documentPaths, "打开新文档")) {
        return cancelledOutcome();
      }

      const seen = new Set<string>();
      let openedCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;
      for (const entry of pathsToProcess) {
        const key = `${entry.kind}:${normalizePathKey(entry.path)}`;
        if (seen.has(key)) {
          duplicateCount += 1;
          continue;
        }
        seen.add(key);

        try {
          const authorizedPath = isTauriRuntime()
            ? await authorizeStoredPath(entry.path, entry.kind === "workspace")
            : entry.path;
          if (entry.kind === "workspace") {
            await loadWorkspace(authorizedPath);
            openedCount += 1;
          } else {
            if (await openPath(authorizedPath)) openedCount += 1;
            else failedCount += 1;
          }
        } catch (cause) {
          failedCount += 1;
          setError(cause instanceof Error ? cause.message : "无法打开传入的路径。");
        }
      }

      return { openedCount, failedCount, duplicateCount, cancelled: false };
    },
    [confirmDocumentReplacement, confirmWorkspaceSwitch, loadWorkspace, openPath],
  );

  const handleNavigateBack = useCallback(async () => {
    const targetPath = getBackNavigationPath(navigationHistoryRef.current);
    if (!targetPath) return;
    if (!confirmDocumentReplacement([targetPath], "返回上一文档")) return;
    await openPath(targetPath, false, "back");
  }, [confirmDocumentReplacement, openPath]);

  const saveDocument = useCallback(async (allowExternalOverwrite = false): Promise<boolean> => {
    const current = documentStateRef.current;
    const draft = sourceDraftRef.current;
    if (!current || !current.modified || !isEditableDocument(current.kind)) return false;

    if (current.externallyModified && !allowExternalOverwrite) {
      setExternalChangePath(current.path);
      setError("文件已被其他程序修改，请先选择重新载入、覆盖保存或另存为。");
      return false;
    }

    const path = current.path;
    const pathKey = comparablePath(path);
    let writeCompleted = false;
    try {
      if (isTauriRuntime()) {
        if (!allowExternalOverwrite) {
          const diskSource = await readTextFile(path);
          if (diskSource !== current.source) {
            setDocumentState((latest) =>
              latest && isSameDocumentPath(latest.path, path) ? { ...latest, externallyModified: true } : latest,
            );
            setExternalChangePath(path);
            setError("文件在保存前已被其他程序修改，请先选择处理方式。");
            return false;
          }
        }
        selfWritingPathsRef.current.add(pathKey);
        try {
          await writeTextFile(path, draft);
        } finally {
          selfWritingPathsRef.current.delete(pathKey);
        }
        writeCompleted = true;
        selfWrittenPathsRef.current.set(pathKey, Date.now() + 1_500);
        documentCacheRef.current.remove(path);
      } else {
        downloadText(current.name, draft);
      }

      const rendered = await renderSource(path, draft, {
        allowRemoteResources: preferencesRef.current.allowRemoteResources,
      });
      setDocumentState((latest) =>
        latest && isSameDocumentPath(latest.path, path)
          ? { ...latest, source: draft, rendered, modified: false, externallyModified: false }
          : latest,
      );
      setDraftSnapshots(clearDraftSnapshot(path));
      setDraftRecovery(null);
      setExternalChangePath(null);
      setError(null);
      return true;
    } catch (cause) {
      selfWritingPathsRef.current.delete(pathKey);
      if (!writeCompleted) selfWrittenPathsRef.current.delete(pathKey);
      setError(cause instanceof Error ? cause.message : "保存失败。");
      return false;
    }
  }, []);

  const handleCreateNote = useCallback(
    async (target: string) => {
      if (!workspacePath || !documentState || documentState.path.startsWith("browser://")) {
        setError("请先添加一个工作区文件夹，再创建未解析链接。");
        return;
      }
      const draftOutcome = documentState.modified ? flushCurrentDraft() : "not-needed";
      if (
        documentState.modified &&
        (draftOutcome === "failed" ||
          !window.confirm(formatTransitionConfirmation("切换到新文档", draftOutcome === "saved")))
      )
        return;

      try {
        const path = await createMarkdownFile(workspacePath, documentState.path, target);
        await loadWorkspace(workspacePath, true);
        await openPath(path);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新文档。");
      }
    },
    [documentState, flushCurrentDraft, loadWorkspace, openPath, workspacePath],
  );

  const handleCreateWorkspaceNote = useCallback(
    async (parentPath: string) => {
      if (!workspacePath || !isTauriRuntime()) {
        setError("请先添加一个工作区文件夹，再新建笔记。");
        return;
      }
      const name = window.prompt("新建笔记", "未命名笔记")?.trim();
      if (!name) return;

      const currentDocument = documentStateRef.current;
      const draftOutcome = currentDocument?.modified ? flushCurrentDraft() : "not-needed";
      if (
        currentDocument?.modified &&
        (draftOutcome === "failed" ||
          !window.confirm(formatTransitionConfirmation("切换到新文档", draftOutcome === "saved")))
      ) {
        return;
      }

      try {
        const path = await createWorkspaceNote(workspacePath, parentPath, name);
        await refreshWorkspaceChanges(workspacePath, [path]);
        await openPath(path);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新笔记。");
      }
    },
    [flushCurrentDraft, openPath, refreshWorkspaceChanges, workspacePath],
  );

  const handleCreateWorkspaceFolder = useCallback(
    async (parentPath: string) => {
      if (!workspacePath || !isTauriRuntime()) {
        setError("请先添加一个工作区文件夹，再新建文件夹。");
        return;
      }
      const name = window.prompt("新建文件夹", "新建文件夹")?.trim();
      if (!name) return;

      try {
        const path = await createWorkspaceFolder(workspacePath, parentPath, name);
        await refreshWorkspaceChanges(workspacePath, [path]);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新文件夹。");
      }
    },
    [refreshWorkspaceChanges, workspacePath],
  );

  const handleRenameWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再重命名文件或文件夹。");
        return;
      }

      const oldAbsolutePath = workspaceEntryAbsolutePath(root, entryPath);
      const oldName = fileNameFromPath(entryPath);
      const name = window.prompt(kind === "folder" ? "重命名文件夹" : "重命名文件", oldName)?.trim();
      if (!name || name === oldName) return;

      const current = documentStateRef.current;
      const currentIsAffected = Boolean(current && isPathWithinEntry(current.path, oldAbsolutePath));
      if (currentIsAffected && current?.modified) {
        if (!window.confirm("当前文档有未保存修改，是否先保存后重命名？")) return;
        if (!(await saveDocument())) return;
      }

      try {
        const renamedPath = await renameWorkspaceEntry(root, entryPath, name);
        documentCacheRef.current.invalidate([oldAbsolutePath, renamedPath]);

        const rebaseTab = (tab: RecentFile): RecentFile => {
          const nextPath = rebaseWorkspacePath(tab.path, oldAbsolutePath, renamedPath);
          return nextPath === tab.path ? tab : { path: nextPath, name: fileNameFromPath(nextPath) };
        };
        const nextTabs = openTabsRef.current.map(rebaseTab);
        openTabsRef.current = nextTabs;
        setOpenTabs(nextTabs);
        saveOpenTabs(nextTabs);
        setRecentFiles((currentFiles) => {
          const nextFiles = currentFiles.map(rebaseTab);
          saveRecentFiles(nextFiles);
          return nextFiles;
        });

        const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
        if (cached) {
          const cachedTabs = nextTabs.filter(
            (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, root),
          );
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, {
            tabs: cachedTabs,
            activeDocumentPath: cached.activeDocumentPath
              ? rebaseWorkspacePath(cached.activeDocumentPath, oldAbsolutePath, renamedPath)
              : null,
          });
          persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, root);
        }

        let reopenFailed = false;
        if (currentIsAffected && current) {
          const nextCurrentPath = rebaseWorkspacePath(current.path, oldAbsolutePath, renamedPath);
          releaseDocumentResources(current.path);
          documentStateRef.current = null;
          setDocumentState(null);
          setSourceDraft("");
          sourceDraftRef.current = "";
          setDraftRecovery(null);
          setExternalChangePath(null);
          setMode("rendered");
          resetEditorHistory("", "");
          reopenFailed = !(await openPath(nextCurrentPath, true));
          if (reopenFailed) {
            setError("文件已重命名，但重新打开失败，请从文件树中再次打开。");
          }
        }

        await refreshWorkspaceChanges(root, [oldAbsolutePath, renamedPath]);
        notify(`已重命名${kind === "folder" ? "文件夹" : "文件"}：${name}`);
        if (!reopenFailed) setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法重命名工作区内容。");
      }
    },
    [notify, openPath, refreshWorkspaceChanges, releaseDocumentResources, resetEditorHistory, saveDocument],
  );

  const handleDeleteWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再删除文件或文件夹。");
        return;
      }

      const oldAbsolutePath = workspaceEntryAbsolutePath(root, entryPath);
      const label = fileNameFromPath(entryPath);
      const message =
        kind === "folder"
          ? `确定将文件夹“${label}”及其中的全部内容移入 Windows 回收站吗？`
          : `确定将文件“${label}”移入 Windows 回收站吗？`;
      if (!window.confirm(message)) return;

      const current = documentStateRef.current;
      const currentIsAffected = Boolean(current && isPathWithinEntry(current.path, oldAbsolutePath));
      if (currentIsAffected && current?.modified) {
        if (!window.confirm("当前文档有未保存修改，是否先保存后删除？")) return;
        if (!(await saveDocument())) return;
      }

      try {
        const currentIndex = current
          ? openTabsRef.current.findIndex((tab) => isSameDocumentPath(tab.path, current.path))
          : -1;
        const nextTabs = openTabsRef.current.filter((tab) => !isPathWithinEntry(tab.path, oldAbsolutePath));
        const affectedTabs = openTabsRef.current.filter((tab) => isPathWithinEntry(tab.path, oldAbsolutePath));
        for (const tab of affectedTabs) releaseDocumentResources(tab.path);
        documentCacheRef.current.invalidate([oldAbsolutePath]);
        await deleteWorkspaceEntry(root, entryPath);

        openTabsRef.current = nextTabs;
        setOpenTabs(nextTabs);
        saveOpenTabs(nextTabs);
        setRecentFiles((currentFiles) => {
          const nextFiles = currentFiles.filter((file) => !isPathWithinEntry(file.path, oldAbsolutePath));
          saveRecentFiles(nextFiles);
          return nextFiles;
        });

        const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
        if (cached) {
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, {
            tabs: nextTabs.filter(
              (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, root),
            ),
            activeDocumentPath: currentIsAffected ? null : cached.activeDocumentPath,
          });
          persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, root);
        }

        let nextTabFailed = false;
        if (currentIsAffected) {
          setDocumentState(null);
          documentStateRef.current = null;
          setSourceDraft("");
          sourceDraftRef.current = "";
          setDraftRecovery(null);
          setExternalChangePath(null);
          setMode("rendered");
          resetEditorHistory("", "");
          saveLastDocumentPath(null);

          const nextTab = nextTabs[currentIndex] ?? nextTabs[currentIndex - 1];
          if (nextTab) nextTabFailed = !(await openPath(nextTab.path, true));
        }

        await refreshWorkspaceChanges(root, [oldAbsolutePath]);
        notify(`已移入 Windows 回收站：${kind === "folder" ? "文件夹及其内容" : "文件"} ${label}`);
        if (!nextTabFailed) setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法删除工作区内容。");
      }
    },
    [notify, openPath, refreshWorkspaceChanges, releaseDocumentResources, resetEditorHistory, saveDocument],
  );

  const handleTransferWorkspaceEntry = useCallback(
    async (
      entryPath: string,
      destinationParentPath: string,
      mode: "copy" | "move",
      kind: "file" | "folder",
    ): Promise<boolean> => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError(`请先添加工作区，再${mode === "move" ? "移动" : "复制"}文件或文件夹。`);
        return false;
      }

      const oldAbsolutePath = workspaceEntryAbsolutePath(root, entryPath);
      const current = documentStateRef.current;
      const currentIsAffected = Boolean(current && isPathWithinEntry(current.path, oldAbsolutePath));
      if (currentIsAffected && current?.modified) {
        const actionLabel = mode === "move" ? "移动" : "复制";
        if (!window.confirm(`当前文档有未保存修改，是否先保存后${actionLabel}？`)) return false;
        if (!(await saveDocument())) return false;
      }

      try {
        const transferredPath =
          mode === "move"
            ? await moveWorkspaceEntry(root, entryPath, destinationParentPath)
            : await copyWorkspaceEntry(root, entryPath, destinationParentPath);
        documentCacheRef.current.invalidate([oldAbsolutePath, transferredPath]);

        let reopenFailed = false;
        if (mode === "move") {
          const rebaseTab = (tab: RecentFile): RecentFile => {
            const nextPath = rebaseWorkspacePath(tab.path, oldAbsolutePath, transferredPath);
            return nextPath === tab.path ? tab : { path: nextPath, name: fileNameFromPath(nextPath) };
          };
          const nextTabs = openTabsRef.current.map(rebaseTab);
          openTabsRef.current = nextTabs;
          setOpenTabs(nextTabs);
          saveOpenTabs(nextTabs);
          setRecentFiles((currentFiles) => {
            const nextFiles = currentFiles.map(rebaseTab);
            saveRecentFiles(nextFiles);
            return nextFiles;
          });

          const cached = mountedWorkspaceCacheRef.current.get(comparablePath(root));
          if (cached) {
            updateCachedWorkspace(mountedWorkspaceCacheRef.current, root, {
              tabs: nextTabs.filter(
                (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, root),
              ),
              activeDocumentPath: cached.activeDocumentPath
                ? rebaseWorkspacePath(cached.activeDocumentPath, oldAbsolutePath, transferredPath)
                : null,
            });
            persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, root);
          }

          if (currentIsAffected && current) {
            const nextCurrentPath = rebaseWorkspacePath(current.path, oldAbsolutePath, transferredPath);
            releaseDocumentResources(current.path);
            documentStateRef.current = null;
            setDocumentState(null);
            setSourceDraft("");
            sourceDraftRef.current = "";
            setDraftRecovery(null);
            setExternalChangePath(null);
            setMode("rendered");
            resetEditorHistory("", "");
            reopenFailed = !(await openPath(nextCurrentPath, true));
            if (reopenFailed) {
              setError("内容已移动，但重新打开当前文档失败，请从文件树中再次打开。");
            }
          }
        }

        await refreshWorkspaceChanges(root, [oldAbsolutePath, transferredPath]);
        notify(
          `${mode === "move" ? "已移动" : "已复制"}${kind === "folder" ? "文件夹" : "文件"}：${fileNameFromPath(transferredPath)}`,
        );
        if (!reopenFailed) setError(null);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `${mode === "move" ? "移动" : "复制"}工作区内容失败。`);
        return false;
      }
    },
    [notify, openPath, refreshWorkspaceChanges, releaseDocumentResources, resetEditorHistory, saveDocument],
  );

  const handleCopyWorkspacePath = useCallback(
    async (entryPath: string) => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime()) {
        setError("当前没有可复制的工作区路径。");
        return;
      }

      try {
        const path = workspaceEntryAbsolutePath(root, entryPath);
        await copyPlainText(path);
        notify("完整路径已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制路径失败。");
      }
    },
    [notify],
  );

  const handleCopyWorkspaceRelativePath = useCallback(
    async (entryPath: string) => {
      const relativePath = entryPath.replace(/[\\/]+/g, "\\").replace(/^\\+|\\+$/g, "");
      if (!relativePath) {
        setError("当前条目没有可复制的相对路径。");
        return;
      }

      try {
        await copyPlainText(relativePath);
        notify("相对路径已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制相对路径失败。");
      }
    },
    [notify],
  );

  const handleShowWorkspaceDetails = useCallback((details: WorkspaceEntryDetails) => {
    const root = workspacePathRef.current;
    const absolutePath =
      details.absolutePath ?? (root ? workspaceEntryAbsolutePath(root, details.relativePath) : details.relativePath);
    setWorkspaceEntryDetails({ ...details, absolutePath });
    setError(null);
  }, []);

  const handleDuplicateWorkspaceEntry = useCallback(
    async (entryPath: string, kind: "file" | "folder") => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime() || !entryPath.trim()) {
        setError("请先添加工作区，再复制文件或文件夹。");
        return;
      }

      const defaultName = duplicateEntryName(entryPath, kind);
      const name = window.prompt(kind === "folder" ? "复制文件夹" : "复制文件", defaultName)?.trim();
      if (!name) return;

      try {
        const duplicatedPath = await duplicateWorkspaceEntry(root, entryPath, name);
        await refreshWorkspaceChanges(root, [duplicatedPath]);
        notify(`已创建副本：${fileNameFromPath(duplicatedPath)}`);
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建工作区副本。");
      }
    },
    [notify, refreshWorkspaceChanges],
  );

  const handleRevealWorkspaceEntry = useCallback(async (entryPath: string) => {
    const root = workspacePathRef.current;
    if (!root || !isTauriRuntime()) {
      setError("请先添加工作区，再打开资源管理器。");
      return;
    }

    try {
      await revealWorkspaceEntry(root, entryPath);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法打开资源管理器。");
    }
  }, []);

  const handleCopyWorkspaceName = useCallback(
    async (entryPath: string) => {
      const name = fileNameFromPath(entryPath.replace(/[\\/]+$/, ""));
      if (!name) {
        setError("当前条目没有可复制的名称。");
        return;
      }

      try {
        await copyPlainText(name);
        notify("名称已复制到剪贴板。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制名称失败。");
      }
    },
    [notify],
  );

  const handleRefreshWorkspaceEntry = useCallback(
    async (entryPath: string) => {
      const root = workspacePathRef.current;
      if (!root || !isTauriRuntime()) {
        setError("请先添加工作区，再刷新文件树。");
        return;
      }

      notify("正在刷新文件树…", "info");
      if (entryPath.trim()) {
        await refreshWorkspaceChanges(root, [workspaceEntryAbsolutePath(root, entryPath)]);
      } else {
        await loadWorkspace(root, true);
      }
      notify("文件树已刷新。");
      setError(null);
    },
    [loadWorkspace, notify, refreshWorkspaceChanges],
  );

  const openSelectedFile = useCallback(async () => {
    const nativePaths = await chooseDocumentPaths();
    if (isTauriRuntime()) {
      if (nativePaths.length > 0) {
        await handleOpenPaths(nativePaths.map((path) => ({ path, kind: "document" as const })));
      }
      return;
    }
    inputRef.current?.click();
  }, [handleOpenPaths]);

  const closeGettingStarted = useCallback(() => {
    markGettingStartedSeen();
    setGuideOpen(false);
  }, []);

  const openDocumentFromGuide = useCallback(() => {
    closeGettingStarted();
    void openSelectedFile();
  }, [closeGettingStarted, openSelectedFile]);

  const addWorkspaceFromGuide = useCallback(() => {
    closeGettingStarted();
    void handleChooseWorkspace();
  }, [closeGettingStarted, handleChooseWorkspace]);

  const overwriteExternalChange = useCallback(() => {
    const current = documentStateRef.current;
    if (!current?.externallyModified) return;
    setExternalOverwriteConfirmationOpen(true);
  }, []);

  const cancelExternalOverwrite = useCallback(() => {
    setExternalOverwriteConfirmationOpen(false);
  }, []);

  const confirmExternalOverwrite = useCallback(() => {
    setExternalOverwriteConfirmationOpen(false);
    void saveDocument(true);
  }, [saveDocument]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;

    void (async () => {
      const paths = await initialPaths();
      if (isTauriRuntime()) {
        const hasStartupWorkspace = paths.some((entry) => entry.kind === "workspace");
        const savedWorkspace = loadWorkspacePath();
        if (!hasStartupWorkspace) {
          const candidates = [
            ...(savedWorkspace
              ? [
                  {
                    path: savedWorkspace,
                    name: fileNameFromPath(savedWorkspace.replace(/[\\/]+$/, "")) || savedWorkspace,
                  },
                ]
              : []),
            ...loadMountedWorkspaces(),
          ];
          const authorizedMounts: RecentWorkspace[] = [];
          const seen = new Set<string>();
          for (const candidate of candidates) {
            const candidateKey = comparablePath(candidate.path);
            if (!candidateKey || seen.has(candidateKey)) continue;
            seen.add(candidateKey);
            try {
              const authorizedWorkspace = await authorizeStoredPath(candidate.path, true);
              if (!active) return;
              authorizedMounts.push({
                path: authorizedWorkspace,
                name: fileNameFromPath(authorizedWorkspace.replace(/[\\/]+$/, "")) || candidate.name,
              });
            } catch {
              // Stale mounted workspaces are discarded without blocking launch.
            }
          }
          if (!active) return;
          setMountedWorkspaces(authorizedMounts);
          saveMountedWorkspaces(authorizedMounts);
          const activeWorkspace =
            authorizedMounts.find(
              (workspace) => comparablePath(workspace.path) === comparablePath(savedWorkspace ?? ""),
            ) ?? authorizedMounts[0];
          if (activeWorkspace) {
            await loadWorkspace(activeWorkspace.path, true);
          } else if (candidates.length > 0) {
            saveWorkspacePath(null);
            workspacePathRef.current = null;
            setWorkspacePath(null);
            setWorkspaceFiles([]);
            setWorkspaceFolders([]);
            setWorkspaceListingStatus({ truncated: false, scannedTotal: 0 });
            setWorkspaceIndex([]);
          }
        }

        if (paths.length === 0) {
          const activeWorkspacePath = loadWorkspacePath();
          const workspaceSession = activeWorkspacePath
            ? loadWorkspaceSessions().find(
                (session) => comparablePath(session.path) === comparablePath(activeWorkspacePath),
              )
            : undefined;
          const restoredTabs: RecentFile[] = [];
          for (const tab of workspaceSession?.tabs ?? loadOpenTabs()) {
            try {
              const authorizedDocument = await authorizeStoredPath(tab.path, false);
              if (!active) return;
              restoredTabs.push({ path: authorizedDocument, name: fileNameFromPath(authorizedDocument) });
            } catch {
              // Stale tabs are discarded without blocking the next launch.
            }
          }
          if (!active) return;
          setOpenTabs(restoredTabs);

          if (!workspaceSession) {
            const lastDocument = loadLastDocumentPath();
            const activeTab =
              restoredTabs.find((tab) => comparablePath(tab.path) === comparablePath(lastDocument ?? "")) ??
              restoredTabs[restoredTabs.length - 1];
            if (activeTab) {
              await openPath(activeTab.path);
            } else if (lastDocument) {
              try {
                const authorizedDocument = await authorizeStoredPath(lastDocument, false);
                if (!active) return;
                await openPath(authorizedDocument);
              } catch {
                if (active) saveLastDocumentPath(null);
              }
            }
          }
        }
      }

      if (active) await handleOpenPaths(paths);
      if (active) setTabSessionReady(true);
      const dispose = await subscribeToOpenPaths((nextPaths) => void handleOpenPaths(nextPaths));
      if (active) unlisten = dispose;
      else dispose?.();
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [handleOpenPaths, loadWorkspace, openPath]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let unlisten: (() => void) | null = null;
    void subscribeToFileDrop((event: FileDropEvent) => {
      if (!active) return;

      if (event.type === "enter") {
        const paths = event.paths.map((path) => path.trim()).filter(Boolean);
        const hasLikelyFile = paths.some((path) => /[\\/][^\\/]*\.[^\\/.]+$/.test(path));
        updateFileDropState(
          "native",
          hasLikelyFile ? classifyFileDropPaths(paths, (path) => Boolean(documentKindFromPath(path))) : "unknown",
        );
        return;
      }

      if (event.type === "over") {
        if (!fileDropStateRef.current.active) updateFileDropState("native", "unknown");
        return;
      }

      if (event.type === "leave") {
        resetFileDropState();
        return;
      }

      const paths = [...event.paths];
      resetFileDropState();
      void resolveOpenPaths(paths)
        .then(async (entries) => {
          if (!active) return;
          if (entries.length === 0) {
            notify("拖入的路径中没有可打开的文件或阅读库。", "info");
            return;
          }

          const outcome = await handleOpenPaths(entries);
          if (!active || outcome.cancelled) return;

          const skippedCount = Math.max(0, paths.length - entries.length);
          if (outcome.openedCount > 0) notify(`已打开 ${outcome.openedCount} 个拖入项目。`);
          if (outcome.duplicateCount > 0) {
            notify(`已忽略 ${outcome.duplicateCount} 个重复路径。`, "info");
          }
          if (skippedCount > 0) {
            notify(`已跳过 ${skippedCount} 个不支持或无法访问的路径。`, "info");
          }
          if (outcome.failedCount > 0) {
            notify(`有 ${outcome.failedCount} 个拖入项目打开失败，请检查文件类型或权限。`, "error");
          }
          if (outcome.openedCount === 0 && outcome.failedCount === 0 && outcome.duplicateCount === 0) {
            notify("没有打开任何项目。", "info");
          }
        })
        .catch((cause) => {
          if (active) notify(cause instanceof Error ? cause.message : "无法打开拖入的路径。", "error");
        });
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose?.();
    });

    return () => {
      active = false;
      unlisten?.();
      resetFileDropState();
    };
  }, [handleOpenPaths, notify, resetFileDropState, updateFileDropState]);

  useEffect(() => {
    if (!workspacePath || !isTauriRuntime()) return;

    let active = true;
    let unwatch: (() => void) | null = null;
    const pendingWorkspacePaths = pendingWorkspacePathsRef.current;
    setWorkspaceWatchError(null);

    void subscribeToWorkspaceChanges(workspacePath, (paths) => {
      if (!active) return;

      documentCacheRef.current.invalidate(paths);
      for (const path of paths) pendingWorkspacePaths.add(path);
      if (workspaceReloadTimerRef.current !== null) {
        window.clearTimeout(workspaceReloadTimerRef.current);
      }
      workspaceReloadTimerRef.current = window.setTimeout(() => {
        workspaceReloadTimerRef.current = null;
        const changedPaths = [...pendingWorkspacePaths];
        pendingWorkspacePaths.clear();
        void refreshWorkspaceChanges(workspacePath, changedPaths);
      }, 280);

      const current = documentStateRef.current;
      if (!current || current.path.startsWith("browser://")) return;

      const currentPath = comparablePath(current.path);
      const writtenUntil = selfWrittenPathsRef.current.get(currentPath);
      const action = resolveExternalChangeAction({
        changedPaths: paths,
        currentPath: current.path,
        modified: current.modified,
        selfWriting: selfWritingPathsRef.current.has(currentPath),
        selfWrittenUntil: writtenUntil,
        now: Date.now(),
      });
      if (action === "ignore") return;
      if (writtenUntil !== undefined) {
        selfWrittenPathsRef.current.delete(currentPath);
      }

      if (action === "notify") {
        setExternalChangePath(current.path);
        setDocumentState((latest) =>
          latest && isSameDocumentPath(latest.path, current.path) ? { ...latest, externallyModified: true } : latest,
        );
      } else {
        void openPath(current.path, true);
      }
    })
      .then((dispose) => {
        if (!active) {
          dispose?.();
        } else {
          unwatch = dispose;
        }
      })
      .catch(() => {
        if (active) setWorkspaceWatchError("文件监听不可用，目录仍可手动刷新。");
      });

    return () => {
      active = false;
      if (workspaceReloadTimerRef.current !== null) {
        window.clearTimeout(workspaceReloadTimerRef.current);
        workspaceReloadTimerRef.current = null;
      }
      pendingWorkspacePaths.clear();
      unwatch?.();
    };
  }, [openPath, refreshWorkspaceChanges, workspacePath]);

  useEffect(() => {
    const query = workspaceQuery.trim();
    if (!workspacePath || !isTauriRuntime() || query.length < 2) {
      setWorkspaceResults([]);
      setWorkspaceSearchLoading(false);
      return;
    }

    let active = true;
    setWorkspaceSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(workspacePath, query)
        .then((results) => {
          if (active) setWorkspaceResults(results);
        })
        .catch((cause) => {
          if (active) {
            setWorkspaceResults([]);
            setError(cause instanceof Error ? cause.message : "工作区搜索失败。");
          }
        })
        .finally(() => {
          if (active) setWorkspaceSearchLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [workspacePath, workspaceQuery, workspaceRevision]);

  const requestEditorInsert = useCallback(
    (kind: EditorInsertKind) => {
      const currentDocument = documentStateRef.current;
      if (!currentDocument || !isEditableDocument(currentDocument.kind) || mode === "rendered") {
        notify("请先进入编辑模式，再使用插入工具。", "info");
        return;
      }
      setRequestedInsertKind(kind);
    },
    [mode, notify],
  );

  const handleEditorInsertRequestHandled = useCallback(() => {
    setRequestedInsertKind(null);
  }, []);

  // Keep the mode transition in one place so toolbar and keyboard shortcuts cannot drift apart.
  const toggleDocumentMode = useCallback(() => {
    const currentDocument = documentStateRef.current;
    if (!currentDocument || !isEditableDocument(currentDocument.kind)) return;

    if (currentDocument.kind === "markdown" && !checkMarkdownEditorSafety(sourceDraftRef.current).safe) {
      notify("该 Markdown 含有暂不支持的结构，已切换到源码模式以避免丢失内容。", "info");
    }

    setMode((current) => {
      if (currentDocument.kind !== "markdown") return current === "source" ? "rendered" : "source";
      if (current === "rendered") {
        return checkMarkdownEditorSafety(sourceDraftRef.current).safe ? "wysiwyg" : "source";
      }
      if (current === "wysiwyg") return "source";
      return "rendered";
    });
  }, [notify]);

  const toggleReadingEditing = useCallback(() => {
    const currentDocument = documentStateRef.current;
    if (!currentDocument || !isEditableDocument(currentDocument.kind)) return;

    setMode((current) => {
      if (current !== "rendered") return "rendered";
      if (currentDocument.kind !== "markdown") return "source";
      return checkMarkdownEditorSafety(sourceDraftRef.current).safe ? "wysiwyg" : "source";
    });
  }, []);

  const handleFindEditorText = useCallback((text: string) => {
    const query = text.trim();
    if (!query) return;
    setSearchOpen(true);
    setSearchQuery(query);
    setSearchResultIndex(0);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const eventTarget = event.target instanceof HTMLElement ? event.target : null;
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const isCodeMirrorEditor = Boolean(eventTarget?.closest(".cm-editor") ?? activeElement?.closest(".cm-editor"));
      const isTextEntry = Boolean(
        eventTarget?.closest('input, textarea, [contenteditable="true"], .cm-editor') ??
        activeElement?.closest('input, textarea, [contenteditable="true"], .cm-editor'),
      );
      const zoomKey = event.key;
      const isZoomShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.isComposing &&
        !isTextEntry &&
        mode === "rendered" &&
        ["markdown", "text", "docx"].includes(documentStateRef.current?.kind ?? "") &&
        (event.code === "Equal" ||
          event.code === "NumpadAdd" ||
          event.code === "Minus" ||
          event.code === "NumpadSubtract" ||
          event.code === "Digit0" ||
          event.code === "Numpad0" ||
          zoomKey === "+" ||
          zoomKey === "=" ||
          zoomKey === "-" ||
          zoomKey === "0");
      if (isZoomShortcut) {
        event.preventDefault();
        if (event.code === "Digit0" || event.code === "Numpad0" || zoomKey === "0") {
          setReadingZoom(READING_ZOOM_DEFAULT);
        } else {
          setReadingZoom(
            stepReadingZoom(
              preferencesRef.current.readingZoom,
              event.code === "Minus" || event.code === "NumpadSubtract" || zoomKey === "-" ? "out" : "in",
            ),
          );
        }
        return;
      }
      if (
        !isTextEntry &&
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.key === "ArrowLeft" &&
        canGoBack(navigationHistoryRef.current)
      ) {
        event.preventDefault();
        void handleNavigateBack();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f" &&
        (event.defaultPrevented || isCodeMirrorEditor)
      ) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (event.shiftKey) {
          void handleChooseWorkspace();
          return;
        }
        void openSelectedFile();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDocument();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        toggleReadingEditing();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k" && !event.defaultPrevented) {
        if (mode === "wysiwyg" || mode === "source") {
          event.preventDefault();
          requestEditorInsert("link");
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickOpen(true);
      }
      if (!focusMode && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed((current) => !current);
      }
      if (!focusMode && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        setRightPanelOpen((current) => !current);
      }
      if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        setFocusMode(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "Enter" && documentStateRef.current) {
        event.preventDefault();
        setFocusMode((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    focusMode,
    handleChooseWorkspace,
    handleNavigateBack,
    mode,
    openSelectedFile,
    requestEditorInsert,
    saveDocument,
    setReadingZoom,
    toggleReadingEditing,
  ]);

  useEffect(() => {
    const handleEditorHistoryShortcut = (event: KeyboardEvent) => {
      if (event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (mode !== "source" && mode !== "wysiwyg") return;

      const target = event.target instanceof Element ? event.target : null;
      const editorSurface = target?.closest(".source-editor, .wysiwyg-editor");
      const activeElement = document.activeElement;
      const focusIsDocument = activeElement === document.body || activeElement === document.documentElement;
      if (!editorSurface && !focusIsDocument) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      event.stopPropagation();
      if (isUndo) undoEditor(editorSurface);
      else redoEditor(editorSurface);
    };

    window.addEventListener("keydown", handleEditorHistoryShortcut, true);
    return () => window.removeEventListener("keydown", handleEditorHistoryShortcut, true);
  }, [mode, redoEditor, undoEditor]);

  useEffect(() => {
    const path = documentState?.path;
    const kind = documentState?.kind;
    const requestId = ++sourceRenderRequestRef.current;
    if (mode !== "source" || !path || !kind || !isEditableDocument(kind)) return;

    const nextSource = sourceDraft;
    const cancel = scheduleSourceRender(() => {
      void renderSource(path, nextSource, {
        allowRemoteResources: preferences.allowRemoteResources,
      })
        .then((rendered) => {
          if (requestId !== sourceRenderRequestRef.current) return;
          setDocumentState((current) => (current?.path === path ? { ...current, rendered } : current));
        })
        .catch((cause) => {
          if (requestId === sourceRenderRequestRef.current) {
            setError(cause instanceof Error ? cause.message : "文档渲染失败。");
          }
        });
    });

    return cancel;
  }, [documentState?.kind, documentState?.path, mode, preferences.allowRemoteResources, sourceDraft]);

  useEffect(() => {
    const current = documentStateRef.current;
    if ((mode !== "rendered" && mode !== "wysiwyg") || !current || !isEditableDocument(current.kind)) return;

    const requestId = ++sourceRenderRequestRef.current;
    const path = current.path;
    const cancel = scheduleSourceRender(() => {
      void renderSource(path, sourceDraft, {
        allowRemoteResources: preferences.allowRemoteResources,
      })
        .then((rendered) => {
          if (requestId !== sourceRenderRequestRef.current) return;
          setDocumentState((latest) => (latest?.path === path ? { ...latest, rendered } : latest));
        })
        .catch((cause) => {
          if (requestId === sourceRenderRequestRef.current) {
            setError(cause instanceof Error ? cause.message : "文档渲染失败。");
          }
        });
    });

    return cancel;
  }, [mode, preferences.allowRemoteResources, sourceDraft]);

  const updateSource = useCallback((nextSource: string, options: { merge?: boolean } = {}) => {
    const current = documentStateRef.current;
    if (!current || !isEditableDocument(current.kind)) return;

    const history = editorHistoryRef.current;
    const nextHistory = isSameDocumentPath(history.documentKey, current.path)
      ? recordEditorChange(history, nextSource, options)
      : createEditorHistory(current.path, nextSource);
    if (nextHistory !== history) {
      editorHistoryRef.current = nextHistory;
      setEditorHistory(nextHistory);
    }
    sourceDraftRef.current = nextSource;
    setSourceDraft(nextSource);
    setDocumentState((document) => (document ? { ...document, modified: nextSource !== document.source } : document));
  }, []);

  useEffect(() => {
    const current = documentState;
    if (!current || !current.modified || !isEditableDocument(current.kind) || current.path.startsWith("browser://")) {
      return;
    }

    const timer = window.setTimeout(() => {
      const result = saveDraftSnapshot({
        path: current.path,
        draft: sourceDraft,
        baseSource: current.source,
        savedAt: Date.now(),
      });
      handleDraftSaveResult(result);
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [
    documentState,
    documentState?.kind,
    documentState?.modified,
    documentState?.path,
    documentState?.source,
    sourceDraft,
    handleDraftSaveResult,
  ]);

  useEffect(() => {
    const current = documentStateRef.current;
    const requestId = ++previousVersionRequestIdRef.current;
    if (!current || !isEditableDocument(current.kind) || current.path.startsWith("browser://") || !isTauriRuntime()) {
      setPreviousVersion(null);
      return;
    }

    let active = true;
    void readPreviousVersion(current.path)
      .then((source) => {
        if (!active || requestId !== previousVersionRequestIdRef.current) return;
        if (!source || areDraftSourcesEquivalent(current.source, source)) {
          setPreviousVersion(null);
          return;
        }
        setPreviousVersion({ path: current.path, source });
      })
      .catch(() => {
        if (active && requestId === previousVersionRequestIdRef.current) setPreviousVersion(null);
      });

    return () => {
      active = false;
    };
  }, [documentState?.kind, documentState?.path, documentState?.source]);

  const recoverDraft = useCallback(() => {
    if (!draftRecovery || !isSameDocumentPath(documentStateRef.current?.path ?? "", draftRecovery.path)) return;
    updateSource(draftRecovery.draft);
    setDraftRecovery(null);
    setMode("source");
  }, [draftRecovery, updateSource]);

  const prepareDraftComparison = useCallback(
    async (snapshot: RecoverySnapshot, current: OpenDocument | null, isCurrentDocument: boolean) => {
      const requestId = draftComparisonRequestIdRef.current + 1;
      draftComparisonRequestIdRef.current = requestId;
      const currentDocumentModified = Boolean(isCurrentDocument && current?.modified);
      const isBrowserDocument = Boolean(isCurrentDocument && current?.path.startsWith("browser://"));

      if (!isTauriRuntime() || isBrowserDocument) {
        const comparisonSource = isCurrentDocument && current ? current.source : snapshot.baseSource;
        setDraftComparison({
          snapshot,
          comparisonSource,
          comparisonLabel: isCurrentDocument ? "当前打开版本（浏览器预览）" : "草稿保存时的原文（浏览器预览）",
          comparisonIsCurrent: isCurrentDocument,
          comparisonStatus: "ready",
          comparisonError: null,
          currentDocumentModified,
          isCurrentDocument,
          sourceChangedSinceDraft: !areDraftSourcesEquivalent(comparisonSource, snapshot.baseSource),
          recoveryKind: "draft",
        });
        return;
      }

      setDraftComparison({
        snapshot,
        comparisonSource: null,
        comparisonLabel: "当前磁盘版本",
        comparisonIsCurrent: true,
        comparisonStatus: "loading",
        comparisonError: null,
        currentDocumentModified,
        isCurrentDocument,
        sourceChangedSinceDraft: false,
        recoveryKind: "draft",
      });

      try {
        const path = isCurrentDocument && current ? current.path : await authorizeStoredPath(snapshot.path, false);
        const kind = documentKindFromPath(path);
        if (!kind || !isEditableDocument(kind)) {
          throw new Error("只能比较 Markdown 或纯文本草稿。");
        }
        const comparisonSource = await readTextFile(path);
        if (draftComparisonRequestIdRef.current !== requestId) return;

        setDraftComparison({
          snapshot,
          comparisonSource,
          comparisonLabel: "当前磁盘版本",
          comparisonIsCurrent: true,
          comparisonStatus: "ready",
          comparisonError: null,
          currentDocumentModified,
          isCurrentDocument,
          sourceChangedSinceDraft: !areDraftSourcesEquivalent(comparisonSource, snapshot.baseSource),
          recoveryKind: "draft",
        });
      } catch (cause) {
        if (draftComparisonRequestIdRef.current !== requestId) return;
        setDraftComparison({
          snapshot,
          comparisonSource: null,
          comparisonLabel: "当前磁盘版本",
          comparisonIsCurrent: true,
          comparisonStatus: "unavailable",
          comparisonError: cause instanceof Error ? cause.message : "当前文件不可访问，请确认文件仍存在且有读取权限。",
          currentDocumentModified,
          isCurrentDocument,
          sourceChangedSinceDraft: false,
          recoveryKind: "draft",
        });
      }
    },
    [],
  );

  const preparePreviousVersionComparison = useCallback(
    async (snapshot: RecoverySnapshot, current: OpenDocument | null) => {
      const requestId = draftComparisonRequestIdRef.current + 1;
      draftComparisonRequestIdRef.current = requestId;
      const currentDocumentModified = Boolean(current?.modified);

      if (!current || !isTauriRuntime() || current.path.startsWith("browser://")) return;

      setDraftComparison({
        snapshot,
        comparisonSource: null,
        comparisonLabel: "当前磁盘版本",
        comparisonIsCurrent: true,
        comparisonStatus: "loading",
        comparisonError: null,
        currentDocumentModified,
        isCurrentDocument: true,
        sourceChangedSinceDraft: false,
        recoveryKind: "previous-save",
      });

      try {
        const comparisonSource = await readTextFile(current.path);
        if (draftComparisonRequestIdRef.current !== requestId) return;

        setDraftComparison({
          snapshot: { ...snapshot, baseSource: comparisonSource },
          comparisonSource,
          comparisonLabel: "当前磁盘版本",
          comparisonIsCurrent: true,
          comparisonStatus: "ready",
          comparisonError: null,
          currentDocumentModified,
          isCurrentDocument: true,
          sourceChangedSinceDraft: false,
          recoveryKind: "previous-save",
        });
      } catch (cause) {
        if (draftComparisonRequestIdRef.current !== requestId) return;
        setDraftComparison({
          snapshot,
          comparisonSource: null,
          comparisonLabel: "当前磁盘版本",
          comparisonIsCurrent: true,
          comparisonStatus: "unavailable",
          comparisonError: cause instanceof Error ? cause.message : "当前文件不可访问，请确认文件仍存在且有读取权限。",
          currentDocumentModified,
          isCurrentDocument: true,
          sourceChangedSinceDraft: false,
          recoveryKind: "previous-save",
        });
      }
    },
    [],
  );

  const previewCurrentDraft = useCallback(() => {
    const snapshot = draftRecovery;
    const current = documentStateRef.current;
    if (!snapshot || !current || !isSameDocumentPath(current.path, snapshot.path)) return;

    void prepareDraftComparison(snapshot, current, true);
  }, [draftRecovery, prepareDraftComparison]);

  const previewPreviousVersion = useCallback(() => {
    const candidate = previousVersion;
    const current = documentStateRef.current;
    if (!candidate || !current || !isSameDocumentPath(current.path, candidate.path)) return;

    void preparePreviousVersionComparison(
      {
        path: candidate.path,
        draft: candidate.source,
        baseSource: current.source,
      },
      current,
    );
  }, [preparePreviousVersionComparison, previousVersion]);

  const previewDraftSnapshot = useCallback(
    (path: string) => {
      const snapshot = draftSnapshots.find((item) => isSameDocumentPath(item.path, path));
      if (!snapshot) return;

      const current = documentStateRef.current;
      const isCurrentDocument = Boolean(current && isSameDocumentPath(current.path, snapshot.path));
      setDraftRecoveryOpen(false);
      void prepareDraftComparison(snapshot, current, isCurrentDocument);
    },
    [draftSnapshots, prepareDraftComparison],
  );

  const closeDraftComparison = useCallback(() => {
    draftComparisonRequestIdRef.current += 1;
    setDraftComparison(null);
  }, []);

  const retryDraftComparison = useCallback(() => {
    const request = draftComparison;
    if (!request) return;
    const current = documentStateRef.current;
    const isCurrentDocument = Boolean(current && isSameDocumentPath(current.path, request.snapshot.path));
    if (request.recoveryKind === "previous-save") {
      if (isCurrentDocument) void preparePreviousVersionComparison(request.snapshot, current);
      return;
    }
    void prepareDraftComparison(request.snapshot, current, isCurrentDocument);
  }, [draftComparison, prepareDraftComparison, preparePreviousVersionComparison]);

  const discardDraft = useCallback(() => {
    if (draftRecovery) setDraftDiscardRequest({ path: draftRecovery.path, fromCenter: false });
  }, [draftRecovery]);

  const deferDraftRecovery = useCallback(() => {
    setDraftRecovery(null);
  }, []);

  const openDraftSnapshot = useCallback(
    async (path: string) => {
      try {
        const authorizedPath = await authorizeStoredPath(path, false);
        if (!confirmDocumentReplacement([authorizedPath], "打开另一个草稿")) {
          return;
        }
        const opened = await openPath(authorizedPath);
        if (opened) setDraftRecoveryOpen(false);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "草稿对应的文档无法打开，请确认文件仍然存在。");
      }
    },
    [confirmDocumentReplacement, openPath],
  );

  const handleDraftComparisonAction = useCallback(() => {
    const request = draftComparison;
    if (!request || request.comparisonStatus !== "ready" || request.comparisonSource === null) return;

    closeDraftComparison();
    if (request.isCurrentDocument) {
      if (request.recoveryKind === "previous-save") {
        updateSource(request.snapshot.draft);
        setPreviousVersion(null);
        setMode("source");
        return;
      }
      recoverDraft();
      return;
    }
    void openDraftSnapshot(request.snapshot.path);
  }, [closeDraftComparison, draftComparison, openDraftSnapshot, recoverDraft, updateSource]);

  const requestDraftDiscardByPath = useCallback((path: string) => {
    setDraftRecoveryOpen(false);
    setDraftDiscardRequest({ path, fromCenter: true });
  }, []);

  const cancelDraftDiscard = useCallback(() => {
    const request = draftDiscardRequest;
    setDraftDiscardRequest(null);
    if (request?.fromCenter) setDraftRecoveryOpen(true);
  }, [draftDiscardRequest]);

  const confirmDraftDiscard = useCallback(() => {
    const request = draftDiscardRequest;
    if (!request) return;

    const remaining = clearDraftSnapshot(request.path);
    setDraftSnapshots(remaining);
    if (isSameDocumentPath(draftRecovery?.path ?? "", request.path)) setDraftRecovery(null);
    setDraftDiscardRequest(null);
    if (request.fromCenter) setDraftRecoveryOpen(remaining.length > 0);
  }, [draftDiscardRequest, draftRecovery?.path]);

  const clearAllDrafts = useCallback(() => {
    if (draftSnapshots.length === 0 || !window.confirm("确定清空全部未保存草稿吗？此操作无法撤销。")) return;
    clearAllDraftSnapshots();
    setDraftSnapshots([]);
    setDraftRecovery(null);
  }, [draftSnapshots.length]);

  const saveClipboardImageAsset = useCallback(async (image: File, documentPath: string): Promise<string> => {
    if (image.size > MAX_CLIPBOARD_IMAGE_BYTES) {
      throw new Error("剪贴板图片不能超过 10 MB。");
    }

    const bytes = await clipboardImageToPng(image);
    if (bytes.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) {
      throw new Error("转换后的剪贴板图片不能超过 10 MB。");
    }

    const baseName = clipboardAssetFileName(bytes);
    let assetName = baseName;
    let assetPath = clipboardAssetPath(documentPath, assetName);
    for (let suffix = 2; suffix <= 100 && (await fileExists(assetPath)); suffix += 1) {
      assetName = baseName.replace(/\.png$/i, `-${suffix}.png`);
      assetPath = clipboardAssetPath(documentPath, assetName);
    }
    if (await fileExists(assetPath)) throw new Error("无法为剪贴板图片生成不重复的文件名。");

    await writeBinaryFile(assetPath, bytes);
    return assetName;
  }, []);

  const handleWysiwygPasteImage = useCallback(
    async (image: File): Promise<string | null> => {
      const current = documentStateRef.current;
      if (!isTauriRuntime()) {
        setError("浏览器预览模式不能保存剪贴板图片，请使用桌面版 Moyang Reader。");
        return null;
      }
      if (!current || current.kind !== "markdown") {
        setError("剪贴板图片只能粘贴到 Markdown 文档中。");
        return null;
      }
      if (!workspacePathRef.current || current.path.startsWith("browser://")) {
        setError("请先添加文档所在的文件夹，再粘贴剪贴板图片。");
        return null;
      }

      const path = current.path;
      try {
        const assetName = await saveClipboardImageAsset(image, path);
        if (documentStateRef.current?.path !== path) {
          throw new Error("文档已切换，图片已保存但未插入引用。");
        }
        setError(null);
        return `assets/${assetName}`;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法保存剪贴板图片。");
        return null;
      }
    },
    [saveClipboardImageAsset],
  );

  const handleSourcePaste = useCallback(
    (context: SourceEditorPasteContext) => {
      const image = findClipboardImage(context.clipboardData);
      if (!image) return false;

      context.preventDefault();
      const current = documentStateRef.current;
      if (!isTauriRuntime()) {
        setError("浏览器预览模式不能保存剪贴板图片，请使用桌面版 Moyang Reader。");
        return true;
      }
      if (!current || current.kind !== "markdown") {
        setError("剪贴板图片只能粘贴到 Markdown 源码文档中。");
        return true;
      }
      if (!workspacePathRef.current || current.path.startsWith("browser://")) {
        setError("请先添加文档所在的文件夹，再粘贴剪贴板图片。");
        return true;
      }

      const initialStart = context.selectionStart;
      const initialEnd = context.selectionEnd;
      const initialValue = context.value;
      const path = current.path;

      void (async () => {
        try {
          const assetName = await saveClipboardImageAsset(image, path);
          if (documentStateRef.current?.path !== path) {
            throw new Error("文档已切换，未插入剪贴板图片。");
          }
          if (documentStateRef.current?.path !== path) {
            throw new Error("文档已切换，图片已保存但未插入引用。");
          }

          if (sourceDraftRef.current !== initialValue) {
            throw new Error("文档内容已变化，未插入剪贴板图片。");
          }

          const start = initialStart;
          const end = initialEnd;
          updateSource(insertTextAtSelection(initialValue, start, end, clipboardAssetReference(assetName)));
          setError(null);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "无法保存剪贴板图片。");
        }
      })();
      return true;
    },
    [saveClipboardImageAsset, updateSource],
  );

  const buildCurrentExportHtml = useCallback(async (): Promise<string | null> => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return null;

    const body = isTauriRuntime()
      ? await inlineLocalImages(
          documentState.rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(documentState.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        )
      : documentState.rendered.html;

    return buildHtmlExport(
      documentState.name,
      body,
      {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
      },
      documentState.rendered.toc,
    );
  }, [documentState, preferences.exportMargin, preferences.exportOrientation, preferences.exportPaper]);

  const savePdfDocument = useCallback(
    async (html: string, defaultPath: string): Promise<boolean> => {
      if (!isTauriRuntime()) {
        await printHtmlDocument(html);
        return true;
      }

      const path = await chooseSavePath(defaultPath, "pdf");
      if (!path) return false;
      await exportPdfFile(path, html);
      notify(`已保存 PDF：${fileNameFromPath(path)}。`);
      return true;
    },
    [notify],
  );

  const handleExport = useCallback(async () => {
    if ((documentState?.kind === "pdf" || documentState?.kind === "image") && documentState.previewUrl) {
      const anchor = document.createElement("a");
      anchor.href = documentState.previewUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
      return;
    }
    if (!documentState) return;

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      const saved = await savePdfDocument(html, pathWithExtension(documentState.path, "pdf"));
      if (!saved) return;
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 PDF 失败。");
    }
  }, [buildCurrentExportHtml, documentState, savePdfDocument]);

  const handlePreviewPrint = useCallback(async () => {
    if (!documentState) return;

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      setPrintPreview({
        title: documentState.name,
        html,
        defaultPath: pathWithExtension(documentState.path, "pdf"),
        actionLabel: isTauriRuntime() ? "保存 PDF" : "打印 / 保存 PDF",
        actionHint: isTauriRuntime()
          ? "Windows 桌面版会将 PDF 保存到所选位置 · 预览内容不会修改原文"
          : "预计页数以系统打印对话框为准 · 预览内容不会修改原文",
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成打印版式预览失败。");
    }
  }, [
    buildCurrentExportHtml,
    documentState,
    preferences.exportMargin,
    preferences.exportOrientation,
    preferences.exportPaper,
  ]);

  const finishPdfBatch = useCallback((cancelled: boolean) => {
    const batch = pdfBatchExportRef.current;
    if (!batch) return;

    const failureSummary = summarizeExportFailures(
      batch.skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
    );
    const suffix = failureSummary ? `，跳过 ${batch.skippedFiles.length} 个：${failureSummary}` : "";
    setWorkspaceExportNotice(
      cancelled
        ? `已取消批量打印，已整理 ${batch.exported} 篇文档${suffix}。`
        : `已完成批量打印，共 ${batch.exported} 篇文档${suffix}。`,
    );
    pdfBatchExportRef.current = null;
    workspaceExportAbortRef.current = null;
    setWorkspaceExporting(false);
    setWorkspaceExportProgress(null);
    setPrintPreview(null);
  }, []);

  const prepareNextPdfBatch = useCallback(async () => {
    const batch = pdfBatchExportRef.current;
    const controller = workspaceExportAbortRef.current;
    if (!batch || !controller) return;

    const documents: Array<{ title: string; body: string }> = [];
    while (batch.nextIndex < batch.files.length && documents.length < BATCH_EXPORT_CHUNK_SIZE) {
      if (controller.signal.aborted) {
        finishPdfBatch(true);
        return;
      }

      const file = batch.files[batch.nextIndex];
      batch.nextIndex += 1;
      setWorkspaceExportProgress({ current: batch.nextIndex, total: batch.files.length, fileName: file.relativePath });
      try {
        const rendered =
          file.kind === "docx"
            ? await renderDocx(await readBinaryFile(file.path), {
                allowRemoteResources: preferencesRef.current.allowRemoteResources,
              })
            : await renderSource(
                file.kind === "text" ? "workspace-export.txt" : "workspace-export.md",
                await readTextFile(file.path),
                {
                  allowRemoteResources: preferencesRef.current.allowRemoteResources,
                },
              );
        const body = await inlineLocalImages(
          rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(file.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        );
        documents.push({ title: file.relativePath, body });
        batch.exported += 1;
      } catch {
        batch.skippedFiles.push({ fileName: file.relativePath, reason: "读取失败" });
        setWorkspaceExportFailures([...batch.skippedFiles]);
      }
    }

    if (controller.signal.aborted) {
      finishPdfBatch(true);
      return;
    }
    if (documents.length === 0) {
      finishPdfBatch(false);
      if (batch.exported === 0) setError("当前筛选中没有可打印的 Markdown、文本或 Word 文档。");
      return;
    }

    batch.volumeNumber += 1;
    setPrintPreview({
      title: `${batch.title} · 第 ${batch.volumeNumber} 卷`,
      html: buildBatchHtmlExport(`${batch.title} · 第 ${batch.volumeNumber} 卷`, documents, batch.options),
      paper: batch.options.paper,
      orientation: batch.options.orientation,
      margin: batch.options.margin,
    });
    setWorkspaceExportNotice(`第 ${batch.volumeNumber} 卷已准备，打印后自动继续。`);
    setWorkspaceExporting(false);
    setWorkspaceExportProgress(null);
  }, [finishPdfBatch]);

  const handlePrintPreview = useCallback(async () => {
    if (!printPreview) return;

    try {
      const batch = pdfBatchExportRef.current;
      if (batch) {
        await printHtmlDocument(printPreview.html);
        if (batch.nextIndex < batch.files.length) {
          await prepareNextPdfBatch();
        } else {
          finishPdfBatch(false);
        }
      } else {
        if (!documentState) return;
        const saved = await savePdfDocument(
          printPreview.html,
          printPreview.defaultPath ?? pathWithExtension(documentState.path, "pdf"),
        );
        if (!saved) return;
        setPrintPreview(null);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存 PDF 失败。");
    }
  }, [documentState, finishPdfBatch, prepareNextPdfBatch, printPreview, savePdfDocument]);

  const handleClosePrintPreview = useCallback(() => {
    if (pdfBatchExportRef.current) finishPdfBatch(true);
    else setPrintPreview(null);
  }, [finishPdfBatch]);

  const handleCopy = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    try {
      await copyRichText(documentState.rendered.html);
      setCopyFeedback(true);
      window.setTimeout(() => setCopyFeedback(false), 1_600);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制文档失败。");
    }
  }, [documentState]);

  const handleExportMarkdown = useCallback(async () => {
    if (!documentState || !isEditableDocument(documentState.kind)) return;

    const extension = documentState.kind === "text" ? "txt" : "md";
    const contents = sourceDraft;
    try {
      if (isTauriRuntime()) {
        const path = await chooseSavePath(pathWithExtension(documentState.path, extension), "markdown");
        if (!path) return;
        await writeTextFile(path, contents);
      } else {
        downloadText(fileNameWithExtension(documentState.name, extension), contents);
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 Markdown 失败。");
    }
  }, [documentState, sourceDraft]);

  const handleExportHtml = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    const body = isTauriRuntime()
      ? await inlineLocalImages(
          documentState.rendered.html,
          (source) => {
            const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
            if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
            return resolveRelativePath(documentState.path, safeDecode(target));
          },
          readBinaryFile,
          imageMimeType,
          fileSize,
        )
      : documentState.rendered.html;
    const contents = buildHtmlExport(
      documentState.name,
      body,
      {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
      },
      documentState.rendered.toc,
    );
    try {
      if (isTauriRuntime()) {
        const path = await chooseSavePath(pathWithExtension(documentState.path, "html"), "html");
        if (!path) return;
        await writeTextFile(path, contents);
      } else {
        downloadText(fileNameWithExtension(documentState.name, "html"), contents, "text/html");
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 HTML 失败。");
    }
  }, [documentState, preferences.exportMargin, preferences.exportOrientation, preferences.exportPaper]);

  const handleExportDocx = useCallback(async () => {
    if (!documentState || documentState.kind === "pdf" || documentState.kind === "image") return;

    try {
      const body = isTauriRuntime()
        ? await inlineLocalImages(
            documentState.rendered.html,
            (source) => {
              const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
              if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
              return resolveRelativePath(documentState.path, safeDecode(target));
            },
            readBinaryFile,
            imageMimeType,
            fileSize,
          )
        : documentState.rendered.html;
      const contents = await buildDocxExport(documentState.name, body, {
        paper: preferences.exportPaper,
        orientation: preferences.exportOrientation,
        margin: preferences.exportMargin,
      });

      if (isTauriRuntime()) {
        const defaultPath =
          documentState.kind === "docx"
            ? pathWithNameSuffix(documentState.path, " - 导出", "docx")
            : pathWithExtension(documentState.path, "docx");
        const path = await chooseSavePath(defaultPath, "docx");
        if (!path) return;
        await writeBinaryFile(path, contents);
      } else {
        downloadBytes(
          fileNameWithExtension(documentState.name, "docx"),
          contents,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        );
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导出 Word 失败。");
    }
  }, [documentState, preferences.exportMargin, preferences.exportOrientation, preferences.exportPaper]);

  const handleBrowserFiles = useCallback(
    async (files: FileList | File[] | null | undefined, source: "picker" | "drop" = "picker") => {
      if (browserDropProcessingRef.current) {
        if (source === "drop") notify("正在处理上一批拖入文件，请稍后再试。", "info");
        return;
      }

      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) return;

      browserDropProcessingRef.current = true;
      try {
        const supportedFiles: Array<{ file: File; kind: DocumentKind; path: string }> = [];
        const unsupportedNames: string[] = [];
        const duplicateNames: string[] = [];
        const seenFiles = new Set<File>();
        for (const file of selectedFiles) {
          if (seenFiles.has(file)) {
            duplicateNames.push(file.name);
            continue;
          }
          seenFiles.add(file);

          const kind = documentKindFromPath(file.name);
          if (!kind) {
            unsupportedNames.push(file.name);
            continue;
          }
          supportedFiles.push({
            file,
            kind,
            path: `browser://${++browserDocumentSequenceRef.current}/${file.name}`,
          });
        }

        const unsupportedNotice =
          unsupportedNames.length > 0
            ? `已跳过 ${unsupportedNames.length} 个不支持的文件：${unsupportedNames.join("、")}。支持 Markdown、文本、Word、PDF 和图片。`
            : null;
        if (supportedFiles.length === 0) {
          if (unsupportedNotice) {
            if (source === "drop") notify(unsupportedNotice, "info");
            else setError(unsupportedNotice);
          }
          return;
        }
        const nextPaths = supportedFiles.map((entry) => entry.path);
        if (!confirmDocumentReplacement(nextPaths, "打开新文件")) {
          return;
        }

        let openedCount = 0;
        const failedNames: string[] = [];
        for (const { file, kind, path } of supportedFiles) {
          try {
            const opened =
              kind === "docx" || kind === "pdf" || kind === "image"
                ? await openBinary(path, new Uint8Array(await file.arrayBuffer()))
                : await openSource(path, await file.text());
            if (opened) openedCount += 1;
            else failedNames.push(file.name);
          } catch {
            failedNames.push(file.name);
          }
        }

        if (source === "drop") {
          if (openedCount > 0) notify(`已打开 ${openedCount} 个拖入文件。`);
          if (duplicateNames.length > 0) {
            notify(`已忽略 ${duplicateNames.length} 个重复文件。`, "info");
          }
          if (unsupportedNotice) notify(unsupportedNotice, "info");
          if (failedNames.length > 0) {
            notify(`有 ${failedNames.length} 个拖入文件打开失败：${failedNames.join("、")}。`, "error");
          }
        } else if (unsupportedNotice) {
          setError((current) => (current ? `${current} ${unsupportedNotice}` : unsupportedNotice));
        }
      } finally {
        browserDropProcessingRef.current = false;
      }
    },
    [confirmDocumentReplacement, notify, openBinary, openSource],
  );

  const handleSelectTab = useCallback(
    async (path: string): Promise<boolean> => {
      if (documentState?.path && isSameDocumentPath(path, documentState.path)) return true;
      if (!confirmDocumentReplacement([path], "切换文档")) return false;
      try {
        const authorizedPath = path.startsWith("browser://") ? path : await authorizeStoredPath(path, false);
        return await openPath(authorizedPath, false, "push");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近文档无法打开，请重新选择文件。");
        return false;
      }
    },
    [confirmDocumentReplacement, documentState, openPath],
  );

  const handleCloseTabs = useCallback(
    async (paths: readonly string[]) => {
      const currentTabs = openTabsRef.current;
      const targetTabs = currentTabs.filter((tab) => paths.some((path) => isSameDocumentPath(path, tab.path)));
      if (targetTabs.length === 0) return;

      const current = documentStateRef.current;
      const activeIndex = current ? currentTabs.findIndex((tab) => isSameDocumentPath(tab.path, current.path)) : -1;
      const closesActive = Boolean(current && targetTabs.some((tab) => isSameDocumentPath(tab.path, current.path)));
      if (closesActive && current?.modified) {
        const draftOutcome = flushCurrentDraft();
        if (
          draftOutcome === "failed" ||
          !window.confirm(formatTransitionConfirmation("关闭标签", draftOutcome === "saved"))
        ) {
          return;
        }
      }

      const nextTabs = currentTabs.filter(
        (tab) => !targetTabs.some((target) => isSameDocumentPath(target.path, tab.path)),
      );
      targetTabs.forEach((tab) => releaseDocumentResources(tab.path));
      openTabsRef.current = nextTabs;
      setOpenTabs(nextTabs);
      saveOpenTabs(nextTabs);
      if (!closesActive) return;

      const nextTab = nextTabs[activeIndex] ?? nextTabs[activeIndex - 1];
      if (nextTab) {
        await openPath(nextTab.path);
      } else {
        setDocumentState(null);
        commitNavigationHistory(createNavigationHistory());
        setSourceDraft("");
        setMode("rendered");
        setSearchQuery("");
        setError(null);
        saveLastDocumentPath(null);
        if (workspacePath) {
          updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, { activeDocumentPath: null });
        }
      }
    },
    [commitNavigationHistory, flushCurrentDraft, openPath, releaseDocumentResources, workspacePath],
  );

  const handleCloseTab = useCallback(
    (path: string) => {
      void handleCloseTabs([path]);
    },
    [handleCloseTabs],
  );

  const handleReorderTabs = useCallback((sourcePath: string, targetPath: string) => {
    setOpenTabs((current) => reorderTabs(current, sourcePath, targetPath));
  }, []);

  const handleBrowserDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime() || !hasFileDragPayload(event.dataTransfer)) return;
      event.preventDefault();
      fileDropDepthRef.current += 1;
      const names = Array.from(event.dataTransfer.files).map((file) => file.name);
      updateFileDropState(
        "browser",
        names.length > 0 ? classifyFileDropPaths(names, (path) => Boolean(documentKindFromPath(path))) : "unknown",
      );
    },
    [updateFileDropState],
  );

  const handleBrowserDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime()) return;
      const hasFilePayload = hasFileDragPayload(event.dataTransfer);
      if (!hasFilePayload && !fileDropStateRef.current.active) return;
      event.preventDefault();
      const names = Array.from(event.dataTransfer.files).map((file) => file.name);
      if (hasFilePayload || !fileDropStateRef.current.active) {
        updateFileDropState(
          "browser",
          names.length > 0
            ? classifyFileDropPaths(names, (path) => Boolean(documentKindFromPath(path)))
            : fileDropStateRef.current.support,
        );
      }
    },
    [updateFileDropState],
  );

  const handleBrowserDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime() || !fileDropStateRef.current.active) return;
      event.preventDefault();
      fileDropDepthRef.current = Math.max(0, fileDropDepthRef.current - 1);
      const relatedTarget = event.relatedTarget;
      const remainsInside = relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget);
      if (!remainsInside || fileDropDepthRef.current === 0) resetFileDropState();
    },
    [resetFileDropState],
  );

  const handleBrowserDragEnd = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime() || !fileDropStateRef.current.active) return;
      event.preventDefault();
      resetFileDropState();
    },
    [resetFileDropState],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (isTauriRuntime() || !hasFileDragPayload(event.dataTransfer)) return;
      event.preventDefault();
      resetFileDropState();
      void handleBrowserFiles(event.dataTransfer.files, "drop");
    },
    [handleBrowserFiles, resetFileDropState],
  );

  const handleOpenReaderLink = useCallback(
    (href: string) => {
      if (href.startsWith("moyang-wiki:")) {
        const target = safeDecode(href.slice("moyang-wiki:".length));
        const [rawPath, rawAnchor] = target.split("#", 2);
        const currentEntry = documentState ? findIndexEntry(workspaceIndex, documentState.path) : undefined;
        const linkedEntry = currentEntry
          ? findLinkedEntry(workspaceIndex, currentEntry, rawPath, linkIndex)
          : undefined;
        const path =
          linkedEntry?.file.path ??
          (documentState ? resolveWikiPath(documentState.path, rawPath || documentState.path) : null);
        if (!path) {
          setError("浏览器预览模式无法解析文档内链接，请在 Moyang Reader 桌面版中打开。");
          return;
        }
        void handleSelectTab(path).then((opened) => {
          if (opened && rawAnchor)
            scrollToHeading(safeDecode(rawAnchor), contentAreaRef.current, articleRef.current, revealProgressiveReader);
        });
        return;
      }

      const target = safeDecode(href);
      if (target.startsWith("#")) {
        scrollToHeading(target.slice(1), contentAreaRef.current, articleRef.current, revealProgressiveReader);
        return;
      }

      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
        const normalized = target.startsWith("//") ? `https:${target}` : target;
        try {
          const externalUrl = new URL(normalized, window.location.href);
          if (!["http:", "https:", "mailto:", "tel:"].includes(externalUrl.protocol)) {
            setError("已阻止不受支持的外部链接协议。");
            return;
          }
          void openExternalUrl(externalUrl.toString()).catch((cause) => {
            setError(cause instanceof Error ? cause.message : "无法打开外部链接。");
          });
        } catch {
          setError("无法解析这个外部链接。");
        }
        return;
      }
      if (!documentState || documentState.path.startsWith("browser://")) {
        setError("浏览器预览模式无法解析本地文档链接，请在 Moyang Reader 桌面版中打开。");
        return;
      }

      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = resolveRelativePath(documentState.path, rawPath);
      if (!path) {
        setError("无法解析这个本地文档链接。");
        return;
      }
      void handleSelectTab(path).then((opened) => {
        if (opened && rawAnchor)
          scrollToHeading(safeDecode(rawAnchor), contentAreaRef.current, articleRef.current, revealProgressiveReader);
      });
    },
    [documentState, handleSelectTab, linkIndex, revealProgressiveReader, workspaceIndex],
  );

  const handleReaderClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const anchor = (event.target as HTMLElement).closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;

      event.preventDefault();
      handleOpenReaderLink(href);
    },
    [handleOpenReaderLink],
  );

  const handleReaderContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const anchor = (event.target as HTMLElement).closest("a");
    const selection = window.getSelection();
    setReaderContextMenu({
      x: event.clientX,
      y: event.clientY,
      selectedText: selection?.toString() ?? "",
      linkHref: anchor?.getAttribute("href") ?? null,
      headingId: headingIdFromTarget(event.target),
      annotationSelection: readerBodyRef.current ? createSelectionAnchor(readerBodyRef.current, selection) : null,
      restoreFocusTarget: event.currentTarget,
      fallbackFocusTarget: event.currentTarget,
    });
  }, []);

  const handleReaderContextKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isContextMenuKeyboardEvent(event)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = (event.target as HTMLElement).closest("a");
    const selection = window.getSelection();
    setReaderContextMenu({
      x: rect.left + Math.min(32, rect.width / 2),
      y: rect.bottom,
      selectedText: selection?.toString() ?? "",
      linkHref: anchor?.getAttribute("href") ?? null,
      headingId: headingIdFromTarget(event.target),
      annotationSelection: readerBodyRef.current ? createSelectionAnchor(readerBodyRef.current, selection) : null,
      restoreFocusTarget: event.currentTarget,
      fallbackFocusTarget: event.currentTarget,
    });
  }, []);

  const handleCopyReaderText = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;

      try {
        await copyPlainText(value);
        notify("选中文本已复制。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制选中文本失败。");
      }
    },
    [notify],
  );

  const handleCopyReaderLink = useCallback(
    async (href: string) => {
      try {
        await copyPlainText(href);
        notify("链接地址已复制。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制链接地址失败。");
      }
    },
    [notify],
  );

  const handleCopyReaderDocumentPath = useCallback(async () => {
    const path = documentStateRef.current?.path;
    if (!path || path.startsWith("browser://")) {
      setError("当前文档没有可复制的本地路径。");
      return;
    }

    try {
      await copyPlainText(path);
      notify("文档路径已复制。");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制文档路径失败。");
    }
  }, [notify]);

  useEffect(() => {
    setReaderContextMenu(null);
  }, [documentState?.path, mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }

    try {
      localStorage.setItem("moyang-reader-theme", theme);
    } catch {
      // Local storage may be unavailable in a restricted browser preview.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === "en-US" ? "en" : "zh-CN";
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!selectedTag || !workspacePath || workspaceIndex.some((entry) => entry.tags.includes(selectedTag))) return;
    setSelectedTag(null);
  }, [selectedTag, workspaceIndex, workspacePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 160);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const root = articleRef.current;
    const contentKey = renderedHtml;
    if (!root || mode !== "rendered") {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    if (!progressiveReaderReady) {
      if (debouncedSearchQuery.trim()) revealProgressiveReader();
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    if (
      !searchHighlightRef.current ||
      searchHighlightRef.current.root !== root ||
      searchHighlightRef.current.contentKey !== contentKey
    ) {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = {
        root,
        contentKey,
        controller: createSearchHighlightController(root),
      };
    }

    const count = searchHighlightRef.current.controller.update(debouncedSearchQuery);
    setSearchResultCount(count);
    setSearchResultIndex((current) => (count ? Math.min(current, count - 1) : 0));
  }, [debouncedSearchQuery, mode, progressiveReaderReady, renderedHtml, revealProgressiveReader]);

  useEffect(() => {
    if (mode !== "rendered") return;
    if (!progressiveReaderReady) return;
    const target = searchHighlightRef.current?.controller.setActive(searchResultIndex);
    target?.scrollIntoView({ behavior: resolveProgrammaticScrollBehavior("auto"), block: "center" });
  }, [debouncedSearchQuery, mode, progressiveReaderReady, renderedHtml, searchResultIndex]);

  useEffect(() => {
    const root = readerBodyRef.current;
    const currentPath = documentState?.path;
    const currentAnnotationPath = currentPath?.startsWith("browser://")
      ? currentPath
      : currentPath && workspacePath
        ? workspaceRelativePath(workspacePath, currentPath)
        : null;
    if (
      !root ||
      mode !== "rendered" ||
      !progressiveReaderReady ||
      !currentAnnotationPath ||
      !preferences.annotationEnabled
    ) {
      annotationHighlightRef.current?.controller.dispose();
      annotationHighlightRef.current = null;
      setAnnotationLocations([]);
      return;
    }

    if (
      !annotationHighlightRef.current ||
      annotationHighlightRef.current.root !== root ||
      annotationHighlightRef.current.contentKey !== renderedHtml
    ) {
      annotationHighlightRef.current?.controller.dispose();
      annotationHighlightRef.current = {
        root,
        contentKey: renderedHtml,
        controller: createAnnotationHighlightController(root),
      };
    }

    const current = annotations.filter(
      (annotation) => normalizePathKey(annotation.path) === normalizePathKey(currentAnnotationPath),
    );
    const locations = annotationHighlightRef.current.controller.update(current);
    setAnnotationLocations(locations);
    const pending = pendingAnnotationIdRef.current;
    if (pending && annotationHighlightRef.current.controller.scrollTo(pending)) {
      pendingAnnotationIdRef.current = null;
    }
  }, [
    annotations,
    documentState?.path,
    mode,
    preferences.annotationEnabled,
    progressiveReaderReady,
    renderedHtml,
    workspacePath,
  ]);

  useEffect(() => {
    return () => {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
      annotationHighlightRef.current?.controller.dispose();
      annotationHighlightRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = articleRef.current;
    const currentPath = documentState?.path;
    if (!root || mode !== "rendered" || !currentPath || !isTauriRuntime()) return;

    let active = true;
    const objectUrls = new Set<string>();
    void (async () => {
      const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[src]"));
      for (const image of images) {
        const source = image.getAttribute("src") ?? "";
        const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
        if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
        const localPath = resolveRelativePath(currentPath, safeDecode(target));
        if (!localPath) continue;

        try {
          const bytes = await readBinaryFile(localPath);
          const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          const objectUrl = URL.createObjectURL(new Blob([binary], { type: imageMimeType(localPath) }));
          if (!active) {
            URL.revokeObjectURL(objectUrl);
            continue;
          }
          objectUrls.add(objectUrl);
          image.src = objectUrl;
        } catch {
          // Keep the original source when a relative attachment is unavailable or unauthorized.
        }
      }
    })();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, [documentState?.path, documentState?.rendered.html, mode, progressiveReaderReady]);

  const moveSearchResult = useCallback(
    (step: number) => {
      if (!searchResultCount) return;
      setSearchResultIndex((current) => (current + step + searchResultCount) % searchResultCount);
    },
    [searchResultCount],
  );

  const cycleTheme = useCallback(() => {
    setTheme((current) => (current === "system" ? "light" : current === "light" ? "dark" : "system"));
  }, []);

  const canEdit = documentState ? isEditableDocument(documentState.kind) : false;
  const documentPath = documentState?.path;
  const currentIndexEntry = useMemo(
    () => (documentPath ? findIndexEntry(workspaceIndex, documentPath) : undefined),
    [documentPath, workspaceIndex],
  );
  const backlinkIndex = useMemo(() => createBacklinkIndex(workspaceIndex), [workspaceIndex]);
  const backlinks = useMemo(
    () => (currentIndexEntry ? findBacklinks(workspaceIndex, currentIndexEntry, backlinkIndex) : []),
    [backlinkIndex, currentIndexEntry, workspaceIndex],
  );
  const outgoing = useMemo(
    () =>
      currentIndexEntry
        ? currentIndexEntry.links.map((target) => ({
            target,
            entry: findLinkedEntry(workspaceIndex, currentIndexEntry, target, linkIndex),
          }))
        : [],
    [currentIndexEntry, linkIndex, workspaceIndex],
  );
  const bookmarkKnownPaths = useMemo(
    () => [
      ...(documentPath ? [documentPath] : []),
      ...openTabs.map((tab) => tab.path),
      ...workspaceIndex.map((entry) => entry.file.path),
    ],
    [documentPath, openTabs, workspaceIndex],
  );
  const canBookmark = Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image");
  const canAnnotate = Boolean(
    documentState &&
    documentState.kind !== "pdf" &&
    documentState.kind !== "image" &&
    preferences.annotationEnabled &&
    (Boolean(workspacePath) || documentState.path.startsWith("browser://")),
  );
  const currentAnnotationPath = useMemo(() => {
    if (!documentState) return null;
    if (documentState.path.startsWith("browser://")) return documentState.path;
    return workspacePath ? workspaceRelativePath(workspacePath, documentState.path) : null;
  }, [documentState, workspacePath]);
  const persistAnnotations = useCallback(async (next: TextAnnotation[]): Promise<boolean> => {
    if (!preferencesRef.current.annotationEnabled) return false;

    const root = workspacePathRef.current;
    if (!isTauriRuntime()) {
      setAnnotations(next);
      return true;
    }
    if (!root) {
      setError("请先打开工作区，再保存阅读批注。");
      return false;
    }

    try {
      await writeAnnotations(root, next);
      setAnnotations(next);
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "阅读批注保存失败。");
      return false;
    }
  }, []);
  const readerBookmarkTarget = useMemo(
    () =>
      documentState && readerContextMenu
        ? createBookmark(documentState.path, { headingId: readerContextMenu.headingId })
        : null,
    [documentState, readerContextMenu],
  );
  const readerBookmarkPresent = readerBookmarkTarget ? hasBookmark(bookmarks, readerBookmarkTarget) : false;
  const handleToggleReaderBookmark = useCallback(() => {
    if (!readerBookmarkTarget) return;

    if (readerBookmarkPresent) {
      setBookmarks((current) => {
        const next = removeBookmark(current, readerBookmarkTarget);
        saveBookmarks(next);
        return next;
      });
      notify("已移除当前书签。");
    } else {
      setBookmarks((current) => {
        const next = addBookmark(current, readerBookmarkTarget);
        saveBookmarks(next);
        return next;
      });
      notify(readerBookmarkTarget.headingId ? "已添加章节书签。" : "已添加文档书签。");
    }
    setError(null);
  }, [notify, readerBookmarkPresent, readerBookmarkTarget]);
  const handleDeleteBookmark = useCallback(
    (bookmark: DocumentBookmark) => {
      setBookmarks((current) => {
        const next = removeBookmark(current, bookmark);
        saveBookmarks(next);
        return next;
      });
      notify("已删除书签。");
    },
    [notify],
  );
  const handleOpenBookmark = useCallback(
    async (bookmark: DocumentBookmark) => {
      const current = documentStateRef.current;
      if (current && isSameDocumentPath(bookmark.path, current.path)) {
        if (!bookmark.headingId) return;

        const item = current.rendered.toc.find((candidate) => candidate.id === bookmark.headingId);
        if (item) {
          navigateToHeading(item);
          return;
        }
        if (mode !== "rendered") {
          pendingHeadingRef.current = bookmark.headingId;
          setMode("rendered");
          return;
        }
        scrollToHeading(bookmark.headingId, contentAreaRef.current, articleRef.current, revealProgressiveReader);
        return;
      }

      pendingHeadingRef.current = bookmark.headingId ?? null;
      const opened = await handleSelectTab(bookmark.path);
      if (!opened) pendingHeadingRef.current = null;
    },
    [handleSelectTab, mode, navigateToHeading, revealProgressiveReader],
  );
  const handleOpenAnnotationDialog = useCallback(() => {
    const current = documentStateRef.current;
    const selection = readerContextMenu?.annotationSelection;
    if (!current || !selection) {
      setError("请先在正文中选择要高亮的文字。");
      return;
    }

    const relativePath = current.path.startsWith("browser://")
      ? current.path
      : workspacePathRef.current
        ? workspaceRelativePath(workspacePathRef.current, current.path)
        : null;
    if (!relativePath) {
      setError("当前文档不在已打开的工作区中，无法保存阅读批注。");
      return;
    }

    setReaderContextMenu(null);
    setAnnotationDialog({ relativePath, selection });
  }, [readerContextMenu]);
  const handleSaveAnnotation = useCallback(
    (note: string) => {
      if (!annotationDialog) return;

      try {
        const annotation = createAnnotation(annotationDialog.relativePath, annotationDialog.selection, note);
        const next = addAnnotation(annotations, annotation);
        pendingAnnotationIdRef.current = annotation.id;
        void persistAnnotations(next).then((saved) => {
          if (!saved) return;
          setAnnotationDialog(null);
          notify("批注已保存。");
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建阅读批注。");
      }
    },
    [annotationDialog, annotations, notify, persistAnnotations],
  );
  const handleDeleteAnnotation = useCallback(
    (annotation: TextAnnotation) => {
      const next = removeAnnotation(annotations, annotation.id);
      void persistAnnotations(next).then((saved) => {
        if (saved) notify("已删除批注。");
      });
    },
    [annotations, notify, persistAnnotations],
  );
  const handleOpenAnnotation = useCallback(
    async (annotation: TextAnnotation) => {
      const current = documentStateRef.current;
      const root = workspacePathRef.current;
      const targetPath = annotation.path.startsWith("browser:")
        ? annotation.path
        : root
          ? workspaceEntryAbsolutePath(root, annotation.path)
          : null;
      if (!targetPath) {
        setError("批注所属工作区尚未打开，请先添加对应文件夹。");
        return;
      }

      pendingAnnotationIdRef.current = annotation.id;
      if (current && isSameDocumentPath(targetPath, current.path)) {
        if (mode !== "rendered") {
          setMode("rendered");
          return;
        }
        window.requestAnimationFrame(() => {
          if (annotationHighlightRef.current?.controller.scrollTo(annotation.id)) {
            pendingAnnotationIdRef.current = null;
          }
        });
        return;
      }

      const opened = await handleSelectTab(targetPath);
      if (!opened) pendingAnnotationIdRef.current = null;
    },
    [handleSelectTab, mode],
  );
  const availableTags = useMemo(
    () => Array.from(new Set(workspaceIndex.flatMap((entry) => entry.tags))).sort((a, b) => a.localeCompare(b)),
    [workspaceIndex],
  );
  const taggedFilePaths = useMemo(
    () =>
      new Set(workspaceIndex.filter((entry) => entry.tags.includes(selectedTag ?? "")).map((entry) => entry.file.path)),
    [selectedTag, workspaceIndex],
  );
  const visibleWorkspaceFiles = useMemo(
    () => workspaceFiles.filter((file) => matchesWorkspaceFilter(file, selectedFileKind, selectedTag, taggedFilePaths)),
    [selectedFileKind, selectedTag, taggedFilePaths, workspaceFiles],
  );
  const visibleWorkspaceResults = useMemo(
    () =>
      workspaceResults.filter((result) =>
        matchesWorkspaceFilter(result.file, selectedFileKind, selectedTag, taggedFilePaths),
      ),
    [selectedFileKind, selectedTag, taggedFilePaths, workspaceResults],
  );
  const workspaceExportFiles = useMemo(() => {
    const query = workspaceQuery.trim();
    if (!query) return visibleWorkspaceFiles;
    if (query.length < 2 || workspaceSearchLoading) return [];
    return visibleWorkspaceResults.map((result) => result.file);
  }, [visibleWorkspaceFiles, visibleWorkspaceResults, workspaceQuery, workspaceSearchLoading]);
  const wikiLinkCandidates = useMemo(
    () => buildWikiLinkCandidates(workspaceFiles, documentState?.path),
    [workspaceFiles, documentState?.path],
  );
  const executeCommand = useCallback(
    (commandId: string) => {
      switch (commandId) {
        case "open":
          void openSelectedFile();
          break;
        case "workspace":
          void handleChooseWorkspace();
          break;
        case "quick-open":
          setQuickOpen(true);
          break;
        case "navigate-back":
          void handleNavigateBack();
          break;
        case "toggle-mode":
          toggleReadingEditing();
          break;
        case "save":
          void saveDocument();
          break;
        case "undo":
          undoEditor();
          break;
        case "redo":
          redoEditor();
          break;
        case "link":
          requestEditorInsert("link");
          break;
        case "context":
          setRightPanelOpen((current) => !current);
          break;
        case "focus":
          setFocusMode((current) => !current);
          break;
      }
    },
    [
      handleChooseWorkspace,
      handleNavigateBack,
      openSelectedFile,
      requestEditorInsert,
      redoEditor,
      saveDocument,
      toggleReadingEditing,
      undoEditor,
    ],
  );
  const canEditHistory = canEdit && mode !== "rendered";
  const canUndo = canEditHistory && canUndoEditorChange(editorHistory);
  const canRedo = canEditHistory && canRedoEditorChange(editorHistory);
  const commandItems = useMemo<ReaderCommand[]>(
    () => [
      {
        id: "open",
        label: "打开文档",
        shortcut: "Ctrl O",
      },
      {
        id: "workspace",
        label: "添加整个文件夹",
        shortcut: "Ctrl ⇧ O",
      },
      {
        id: "quick-open",
        label: "快速打开",
        shortcut: "Ctrl P",
      },
      {
        id: "navigate-back",
        label: "返回上一文档",
        shortcut: "Ctrl Alt ←",
        disabled: !canGoBack(navigationHistory),
      },
      {
        id: "toggle-mode",
        label: mode === "rendered" ? "进入编辑模式" : "切换到阅读模式",
        shortcut: "Ctrl E",
        disabled: !canEdit,
      },
      {
        id: "save",
        label: "保存当前文档",
        shortcut: "Ctrl S",
        disabled: !documentState?.modified,
      },
      {
        id: "undo",
        label: "撤销上一次编辑",
        shortcut: "Ctrl Z",
        disabled: !canUndo,
      },
      {
        id: "redo",
        label: "重做上一次编辑",
        shortcut: "Ctrl Y",
        disabled: !canRedo,
      },
      {
        id: "link",
        label: "插入 Markdown 链接",
        shortcut: "Ctrl K",
        disabled: !canEdit,
      },
      {
        id: "context",
        label: rightPanelOpen ? "隐藏上下文面板" : "显示上下文面板",
        shortcut: "Ctrl ⇧ R",
      },
      {
        id: "focus",
        label: focusMode ? "退出专注阅读" : "进入专注阅读",
        shortcut: "Ctrl ⇧ Enter",
        disabled: !documentState,
      },
    ],
    [canEdit, canRedo, canUndo, focusMode, mode, navigationHistory, rightPanelOpen, documentState],
  );
  const quickOpenItems = useMemo<QuickOpenCandidate[]>(() => {
    const items = new Map<string, QuickOpenCandidate>();
    const add = (candidate: QuickOpenCandidate) => {
      const key = comparablePath(candidate.path);
      const existing = items.get(key);
      items.set(key, existing ? { ...existing, isRecent: existing.isRecent || candidate.isRecent } : candidate);
    };

    workspaceFiles.forEach((file) => add(file));
    openTabs.forEach((file) => add({ ...file, relativePath: file.path, isRecent: true }));
    recentFiles.forEach((file) => add({ ...file, relativePath: file.path, isRecent: true }));

    return [...items.values()].sort((left, right) => Number(right.isRecent) - Number(left.isRecent));
  }, [openTabs, recentFiles, workspaceFiles]);

  const handleCancelWorkspaceExport = useCallback(() => {
    workspaceExportAbortRef.current?.abort();
    if (pdfBatchExportRef.current) finishPdfBatch(true);
  }, [finishPdfBatch]);

  const copyWorkspaceExportFailures = useCallback(async () => {
    if (workspaceExportFailures.length === 0) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("当前环境不支持复制到剪贴板。");
      await navigator.clipboard.writeText(formatExportFailureReport(workspaceExportFailures));
      setWorkspaceExportNotice(`已复制 ${workspaceExportFailures.length} 个失败项清单。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制导出失败清单失败。");
    }
  }, [workspaceExportFailures]);

  const saveWorkspaceExportFailures = useCallback(async () => {
    if (workspaceExportFailures.length === 0) return;

    const report = formatExportFailureReport(workspaceExportFailures);
    try {
      if (isTauriRuntime()) {
        const workspaceName = fileNameFromPath(workspacePath?.replace(/[\\/]+$/, "") ?? "") || "阅读库";
        const defaultPath = pathWithExtension(`${workspacePath ?? ""}\\${workspaceName} - 导出失败清单.md`, "md");
        const path = await chooseSavePath(defaultPath, "markdown");
        if (!path) return;
        await writeTextFile(path, report);
      } else {
        downloadText("moyang-reader-export-failures.md", report);
      }
      setWorkspaceExportNotice(`已保存 ${workspaceExportFailures.length} 个失败项清单。`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存导出失败清单失败。");
    }
  }, [workspaceExportFailures, workspacePath]);

  const handleExportWorkspace = useCallback(
    async (format: "html" | "docx" | "pdf") => {
      if (!workspacePath || workspaceExportFiles.length === 0 || !isTauriRuntime()) return;

      const workspaceName = fileNameFromPath(workspacePath.replace(/[\\/]+$/, "")) || "阅读库";
      let savePath: string | null = null;
      try {
        if (format !== "pdf") {
          savePath = await chooseSavePath(pathWithExtension(`${workspacePath}\\${workspaceName}`, format), format);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "打开导出保存位置失败。");
        return;
      }
      if (format !== "pdf" && !savePath) return;

      const controller = new AbortController();
      workspaceExportAbortRef.current = controller;
      setWorkspaceExporting(true);
      setWorkspaceExportProgress({ current: 0, total: workspaceExportFiles.length, fileName: "准备导出…" });
      setWorkspaceExportFailures([]);
      setWorkspaceExportNotice(null);
      setError(null);
      await yieldToExportScheduler();

      if (format === "pdf") {
        const files = workspaceExportFiles.filter(
          (file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text",
        );
        if (files.length === 0) {
          workspaceExportAbortRef.current = null;
          setWorkspaceExporting(false);
          setWorkspaceExportProgress(null);
          setWorkspaceExportNotice("当前筛选中没有可打印的 Markdown、文本或 Word 文档。");
          return;
        }

        pdfBatchExportRef.current = {
          files,
          nextIndex: 0,
          volumeNumber: 0,
          exported: 0,
          skippedFiles: [],
          title: `${workspaceName} 阅读库`,
          options: {
            paper: preferences.exportPaper,
            orientation: preferences.exportOrientation,
            margin: preferences.exportMargin,
          },
        };
        try {
          await prepareNextPdfBatch();
        } catch (cause) {
          finishPdfBatch(true);
          setError(cause instanceof Error ? cause.message : "批量打印准备失败。");
        }
        return;
      }

      let exported = 0;
      let writtenVolumes = 0;
      const skippedFiles: WorkspaceExportFailure[] = [];
      const recordSkippedFile = (fileName: string, reason: string) => {
        skippedFiles.push({ fileName, reason });
        setWorkspaceExportFailures([...skippedFiles]);
      };
      try {
        const exportTitle = `${workspaceName} 阅读库`;
        const exportOptions = {
          paper: preferences.exportPaper,
          orientation: preferences.exportOrientation,
          margin: preferences.exportMargin,
        };
        const exportableFileCount = workspaceExportFiles.filter(
          (file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text",
        ).length;
        const estimatedExportBytes = workspaceExportFiles
          .filter((file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text")
          .reduce((total, file) => total + file.size, 0);
        const expectedVolumeCount = Math.max(
          1,
          Math.ceil(exportableFileCount / BATCH_EXPORT_CHUNK_SIZE),
          Math.ceil(estimatedExportBytes / BATCH_EXPORT_MAX_ESTIMATED_BYTES),
        );
        let documents: { title: string; body: string }[] = [];
        let estimatedDocumentBytes = 0;
        const flushDocuments = async () => {
          if (documents.length === 0) return;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");

          const batch = documents;
          documents = [];
          estimatedDocumentBytes = 0;
          const volumeNumber = writtenVolumes + 1;
          const volumeTitle = expectedVolumeCount > 1 ? `${exportTitle} · 第 ${volumeNumber} 卷` : exportTitle;
          if (format === "html") {
            if (!savePath) throw new Error("没有选择 HTML 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "html") : savePath;
            await writeTextFile(
              targetPath,
              await buildBatchHtmlExportAsync(volumeTitle, batch, exportOptions, controller.signal),
            );
          } else {
            if (!savePath) throw new Error("没有选择 Word 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "docx") : savePath;
            const tempPath = pathWithExportTempSuffix(
              targetPath,
              `${Date.now()}-${volumeNumber}-${Math.random().toString(36).slice(2, 10)}`,
            );
            let committed = false;
            try {
              let hasWrittenChunk = false;
              await streamDocxExportWithWorker(
                volumeTitle,
                batch,
                exportOptions,
                (chunk) => {
                  const append = hasWrittenChunk;
                  hasWrittenChunk = true;
                  return writeBinaryFileChunk(tempPath, chunk, append, targetPath);
                },
                controller.signal,
              );
              if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");
              await commitBinaryFile(tempPath, targetPath);
              committed = true;
            } finally {
              if (!committed) {
                try {
                  await discardBinaryFile(tempPath, targetPath);
                } catch {
                  // Keep the original export error or cancellation notice visible.
                }
              }
            }
          }
          writtenVolumes = volumeNumber;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");
        };

        for (const [index, file] of workspaceExportFiles.entries()) {
          if (controller.signal.aborted) {
            setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
            return;
          }
          setWorkspaceExportProgress({
            current: index + 1,
            total: workspaceExportFiles.length,
            fileName: file.relativePath,
          });
          try {
            let rendered;
            if (file.kind === "docx") {
              rendered = await renderDocx(await readBinaryFile(file.path), {
                allowRemoteResources: preferences.allowRemoteResources,
              });
            } else if (file.kind === "markdown" || file.kind === "text") {
              rendered = await renderSource(
                file.kind === "text" ? "workspace-export.txt" : "workspace-export.md",
                await readTextFile(file.path),
                {
                  allowRemoteResources: preferences.allowRemoteResources,
                },
              );
            } else {
              recordSkippedFile(file.relativePath, "类型不支持");
              continue;
            }

            const body = await inlineLocalImages(
              rendered.html,
              (source) => {
                const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
                if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) return null;
                return resolveRelativePath(file.path, safeDecode(target));
              },
              readBinaryFile,
              imageMimeType,
              fileSize,
              controller.signal,
            );
            const document = { title: file.relativePath, body };
            const documentEstimate = estimateBatchExportDocumentBytes(document);
            if (
              documents.length > 0 &&
              shouldFlushBatchExport(documents.length, estimatedDocumentBytes + documentEstimate)
            ) {
              await flushDocuments();
            }
            documents.push(document);
            estimatedDocumentBytes += documentEstimate;
            exported += 1;
            await yieldToExportScheduler();
            if (shouldFlushBatchExport(documents.length, estimatedDocumentBytes)) await flushDocuments();
          } catch (cause) {
            recordSkippedFile(file.relativePath, cause instanceof Error ? cause.message : "读取失败");
          }
        }

        if (controller.signal.aborted) {
          setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
          return;
        }

        if (exported === 0) {
          const failureSummary = summarizeExportFailures(
            skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
          );
          throw new Error(
            failureSummary
              ? `当前筛选中没有可导出的文档。跳过 ${skippedFiles.length} 个：${failureSummary}`
              : "当前筛选中没有可导出的 Markdown、文本或 Word 文档。",
          );
        }
        await flushDocuments();
        const formatLabel = format === "html" ? "HTML" : "Word";
        const failureSummary = summarizeExportFailures(
          skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
        );
        const volumeNotice = writtenVolumes > 1 ? `，已分卷为 ${writtenVolumes} 个文件` : "";
        const destinationNotice = savePath ? `（${fileNameFromPath(savePath)}）` : "";
        setWorkspaceExportNotice(
          `已导出 ${exported} 篇文档为 ${formatLabel}${destinationNotice}${volumeNotice}${
            failureSummary ? `，跳过 ${skippedFiles.length} 个：${failureSummary}` : ""
          }。`,
        );
      } catch (cause) {
        if (controller.signal.aborted) {
          setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
        } else {
          setError(cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "批量导出失败。");
        }
      } finally {
        if (workspaceExportAbortRef.current === controller) workspaceExportAbortRef.current = null;
        setWorkspaceExporting(false);
        setWorkspaceExportProgress(null);
      }
    },
    [
      preferences.allowRemoteResources,
      preferences.exportMargin,
      preferences.exportOrientation,
      preferences.exportPaper,
      finishPdfBatch,
      prepareNextPdfBatch,
      workspaceExportFiles,
      workspacePath,
    ],
  );

  return (
    <div
      ref={appShellRef}
      className={`app-shell reading-width-${preferences.readingWidth}${
        focusMode ? " focus-mode" : ""
      }${sidebarCollapsed ? " sidebar-collapsed" : ""}${!rightPanelOpen ? " right-panel-collapsed" : ""}`}
      style={
        {
          "--sidebar-width": `${paneWidths.sidebar}px`,
          "--context-width": `${paneWidths.context}px`,
          "--reading-zoom": `${preferences.readingZoom / 100}`,
        } as CSSProperties
      }
      onDragEnter={handleBrowserDragEnter}
      onDragOver={handleBrowserDragOver}
      onDragLeave={handleBrowserDragLeave}
      onDragEnd={handleBrowserDragEnd}
      onDrop={handleDrop}
    >
      <TopBar
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
        exportPaper={preferences.exportPaper}
        exportOrientation={preferences.exportOrientation}
        exportMargin={preferences.exportMargin}
        onReadingZoomChange={setReadingZoom}
        onReadingWidthChange={(width) => {
          setReaderPreferences({ readingWidth: width });
          notify("正文宽度已更新。");
        }}
        onExportPaperChange={(paper) => {
          setReaderPreferences({ exportPaper: paper });
          notify("导出纸张已更新。");
        }}
        onExportOrientationChange={(orientation) => {
          setReaderPreferences({ exportOrientation: orientation });
          notify("导出方向已更新。");
        }}
        onExportMarginChange={(margin) => {
          setReaderPreferences({ exportMargin: margin });
          notify("导出页边距已更新。");
        }}
        allowRemoteResources={preferences.allowRemoteResources}
        startupUpdateCheck={preferences.startupUpdateCheck}
        annotationEnabled={preferences.annotationEnabled}
        onAllowRemoteResourcesChange={(allowed) => {
          setReaderPreferences({ allowRemoteResources: allowed });
          notify(allowed ? "已允许加载远程图片。" : "已禁止加载远程图片。");
        }}
        onStartupUpdateCheckChange={(enabled) => {
          setReaderPreferences({ startupUpdateCheck: enabled });
          notify(enabled ? "已开启启动时检查更新。" : "已关闭启动时检查更新。");
        }}
        onAnnotationEnabledChange={(enabled) => {
          setReaderPreferences({ annotationEnabled: enabled });
          notify(enabled ? "已开启阅读批注。" : "已关闭阅读批注。已有批注仍保留在工作区中。");
        }}
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
        previousVersionAvailable={Boolean(previousVersion)}
        onOpenPreviousVersion={previewPreviousVersion}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((current) => !current)}
        onToggleMode={toggleReadingEditing}
        onCycleMode={toggleDocumentMode}
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
        onCycleTheme={() => {
          cycleTheme();
          notify("阅读主题已更新。");
        }}
        onLocaleChange={(nextLocale) => {
          setLocale(nextLocale);
          notify(nextLocale === "en-US" ? "Interface language changed." : "界面语言已切换。");
        }}
      />
      <NotificationViewport
        notifications={notifications}
        onDismiss={dismissNotification}
        updateNotice={
          updateNoticeVisible && updateStatus !== "idle" && updateStatus !== "checking" ? (
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
          ) : null
        }
      />
      <FileDropOverlay state={fileDropState} />
      <div className="navigation-strip">
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
      <div className="workspace-grid">
        <aside className="sidebar">
          <WorkspacePanel
            onExportWorkspace={(format) => void handleExportWorkspace(format)}
            onCancelWorkspaceExport={handleCancelWorkspaceExport}
            workspaceExporting={workspaceExporting}
            workspaceExportProgress={workspaceExportProgress}
            workspaceExportFailures={workspaceExportFailures}
            onCopyExportFailures={() => void copyWorkspaceExportFailures()}
            onSaveExportFailures={() => void saveWorkspaceExportFailures()}
            workspaceExportNotice={workspaceExportNotice}
            workspaceIndexLoading={workspaceIndexLoading}
            workspaceListingStatus={workspaceListingStatus}
            workspacePath={workspacePath}
            files={workspaceFiles}
            folders={workspaceFolders}
            visibleFiles={visibleWorkspaceFiles}
            visibleResultCount={visibleWorkspaceResults.length}
            exportableFiles={workspaceExportFiles}
            recentFiles={recentFiles}
            recentWorkspaces={recentWorkspaces}
            mountedWorkspaces={mountedWorkspaces}
            activePath={documentState?.path ?? null}
            searchQuery={workspaceQuery}
            searchResults={visibleWorkspaceResults}
            searchLoading={workspaceSearchLoading}
            tagOptions={availableTags}
            selectedTag={selectedTag}
            selectedKind={selectedFileKind}
            onAddWorkspace={() => void handleChooseWorkspace()}
            workspaceLimitReached={mountedWorkspaces.length >= MAX_MOUNTED_WORKSPACES}
            onOpenWorkspace={(path) => void handleOpenRecentWorkspace(path)}
            onRemoveWorkspace={handleRemoveMountedWorkspace}
            onOpenFile={(path) => void handleSelectTab(path)}
            onCloseFile={(path) => void handleCloseTab(path)}
            onCreateNote={(parentPath) => void handleCreateWorkspaceNote(parentPath)}
            onCreateFolder={(parentPath) => void handleCreateWorkspaceFolder(parentPath)}
            onRenameEntry={(entryPath, kind) => void handleRenameWorkspaceEntry(entryPath, kind)}
            onDeleteEntry={(entryPath, kind) => void handleDeleteWorkspaceEntry(entryPath, kind)}
            onDuplicateEntry={(entryPath, kind) => void handleDuplicateWorkspaceEntry(entryPath, kind)}
            onShowDetails={handleShowWorkspaceDetails}
            onRevealEntry={(entryPath) => void handleRevealWorkspaceEntry(entryPath)}
            onCopyPath={(entryPath) => void handleCopyWorkspacePath(entryPath)}
            onCopyRelativePath={(entryPath) => void handleCopyWorkspaceRelativePath(entryPath)}
            onCopyName={(entryPath) => void handleCopyWorkspaceName(entryPath)}
            onRefresh={(entryPath) => void handleRefreshWorkspaceEntry(entryPath)}
            onTransferEntry={(sourcePath, destinationParentPath, operation, kind) =>
              handleTransferWorkspaceEntry(sourcePath, destinationParentPath, operation, kind)
            }
            onStatusMessage={(message) => notify(message)}
            onSearchQueryChange={setWorkspaceQuery}
            onTagChange={setSelectedTag}
            onKindChange={setSelectedFileKind}
            onClearFilters={() => {
              setSelectedTag(null);
              setSelectedFileKind("all");
            }}
          />
          {workspaceLoading && <div className="workspace-loading">正在读取阅读库…</div>}
          {workspaceWatchError && <div className="workspace-watch-note">{workspaceWatchError}</div>}
          {documentState ? (
            <div className="sidebar-note">
              <div className="panel-kicker">READING DESK</div>
              <p>文件树负责找到内容，右侧上下文面板负责理解当前文档。</p>
            </div>
          ) : (
            <div className="sidebar-note">
              <div className="panel-kicker">MOMENT</div>
              <p>一个轻量的本地入口，先让内容抵达你面前。</p>
            </div>
          )}
        </aside>
        {!sidebarCollapsed && !focusMode && (
          <PaneResizeHandle
            side="sidebar"
            value={paneWidths.sidebar}
            min={PANE_WIDTH_LIMITS.sidebar.min}
            max={PANE_WIDTH_LIMITS.sidebar.max}
            onResizeBy={(delta) => resizePane("sidebar", delta)}
            onResizePreview={(delta) => previewPaneResize("sidebar", delta)}
            onResizeCommit={commitPaneResize}
            onReset={() => resetPane("sidebar")}
          />
        )}

        <main ref={contentAreaRef} className="content-area" aria-live="polite" onWheel={handleReaderWheel}>
          {readingZoomNotice !== null && (
            <div className="reading-zoom-hud" role="status" aria-live="polite">
              阅读缩放 {readingZoomNotice}%
            </div>
          )}
          {sidebarCollapsed && !focusMode && (
            <button
              type="button"
              className="sidebar-restore"
              onClick={() => setSidebarCollapsed(false)}
              title="显示侧栏 (Ctrl+Shift+B)"
            >
              显示侧栏 <span>Ctrl+Shift+B</span>
            </button>
          )}
          {focusMode && (
            <button type="button" className="focus-exit" onClick={() => setFocusMode(false)}>
              退出专注 <span>Esc</span>
            </button>
          )}
          {loading && <div className="loading-state">正在打开文档…</div>}
          {externalChangePath && documentState?.path === externalChangePath && (
            <ExternalChangeNotice
              fileName={documentState.name}
              onReload={() => void reloadExternalChange()}
              onOverwrite={overwriteExternalChange}
              onSaveAs={() => void handleExportMarkdown()}
              onDismiss={() => setExternalChangePath(null)}
            />
          )}
          {draftRecovery && isSameDocumentPath(documentState?.path ?? "", draftRecovery.path) && (
            <DraftRecoveryNotice
              snapshot={draftRecovery}
              currentSource={documentState?.source ?? draftRecovery.baseSource}
              onPreview={previewCurrentDraft}
              onLater={deferDraftRecovery}
              onDiscard={discardDraft}
            />
          )}
          {previousVersion && isSameDocumentPath(documentState?.path ?? "", previousVersion.path) && (
            <PreviousVersionNotice
              path={previousVersion.path}
              currentSource={documentState?.source ?? ""}
              previousSource={previousVersion.source}
              onPreview={previewPreviousVersion}
              onDismiss={() => setPreviousVersion(null)}
            />
          )}
          {error && (
            <div className="error-state" role="alert">
              {error}
            </div>
          )}
          {!loading && !documentState && (
            <EmptyState
              onOpen={() => void openSelectedFile()}
              onChooseWorkspace={() => void handleChooseWorkspace()}
              onOpenGuide={() => setGuideOpen(true)}
              hasWorkspace={Boolean(workspacePath)}
              showWorkspaceAction={!workspacePath && !sidebarCollapsed}
            />
          )}
          {!loading && documentState && documentState.kind === "pdf" && mode === "rendered" && (
            <PdfPreview name={documentState.name} src={documentState.previewUrl} />
          )}
          {!loading && documentState && documentState.kind === "image" && mode === "rendered" && (
            <ImagePreview name={documentState.name} src={documentState.previewUrl} />
          )}
          {!loading &&
            documentState &&
            documentState.kind !== "pdf" &&
            documentState.kind !== "image" &&
            mode === "rendered" && (
              <div className="reader-stage">
                <article
                  ref={articleRef}
                  className="reader-content markdown-body"
                  tabIndex={-1}
                  data-search-result-count={searchResultCount}
                  data-search-active-result={searchResultCount ? searchResultIndex + 1 : 0}
                  onClick={handleReaderClick}
                  onContextMenu={handleReaderContextMenu}
                  onKeyDown={handleReaderContextKeyDown}
                >
                  <div className="reader-meta" aria-label="文档信息">
                    <span className="reader-meta-kicker">DOCUMENT</span>
                    <span>
                      {fileTypeLabel(documentState.kind)} · {documentState.rendered.wordCount.toLocaleString("zh-CN")}{" "}
                      字 · {documentState.rendered.readingMinutes} 分钟阅读
                    </span>
                    {documentState.externallyModified && (
                      <button
                        type="button"
                        className="reader-external-change"
                        onClick={() => setExternalChangePath(documentState.path)}
                      >
                        文件已被外部修改 · 处理
                      </button>
                    )}
                  </div>
                  {!startsWithHeading(documentState.rendered.html) && (
                    <header className="print-document-header" aria-hidden="true">
                      <span className="print-document-kicker">MOYANG READER · DOCUMENT</span>
                      <div className="print-document-title">{documentState.name}</div>
                    </header>
                  )}
                  <div ref={readerBodyRef} className="reader-body">
                    <ProgressiveReaderContent
                      ref={progressiveReaderRef}
                      html={documentState.rendered.html}
                      onReady={handleProgressiveReaderReady}
                    />
                  </div>
                </article>
              </div>
            )}
          {!loading && documentState && documentState.kind === "markdown" && mode === "wysiwyg" && (
            <Suspense fallback={<div className="wysiwyg-loading-state">正在准备所见即所得编辑器…</div>}>
              <LazyMarkdownWysiwygEditor
                source={sourceDraft}
                documentKey={documentState.path}
                ariaLabel="Markdown 所见即所得编辑器"
                onChange={(value) => void updateSource(value, { merge: true })}
                requestedInsertKind={requestedInsertKind}
                onInsertRequestHandled={handleEditorInsertRequestHandled}
                onFindText={handleFindEditorText}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={(target) => undoEditor(target)}
                onRedo={(target) => redoEditor(target)}
                onStatusMessage={(message) => notify(message)}
                wikiCandidates={wikiLinkCandidates}
                onPasteImage={handleWysiwygPasteImage}
              />
            </Suspense>
          )}
          {!loading && documentState && canEdit && mode === "source" && (
            <SourceEditor
              value={sourceDraft}
              ariaLabel={documentState.kind === "text" ? "文本源内容" : "Markdown 源文本"}
              onChange={(value) => void updateSource(value, { merge: true })}
              onPaste={handleSourcePaste}
              requestedInsertKind={requestedInsertKind}
              onInsertRequestHandled={handleEditorInsertRequestHandled}
              onFindText={handleFindEditorText}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={(target) => undoEditor(target)}
              onRedo={(target) => redoEditor(target)}
              onStatusMessage={(message) => notify(message)}
              wikiCompletions={wikiLinkCandidates}
            />
          )}
          {readerContextMenu && documentState && mode === "rendered" && (
            <ReaderContextMenu
              target={readerContextMenu}
              documentPath={documentState.path.startsWith("browser://") ? null : documentState.path}
              canEdit={canEdit}
              canBookmark={canBookmark}
              isBookmarked={readerBookmarkPresent}
              canAnnotate={canAnnotate}
              editLabel={documentState.kind === "markdown" ? "进入所见即所得编辑" : "进入文本编辑"}
              onCopySelection={(text) => void handleCopyReaderText(text)}
              onFindSelection={(text) => handleFindEditorText(text)}
              onCopyLink={(href) => void handleCopyReaderLink(href)}
              onOpenLink={handleOpenReaderLink}
              onEdit={toggleReadingEditing}
              onCopyDocumentPath={() => void handleCopyReaderDocumentPath()}
              onToggleBookmark={handleToggleReaderBookmark}
              onAddAnnotation={handleOpenAnnotationDialog}
              onClose={() => setReaderContextMenu(null)}
            />
          )}
        </main>
        {rightPanelOpen && !focusMode && (
          <PaneResizeHandle
            side="context"
            value={paneWidths.context}
            min={PANE_WIDTH_LIMITS.context.min}
            max={PANE_WIDTH_LIMITS.context.max}
            onResizeBy={(delta) => resizePane("context", delta)}
            onResizePreview={(delta) => previewPaneResize("context", delta)}
            onResizeCommit={commitPaneResize}
            onReset={() => resetPane("context")}
          />
        )}
        {rightPanelOpen && !focusMode && (
          <ContextPanel
            documentState={documentState}
            entry={currentIndexEntry}
            backlinks={backlinks}
            outgoing={outgoing}
            bookmarks={bookmarks}
            annotations={annotations}
            annotationLocations={annotationLocations}
            annotationEnabled={preferences.annotationEnabled}
            currentAnnotationPath={currentAnnotationPath}
            knownPaths={bookmarkKnownPaths}
            canCreateNote={Boolean(workspacePath && isTauriRuntime())}
            selectedTag={selectedTag}
            toc={documentState?.rendered.toc ?? []}
            activeHeadingId={currentHeadingId}
            currentHeading={currentHeading}
            readingProgress={readingProgress}
            mode={mode}
            activeTab={activeContextTab}
            onTabChange={setActiveContextTab}
            onClose={() => setRightPanelOpen(false)}
            onOpenFile={(path) => void handleSelectTab(path)}
            onOpenBookmark={(bookmark) => void handleOpenBookmark(bookmark)}
            onDeleteBookmark={handleDeleteBookmark}
            onOpenAnnotation={(annotation) => void handleOpenAnnotation(annotation)}
            onDeleteAnnotation={handleDeleteAnnotation}
            onCreateNote={(target) => void handleCreateNote(target)}
            onOpenGraph={() => setGraphOpen(true)}
            onSelectTag={setSelectedTag}
            onScrollToTop={() => scrollToReaderEdge("top")}
            onScrollToBottom={() => scrollToReaderEdge("bottom")}
            onNavigateHeading={navigateToHeading}
          />
        )}
      </div>

      <footer className="statusbar">
        <span>{documentState?.path ?? "等待打开文件"}</span>
        {documentState && (
          <span>
            {documentState.kind === "pdf"
              ? "PDF"
              : documentState.kind === "image"
                ? "图片"
                : `${documentState.rendered.wordCount.toLocaleString("zh-CN")} 字符`}
          </span>
        )}
        {documentState?.externallyModified && (
          <button
            type="button"
            className="statusbar-external-change"
            onClick={() => setExternalChangePath(documentState.path)}
          >
            外部修改待处理
          </button>
        )}
        <span>{currentVersion ? "v" + currentVersion : "Moyang Reader"}</span>
      </footer>

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
          onPreview={previewDraftSnapshot}
          onDiscard={requestDraftDiscardByPath}
          onClearAll={clearAllDrafts}
          onClose={() => setDraftRecoveryOpen(false)}
          activeDocumentPath={documentState?.path}
          activeDocumentSource={documentState?.source}
        />
      )}
      {draftComparison && (
        <DraftRecoveryComparisonDialog
          snapshot={draftComparison.snapshot}
          comparisonSource={draftComparison.comparisonSource}
          comparisonLabel={draftComparison.comparisonLabel}
          comparisonIsCurrent={draftComparison.comparisonIsCurrent}
          comparisonStatus={draftComparison.comparisonStatus}
          comparisonError={draftComparison.comparisonError}
          currentDocumentModified={draftComparison.currentDocumentModified}
          sourceChangedSinceDraft={draftComparison.sourceChangedSinceDraft}
          actionLabel={draftComparison.isCurrentDocument ? "恢复到编辑区" : "打开文档继续确认"}
          onAction={handleDraftComparisonAction}
          onRetry={retryDraftComparison}
          onClose={closeDraftComparison}
          recoveryKind={draftComparison.recoveryKind}
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
      {annotationDialog && (
        <AnnotationDialog
          quote={annotationDialog.selection.quote}
          onCancel={() => setAnnotationDialog(null)}
          onSave={handleSaveAnnotation}
        />
      )}
      {guideOpen && (
        <GettingStartedDialog
          locale={locale}
          onClose={closeGettingStarted}
          onOpenDocument={openDocumentFromGuide}
          onAddWorkspace={addWorkspaceFromGuide}
        />
      )}
    </div>
  );
}
