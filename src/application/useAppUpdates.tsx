import { useCallback, useEffect } from "react";
import {
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
} from "../features/recovery/update-recovery";
import { isTauriRuntime } from "../platform/bridge";
import {
  checkForAppUpdate,
  describeUpdateError,
  getCurrentAppVersion,
  installAppUpdate,
  relaunchApp,
  previousUpdateFailure,
} from "../platform/updater";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "documentCacheRef"
  | "browserDocumentsRef"
  | "previewUrlsRef"
  | "updateRef"
  | "setAvailableUpdate"
  | "setUpdateStatus"
  | "setUpdateError"
  | "setUpdateNoticeVisible"
  | "updateCheckInFlightRef"
  | "setUpdateProgress"
  | "setCurrentVersion"
  | "currentVersion"
  | "initialStartupUpdateCheckRef"
>;
export function useAppUpdates({
  documentCacheRef,
  browserDocumentsRef,
  previewUrlsRef,
  updateRef,
  setAvailableUpdate,
  setUpdateStatus,
  setUpdateError,
  setUpdateNoticeVisible,
  updateCheckInFlightRef,
  setUpdateProgress,
  setCurrentVersion,
  currentVersion,
  initialStartupUpdateCheckRef,
}: Input) {
  const releaseDocumentResources = useCallback(
    (path: string) => {
      documentCacheRef.current.remove(path);
      const cached = browserDocumentsRef.current.get(path);
      const previewUrl = previewUrlsRef.current.get(path) ?? cached?.previewUrl;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(path);
      }
      browserDocumentsRef.current.delete(path);
    },
    [browserDocumentsRef, documentCacheRef, previewUrlsRef],
  );

  const closePendingUpdate = useCallback(async () => {
    const pending = updateRef.current;
    updateRef.current = null;
    setAvailableUpdate(null);
    if (pending) await pending.close().catch(() => undefined);
  }, [setAvailableUpdate, updateRef]);

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
    [
      closePendingUpdate,
      setAvailableUpdate,
      setCurrentVersion,
      setUpdateError,
      setUpdateNoticeVisible,
      setUpdateProgress,
      setUpdateStatus,
      updateCheckInFlightRef,
      updateRef,
    ],
  );

  const installUpdate = useCallback(async () => {
    const pending = updateRef.current;
    if (!pending || updateCheckInFlightRef.current) return;
    updateCheckInFlightRef.current = true;

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

      setUpdateStatus("ready");
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
    } finally {
      updateCheckInFlightRef.current = false;
    }
  }, [
    currentVersion,
    setUpdateError,
    setUpdateNoticeVisible,
    setUpdateProgress,
    setUpdateStatus,
    updateRef,
    updateCheckInFlightRef,
  ]);

  const relaunchUpdatedApp = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (cause) {
      setUpdateStatus("error");
      setUpdateError(describeUpdateError(cause));
      setUpdateNoticeVisible(true);
    }
  }, [setUpdateError, setUpdateNoticeVisible, setUpdateStatus]);

  const dismissUpdateNotice = useCallback(() => {
    setUpdateNoticeVisible(false);
  }, [setUpdateNoticeVisible]);

  useEffect(
    () => () => {
      const pending = updateRef.current;
      updateRef.current = null;
      if (pending) void pending.close().catch(() => undefined);
    },
    [updateRef],
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let active = true;
    let hasRecoveryFailure = false;
    void previousUpdateFailure()
      .then((failure) => {
        if (active && failure) {
          hasRecoveryFailure = true;
          setUpdateStatus("error");
          setUpdateError(failure);
          setUpdateNoticeVisible(true);
        }
      })
      .catch(() => undefined);
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
        hasRecoveryFailure = true;
        setUpdateError(formatUpdateRecoveryNotice(recovery));
        setUpdateNoticeVisible(true);
      })
      .catch(() => undefined);

    const timer = initialStartupUpdateCheckRef.current
      ? window.setTimeout(() => {
          if (active && !hasRecoveryFailure) void checkForUpdates(false);
        }, 1_200)
      : null;

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [
    checkForUpdates,
    initialStartupUpdateCheckRef,
    setCurrentVersion,
    setUpdateError,
    setUpdateNoticeVisible,
    setUpdateStatus,
  ]);
  return { releaseDocumentResources, checkForUpdates, installUpdate, relaunchUpdatedApp, dismissUpdateNotice };
}
