import { useCallback, useEffect } from "react";
import { isEditableDocument, renderSource } from "../features/documents/rendering/document-adapters";
import {
  clipboardAssetFileName,
  clipboardAssetPath,
  clipboardAssetReference,
  clipboardImageToPng,
  findClipboardImage,
  insertTextAtSelection,
  MAX_CLIPBOARD_IMAGE_BYTES,
} from "../features/editor/clipboard-image";
import {
  type SourceEditorLinkContext,
  type SourceEditorPasteContext,
} from "../features/editor/components/SourceEditor";
import { createEditorHistory, recordEditorChange } from "../features/editor/editor-history";
import { checkMarkdownEditorSafety } from "../features/editor/markdown-editor-support";
import { scheduleSourceRender } from "../features/editor/source-render-scheduler";
import { READING_ZOOM_DEFAULT, stepReadingZoom } from "../features/reader/reading-zoom";
import { isSameDocumentPath } from "../features/recovery/document-transition";
import {
  clearAllDraftSnapshots,
  clearDraftSnapshot,
  loadDraftSnapshots,
  saveDraftSnapshot,
} from "../features/recovery/draft-recovery";
import { authorizeStoredPath, fileExists, isTauriRuntime, writeBinaryFile } from "../platform/bridge";
import type { useDocumentSession } from "./useDocumentSession";
import type { useDocumentTransitions } from "./useDocumentTransitions";
import type { useEditorHistory } from "./useEditorHistory";
import type { useOpenEvents } from "./useOpenEvents";
import type { useReaderState } from "./useReaderState";
import type { useReadingLayout } from "./useReadingLayout";
import type { useWorkspaceSession } from "./useWorkspaceSession";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "setSettingsNotice"
  | "documentStateRef"
  | "sourceDraftRef"
  | "setMode"
  | "setSearchOpen"
  | "setSearchQuery"
  | "setSearchResultIndex"
  | "mode"
  | "preferencesRef"
  | "setCommandPaletteOpen"
  | "setQuickOpen"
  | "focusMode"
  | "setSidebarCollapsed"
  | "setRightPanelOpen"
  | "setFocusMode"
  | "documentState"
  | "sourceRenderRequestRef"
  | "sourceDraft"
  | "preferences"
  | "setDocumentState"
  | "setError"
  | "draftRecovery"
  | "setDraftRecovery"
  | "setDraftDiscardRequest"
  | "setDraftRecoveryOpen"
  | "draftDiscardRequest"
  | "setDraftSnapshots"
  | "draftSnapshots"
  | "workspacePathRef"
  | "documentSessions"
> &
  Pick<ReturnType<typeof useReadingLayout>, "setReadingZoom"> &
  Pick<ReturnType<typeof useWorkspaceSession>, "handleChooseWorkspace"> &
  Pick<ReturnType<typeof useOpenEvents>, "openSelectedFile"> &
  Pick<ReturnType<typeof useDocumentSession>, "saveDocument" | "openPath"> &
  Pick<ReturnType<typeof useEditorHistory>, "undoEditor" | "redoEditor" | "handleDraftSaveResult"> &
  Pick<ReturnType<typeof useDocumentTransitions>, "confirmDocumentReplacement">;
