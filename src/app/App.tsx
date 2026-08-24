import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
} from "react";
import { EmptyState } from "./components/EmptyState";
import { ExternalChangeNotice } from "./components/ExternalChangeNotice";
import { ImagePreview } from "./components/ImagePreview";
import { Outline } from "./components/Outline";
import { PdfPreview } from "./components/PdfPreview";
import { PrintPreview } from "./components/PrintPreview";
import { QuickOpenPalette } from "./components/QuickOpenPalette";
import { RelatedPanel } from "./components/RelatedPanel";
import { RelationGraph } from "./components/RelationGraph";
import { ReadingRail } from "./components/ReadingRail";
import { Tabs } from "./components/Tabs";
import { TopBar } from "./components/TopBar";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { UpdateNotice } from "./components/UpdateNotice";
import {
  chooseDocumentPaths,
  chooseSavePath,
  chooseWorkspacePath,
  authorizeStoredPath,
  closeWindow,
  createMarkdownFile,
  fileExists,
  fileSize,
  indexWorkspace,
  initialPaths,
  isTauriRuntime,
  listWorkspaceFiles,
  openExternalUrl,
  readBinaryFile,
  readTextFile,
  refreshWorkspace,
  resolveOpenPaths,
  searchWorkspace,
  subscribeToFileDrop,
  subscribeToWorkspaceChanges,
  subscribeToCloseRequest,
  subscribeToOpenPaths,
  writeBinaryFile,
  writeTextFile,
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
import type {
  DocumentKind,
  ExportMargin,
  ExportOrientation,
  ExportPaper,
  OpenPath,
  OpenDocument,
  ReaderMode,
  RecentFile,
  RecentWorkspace,
  ThemeMode,
  WorkspaceExportFailure,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceSearchResult,
} from "./types";
import { nextReaderModeAfterOpen } from "./reader-mode";
import {
  BATCH_EXPORT_CHUNK_SIZE,
  buildBatchDocxExport,
  buildBatchHtmlExport,
  buildDocxExport,
  buildHtmlExport,
  copyRichText,
  formatExportCancellationNotice,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
  printHtmlDocument,
  summarizeExportFailures,
} from "./export";
import {
  loadRecentFiles,
  loadRecentWorkspaces,
  loadLastDocumentPath,
  loadOpenTabs,
  loadReadingPosition,
  loadSidebarCollapsed,
  loadWorkspacePath,
  rememberRecentFile,
  rememberRecentWorkspace,
  saveLastDocumentPath,
  saveOpenTabs,
  saveReadingPosition,
  saveSidebarCollapsed,
  saveWorkspacePath,
} from "./storage";
import { loadReaderPreferences, saveReaderPreferences, type ReaderPreferences } from "./preferences";
import {
  documentKindFromPath,
  emptyRenderedDocument,
  imageMimeType,
  isEditableDocument,
  renderDocx,
  renderSource,
} from "../lib/document-adapters";
import { createBacklinkIndex, findBacklinks, findIndexEntry, findLinkedEntry } from "./workspace-index";
import type { QuickOpenCandidate } from "./quick-open";
import {
  applyWorkspaceFileDelta,
  applyWorkspaceIndexDelta,
  isCurrentWorkspaceLoad,
  isSelfWrittenChangePending,
} from "./workspace-refresh";
import { createWorkspaceOpenPlan } from "./workspace-open";
import { matchesWorkspaceFilter, type WorkspaceKindFilter } from "./workspace-filter";
import {
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

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function fileTypeLabel(kind: DocumentKind): string {
  return kind === "markdown" ? "MD" : kind === "image" ? "IMG" : kind.toUpperCase();
}

function startsWithHeading(html: string): boolean {
  return /^\s*<h1(?:\s[^>]*)?>/i.test(html);
}

function comparablePath(path: string): string {
  return path
    .replace(/[\\/]+/g, "\\")
    .replace(/\\$/, "")
    .toLocaleLowerCase();
}

function pathWasChanged(changedPath: string, currentPath: string): boolean {
  const changed = comparablePath(changedPath);
  const current = comparablePath(currentPath);
  return changed === current || current.startsWith(`${changed}\\`) || changed.startsWith(`${current}\\`);
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

function scrollToHeading(anchor: string): void {
  const id = safeDecode(anchor);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type CurrentHeading = {
  id: string;
  text: string;
};

function currentHeadingFromArticle(
  article: HTMLElement | null,
  contentArea: HTMLElement | null,
): CurrentHeading | null {
  if (!article) return null;

  const headings = Array.from(article.querySelectorAll<HTMLElement>("h1, h2, h3, h4"));
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

  const heading = currentHeading ?? headings[0];
  const text = heading.textContent?.trim() ?? "";
  return text ? { id: heading.id, text } : null;
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
  paper: ExportPaper;
  orientation: ExportOrientation;
  margin: ExportMargin;
};

type WorkspaceExportProgress = {
  current: number;
  total: number;
  fileName: string;
};

export function App() {
  const [documentState, setDocumentState] = useState<OpenDocument | null>(null);
  const [mode, setMode] = useState<ReaderMode>("rendered");
  const [sourceDraft, setSourceDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(readSavedTheme);
  const [focusMode, setFocusMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed);
  const [preferences, setPreferences] = useState<ReaderPreferences>(loadReaderPreferences);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceIndex, setWorkspaceIndex] = useState<WorkspaceIndexEntry[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(loadRecentFiles);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [workspaceResults, setWorkspaceResults] = useState<WorkspaceSearchResult[]>([]);
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false);
  const [workspaceExporting, setWorkspaceExporting] = useState(false);
  const [workspaceExportProgress, setWorkspaceExportProgress] = useState<WorkspaceExportProgress | null>(null);
  const [workspaceExportFailures, setWorkspaceExportFailures] = useState<WorkspaceExportFailure[]>([]);
  const [workspaceExportNotice, setWorkspaceExportNotice] = useState<string | null>(null);
  const [workspaceOpening, setWorkspaceOpening] = useState(false);
  const [workspaceOpenNotice, setWorkspaceOpenNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);
  const updateRef = useRef<Update | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const workspaceExportAbortRef = useRef<AbortController | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceIndexLoading, setWorkspaceIndexLoading] = useState(false);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [workspaceWatchError, setWorkspaceWatchError] = useState<string | null>(null);
  const [externalChangePath, setExternalChangePath] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFileKind, setSelectedFileKind] = useState<WorkspaceKindFilter>("all");
  const [graphOpen, setGraphOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [printPreview, setPrintPreview] = useState<PrintPreviewState | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentHeading, setCurrentHeading] = useState<string | null>(null);
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<RecentFile[]>([]);
  const [tabSessionReady, setTabSessionReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const browserDocumentsRef = useRef(new Map<string, BrowserDocument>());
  const browserDocumentSequenceRef = useRef(0);
  const previewUrlsRef = useRef(new Map<string, string>());
  const documentStateRef = useRef<OpenDocument | null>(null);
  const preferencesRef = useRef<ReaderPreferences>(preferences);
  const workspacePathRef = useRef<string | null>(workspacePath);
  const workspaceLoadRequestRef = useRef(0);
  const workspaceRefreshRequestRef = useRef(0);
  const workspaceReloadTimerRef = useRef<number | null>(null);
  const pendingWorkspacePathsRef = useRef(new Set<string>());
  const selfWrittenPathsRef = useRef(new Map<string, number>());
  const sourceRenderRequestRef = useRef(0);

  const confirmDocumentReplacement = useCallback((nextPaths: readonly string[], message: string) => {
    if (!shouldConfirmDocumentReplacement(documentStateRef.current, nextPaths)) return true;
    return window.confirm(message);
  }, []);

  const confirmWorkspaceSwitch = useCallback((nextWorkspacePath: string, message: string) => {
    const currentDocument = documentStateRef.current;
    if (
      !shouldConfirmWorkspaceSwitch(Boolean(currentDocument?.modified), workspacePathRef.current, nextWorkspacePath)
    ) {
      return true;
    }
    return window.confirm(message);
  }, []);

  const updateReadingRail = useCallback(() => {
    const contentArea = contentAreaRef.current;
    const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
    const nextProgress = maxScrollTop > 0 ? Math.min(1, Math.max(0, contentArea!.scrollTop / maxScrollTop)) : 0;
    setReadingProgress((current) => (Math.abs(current - nextProgress) < 0.001 ? current : nextProgress));
    const heading = currentHeadingFromArticle(articleRef.current, contentArea);
    setCurrentHeading((current) => (current === (heading?.text ?? null) ? current : (heading?.text ?? null)));
    setCurrentHeadingId((current) => (current === (heading?.id || null) ? current : heading?.id || null));
  }, []);

  const scrollToReaderEdge = useCallback((edge: "top" | "bottom") => {
    const contentArea = contentAreaRef.current;
    if (!contentArea) return;
    contentArea.scrollTo({ top: edge === "top" ? 0 : contentArea.scrollHeight, behavior: "smooth" });
  }, []);

  const setReaderPreferences = useCallback((changes: Partial<ReaderPreferences>) => {
    setPreferences((current) => {
      const next = { ...current, ...changes };
      saveReaderPreferences(next);
      return next;
    });
  }, []);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (tabSessionReady) saveOpenTabs(openTabs);
  }, [openTabs, tabSessionReady]);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    setWorkspaceExportFailures([]);
    setWorkspaceExportNotice(null);
  }, [selectedFileKind, selectedTag, workspacePath, workspaceQuery]);

  useEffect(() => {
    const path = documentState?.path;
    if (!path || path.startsWith("browser://")) return;

    const timer = window.setTimeout(() => {
      const contentArea = contentAreaRef.current;
      if (contentArea) contentArea.scrollTop = loadReadingPosition(path);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [documentState?.path]);

  useEffect(() => {
    const path = documentState?.path;
    const contentArea = contentAreaRef.current;
    if (!path || path.startsWith("browser://") || !contentArea) return;

    let timer: number | null = null;
    const persistPosition = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        saveReadingPosition(path, contentArea.scrollTop);
      }, 180);
    };

    contentArea.addEventListener("scroll", persistPosition, { passive: true });
    return () => {
      contentArea.removeEventListener("scroll", persistPosition);
      if (timer !== null) window.clearTimeout(timer);
      saveReadingPosition(path, contentArea.scrollTop);
    };
  }, [documentState?.path]);

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
  }, [documentState?.path, documentState?.rendered.html, mode, updateReadingRail]);

  useEffect(() => {
    if (documentState && mode === "rendered" && documentState.kind !== "pdf" && documentState.kind !== "image") return;
    setReadingProgress(0);
    setCurrentHeading(null);
    setCurrentHeadingId(null);
  }, [documentState, mode]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isTauriRuntime() || !documentStateRef.current?.modified) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let unlisten: (() => void) | null = null;
    const handleCloseRequest = () => {
      const current = documentStateRef.current;
      if (current?.modified && !window.confirm("当前文档有未保存修改，确定退出 Moyang Reader 吗？")) return;
      void closeWindow().catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "关闭窗口失败。");
      });
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
  }, []);

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
      browserDocumentsRef.current.clear();
    },
    [],
  );

  const releaseDocumentResources = useCallback((path: string) => {
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
      setUpdateError(describeUpdateError(cause));
      setUpdateNoticeVisible(true);
    }
  }, []);

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
        if (active && version) setCurrentVersion(version);
      })
      .catch(() => undefined);

    const timer = preferences.startupUpdateCheck
      ? window.setTimeout(() => {
          if (active) void checkForUpdates(false);
        }, 1_200)
      : null;

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [checkForUpdates, preferences.startupUpdateCheck]);

  const refreshWorkspaceChanges = useCallback(async (root: string, paths: string[]) => {
    if (!isTauriRuntime() || paths.length === 0) return;

    const requestId = ++workspaceRefreshRequestRef.current;
    setWorkspaceIndexLoading(true);
    try {
      const delta = await refreshWorkspace(root, paths);
      if (
        requestId !== workspaceRefreshRequestRef.current ||
        comparablePath(workspacePathRef.current ?? "") !== comparablePath(root)
      ) {
        return;
      }
      setWorkspaceFiles((current) => applyWorkspaceFileDelta(current, delta));
      setWorkspaceIndex((current) => applyWorkspaceIndexDelta(current, delta));
      setWorkspaceRevision((current) => current + 1);
    } catch {
      if (requestId === workspaceRefreshRequestRef.current) {
        setWorkspaceWatchError("工作区增量刷新失败，目录仍可手动刷新。");
      }
    } finally {
      if (requestId === workspaceRefreshRequestRef.current) setWorkspaceIndexLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async (root: string, silent = false) => {
    if (!isTauriRuntime()) return;

    const requestId = ++workspaceLoadRequestRef.current;
    workspaceRefreshRequestRef.current += 1;
    setWorkspaceLoading(true);
    setWorkspaceIndexLoading(true);
    try {
      const files = await listWorkspaceFiles(root);
      if (requestId !== workspaceLoadRequestRef.current) return;

      const switchedWorkspace = comparablePath(workspacePathRef.current ?? "") !== comparablePath(root);
      workspacePathRef.current = root;
      setWorkspacePath(root);
      setWorkspaceFiles(files);
      if (switchedWorkspace) {
        setWorkspaceIndex([]);
        setWorkspaceResults([]);
        setSelectedTag(null);
        setSelectedFileKind("all");
      }
      setWorkspaceRevision((current) => current + 1);
      saveWorkspacePath(root);
      setRecentWorkspaces(
        rememberRecentWorkspace({
          path: root,
          name: fileNameFromPath(root.replace(/[\\/]+$/, "")) || root,
        }),
      );
      if (!silent) setError(null);
      setWorkspaceLoading(false);

      void indexWorkspace(root)
        .then((index) => {
          if (!isCurrentWorkspaceLoad(requestId, workspaceLoadRequestRef.current, root, workspacePathRef.current))
            return;
          setWorkspaceIndex(index);
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
        setWorkspaceIndex([]);
        saveWorkspacePath(null);
      } else {
        setError(cause instanceof Error ? cause.message : "工作区读取失败。");
      }
    }
  }, []);

  const handleChooseWorkspace = useCallback(async () => {
    const selected = await chooseWorkspacePath();
    if (selected && confirmWorkspaceSwitch(selected, "当前文档有未保存修改，切换阅读库后将丢失这些修改。继续吗？")) {
      await loadWorkspace(selected);
    }
  }, [confirmWorkspaceSwitch, loadWorkspace]);

  const handleOpenRecentWorkspace = useCallback(
    async (path: string) => {
      try {
        const authorizedPath = await authorizeStoredPath(path, true);
        if (!confirmWorkspaceSwitch(authorizedPath, "当前文档有未保存修改，切换阅读库后将丢失这些修改。继续吗？")) {
          return;
        }
        await loadWorkspace(authorizedPath);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近阅读库无法打开，请重新选择文件夹。");
      }
    },
    [confirmWorkspaceSwitch, loadWorkspace],
  );

  const openSource = useCallback(
    async (path: string, source: string, preserveMode = false): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const kind = documentKindFromPath(path);
        if (!kind || (kind !== "markdown" && kind !== "text")) {
          throw new Error("当前文件不是可编辑的 Markdown 或文本文件。");
        }
        const rendered = await renderSource(path, source, {
          allowRemoteResources: preferencesRef.current.allowRemoteResources,
        });
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
        });
        setExternalChangePath(null);
        setSourceDraft(source);
        setOpenTabs((current) =>
          current.some((tab) => tab.path === path) ? current : [...current, { path, name: fileNameFromPath(path) }],
        );
        if (!path.startsWith("browser://")) {
          setRecentFiles(rememberRecentFile({ path, name: fileNameFromPath(path) }));
          saveLastDocumentPath(path);
        }
        setMode((current) => nextReaderModeAfterOpen(current, preserveMode));
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档渲染失败。");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [releaseDocumentResources],
  );

  const openBinary = useCallback(
    async (path: string, bytes: Uint8Array, preserveMode = false): Promise<boolean> => {
      const kind = documentKindFromPath(path);
      if (kind !== "docx" && kind !== "pdf" && kind !== "image") {
        throw new Error("当前文件不是可预览的文档。");
      }

      setLoading(true);
      setError(null);

      try {
        const rendered =
          kind === "docx"
            ? await renderDocx(bytes, { allowRemoteResources: preferencesRef.current.allowRemoteResources })
            : emptyRenderedDocument();
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
        });
        setExternalChangePath(null);
        setSourceDraft("");
        setOpenTabs((current) =>
          current.some((tab) => tab.path === path) ? current : [...current, { path, name: fileNameFromPath(path) }],
        );
        if (!path.startsWith("browser://")) {
          setRecentFiles(rememberRecentFile({ path, name: fileNameFromPath(path) }));
          saveLastDocumentPath(path);
        }
        setMode((current) => nextReaderModeAfterOpen(current, preserveMode));
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档预览失败。");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [releaseDocumentResources],
  );

  const openPath = useCallback(
    async (path: string, preserveMode = false): Promise<boolean> => {
      try {
        if (path.startsWith("browser://")) {
          const cached = browserDocumentsRef.current.get(path);
          if (!cached) throw new Error("浏览器预览文件已失效，请重新选择。");
          if (cached.bytes) {
            return await openBinary(path, cached.bytes, preserveMode);
          } else if (cached.source !== undefined) {
            return await openSource(path, cached.source, preserveMode);
          }
          return false;
        }

        const kind = documentKindFromPath(path);
        if (!kind) {
          throw new Error("不支持的文档类型，请选择 Markdown、文本、Word、PDF 或图片文件。");
        }
        if (kind === "docx" || kind === "pdf" || kind === "image") {
          return await openBinary(path, await readBinaryFile(path), preserveMode);
        }

        const source = await readTextFile(path);
        return await openSource(path, source, preserveMode);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文件打开失败。");
        return false;
      }
    },
    [openBinary, openSource],
  );

  const handleOpenPaths = useCallback(
    async (paths: OpenPath[]) => {
      const workspacePaths = paths.filter((entry) => entry.kind === "workspace").map((entry) => entry.path);
      const workspacePathToConfirm = workspacePaths.find((path) =>
        shouldConfirmWorkspaceSwitch(Boolean(documentStateRef.current?.modified), workspacePathRef.current, path),
      );
      if (
        workspacePathToConfirm &&
        !confirmWorkspaceSwitch(workspacePathToConfirm, "当前文档有未保存修改，切换阅读库后将丢失这些修改。继续吗？")
      ) {
        return;
      }

      const currentModifiedPath = documentStateRef.current?.modified ? documentStateRef.current.path : null;
      const pathsToProcess = currentModifiedPath
        ? paths.filter((entry) => entry.kind !== "document" || !isSameDocumentPath(currentModifiedPath, entry.path))
        : paths;
      const documentPaths = pathsToProcess.filter((entry) => entry.kind === "document").map((entry) => entry.path);
      if (!confirmDocumentReplacement(documentPaths, "当前文档有未保存修改，打开新文档后将丢失这些修改。继续吗？")) {
        return;
      }

      const seen = new Set<string>();
      for (const entry of pathsToProcess) {
        const key = `${entry.kind}:${entry.path.toLocaleLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        try {
          const authorizedPath = isTauriRuntime()
            ? await authorizeStoredPath(entry.path, entry.kind === "workspace")
            : entry.path;
          if (entry.kind === "workspace") {
            await loadWorkspace(authorizedPath);
          } else {
            await openPath(authorizedPath);
          }
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "无法打开传入的路径。");
        }
      }
    },
    [confirmDocumentReplacement, confirmWorkspaceSwitch, loadWorkspace, openPath],
  );

  const handleCreateNote = useCallback(
    async (target: string) => {
      if (!workspacePath || !documentState || documentState.path.startsWith("browser://")) {
        setError("请先添加一个工作区文件夹，再创建未解析链接。");
        return;
      }
      if (documentState.modified && !window.confirm("当前文档有未保存修改，创建后将切换到新文档。继续吗？")) return;

      try {
        const path = await createMarkdownFile(workspacePath, documentState.path, target);
        await loadWorkspace(workspacePath, true);
        await openPath(path);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法创建新文档。");
      }
    },
    [documentState, loadWorkspace, openPath, workspacePath],
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

  const saveDocument = useCallback(async () => {
    if (!documentState || !documentState.modified || !isEditableDocument(documentState.kind)) return;

    try {
      if (isTauriRuntime()) {
        selfWrittenPathsRef.current.set(comparablePath(documentState.path), Date.now() + 1_500);
        await writeTextFile(documentState.path, sourceDraft);
      } else {
        downloadText(documentState.name, sourceDraft);
      }

      const rendered = await renderSource(documentState.path, sourceDraft, {
        allowRemoteResources: preferences.allowRemoteResources,
      });
      setDocumentState((current) =>
        current ? { ...current, source: sourceDraft, rendered, modified: false } : current,
      );
      selfWrittenPathsRef.current.set(comparablePath(documentState.path), Date.now() + 1_500);
      setExternalChangePath(null);
    } catch (cause) {
      selfWrittenPathsRef.current.delete(comparablePath(documentState.path));
      setError(cause instanceof Error ? cause.message : "保存失败。");
    }
  }, [documentState, preferences.allowRemoteResources, sourceDraft]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;

    void (async () => {
      const paths = await initialPaths();
      if (isTauriRuntime()) {
        const hasStartupWorkspace = paths.some((entry) => entry.kind === "workspace");
        const savedWorkspace = loadWorkspacePath();
        if (savedWorkspace && !hasStartupWorkspace) {
          try {
            const authorizedWorkspace = await authorizeStoredPath(savedWorkspace, true);
            if (!active) return;
            await loadWorkspace(authorizedWorkspace, true);
          } catch {
            if (!active) return;
            saveWorkspacePath(null);
            workspacePathRef.current = null;
            setWorkspacePath(null);
            setWorkspaceFiles([]);
            setWorkspaceIndex([]);
          }
        }

        if (paths.length === 0) {
          const restoredTabs: RecentFile[] = [];
          for (const tab of loadOpenTabs()) {
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
    void subscribeToFileDrop((paths) => {
      if (!active) return;
      void resolveOpenPaths(paths)
        .then((entries) => {
          if (active) return handleOpenPaths(entries);
          return undefined;
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "无法打开拖入的路径。");
        });
    }).then((dispose) => {
      if (active) unlisten = dispose;
      else dispose?.();
    });

    return () => {
      active = false;
      unlisten?.();
    };
  }, [handleOpenPaths]);

  useEffect(() => {
    if (!workspacePath || !isTauriRuntime()) return;

    let active = true;
    let unwatch: (() => void) | null = null;
    const pendingWorkspacePaths = pendingWorkspacePathsRef.current;
    setWorkspaceWatchError(null);

    void subscribeToWorkspaceChanges(workspacePath, (paths) => {
      if (!active) return;

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

      const changedCurrentFile = paths.some((path) => pathWasChanged(path, current.path));
      if (!changedCurrentFile) return;

      const currentPath = comparablePath(current.path);
      const writtenUntil = selfWrittenPathsRef.current.get(currentPath);
      if (writtenUntil) {
        if (isSelfWrittenChangePending(writtenUntil, Date.now())) return;
        selfWrittenPathsRef.current.delete(currentPath);
      }

      if (current.modified) {
        setExternalChangePath(current.path);
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

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickOpen(true);
      }
      if (!focusMode && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarCollapsed((current) => !current);
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
  }, [focusMode, handleChooseWorkspace, openSelectedFile, saveDocument]);

  useEffect(() => {
    const path = documentState?.path;
    const kind = documentState?.kind;
    const requestId = ++sourceRenderRequestRef.current;
    if (mode !== "source" || !path || !kind || !isEditableDocument(kind)) return;

    const nextSource = sourceDraft;
    const timer = window.setTimeout(() => {
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
    }, 180);

    return () => window.clearTimeout(timer);
  }, [documentState?.kind, documentState?.path, mode, preferences.allowRemoteResources, sourceDraft]);

  useEffect(() => {
    const current = documentStateRef.current;
    if (mode !== "rendered" || !current || !isEditableDocument(current.kind)) return;

    const requestId = ++sourceRenderRequestRef.current;
    const path = current.path;
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
  }, [mode, preferences.allowRemoteResources, sourceDraft]);

  const updateSource = useCallback((nextSource: string) => {
    const current = documentStateRef.current;
    if (!current || !isEditableDocument(current.kind)) return;
    setSourceDraft(nextSource);
    setDocumentState((document) => (document ? { ...document, modified: nextSource !== document.source } : document));
  }, []);

  const handleSourcePaste = useCallback(
    async (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const image = findClipboardImage(event.clipboardData);
      if (!image) return;

      event.preventDefault();
      const current = documentStateRef.current;
      if (!isTauriRuntime()) {
        setError("浏览器预览模式不能保存剪贴板图片，请使用桌面版 Moyang Reader。");
        return;
      }
      if (!current || current.kind !== "markdown") {
        setError("剪贴板图片只能粘贴到 Markdown 源码文档中。");
        return;
      }
      if (!workspacePathRef.current || current.path.startsWith("browser://")) {
        setError("请先添加文档所在的文件夹，再粘贴剪贴板图片。");
        return;
      }
      if (image.size > MAX_CLIPBOARD_IMAGE_BYTES) {
        setError("剪贴板图片不能超过 10 MB。");
        return;
      }

      const editor = event.currentTarget;
      const initialStart = editor.selectionStart;
      const initialEnd = editor.selectionEnd;
      const path = current.path;

      try {
        const bytes = await clipboardImageToPng(image);
        if (bytes.byteLength > MAX_CLIPBOARD_IMAGE_BYTES) {
          throw new Error("转换后的剪贴板图片不能超过 10 MB。");
        }
        if (documentStateRef.current?.path !== path) {
          throw new Error("文档已切换，未插入剪贴板图片。");
        }

        const baseName = clipboardAssetFileName(bytes);
        let assetName = baseName;
        let assetPath = clipboardAssetPath(path, assetName);
        for (let suffix = 2; suffix <= 100 && (await fileExists(assetPath)); suffix += 1) {
          assetName = baseName.replace(/\.png$/i, `-${suffix}.png`);
          assetPath = clipboardAssetPath(path, assetName);
        }
        if (await fileExists(assetPath)) throw new Error("无法为剪贴板图片生成不重复的文件名。");

        await writeBinaryFile(assetPath, bytes);
        if (documentStateRef.current?.path !== path) {
          throw new Error("文档已切换，图片已保存但未插入引用。");
        }

        const start = document.activeElement === editor ? editor.selectionStart : initialStart;
        const end = document.activeElement === editor ? editor.selectionEnd : initialEnd;
        updateSource(insertTextAtSelection(editor.value, start, end, clipboardAssetReference(assetName)));
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "无法保存剪贴板图片。");
      }
    },
    [updateSource],
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

  const handleExport = useCallback(async () => {
    if ((documentState?.kind === "pdf" || documentState?.kind === "image") && documentState.previewUrl) {
      const anchor = document.createElement("a");
      anchor.href = documentState.previewUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
      return;
    }

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      await printHtmlDocument(html);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "打开打印预览失败。");
    }
  }, [buildCurrentExportHtml, documentState]);

  const handlePreviewPrint = useCallback(async () => {
    if (!documentState) return;

    try {
      const html = await buildCurrentExportHtml();
      if (!html) return;
      setPrintPreview({
        title: documentState.name,
        html,
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

  const handlePrintPreview = useCallback(async () => {
    if (!printPreview) return;

    try {
      await printHtmlDocument(printPreview.html);
      setPrintPreview(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "打开打印预览失败。");
    }
  }, [printPreview]);

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
    async (files: FileList | File[] | null | undefined) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) return;
      const supportedFiles: Array<{ file: File; kind: DocumentKind; path: string }> = [];
      const unsupportedNames: string[] = [];
      for (const file of selectedFiles) {
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
        if (unsupportedNotice) setError(unsupportedNotice);
        return;
      }
      const nextPaths = supportedFiles.map((entry) => entry.path);
      if (!confirmDocumentReplacement(nextPaths, "当前文档有未保存修改，打开新文件后将丢失这些修改。继续吗？")) {
        return;
      }

      for (const { file, kind, path } of supportedFiles) {
        if (kind === "docx" || kind === "pdf" || kind === "image") {
          await openBinary(path, new Uint8Array(await file.arrayBuffer()));
        } else {
          await openSource(path, await file.text());
        }
      }
      if (unsupportedNotice) {
        setError((current) => (current ? `${current} ${unsupportedNotice}` : unsupportedNotice));
      }
    },
    [confirmDocumentReplacement, openBinary, openSource],
  );

  const handleSelectTab = useCallback(
    async (path: string) => {
      if (path === documentState?.path) return;
      if (!confirmDocumentReplacement([path], "当前文档有未保存修改，切换后将丢失这些修改。继续吗？")) return;
      try {
        const authorizedPath = path.startsWith("browser://") ? path : await authorizeStoredPath(path, false);
        await openPath(authorizedPath);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "最近文档无法打开，请重新选择文件。");
      }
    },
    [confirmDocumentReplacement, documentState, openPath],
  );

  const handleCloseTab = useCallback(
    async (path: string) => {
      const index = openTabs.findIndex((tab) => tab.path === path);
      if (index < 0) return;
      if (
        documentState?.path === path &&
        documentState.modified &&
        !window.confirm("当前文档有未保存修改，关闭后将丢失这些修改。继续吗？")
      )
        return;

      const nextTabs = openTabs.filter((tab) => tab.path !== path);
      releaseDocumentResources(path);
      setOpenTabs(nextTabs);
      if (documentState?.path !== path) return;

      const nextTab = nextTabs[index] ?? nextTabs[index - 1];
      if (nextTab) {
        await openPath(nextTab.path);
      } else {
        setDocumentState(null);
        setSourceDraft("");
        setMode("rendered");
        setSearchQuery("");
        setError(null);
        saveLastDocumentPath(null);
      }
    },
    [documentState, openPath, openTabs, releaseDocumentResources],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      void handleBrowserFiles(event.dataTransfer.files);
    },
    [handleBrowserFiles],
  );

  const handleReaderClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const anchor = (event.target as HTMLElement).closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;

      if (href.startsWith("moyang-wiki:")) {
        event.preventDefault();
        const target = safeDecode(href.slice("moyang-wiki:".length));
        const [rawPath, rawAnchor] = target.split("#", 2);
        const currentEntry = documentState ? findIndexEntry(workspaceIndex, documentState.path) : undefined;
        const linkedEntry = currentEntry ? findLinkedEntry(workspaceIndex, currentEntry, rawPath) : undefined;
        const path =
          linkedEntry?.file.path ??
          (documentState ? resolveWikiPath(documentState.path, rawPath || documentState.path) : null);
        if (!path) {
          setError("浏览器预览模式无法解析文档内链接，请在 Moyang Reader 桌面版中打开。");
          return;
        }
        void handleSelectTab(path).then(() => {
          if (rawAnchor) scrollToHeading(safeDecode(rawAnchor));
        });
        return;
      }

      const target = safeDecode(href);
      if (target.startsWith("#")) {
        event.preventDefault();
        scrollToHeading(target.slice(1));
        return;
      }

      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
        event.preventDefault();
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
        event.preventDefault();
        setError("浏览器预览模式无法解析本地文档链接，请在 Moyang Reader 桌面版中打开。");
        return;
      }

      event.preventDefault();
      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = resolveRelativePath(documentState.path, rawPath);
      if (!path) {
        setError("无法解析这个本地文档链接。");
        return;
      }
      void handleSelectTab(path).then(() => {
        if (rawAnchor) scrollToHeading(safeDecode(rawAnchor));
      });
    },
    [documentState, handleSelectTab, workspaceIndex],
  );

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
    if (!selectedTag || !workspacePath || workspaceIndex.some((entry) => entry.tags.includes(selectedTag))) return;
    setSelectedTag(null);
  }, [selectedTag, workspaceIndex, workspacePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 160);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || mode !== "rendered") {
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    root.querySelectorAll("mark.moyang-search-hit").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });

    const query = debouncedSearchQuery.trim().toLocaleLowerCase();
    if (!query) {
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.parentElement?.tagName !== "SCRIPT" && currentNode.parentElement?.tagName !== "STYLE") {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? "";
      const lowerValue = value.toLocaleLowerCase();
      const positions: number[] = [];
      let cursor = 0;
      while (true) {
        const position = lowerValue.indexOf(query, cursor);
        if (position < 0) break;
        positions.push(position);
        cursor = position + query.length;
      }

      for (const position of positions.reverse()) {
        const range = document.createRange();
        range.setStart(textNode, position);
        range.setEnd(textNode, position + query.length);
        const mark = document.createElement("mark");
        mark.className = "moyang-search-hit";
        range.surroundContents(mark);
      }
    }

    const hits = Array.from(root.querySelectorAll<HTMLElement>("mark.moyang-search-hit"));
    setSearchResultCount(hits.length);
    setSearchResultIndex((current) => (hits.length ? Math.min(current, hits.length - 1) : 0));
  }, [debouncedSearchQuery, documentState?.rendered.html, mode]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || mode !== "rendered") return;

    const hits = Array.from(root.querySelectorAll<HTMLElement>("mark.moyang-search-hit"));
    const nextIndex = hits.length ? Math.min(searchResultIndex, hits.length - 1) : 0;
    hits.forEach((hit, index) => hit.classList.toggle("active", index === nextIndex));
    hits[nextIndex]?.scrollIntoView({ block: "center" });
  }, [debouncedSearchQuery, documentState?.rendered.html, mode, searchResultIndex]);

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
  }, [documentState?.path, documentState?.rendered.html, mode]);

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
  const currentIndexEntry = documentState ? findIndexEntry(workspaceIndex, documentState.path) : undefined;
  const backlinkIndex = useMemo(() => createBacklinkIndex(workspaceIndex), [workspaceIndex]);
  const backlinks = currentIndexEntry ? findBacklinks(workspaceIndex, currentIndexEntry, backlinkIndex) : [];
  const outgoing = currentIndexEntry
    ? currentIndexEntry.links.map((target) => ({
        target,
        entry: findLinkedEntry(workspaceIndex, currentIndexEntry, target),
      }))
    : [];
  const availableTags = Array.from(new Set(workspaceIndex.flatMap((entry) => entry.tags))).sort((a, b) =>
    a.localeCompare(b),
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
  const workspaceActionFiles = useMemo(() => {
    const query = workspaceQuery.trim();
    if (!query) return visibleWorkspaceFiles;
    if (query.length < 2 || workspaceSearchLoading) return [];
    return visibleWorkspaceResults.map((result) => result.file);
  }, [visibleWorkspaceFiles, visibleWorkspaceResults, workspaceQuery, workspaceSearchLoading]);
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

  const handleOpenWorkspaceFiles = useCallback(async () => {
    if (!workspacePath || workspaceActionFiles.length === 0 || !isTauriRuntime()) return;

    const plan = createWorkspaceOpenPlan(workspaceActionFiles);
    if (plan.files.length === 0) return;
    const currentModifiedPath = documentStateRef.current?.modified ? documentStateRef.current.path : null;
    const filesToOpen = currentModifiedPath
      ? plan.files.filter((file) => !isSameDocumentPath(currentModifiedPath, file.path))
      : plan.files;
    if (filesToOpen.length === 0) {
      setWorkspaceOpenNotice("当前文档有未保存修改，已保留，不重复打开。");
      return;
    }
    if (
      !confirmDocumentReplacement(
        filesToOpen.map((file) => file.path),
        "当前文档有未保存修改，批量打开后将丢失这些修改。继续吗？",
      )
    ) {
      return;
    }

    setWorkspaceOpening(true);
    setWorkspaceOpenNotice(null);
    setError(null);

    let opened = 0;
    try {
      for (const file of filesToOpen) {
        if (await openPath(file.path)) opened += 1;
      }

      const failed = filesToOpen.length - opened;
      const details = [
        `已打开 ${opened} 个文档`,
        failed > 0 ? `失败 ${failed} 个` : "",
        filesToOpen.length < plan.files.length
          ? `已保留当前未保存文档 ${plan.files.length - filesToOpen.length} 个`
          : "",
        plan.skippedCount > 0 ? `为保持轻量跳过 ${plan.skippedCount} 个` : "",
      ].filter(Boolean);
      setWorkspaceOpenNotice(`${details.join("，")}。`);
      if (failed > 0) setError(`有 ${failed} 个文档无法打开，请查看当前文件是否仍然存在。`);
    } finally {
      setWorkspaceOpening(false);
    }
  }, [confirmDocumentReplacement, openPath, workspaceActionFiles, workspacePath]);

  const handleCancelWorkspaceExport = useCallback(() => {
    workspaceExportAbortRef.current?.abort();
  }, []);

  const handleExportWorkspace = useCallback(
    async (format: "html" | "docx" | "pdf") => {
      if (!workspacePath || workspaceActionFiles.length === 0 || !isTauriRuntime()) return;

      const workspaceName = fileNameFromPath(workspacePath.replace(/[\\/]+$/, "")) || "阅读库";
      const savePath =
        format === "pdf"
          ? null
          : await chooseSavePath(pathWithExtension(`${workspacePath}\\${workspaceName}`, format), format);
      if (format !== "pdf" && !savePath) return;

      const controller = new AbortController();
      workspaceExportAbortRef.current = controller;
      setWorkspaceExporting(true);
      setWorkspaceExportProgress({ current: 0, total: workspaceActionFiles.length, fileName: "准备导出…" });
      setWorkspaceExportFailures([]);
      setWorkspaceExportNotice(null);
      setError(null);

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
        const exportableFileCount = workspaceActionFiles.filter(
          (file) => file.kind === "docx" || file.kind === "markdown" || file.kind === "text",
        ).length;
        const expectedVolumeCount =
          format !== "pdf" ? Math.max(1, Math.ceil(exportableFileCount / BATCH_EXPORT_CHUNK_SIZE)) : 1;
        let documents: { title: string; body: string }[] = [];
        const flushDocuments = async () => {
          if (documents.length === 0) return;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");

          const batch = documents;
          documents = [];
          const volumeNumber = writtenVolumes + 1;
          const volumeTitle = expectedVolumeCount > 1 ? `${exportTitle} · 第 ${volumeNumber} 卷` : exportTitle;
          if (format === "html") {
            if (!savePath) throw new Error("没有选择 HTML 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "html") : savePath;
            await writeTextFile(targetPath, buildBatchHtmlExport(volumeTitle, batch, exportOptions));
          } else {
            if (!savePath) throw new Error("没有选择 Word 保存位置。");
            const targetPath =
              expectedVolumeCount > 1 ? pathWithNameSuffix(savePath, ` - 第 ${volumeNumber} 卷`, "docx") : savePath;
            await writeBinaryFile(
              targetPath,
              await buildBatchDocxExport(volumeTitle, batch, exportOptions, controller.signal),
            );
          }
          writtenVolumes = volumeNumber;
          if (controller.signal.aborted) throw new Error("EXPORT_CANCELLED");
        };

        for (const [index, file] of workspaceActionFiles.entries()) {
          if (controller.signal.aborted) {
            setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
            return;
          }
          setWorkspaceExportProgress({
            current: index + 1,
            total: workspaceActionFiles.length,
            fileName: file.relativePath,
          });
          try {
            let rendered;
            if (file.kind === "docx") {
              rendered = await renderDocx(await readBinaryFile(file.path), {
                allowRemoteResources: preferences.allowRemoteResources,
              });
            } else if (file.kind === "markdown" || file.kind === "text") {
              rendered = await renderSource(file.path, await readTextFile(file.path), {
                allowRemoteResources: preferences.allowRemoteResources,
              });
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
            );
            documents.push({ title: file.relativePath, body });
            exported += 1;
            if (format !== "pdf" && documents.length >= BATCH_EXPORT_CHUNK_SIZE) await flushDocuments();
          } catch {
            recordSkippedFile(file.relativePath, "读取失败");
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
        if (format === "pdf") {
          setPrintPreview({
            title: `${exportTitle} · 批量打印`,
            html: buildBatchHtmlExport(exportTitle, documents, exportOptions),
            paper: exportOptions.paper,
            orientation: exportOptions.orientation,
            margin: exportOptions.margin,
          });
        } else {
          await flushDocuments();
        }
        const formatLabel = format === "html" ? "HTML" : format === "docx" ? "Word" : "打印 / PDF";
        const failureSummary = summarizeExportFailures(
          skippedFiles.map((failure) => `${failure.fileName}（${failure.reason}）`),
        );
        const volumeNotice = writtenVolumes > 1 ? `，已分卷为 ${writtenVolumes} 个文件` : "";
        setWorkspaceExportNotice(
          `${format === "pdf" ? "已打开批量打印预览，共 " : `已导出 ${exported} 篇文档为 ${formatLabel}`}${
            format === "pdf" ? `${exported} 篇文档` : ""
          }${volumeNotice}${failureSummary ? `，跳过 ${skippedFiles.length} 个：${failureSummary}` : ""}。`,
        );
      } catch (cause) {
        if (controller.signal.aborted) {
          setWorkspaceExportNotice(formatExportCancellationNotice(exported, writtenVolumes));
        } else {
          setError(cause instanceof Error ? cause.message : "批量导出失败。");
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
      workspaceActionFiles,
      workspacePath,
    ],
  );

  return (
    <div
      className={`app-shell reading-scale-${preferences.readingScale} reading-width-${preferences.readingWidth}${
        focusMode ? " focus-mode" : ""
      }${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <TopBar
        fileName={documentState?.name ?? null}
        mode={mode}
        canEdit={canEdit}
        modified={documentState?.modified ?? false}
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchResultCount={searchResultCount}
        searchResultIndex={searchResultIndex}
        theme={theme}
        readingScale={preferences.readingScale}
        readingWidth={preferences.readingWidth}
        exportPaper={preferences.exportPaper}
        exportOrientation={preferences.exportOrientation}
        exportMargin={preferences.exportMargin}
        onReadingScaleChange={(scale) => setReaderPreferences({ readingScale: scale })}
        onReadingWidthChange={(width) => setReaderPreferences({ readingWidth: width })}
        onExportPaperChange={(paper) => setReaderPreferences({ exportPaper: paper })}
        onExportOrientationChange={(orientation) => setReaderPreferences({ exportOrientation: orientation })}
        onExportMarginChange={(margin) => setReaderPreferences({ exportMargin: margin })}
        allowRemoteResources={preferences.allowRemoteResources}
        startupUpdateCheck={preferences.startupUpdateCheck}
        onAllowRemoteResourcesChange={(allowed) => setReaderPreferences({ allowRemoteResources: allowed })}
        onStartupUpdateCheckChange={(enabled) => setReaderPreferences({ startupUpdateCheck: enabled })}
        onOpen={() => void openSelectedFile()}
        onChooseWorkspace={() => void handleChooseWorkspace()}
        onQuickOpen={() => setQuickOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((current) => !current)}
        onToggleMode={() => setMode((current) => (current === "rendered" ? "source" : "rendered"))}
        onSave={() => void saveDocument()}
        onCopy={() => void handleCopy()}
        copyFeedback={copyFeedback}
        onExport={() => void handleExport()}
        exportLabel={
          documentState?.kind === "pdf" ? "打开 PDF" : documentState?.kind === "image" ? "打开图片" : "打印 / PDF"
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
        onCheckUpdates={() => void checkForUpdates(true)}
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
      />
      <div className="navigation-strip">
        {updateNoticeVisible && updateStatus !== "idle" && updateStatus !== "checking" && (
          <UpdateNotice
            status={updateStatus}
            version={availableUpdate?.version ?? null}
            notes={availableUpdate?.body?.trim() || null}
            progress={updateProgress}
            error={updateError}
            onInstall={() => void installUpdate()}
            onRelaunch={() => void relaunchUpdatedApp()}
            onDismiss={dismissUpdateNotice}
          />
        )}
        <Tabs
          tabs={openTabs}
          activePath={documentState?.path ?? null}
          onSelect={(path) => void handleSelectTab(path)}
          onClose={(path) => void handleCloseTab(path)}
        />
      </div>
      <div className="workspace-grid">
        <aside className="sidebar">
          <WorkspacePanel
            onOpenVisibleFiles={() => void handleOpenWorkspaceFiles()}
            onExportWorkspace={(format) => void handleExportWorkspace(format)}
            onCancelWorkspaceExport={handleCancelWorkspaceExport}
            workspaceExporting={workspaceExporting}
            workspaceExportProgress={workspaceExportProgress}
            workspaceExportFailures={workspaceExportFailures}
            workspaceExportNotice={workspaceExportNotice}
            workspaceOpening={workspaceOpening}
            workspaceOpenNotice={workspaceOpenNotice}
            workspaceIndexLoading={workspaceIndexLoading}
            workspacePath={workspacePath}
            files={workspaceFiles}
            visibleFiles={visibleWorkspaceFiles}
            openableFiles={workspaceActionFiles}
            exportableFiles={workspaceActionFiles}
            recentFiles={recentFiles}
            recentWorkspaces={recentWorkspaces}
            activePath={documentState?.path ?? null}
            searchQuery={workspaceQuery}
            searchResults={visibleWorkspaceResults}
            searchLoading={workspaceSearchLoading}
            tagOptions={availableTags}
            selectedTag={selectedTag}
            selectedKind={selectedFileKind}
            onChooseWorkspace={() => void handleChooseWorkspace()}
            onOpenWorkspace={(path) => void handleOpenRecentWorkspace(path)}
            onOpenFile={(path) => void handleSelectTab(path)}
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
            <>
              <div className="sidebar-section">
                <div className="panel-kicker">CURRENT FILE</div>
                <div className="file-card">
                  <span className="file-type">{fileTypeLabel(documentState.kind)}</span>
                  <div>
                    <strong>{documentState.name}</strong>
                    <span>
                      {documentState.kind === "pdf"
                        ? "PDF 预览"
                        : documentState.kind === "image"
                          ? "图片预览"
                          : `${documentState.rendered.readingMinutes} 分钟阅读`}
                    </span>
                  </div>
                </div>
              </div>
              <Outline items={documentState.rendered.toc} activeId={currentHeadingId} />
              <RelatedPanel
                entry={currentIndexEntry}
                backlinks={backlinks}
                outgoing={outgoing}
                canCreateNote={Boolean(workspacePath && isTauriRuntime())}
                selectedTag={selectedTag}
                onOpenFile={(path) => void handleSelectTab(path)}
                onCreateNote={(target) => void handleCreateNote(target)}
                onOpenGraph={() => setGraphOpen(true)}
                onSelectTag={setSelectedTag}
              />
            </>
          ) : (
            <div className="sidebar-note">
              <div className="panel-kicker">MOMENT</div>
              <p>一个轻量的本地入口，先让内容抵达你面前。</p>
            </div>
          )}
        </aside>

        <main ref={contentAreaRef} className="content-area" aria-live="polite">
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
              onReload={() => {
                setExternalChangePath(null);
                void openPath(documentState.path, true);
              }}
              onDismiss={() => setExternalChangePath(null)}
            />
          )}
          {error && (
            <div className="error-state" role="alert">
              {error}
            </div>
          )}
          {!loading && !documentState && (
            <EmptyState onOpen={() => void openSelectedFile()} onChooseWorkspace={() => void handleChooseWorkspace()} />
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
                <article ref={articleRef} className="reader-content markdown-body" onClick={handleReaderClick}>
                  <div className="reader-meta" aria-label="文档信息">
                    <span className="reader-meta-kicker">DOCUMENT</span>
                    <span>
                      {fileTypeLabel(documentState.kind)} · {documentState.rendered.wordCount.toLocaleString("zh-CN")}{" "}
                      字 · {documentState.rendered.readingMinutes} 分钟阅读
                    </span>
                  </div>
                  {!startsWithHeading(documentState.rendered.html) && (
                    <header className="print-document-header" aria-hidden="true">
                      <span className="print-document-kicker">MOYANG READER · DOCUMENT</span>
                      <div className="print-document-title">{documentState.name}</div>
                    </header>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: documentState.rendered.html }} />
                </article>
                <ReadingRail
                  progress={readingProgress}
                  currentHeading={currentHeading}
                  headingCount={documentState.rendered.toc.length}
                  onScrollToTop={() => scrollToReaderEdge("top")}
                  onScrollToBottom={() => scrollToReaderEdge("bottom")}
                />
              </div>
            )}
          {!loading && documentState && canEdit && mode === "source" && (
            <textarea
              className="source-editor"
              aria-label={documentState.kind === "text" ? "文本源内容" : "Markdown 源文本"}
              value={sourceDraft}
              onChange={(event) => void updateSource(event.target.value)}
              onPaste={(event) => void handleSourcePaste(event)}
              spellCheck={false}
            />
          )}
        </main>
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
      {printPreview && (
        <PrintPreview
          title={printPreview.title}
          html={printPreview.html}
          paper={printPreview.paper}
          orientation={printPreview.orientation}
          margin={printPreview.margin}
          onPrint={handlePrintPreview}
          onClose={() => setPrintPreview(null)}
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
    </div>
  );
}
