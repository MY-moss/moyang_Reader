import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { EmptyState } from "./components/EmptyState";
import { ExternalChangeNotice } from "./components/ExternalChangeNotice";
import { ImagePreview } from "./components/ImagePreview";
import { Outline } from "./components/Outline";
import { PdfPreview } from "./components/PdfPreview";
import { RelatedPanel } from "./components/RelatedPanel";
import { RelationGraph } from "./components/RelationGraph";
import { Tabs } from "./components/Tabs";
import { TopBar } from "./components/TopBar";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { UpdateNotice } from "./components/UpdateNotice";
import {
  chooseDocumentPath,
  chooseSavePath,
  chooseWorkspacePath,
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
  searchWorkspace,
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
  OpenDocument,
  ReaderMode,
  RecentFile,
  RecentWorkspace,
  ThemeMode,
  WorkspaceFile,
  WorkspaceIndexEntry,
  WorkspaceSearchResult,
} from "./types";
import {
  buildBatchHtmlExport,
  buildDocxExport,
  buildHtmlExport,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
} from "./export";
import {
  loadRecentFiles,
  loadRecentWorkspaces,
  loadWorkspacePath,
  rememberRecentFile,
  rememberRecentWorkspace,
  saveRecentFiles,
  saveRecentWorkspaces,
  saveWorkspacePath,
} from "./storage";
import {
  documentKindFromPath,
  emptyRenderedDocument,
  imageMimeType,
  isEditableDocument,
  renderDocx,
  renderSource,
} from "../lib/document-adapters";
import { findBacklinks, findIndexEntry, findLinkedEntry } from "./workspace-index";
import { isCurrentWorkspaceLoad, isSelfWrittenChangePending } from "./workspace-refresh";

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function fileTypeLabel(kind: DocumentKind): string {
  return kind === "markdown" ? "MD" : kind === "image" ? "IMG" : kind.toUpperCase();
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

export function App() {
  const [documentState, setDocumentState] = useState<OpenDocument | null>(null);
  const [mode, setMode] = useState<ReaderMode>("rendered");
  const [sourceDraft, setSourceDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(readSavedTheme);
  const [workspacePath, setWorkspacePath] = useState<string | null>(loadWorkspacePath);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspaceIndex, setWorkspaceIndex] = useState<WorkspaceIndexEntry[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(loadRecentFiles);
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>(loadRecentWorkspaces);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [workspaceResults, setWorkspaceResults] = useState<WorkspaceSearchResult[]>([]);
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false);
  const [workspaceExporting, setWorkspaceExporting] = useState(false);
  const [workspaceExportNotice, setWorkspaceExportNotice] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);
  const updateRef = useRef<Update | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceIndexLoading, setWorkspaceIndexLoading] = useState(false);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [workspaceWatchError, setWorkspaceWatchError] = useState<string | null>(null);
  const [externalChangePath, setExternalChangePath] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [openTabs, setOpenTabs] = useState<RecentFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const browserDocumentsRef = useRef(new Map<string, BrowserDocument>());
  const previewUrlsRef = useRef(new Set<string>());
  const documentStateRef = useRef<OpenDocument | null>(null);
  const workspacePathRef = useRef<string | null>(workspacePath);
  const workspaceLoadRequestRef = useRef(0);
  const workspaceReloadTimerRef = useRef<number | null>(null);
  const selfWrittenPathsRef = useRef(new Map<string, number>());
  const sourceRenderRequestRef = useRef(0);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

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
      browserDocumentsRef.current.clear();
    },
    [],
  );

  const releaseBrowserDocument = useCallback((path: string) => {
    const cached = browserDocumentsRef.current.get(path);
    if (cached?.previewUrl) {
      URL.revokeObjectURL(cached.previewUrl);
      previewUrlsRef.current.delete(cached.previewUrl);
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

    const timer = window.setTimeout(() => {
      if (active) void checkForUpdates(false);
    }, 1_200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkForUpdates]);

  const loadWorkspace = useCallback(async (root: string, silent = false) => {
    if (!isTauriRuntime()) return;

    const requestId = ++workspaceLoadRequestRef.current;
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
    if (selected) await loadWorkspace(selected);
  }, [loadWorkspace]);

  const openSource = useCallback(
    async (path: string, source: string) => {
      setLoading(true);
      setError(null);

      try {
        const kind = documentKindFromPath(path);
        const rendered = await renderSource(path, source);
        if (path.startsWith("browser://")) {
          releaseBrowserDocument(path);
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
        }
        setMode("rendered");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档渲染失败。");
      } finally {
        setLoading(false);
      }
    },
    [releaseBrowserDocument],
  );

  const openBinary = useCallback(
    async (path: string, bytes?: Uint8Array) => {
      const kind = documentKindFromPath(path);
      if (kind !== "docx" && kind !== "pdf" && kind !== "image") {
        throw new Error("当前文件不是可预览的文档。");
      }
      if (kind === "docx" && !bytes) {
        throw new Error("Word 文档内容读取失败。");
      }
      if ((kind === "pdf" || kind === "image") && path.startsWith("browser://") && !bytes) {
        throw new Error("浏览器预览文件已失效，请重新选择。");
      }

      setLoading(true);
      setError(null);

      try {
        const rendered = kind === "docx" ? await renderDocx(bytes as Uint8Array) : emptyRenderedDocument();
        let previewUrl: string | undefined;
        if (kind === "pdf" || kind === "image") {
          const pdfBytes = bytes
            ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
            : null;
          previewUrl = path.startsWith("browser://")
            ? URL.createObjectURL(
                new Blob([pdfBytes as ArrayBuffer], {
                  type: kind === "pdf" ? "application/pdf" : imageMimeType(path),
                }),
              )
            : convertFileSrc(path, "asset");
          if (path.startsWith("browser://")) previewUrlsRef.current.add(previewUrl);
        }

        if (path.startsWith("browser://")) {
          releaseBrowserDocument(path);
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
        }
        setMode("rendered");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文档预览失败。");
      } finally {
        setLoading(false);
      }
    },
    [releaseBrowserDocument],
  );

  const openPath = useCallback(
    async (path: string) => {
      try {
        if (path.startsWith("browser://")) {
          const cached = browserDocumentsRef.current.get(path);
          if (!cached) throw new Error("浏览器预览文件已失效，请重新选择。");
          if (cached.bytes) {
            await openBinary(path, cached.bytes);
          } else if (cached.source !== undefined) {
            await openSource(path, cached.source);
          }
          return;
        }

        const kind = documentKindFromPath(path);
        if (kind === "docx" || kind === "pdf" || kind === "image") {
          await openBinary(path, kind === "docx" ? await readBinaryFile(path) : undefined);
          return;
        }

        const source = await readTextFile(path);
        await openSource(path, source);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文件打开失败。");
      }
    },
    [openBinary, openSource],
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
    const nativePath = await chooseDocumentPath();
    if (nativePath) {
      await openPath(nativePath);
      return;
    }
    inputRef.current?.click();
  }, [openPath]);

  const saveDocument = useCallback(async () => {
    if (!documentState || !documentState.modified || !isEditableDocument(documentState.kind)) return;

    try {
      if (isTauriRuntime()) {
        selfWrittenPathsRef.current.set(comparablePath(documentState.path), Date.now() + 1_500);
        await writeTextFile(documentState.path, sourceDraft);
      } else {
        downloadText(documentState.name, sourceDraft);
      }

      const rendered = await renderSource(documentState.path, sourceDraft);
      setDocumentState((current) =>
        current ? { ...current, source: sourceDraft, rendered, modified: false } : current,
      );
      selfWrittenPathsRef.current.set(comparablePath(documentState.path), Date.now() + 1_500);
      setExternalChangePath(null);
    } catch (cause) {
      selfWrittenPathsRef.current.delete(comparablePath(documentState.path));
      setError(cause instanceof Error ? cause.message : "保存失败。");
    }
  }, [documentState, sourceDraft]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;

    void (async () => {
      const paths = await initialPaths();
      for (const path of [...new Set(paths)]) {
        if (!active) break;
        await openPath(path);
      }
      const dispose = await subscribeToOpenPaths((nextPaths) => {
        if (documentStateRef.current?.modified && !window.confirm("当前文档有未保存修改，确定打开外部传入的文件吗？"))
          return;
        void (async () => {
          for (const path of [...new Set(nextPaths)]) {
            if (!active) break;
            await openPath(path);
          }
        })();
      });
      if (active) unlisten = dispose;
      else dispose?.();
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [openPath]);

  useEffect(() => {
    const savedWorkspace = loadWorkspacePath();
    if (savedWorkspace && isTauriRuntime()) {
      void loadWorkspace(savedWorkspace, true);
    }
  }, [loadWorkspace]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    void Promise.all(
      loadRecentFiles().map(async (file) => ({
        file,
        exists: await fileExists(file.path),
      })),
    )
      .then((entries) => {
        if (!active) return;
        const validFiles = entries.filter((entry) => entry.exists).map((entry) => entry.file);
        setRecentFiles(validFiles);
        saveRecentFiles(validFiles);
      })
      .catch(() => {
        // A failed existence check should not prevent the reader from opening.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    void Promise.all(
      loadRecentWorkspaces().map(async (workspace) => ({
        workspace,
        exists: await fileExists(workspace.path),
      })),
    )
      .then((entries) => {
        if (!active) return;
        const validWorkspaces = entries.filter((entry) => entry.exists).map((entry) => entry.workspace);
        setRecentWorkspaces(validWorkspaces);
        saveRecentWorkspaces(validWorkspaces);
      })
      .catch(() => {
        // A failed existence check should not prevent the reader from opening.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!workspacePath || !isTauriRuntime()) return;

    let active = true;
    let unwatch: (() => void) | null = null;
    setWorkspaceWatchError(null);

    void subscribeToWorkspaceChanges(workspacePath, (paths) => {
      if (!active) return;

      if (workspaceReloadTimerRef.current !== null) {
        window.clearTimeout(workspaceReloadTimerRef.current);
      }
      workspaceReloadTimerRef.current = window.setTimeout(() => {
        workspaceReloadTimerRef.current = null;
        void loadWorkspace(workspacePath, true);
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
        void openPath(current.path);
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
      unwatch?.();
    };
  }, [loadWorkspace, openPath, workspacePath]);

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
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openSelectedFile, saveDocument]);

  useEffect(() => {
    const path = documentState?.path;
    const kind = documentState?.kind;
    const requestId = ++sourceRenderRequestRef.current;
    if (mode !== "source" || !path || !kind || !isEditableDocument(kind)) return;

    const nextSource = sourceDraft;
    const timer = window.setTimeout(() => {
      void renderSource(path, nextSource)
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
  }, [documentState?.kind, documentState?.path, mode, sourceDraft]);

  const updateSource = useCallback((nextSource: string) => {
    const current = documentStateRef.current;
    if (!current || !isEditableDocument(current.kind)) return;
    setSourceDraft(nextSource);
    setDocumentState((document) => (document ? { ...document, modified: nextSource !== document.source } : document));
  }, []);

  const handleExport = useCallback(() => {
    if ((documentState?.kind === "pdf" || documentState?.kind === "image") && documentState.previewUrl) {
      const anchor = document.createElement("a");
      anchor.href = documentState.previewUrl;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.click();
      return;
    }
    window.print();
  }, [documentState?.kind, documentState?.previewUrl]);

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
    const contents = buildHtmlExport(documentState.name, body);
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
  }, [documentState]);

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
      const contents = await buildDocxExport(documentState.name, body);

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
  }, [documentState]);

  const handleBrowserFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const path = `browser://${file.name}`;
      const kind = documentKindFromPath(file.name);
      if (kind === "docx" || kind === "pdf" || kind === "image") {
        await openBinary(path, new Uint8Array(await file.arrayBuffer()));
      } else {
        await openSource(path, await file.text());
      }
    },
    [openBinary, openSource],
  );

  const handleSelectTab = useCallback(
    async (path: string) => {
      if (path === documentState?.path) return;
      if (documentState?.modified && !window.confirm("当前文档有未保存修改，切换后将丢失这些修改。继续吗？")) return;
      await openPath(path);
    },
    [documentState, openPath],
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
      if (path.startsWith("browser://")) releaseBrowserDocument(path);
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
      }
    },
    [documentState, openPath, openTabs, releaseBrowserDocument],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      void handleBrowserFile(event.dataTransfer.files[0]);
    },
    [handleBrowserFile],
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
        void openPath(path).then(() => {
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
      void openPath(path).then(() => {
        if (rawAnchor) scrollToHeading(safeDecode(rawAnchor));
      });
    },
    [documentState, openPath, workspaceIndex],
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

    const query = searchQuery.trim().toLocaleLowerCase();
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
    const nextIndex = hits.length ? Math.min(searchResultIndex, hits.length - 1) : 0;
    setSearchResultCount(hits.length);
    setSearchResultIndex(nextIndex);
    hits.forEach((hit, index) => hit.classList.toggle("active", index === nextIndex));
    hits[nextIndex]?.scrollIntoView({ block: "center" });
  }, [documentState?.rendered.html, mode, searchQuery, searchResultIndex]);

  useEffect(() => {
    const root = articleRef.current;
    const currentPath = documentState?.path;
    if (!root || mode !== "rendered" || !currentPath || !isTauriRuntime()) return;

    let active = true;
    void (async () => {
      const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[src]"));
      for (const image of images) {
        const source = image.getAttribute("src") ?? "";
        const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
        if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
        const localPath = resolveRelativePath(currentPath, safeDecode(target));
        if (active && localPath) image.src = convertFileSrc(localPath, "asset");
      }
    })();

    return () => {
      active = false;
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
  const backlinks = currentIndexEntry ? findBacklinks(workspaceIndex, currentIndexEntry) : [];
  const outgoing = currentIndexEntry
    ? currentIndexEntry.links.map((target) => ({
        target,
        entry: findLinkedEntry(workspaceIndex, currentIndexEntry, target),
      }))
    : [];
  const availableTags = Array.from(new Set(workspaceIndex.flatMap((entry) => entry.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
  const taggedFilePaths = new Set(
    workspaceIndex.filter((entry) => entry.tags.includes(selectedTag ?? "")).map((entry) => entry.file.path),
  );
  const visibleWorkspaceFiles = selectedTag
    ? workspaceFiles.filter((file) => taggedFilePaths.has(file.path))
    : workspaceFiles;
  const visibleWorkspaceResults = selectedTag
    ? workspaceResults.filter((result) => taggedFilePaths.has(result.file.path))
    : workspaceResults;

  const handleExportWorkspace = useCallback(async () => {
    if (!workspacePath || visibleWorkspaceFiles.length === 0 || !isTauriRuntime()) return;

    const workspaceName = fileNameFromPath(workspacePath.replace(/[\\/]+$/, "")) || "阅读库";
    const savePath = await chooseSavePath(pathWithExtension(`${workspacePath}\\${workspaceName}`, "html"), "html");
    if (!savePath) return;

    setWorkspaceExporting(true);
    setWorkspaceExportNotice(null);
    setError(null);

    let exported = 0;
    let skipped = 0;
    try {
      const documents = [];
      for (const file of visibleWorkspaceFiles) {
        try {
          let rendered;
          if (file.kind === "docx") {
            rendered = await renderDocx(await readBinaryFile(file.path));
          } else if (file.kind === "markdown" || file.kind === "text") {
            rendered = await renderSource(file.path, await readTextFile(file.path));
          } else {
            skipped += 1;
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
        } catch {
          skipped += 1;
        }
      }

      if (documents.length === 0) throw new Error("当前筛选中没有可导出的 Markdown、文本或 Word 文档。");
      await writeTextFile(savePath, buildBatchHtmlExport(`${workspaceName} 阅读库`, documents));
      setWorkspaceExportNotice(
        `已导出 ${exported} 篇文档${skipped ? `，跳过 ${skipped} 个不支持或读取失败的文件` : ""}。`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "批量导出失败。");
    } finally {
      setWorkspaceExporting(false);
    }
  }, [visibleWorkspaceFiles, workspacePath]);

  return (
    <div className="app-shell" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
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
        onOpen={() => void openSelectedFile()}
        onToggleMode={() => setMode((current) => (current === "rendered" ? "source" : "rendered"))}
        onSave={() => void saveDocument()}
        onExport={handleExport}
        exportLabel={
          documentState?.kind === "pdf" ? "打开 PDF" : documentState?.kind === "image" ? "打开图片" : "打印 / PDF"
        }
        canExportMarkdown={Boolean(documentState && isEditableDocument(documentState.kind))}
        canExportHtml={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
        canExportDocx={Boolean(documentState && documentState.kind !== "pdf" && documentState.kind !== "image")}
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
            onExportWorkspace={() => void handleExportWorkspace()}
            workspaceExporting={workspaceExporting}
            workspaceExportNotice={workspaceExportNotice}
            workspaceIndexLoading={workspaceIndexLoading}
            workspacePath={workspacePath}
            files={workspaceFiles}
            visibleFiles={visibleWorkspaceFiles}
            recentFiles={recentFiles}
            recentWorkspaces={recentWorkspaces}
            activePath={documentState?.path ?? null}
            searchQuery={workspaceQuery}
            searchResults={visibleWorkspaceResults}
            searchLoading={workspaceSearchLoading}
            tagOptions={availableTags}
            selectedTag={selectedTag}
            onChooseWorkspace={() => void handleChooseWorkspace()}
            onOpenWorkspace={(path) => void loadWorkspace(path)}
            onOpenFile={(path) => void handleSelectTab(path)}
            onSearchQueryChange={setWorkspaceQuery}
            onTagChange={setSelectedTag}
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
              <Outline items={documentState.rendered.toc} />
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

        <main className="content-area" aria-live="polite">
          {loading && <div className="loading-state">正在打开文档…</div>}
          {externalChangePath && documentState?.path === externalChangePath && (
            <ExternalChangeNotice
              fileName={documentState.name}
              onReload={() => {
                setExternalChangePath(null);
                void openPath(documentState.path);
              }}
              onDismiss={() => setExternalChangePath(null)}
            />
          )}
          {error && (
            <div className="error-state" role="alert">
              {error}
            </div>
          )}
          {!loading && !documentState && <EmptyState onOpen={() => void openSelectedFile()} />}
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
              <article
                ref={articleRef}
                className="reader-content markdown-body"
                onClick={handleReaderClick}
                dangerouslySetInnerHTML={{ __html: documentState.rendered.html }}
              />
            )}
          {!loading && documentState && canEdit && mode === "source" && (
            <textarea
              className="source-editor"
              aria-label={documentState.kind === "text" ? "文本源内容" : "Markdown 源文本"}
              value={sourceDraft}
              onChange={(event) => void updateSource(event.target.value)}
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
        accept=".md,.markdown,.mdown,.mkd,.txt,.text,.log,.docx,.pdf,.avif,.gif,.jpeg,.jpg,.png,.svg,.webp,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,image/*"
        hidden
        onChange={(event) => void handleBrowserFile(event.target.files?.[0])}
      />
      {graphOpen && (
        <RelationGraph
          current={currentIndexEntry}
          entries={workspaceIndex}
          onClose={() => setGraphOpen(false)}
          onOpenFile={(path) => void handleSelectTab(path)}
        />
      )}
    </div>
  );
}
