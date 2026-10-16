import { useCallback, useEffect } from "react";
import { saveDraftSnapshot } from "../features/recovery/draft-recovery";
import { flushLiveEditors, flushPendingWork } from "../shared/pending-work";
import {
  createAppSettingsSnapshot,
  parseAppSettings,
  saveAppSettingsSnapshot,
} from "../features/settings/app-settings";
import { saveLocale } from "../features/settings/i18n";
import {
  createPortableSettingsBundle,
  parsePortableSettings,
  serializePortableSettings,
} from "../features/settings/portable-settings";
import { saveReaderPreferences } from "../features/settings/preferences";
import {
  chooseSavePath,
  closeWindow,
  isTauriRuntime,
  readAppSettings,
  subscribeToCloseRequest,
  writeTextFile,
} from "../platform/bridge";
import {
  loadLastDocumentPath,
  loadWorkspaceSessions,
  saveContextPanelOpen,
  saveContextPanelTab,
  saveLastDocumentPath,
  saveMountedWorkspaces,
  saveOpenTabs,
  savePaneWidths,
  saveSidebarCollapsed,
  saveWorkspacePath,
  saveWorkspaceSessions,
} from "../platform/storage";
import {
  downloadText,
  fileNameFromPath,
  pathBelongsToWorkspace,
  persistCachedWorkspaceSession,
  scrollToHeading,
  updateCachedWorkspace,
} from "./support";
import type { useDocumentSession } from "./useDocumentSession";
import type { useEditorHistory } from "./useEditorHistory";
import type { useReaderState } from "./useReaderState";
import type { useReadingLayout } from "./useReadingLayout";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "preferences"
  | "loading"
  | "locale"
  | "theme"
  | "workspacePath"
  | "mountedWorkspaces"
  | "openTabs"
  | "setSettingsNotice"
  | "setError"
  | "preferencesRef"
  | "setPreferences"
  | "setLocale"
  | "setTheme"
  | "setMountedWorkspaces"
  | "documentState"
  | "sourceDraft"
  | "storedAppSettings"
  | "setSidebarCollapsed"
  | "setRightPanelOpen"
  | "setActiveContextTab"
  | "setPaneWidths"
  | "setNativeSettingsReady"
  | "nativeSettingsReady"
  | "sidebarCollapsed"
  | "rightPanelOpen"
  | "activeContextTab"
  | "paneWidths"
  | "setSettingsPersistenceStatus"
  | "pendingAppSettingsWriteRef"
  | "appSettingsFlushTimerRef"
  | "documentCacheRef"
  | "settingsNotice"
  | "tabSessionReady"
  | "setWorkspaceExportFailures"
  | "setWorkspaceExportNotice"
  | "selectedFileKind"
  | "selectedTag"
  | "workspaceQuery"
  | "mode"
  | "contentAreaRef"
  | "readingPositionRef"
  | "pendingHeadingRef"
  | "articleRef"
  | "setReadingProgress"
  | "setCurrentHeading"
  | "setCurrentHeadingId"
  | "closeConfirmationOpenRef"
  | "settingsCloseInFlightRef"
  | "setCloseConfirmationOpen"
  | "workspacePathRef"
  | "openTabsRef"
  | "mountedWorkspaceCacheRef"
  | "previewUrlsRef"
  | "browserDocumentsRef"
  | "documentSessions"
> &
  Pick<ReturnType<typeof useReadingLayout>, "enqueueNativeSettingsWrite" | "updateReadingRail" | "flushAppSettings"> &
  Pick<ReturnType<typeof useEditorHistory>, "handleDraftSaveResult"> &
  Pick<ReturnType<typeof useDocumentSession>, "flushDocumentSaves">;