export function useEditing({
  setSettingsNotice,
  documentStateRef,
  sourceDraftRef,
  setMode,
  setSearchOpen,
  setSearchQuery,
  setSearchResultIndex,
  mode,
  setReadingZoom,
  preferencesRef,
  handleChooseWorkspace,
  openSelectedFile,
  saveDocument,
  setCommandPaletteOpen,
  setQuickOpen,
  focusMode,
  setSidebarCollapsed,
  setRightPanelOpen,
  setFocusMode,
  undoEditor,
  redoEditor,
  documentState,
  sourceRenderRequestRef,
  sourceDraft,
  preferences,
  setDocumentState,
  setError,
  handleDraftSaveResult,
  draftRecovery,
  setDraftRecovery,
  setDraftDiscardRequest,
  confirmDocumentReplacement,
  openPath,
  setDraftRecoveryOpen,
  draftDiscardRequest,
  setDraftSnapshots,
  draftSnapshots,
  workspacePathRef,
  documentSessions,
}: Input) {
  const handleInsertLink = useCallback(
    (context?: SourceEditorLinkContext) => {
      const url = window.prompt("输入链接地址", "https://");
      if (!url?.trim()) return;

      if (context) {
        const selectedText = context.value.slice(context.selectionStart, context.selectionEnd).trim() || "链接文字";
        context.replace(`[${selectedText}](${url.trim()})`);
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        document.execCommand("createLink", false, url.trim());
      } else {
        setSettingsNotice("请先在所见即所得编辑器中选择链接文字，再按 Ctrl+K。");
      }
    },
    [setSettingsNotice],
  );

  const toggleDocumentMode = useCallback(() => {
    const currentDocument = documentStateRef.current;
    if (!currentDocument || !isEditableDocument(currentDocument.kind)) return;

    if (currentDocument.kind === "markdown" && !checkMarkdownEditorSafety(sourceDraftRef.current).safe) {
      setSettingsNotice("该 Markdown 含有暂不支持的结构，已切换到源码模式以避免丢失内容。");
    }

    setMode((current) => {
      if (currentDocument.kind !== "markdown") return current === "source" ? "rendered" : "source";
      if (current === "rendered") {
        return checkMarkdownEditorSafety(sourceDraftRef.current).safe ? "wysiwyg" : "source";
      }
      if (current === "wysiwyg") return "source";
      return "rendered";
    });
  }, [documentStateRef, setMode, setSettingsNotice, sourceDraftRef]);

  const toggleReadingEditing = useCallback(() => {
    const currentDocument = documentStateRef.current;
    if (!currentDocument || !isEditableDocument(currentDocument.kind)) return;

    setMode((current) => {
      if (current !== "rendered") return "rendered";
      if (currentDocument.kind !== "markdown") return "source";
      return checkMarkdownEditorSafety(sourceDraftRef.current).safe ? "wysiwyg" : "source";
    });
  }, [documentStateRef, setMode, sourceDraftRef]);

  const handleFindEditorText = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query) return;
      setSearchOpen(true);
      setSearchQuery(query);
      setSearchResultIndex(0);
    },
    [setSearchOpen, setSearchQuery, setSearchResultIndex],
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (document.body.dataset.activeSpace === "ai" || document.body.dataset.globalPage) return;
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
        if (mode === "wysiwyg") {
          event.preventDefault();
          handleInsertLink();
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
    documentStateRef,
    focusMode,
    handleChooseWorkspace,
    handleInsertLink,
    mode,
    openSelectedFile,
    preferencesRef,
    saveDocument,
    setCommandPaletteOpen,
    setFocusMode,
    setQuickOpen,
    setReadingZoom,
    setRightPanelOpen,
    setSearchOpen,
    setSidebarCollapsed,
    toggleReadingEditing,
  ]);

  useEffect(() => {
    const handleEditorHistoryShortcut = (event: KeyboardEvent) => {
      if (document.body.dataset.activeSpace === "ai" || document.body.dataset.globalPage) return;
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
  }, [
    documentState?.kind,
    documentState?.path,
    mode,
    preferences.allowRemoteResources,
    setDocumentState,
    setError,
    sourceDraft,
    sourceRenderRequestRef,
  ]);

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
  }, [
    documentStateRef,
    mode,
    preferences.allowRemoteResources,
    setDocumentState,
    setError,
    sourceDraft,
    sourceRenderRequestRef,
  ]);

  const updateSource = useCallback(
    (nextSource: string, path = documentStateRef.current?.path) => {
      if (!path) return;
      documentSessions.update(path, (session) => {
        if (!isEditableDocument(session.document.kind)) return session;
        const history = session.history;
        return {
          ...session,
          draft: nextSource,
          history: isSameDocumentPath(history.documentKey, path)
            ? recordEditorChange(history, nextSource)
            : createEditorHistory(path, nextSource),
          document: { ...session.document, modified: nextSource !== session.document.source },
          saveError: undefined,
          saveStatus: session.saveStatus === "error" ? "idle" : session.saveStatus,
        };
      });
    },
    [documentSessions, documentStateRef],
  );

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

  const recoverDraft = useCallback(() => {
    if (!draftRecovery || !isSameDocumentPath(documentStateRef.current?.path ?? "", draftRecovery.path)) return;
    updateSource(draftRecovery.draft);
    setDraftRecovery(null);
    setMode("source");
  }, [documentStateRef, draftRecovery, setDraftRecovery, setMode, updateSource]);

  const discardDraft = useCallback(() => {
    if (draftRecovery) setDraftDiscardRequest({ path: draftRecovery.path, fromCenter: false });
  }, [draftRecovery, setDraftDiscardRequest]);

  const deferDraftRecovery = useCallback(() => {
    setDraftRecovery(null);
  }, [setDraftRecovery]);

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
    [confirmDocumentReplacement, openPath, setDraftRecoveryOpen, setError],
  );

  const requestDraftDiscardByPath = useCallback(
    (path: string) => {
      setDraftRecoveryOpen(false);
      setDraftDiscardRequest({ path, fromCenter: true });
    },
    [setDraftDiscardRequest, setDraftRecoveryOpen],
  );

  const cancelDraftDiscard = useCallback(() => {
    const request = draftDiscardRequest;
    setDraftDiscardRequest(null);
    if (request?.fromCenter) setDraftRecoveryOpen(true);
  }, [draftDiscardRequest, setDraftDiscardRequest, setDraftRecoveryOpen]);

  const confirmDraftDiscard = useCallback(() => {
    const request = draftDiscardRequest;
    if (!request) return;

    clearDraftSnapshot(request.path);
    const remaining = loadDraftSnapshots();
    setDraftSnapshots(remaining);
    if (isSameDocumentPath(draftRecovery?.path ?? "", request.path)) setDraftRecovery(null);
    setDraftDiscardRequest(null);
    if (request.fromCenter) setDraftRecoveryOpen(remaining.length > 0);
  }, [
    draftDiscardRequest,
    draftRecovery?.path,
    setDraftDiscardRequest,
    setDraftRecovery,
    setDraftRecoveryOpen,
    setDraftSnapshots,
  ]);

  const clearAllDrafts = useCallback(() => {
    if (draftSnapshots.length === 0 || !window.confirm("确定清空全部未保存草稿吗？此操作无法撤销。")) return;
    clearAllDraftSnapshots();
    setDraftSnapshots([]);
    setDraftRecovery(null);
  }, [draftSnapshots.length, setDraftRecovery, setDraftSnapshots]);

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
      if (image.size > MAX_CLIPBOARD_IMAGE_BYTES) {
        setError("剪贴板图片不能超过 10 MB。");
        return true;
      }

      const initialStart = context.selectionStart;
      const initialEnd = context.selectionEnd;
      const initialValue = context.value;
      const path = current.path;

      void (async () => {
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
    [documentStateRef, setError, sourceDraftRef, updateSource, workspacePathRef],
  );
  return {
    handleInsertLink,
    toggleDocumentMode,
    toggleReadingEditing,
    handleFindEditorText,
    updateSource,
    recoverDraft,
    discardDraft,
    deferDraftRecovery,
    openDraftSnapshot,
    requestDraftDiscardByPath,
    cancelDraftDiscard,
    confirmDraftDiscard,
    clearAllDrafts,
    handleSourcePaste,
  };
}
