import { useCallback, useEffect, useRef, useState } from "react";
import {
  documentKindFromPath,
  emptyRenderedDocument,
  imageMimeType,
  isEditableDocument,
  renderDocx,
  renderSource,
} from "../features/documents/rendering/document-adapters";
import { checkMarkdownEditorSafety } from "../features/editor/markdown-editor-support";
import { nextReaderModeAfterOpen } from "../features/reader/reader-mode";
import { isSameDocumentPath, shouldConfirmWorkspaceSwitch } from "../features/recovery/document-transition";
import {
  clearDraftSnapshot,
  findDraftSnapshot,
  loadDraftSnapshots,
  saveDraftSnapshot,
} from "../features/recovery/draft-recovery";
import {
  authorizeStoredPath,
  fileMetadata,
  isTauriRuntime,
  readBinaryFile,
  readTextFile,
  writeTextFile,
} from "../platform/bridge";
import { normalizePathKey } from "../platform/path-key";
import { contentHash } from "../features/documents/source-chunks";
import { flushLiveEditors } from "../shared/pending-work";
import { rememberRecentFile, saveLastDocumentPath } from "../platform/storage";
import type { FileStamp, OpenDocument, OpenPath } from "../shared/types";
import {
  comparablePath,
  downloadText,
  fileNameFromPath,
  pathBelongsToWorkspace,
  persistCachedWorkspaceSession,
  updateCachedWorkspace,
} from "./support";
import type { useAppUpdates } from "./useAppUpdates";
import type { useDocumentTransitions } from "./useDocumentTransitions";
import type { useEditorHistory } from "./useEditorHistory";
import type { useReaderState } from "./useReaderState";
import type { useWorkspaceSession } from "./useWorkspaceSession";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "setLoading"
  | "setError"
  | "preferencesRef"
  | "browserDocumentsRef"
  | "setDocumentState"
  | "setExternalChangePath"
  | "setSourceDraft"
  | "sourceDraftRef"
  | "setDraftRecovery"
  | "setDraftSnapshots"
  | "setOpenTabs"
  | "setRecentFiles"
  | "setMode"
  | "setSettingsNotice"
  | "documentCacheRef"
  | "previewUrlsRef"
  | "documentStateRef"
  | "externalChangePath"
  | "workspacePath"
  | "workspaceRestorePendingRef"
  | "mountedWorkspaceCacheRef"
  | "setSearchQuery"
  | "workspacePathRef"
  | "selfWritingPathsRef"
  | "selfWrittenPathsRef"
  | "documentSessions"
> &
  Pick<ReturnType<typeof useAppUpdates>, "releaseDocumentResources"> &
  Pick<ReturnType<typeof useEditorHistory>, "resetEditorHistory" | "handleDraftSaveResult"> &
  Pick<ReturnType<typeof useDocumentTransitions>, "confirmWorkspaceSwitch" | "confirmDocumentReplacement"> &
  Pick<ReturnType<typeof useWorkspaceSession>, "loadWorkspace">;