export function useSettingsPersistence({
  documentSessions,
  flushDocumentSaves,
  preferences,
  locale,
  theme,
  workspacePath,
  mountedWorkspaces,
  openTabs,
  setSettingsNotice,
  setError,
  preferencesRef,
  setPreferences,
  setLocale,
  setTheme,
  setMountedWorkspaces,
  documentState,
  storedAppSettings,
  setSidebarCollapsed,
  setRightPanelOpen,
  setActiveContextTab,
  setPaneWidths,
  setNativeSettingsReady,
  nativeSettingsReady,
  sidebarCollapsed,
  rightPanelOpen,
  activeContextTab,
  paneWidths,
  setSettingsPersistenceStatus,
  pendingAppSettingsWriteRef,
  appSettingsFlushTimerRef,
  enqueueNativeSettingsWrite,
  documentCacheRef,
  settingsNotice,
  tabSessionReady,
  setWorkspaceExportFailures,
  setWorkspaceExportNotice,
  selectedFileKind,
  selectedTag,
  workspaceQuery,
  mode,
  contentAreaRef,
  updateReadingRail,
  pendingHeadingRef,
  articleRef,
  setReadingProgress,
  setCurrentHeading,
  setCurrentHeadingId,
  handleDraftSaveResult,
  closeConfirmationOpenRef,
  settingsCloseInFlightRef,
  setCloseConfirmationOpen,
  flushAppSettings,
  workspacePathRef,
  openTabsRef,
  mountedWorkspaceCacheRef,
  previewUrlsRef,
  browserDocumentsRef,
}: Input) {
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
        setSettingsNotice(`设置备份已保存：${fileNameFromPath(targetPath)}`);
      } else {
        downloadText("Moyang Reader - settings.json", serialized, "application/json");
        setSettingsNotice("设置备份已下载，不包含文档正文或私钥。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "设置备份导出失败。");
    }
  }, [locale, mountedWorkspaces, openTabs, preferences, setError, setSettingsNotice, theme, workspacePath]);

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
          setSettingsNotice("设置已导入；已保存的阅读库路径将在重新授权后恢复。");
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : "设置备份导入失败。");
        });
    };
    input.click();
  }, [preferencesRef, setError, setLocale, setMountedWorkspaces, setPreferences, setSettingsNotice, setTheme]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences, preferencesRef]);

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
  }, [
    preferencesRef,
    setActiveContextTab,
    setLocale,
    setNativeSettingsReady,
    setPaneWidths,
    setPreferences,
    setRightPanelOpen,
    setSidebarCollapsed,
    setTheme,
    storedAppSettings,
  ]);

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
    appSettingsFlushTimerRef,
    enqueueNativeSettingsWrite,
    locale,
    nativeSettingsReady,
    paneWidths,
    pendingAppSettingsWriteRef,
    preferences,
    rightPanelOpen,
    setSettingsPersistenceStatus,
    sidebarCollapsed,
    theme,
  ]);

  useEffect(() => {
    documentCacheRef.current.clear();
  }, [documentCacheRef, preferences.allowRemoteResources]);

  useEffect(() => {
    if (!settingsNotice) return;
    const timer = window.setTimeout(() => setSettingsNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [setSettingsNotice, settingsNotice]);

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
  }, [
    selectedFileKind,
    selectedTag,
    setWorkspaceExportFailures,
    setWorkspaceExportNotice,
    workspacePath,
    workspaceQuery,
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
  }, [contentAreaRef, documentState?.path, documentState?.rendered.html, mode, updateReadingRail]);

  useEffect(() => {
    if (mode !== "rendered") return;
    const pendingHeading = pendingHeadingRef.current;
    if (!pendingHeading) return;

    pendingHeadingRef.current = null;
    scrollToHeading(pendingHeading, contentAreaRef.current, articleRef.current);
  }, [articleRef, contentAreaRef, documentState?.path, documentState?.rendered.html, mode, pendingHeadingRef]);

  useEffect(() => {
    if (documentState && mode === "rendered" && documentState.kind !== "pdf" && documentState.kind !== "image") return;
    setReadingProgress(0);
    setCurrentHeading(null);
    setCurrentHeadingId(null);
  }, [documentState, mode, setCurrentHeading, setCurrentHeadingId, setReadingProgress]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      flushLiveEditors();
      const dirty = [...documentSessions.getSnapshot().sessions.values()].filter(
        (session) => session.document.modified,
      );
      for (const session of dirty) {
        if (session.document.path.startsWith("browser://")) continue;
        void saveDraftSnapshot({
          path: session.document.path,
          draft: session.draft,
          baseSource: session.document.source,
          savedAt: Date.now(),
        }).then(handleDraftSaveResult);
      }
      if (isTauriRuntime() || !dirty.length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [documentSessions, handleDraftSaveResult]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let unlisten: (() => void) | null = null;
    const handleCloseRequest = () => {
      if (closeConfirmationOpenRef.current || settingsCloseInFlightRef.current) return;
      settingsCloseInFlightRef.current = true;
      void (async () => {
        try {
          try {
            await flushPendingWork();
          } catch {
            setError("草稿尚未完成暂存，请重试后关闭。");
            return;
          }
          if (!(await flushDocumentSaves())) {
            for (const session of documentSessions.getSnapshot().sessions.values()) {
              if (!session.document.modified || session.document.path.startsWith("browser://")) continue;
              if (
                !handleDraftSaveResult(
                  await saveDraftSnapshot({
                    path: session.document.path,
                    draft: session.draft,
                    baseSource: session.document.source,
                    savedAt: Date.now(),
                  }),
                )
              )
                return;
            }
            closeConfirmationOpenRef.current = true;
            setCloseConfirmationOpen(true);
            return;
          }
          if (!(await flushAppSettings())) {
            if (active) setError("设置尚未成功写入本机，请稍后重试关闭窗口。");
            return;
          }
          await closeWindow();
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : "关闭窗口失败。");
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
  }, [
    closeConfirmationOpenRef,
    documentSessions,
    flushDocumentSaves,
    flushAppSettings,
    handleDraftSaveResult,
    setCloseConfirmationOpen,
    setError,
    settingsCloseInFlightRef,
  ]);

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath, workspacePathRef]);

  useEffect(() => {
    openTabsRef.current = openTabs;
  }, [openTabs, openTabsRef]);

  useEffect(() => {
    if (!workspacePath) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      selectedTag,
      selectedFileKind,
      searchQuery: workspaceQuery,
    });
  }, [mountedWorkspaceCacheRef, selectedFileKind, selectedTag, workspacePath, workspaceQuery]);

  useEffect(() => {
    if (!workspacePath) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      tabs: openTabsRef.current.filter(
        (tab) => !tab.path.startsWith("browser://") && pathBelongsToWorkspace(tab.path, workspacePath),
      ),
    });
  }, [mountedWorkspaceCacheRef, openTabs, openTabsRef, workspacePath]);

  useEffect(() => {
    if (!workspacePath || !documentState?.path || !pathBelongsToWorkspace(documentState.path, workspacePath)) return;
    updateCachedWorkspace(mountedWorkspaceCacheRef.current, workspacePath, {
      activeDocumentPath: documentState.path,
    });
  }, [documentState?.path, mountedWorkspaceCacheRef, workspacePath]);

  useEffect(() => {
    if (!workspacePath) return;
    persistCachedWorkspaceSession(mountedWorkspaceCacheRef.current, workspacePath);
  }, [documentState?.path, mountedWorkspaceCacheRef, openTabs, workspacePath]);

  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
      browserDocumentsRef.current.clear();
      documentCacheRef.current.clear();
    },
    [browserDocumentsRef, documentCacheRef, previewUrlsRef],
  );
  return { exportPortableSettings, importPortableSettings };
}