export function useDocumentSession({
  setLoading,
  setError,
  preferencesRef,
  releaseDocumentResources,
  browserDocumentsRef,
  setDocumentState,
  setExternalChangePath,
  setSourceDraft,
  sourceDraftRef,
  resetEditorHistory,
  setDraftRecovery,
  setDraftSnapshots,
  setOpenTabs,
  setRecentFiles,
  setMode,
  setSettingsNotice,
  documentCacheRef,
  previewUrlsRef,
  documentStateRef,
  externalChangePath,
  handleDraftSaveResult,
  workspacePath,
  workspaceRestorePendingRef,
  mountedWorkspaceCacheRef,
  setSearchQuery,
  workspacePathRef,
  confirmWorkspaceSwitch,
  confirmDocumentReplacement,
  loadWorkspace,
  selfWritingPathsRef,
  selfWrittenPathsRef,
  documentSessions,
}: Input) {
  const opening = useRef(0);
  const savingPaths = useRef(new Set<string>());
  const [saveState, setSaveState] = useState<{ path: string; status: "saving" | "saved" | "error" } | null>(null);
  const openSource = useCallback(
    async (
      path: string,
      source: string,
      preserveMode = false,
      stamp?: FileStamp,
      renderedOverride?: OpenDocument["rendered"],
      requestId = ++opening.current,
      expectedDraft = documentSessions.get(path)?.draft,
    ): Promise<boolean> => {
      flushLiveEditors();
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
        const recoveredDraft = await findDraftSnapshot(path, source);
        if (requestId !== opening.current) return false;
        const latest = documentSessions.get(path);
        if (expectedDraft !== undefined && latest && latest.draft !== expectedDraft) {
          documentSessions.update(path, (session) => ({
            ...session,
            document: { ...session.document, externallyModified: true },
          }));
          if (documentStateRef.current?.path === path) setExternalChangePath(path);
          setError("载入期间产生了新的编辑，已保留草稿。请比较外部修改后继续。");
          return false;
        }
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
        setDraftRecovery(recoveredDraft);
        setDraftSnapshots(loadDraftSnapshots());
        setOpenTabs((current) =>
          current.some((tab) => isSameDocumentPath(tab.path, path))
            ? current
            : [...current, { path, name: fileNameFromPath(path) }],
        );
        if (!path.startsWith("browser://")) {
          setRecentFiles(rememberRecentFile({ path, name: fileNameFromPath(path) }));
          saveLastDocumentPath(path);
        }
        setMode((current) => nextReaderModeAfterOpen(current, preserveMode, kind, editorSafety.safe));
        if (preserveMode && kind === "markdown" && !editorSafety.safe) {
          setSettingsNotice(`该 Markdown 含有暂不支持的结构，编辑时已保留源码模式：${editorSafety.reason}`);
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
        if (requestId === opening.current) setLoading(false);
      }
    },
    [
      browserDocumentsRef,
      documentCacheRef,
      documentSessions,
      documentStateRef,
      preferencesRef,
      releaseDocumentResources,
      resetEditorHistory,
      setDocumentState,
      setDraftRecovery,
      setDraftSnapshots,
      setError,
      setExternalChangePath,
      setLoading,
      setMode,
      setOpenTabs,
      setRecentFiles,
      setSettingsNotice,
      setSourceDraft,
      sourceDraftRef,
    ],
  );

  const openBinary = useCallback(
    async (
      path: string,
      bytes: Uint8Array,
      preserveMode = false,
      stamp?: FileStamp,
      renderedOverride?: OpenDocument["rendered"],
      requestId = ++opening.current,
    ): Promise<boolean> => {
      flushLiveEditors();
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
        const sourceHash = await contentHash(bytes);
        if (requestId !== opening.current) return false;
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
          sourceHash,
          stamp,
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
        setDraftSnapshots(loadDraftSnapshots());
        setOpenTabs((current) =>
          current.some((tab) => isSameDocumentPath(tab.path, path))
            ? current
            : [...current, { path, name: fileNameFromPath(path) }],
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
        if (requestId === opening.current) setLoading(false);
      }
    },
    [
      browserDocumentsRef,
      documentCacheRef,
      preferencesRef,
      previewUrlsRef,
      releaseDocumentResources,
      resetEditorHistory,
      setDocumentState,
      setDraftRecovery,
      setDraftSnapshots,
      setError,
      setExternalChangePath,
      setLoading,
      setMode,
      setOpenTabs,
      setRecentFiles,
      setSourceDraft,
      sourceDraftRef,
    ],
  );

  const openPath = useCallback(
    async (path: string, preserveMode = false): Promise<boolean> => {
      flushLiveEditors();
      const requestId = ++opening.current;
      const expectedDraft = documentSessions.get(path)?.draft;
      setLoading(false);
      try {
        const session = documentSessions.get(path);
        if (session && !preserveMode) {
          documentSessions.activate(path);
          setExternalChangePath(session.document.externallyModified ? path : null);
          const recovered = session.document.modified ? null : await findDraftSnapshot(path, session.document.source);
          if (requestId !== opening.current) return false;
          setDraftRecovery(documentSessions.get(path)?.document.modified ? null : recovered);
          setError(null);
          if (!path.startsWith("browser://")) {
            saveLastDocumentPath(path);
            if (isEditableDocument(session.document.kind)) {
              const disk = await readTextFile(path);
              if (disk !== session.document.source) {
                documentSessions.update(path, (latest) => ({
                  ...latest,
                  document: { ...latest.document, externallyModified: true },
                }));
                if (documentStateRef.current?.path === path) setExternalChangePath(path);
              }
            } else {
              const stamp = await fileMetadata(path);
              if (requestId !== opening.current) return false;
              if (
                !session.document.stamp ||
                stamp.size !== session.document.stamp.size ||
                stamp.modifiedMs !== session.document.stamp.modifiedMs
              ) {
                return await openBinary(path, await readBinaryFile(path), true, stamp, undefined, requestId);
              }
            }
          }
          return true;
        }
        if (path.startsWith("browser://")) {
          const cached = browserDocumentsRef.current.get(path);
          if (!cached) throw new Error("浏览器预览文件已失效，请重新选择。");
          if (cached.bytes) {
            return await openBinary(path, cached.bytes, preserveMode, undefined, undefined, requestId);
          } else if (cached.source !== undefined) {
            return await openSource(path, cached.source, preserveMode, undefined, undefined, requestId, expectedDraft);
          }
          return false;
        }

        const kind = documentKindFromPath(path);
        if (!kind) {
          throw new Error("不支持的文档类型，请选择 Markdown、文本、Word、PDF 或图片文件。");
        }
        const stamp = await fileMetadata(path);
        if (requestId !== opening.current) return false;
        const cached = documentCacheRef.current.get(path, stamp);
        if (kind === "docx" || kind === "pdf" || kind === "image") {
          if (cached?.kind === kind && cached.bytes) {
            return await openBinary(path, cached.bytes, preserveMode, stamp, cached.rendered, requestId);
          }
          return await openBinary(path, await readBinaryFile(path), preserveMode, stamp, undefined, requestId);
        }

        if (cached?.kind === kind) {
          return await openSource(path, cached.source, preserveMode, stamp, cached.rendered, requestId, expectedDraft);
        }
        const source = await readTextFile(path);
        return await openSource(path, source, preserveMode, stamp, undefined, requestId, expectedDraft);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "文件打开失败。");
        return false;
      }
    },
    [
      browserDocumentsRef,
      documentCacheRef,
      documentSessions,
      documentStateRef,
      openBinary,
      openSource,
      setDraftRecovery,
      setExternalChangePath,
      setError,
      setLoading,
    ],
  );

  const reloadExternalChange = useCallback(async () => {
    const current = documentStateRef.current;
    if (!current || !externalChangePath || !isSameDocumentPath(current.path, externalChangePath)) return;

    if (current.modified) {
      const draftResult = await saveDraftSnapshot({
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
  }, [documentStateRef, externalChangePath, handleDraftSaveResult, openPath, setExternalChangePath, sourceDraftRef]);

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
      // The previous workspace's session still owns its PDF/image object URL.
      // Releasing it here would break a cached document when switching back.
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
  }, [
    documentStateRef,
    mountedWorkspaceCacheRef,
    openPath,
    releaseDocumentResources,
    setDocumentState,
    setDraftRecovery,
    setExternalChangePath,
    setMode,
    setSearchQuery,
    setSourceDraft,
    sourceDraftRef,
    workspacePath,
    workspaceRestorePendingRef,
  ]);

  const handleOpenPaths = useCallback(
    async (paths: OpenPath[]) => {
      const workspacePaths = paths.filter((entry) => entry.kind === "workspace").map((entry) => entry.path);
      const workspacePathToConfirm = workspacePaths.find((path) =>
        shouldConfirmWorkspaceSwitch(Boolean(documentStateRef.current?.modified), workspacePathRef.current, path),
      );
      if (workspacePathToConfirm && !(await confirmWorkspaceSwitch(workspacePathToConfirm, "切换阅读库"))) {
        return;
      }

      const currentModifiedPath = documentStateRef.current?.modified ? documentStateRef.current.path : null;
      const pathsToProcess = currentModifiedPath
        ? paths.filter((entry) => entry.kind !== "document" || !isSameDocumentPath(currentModifiedPath, entry.path))
        : paths;
      const documentPaths = pathsToProcess.filter((entry) => entry.kind === "document").map((entry) => entry.path);
      if (!(await confirmDocumentReplacement(documentPaths, "打开新文档"))) {
        return;
      }

      const seen = new Set<string>();
      for (const entry of pathsToProcess) {
        const key = `${entry.kind}:${normalizePathKey(entry.path)}`;
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
    [
      confirmDocumentReplacement,
      confirmWorkspaceSwitch,
      documentStateRef,
      loadWorkspace,
      openPath,
      setError,
      workspacePathRef,
    ],
  );

  const saveDocumentOnce = useCallback(
    async (allowExternalOverwrite = false, targetPath?: string): Promise<boolean> => {
      if (documentSessions.isWriteHeld()) return false;
      const session = targetPath ? documentSessions.get(targetPath) : documentSessions.active();
      const current = session?.document;
      if (current && documentSessions.isComposing(current.path)) {
        setSettingsNotice("输入法正在组词，确认文字后会继续保存。");
        return false;
      }
      const draft = session?.draft ?? "";
      if (!current || !isEditableDocument(current.kind)) return false;
      if (!current.modified) return true;

      if (current.externallyModified && !allowExternalOverwrite) {
        setExternalChangePath(current.path);
        setError("文件已被其他程序修改，请先选择重新载入、覆盖保存或另存为。");
        return false;
      }

      const path = current.path;
      const pathKey = comparablePath(path);
      if (savingPaths.current.has(pathKey)) return false;
      savingPaths.current.add(pathKey);
      setSaveState({ path, status: "saving" });
      documentSessions.update(path, (latest) => ({ ...latest, saveStatus: "saving", saveError: undefined }));
      let writeCompleted = false;
      try {
        if (isTauriRuntime()) {
          if (!allowExternalOverwrite) {
            const diskSource = await readTextFile(path);
            if (diskSource !== current.source) {
              documentSessions.update(path, (latest) => ({
                ...latest,
                saveStatus: "error",
                saveError: "文件已在外部修改",
                document: { ...latest.document, externallyModified: true },
              }));
              setExternalChangePath(path);
              setError("文件在保存前已被其他程序修改，请先选择处理方式。");
              setSaveState({ path, status: "error" });
              return false;
            }
          }
          selfWritingPathsRef.current.add(pathKey);
          try {
            const warning = await writeTextFile(path, draft, allowExternalOverwrite ? undefined : current.source);
            if (warning) setSettingsNotice(warning);
          } finally {
            selfWritingPathsRef.current.delete(pathKey);
          }
          writeCompleted = true;
          selfWrittenPathsRef.current.set(pathKey, Date.now() + 1_500);
          documentCacheRef.current.remove(path);
        } else {
          downloadText(current.name, draft);
        }

        // The file baseline changes at write completion, even if preview rendering fails.
        documentSessions.update(path, (latest) => ({
          ...latest,
          document: { ...latest.document, source: draft, modified: latest.draft !== draft, externallyModified: false },
        }));
        const rendered = await renderSource(path, draft, {
          allowRemoteResources: preferencesRef.current.allowRemoteResources,
        });
        documentSessions.update(path, (latest) => ({
          ...latest,
          saveStatus: "saved",
          document: {
            ...latest.document,
            source: draft,
            modified: latest.draft !== draft,
            externallyModified: false,
            rendered: latest.draft === draft ? rendered : latest.document.rendered,
          },
        }));
        if (documentSessions.get(path)?.draft === draft) await clearDraftSnapshot(path, draft);
        setDraftSnapshots(loadDraftSnapshots());
        if (documentStateRef.current?.path === path) {
          setDraftRecovery(null);
          setExternalChangePath(null);
          setError(null);
        }
        setSaveState({ path, status: "saved" });
        return true;
      } catch (cause) {
        selfWritingPathsRef.current.delete(pathKey);
        if (writeCompleted) {
          const message = "内容已保存，但阅读预览更新失败：" + (cause instanceof Error ? cause.message : String(cause));
          documentSessions.update(path, (latest) => ({ ...latest, saveStatus: "saved" }));
          setSettingsNotice(message);
          return true;
        }
        selfWrittenPathsRef.current.delete(pathKey);
        if (isTauriRuntime()) {
          const disk = await readTextFile(path).catch(() => undefined);
          if (disk !== undefined && disk !== current.source) {
            documentSessions.update(path, (latest) => ({
              ...latest,
              document: { ...latest.document, externallyModified: true },
            }));
            if (documentSessions.active()?.document.path === path) setExternalChangePath(path);
          }
        }
        setError(cause instanceof Error ? cause.message : "保存失败。");
        setSaveState({ path, status: "error" });
        documentSessions.update(path, (latest) => ({
          ...latest,
          saveStatus: "error",
          saveError: cause instanceof Error ? cause.message : "保存失败",
        }));
        return false;
      } finally {
        savingPaths.current.delete(pathKey);
      }
    },
    [
      documentCacheRef,
      setSettingsNotice,
      documentSessions,
      documentStateRef,
      preferencesRef,
      selfWritingPathsRef,
      selfWrittenPathsRef,
      setDraftRecovery,
      setDraftSnapshots,
      setError,
      setExternalChangePath,
    ],
  );
  const pendingSaves = useRef(new Map<string, Promise<boolean>>());
  const saveDocument = useCallback(
    (overwrite = false, targetPath?: string): Promise<boolean> => {
      flushLiveEditors();
      const path = targetPath ?? documentSessions.active()?.document.path;
      if (!path) return Promise.resolve(false);
      const key = comparablePath(path);
      const pending = pendingSaves.current.get(key);
      const operation = (async () => {
        if (pending && !(await pending)) return false;
        return saveDocumentOnce(overwrite, path);
      })().finally(() => {
        if (pendingSaves.current.get(key) === operation) pendingSaves.current.delete(key);
      });
      pendingSaves.current.set(key, operation);
      return operation;
    },
    [documentSessions, saveDocumentOnce],
  );
  const flushDocumentSaves = useCallback(async () => {
    await Promise.all(pendingSaves.current.values());
    for (const session of documentSessions.getSnapshot().sessions.values()) {
      if (session.document.modified && !session.document.path.startsWith("browser://"))
        await saveDocument(false, session.document.path);
    }
    return [...documentSessions.getSnapshot().sessions.values()].every((session) => !session.document.modified);
  }, [documentSessions, saveDocument]);
  return {
    openSource,
    openBinary,
    openPath,
    reloadExternalChange,
    handleOpenPaths,
    saveDocument,
    saveState,
    flushDocumentSaves,
  };
}
