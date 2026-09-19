import { useCallback, useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

import { isTauriRuntime } from "./bridge";
import { recordDiagnosticError } from "./diagnostics";
import { ERROR_CODES } from "./error-contract";
import type { Locale } from "./i18n";
import {
  checkForAppUpdate,
  describeUpdateError,
  getCurrentAppVersion,
  installAppUpdate,
  relaunchApp,
  updateActionForStatus,
  type UpdateStatus,
} from "./updater";
import {
  clearUpdateRecovery,
  formatUpdateRecoveryNotice,
  loadUpdateRecovery,
  saveUpdateRecovery,
} from "./update-recovery";

export type UpdateControllerOptions = {
  locale: Locale;
  startupUpdateCheck: boolean;
};

export type UpdateController = {
  currentVersion: string | null;
  updateStatus: UpdateStatus;
  availableUpdate: Update | null;
  updateProgress: number | null;
  updateError: string | null;
  updateNoticeVisible: boolean;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  relaunchUpdatedApp: () => Promise<void>;
  handleUpdateAction: () => void;
  hideUpdateNotice: () => void;
  dismissUpdateNotice: () => void;
};

export function useUpdateController({ locale, startupUpdateCheck }: UpdateControllerOptions): UpdateController {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateNoticeVisible, setUpdateNoticeVisible] = useState(false);
  const updateRef = useRef<Update | null>(null);
  const updateCheckInFlightRef = useRef(false);
  const initialStartupUpdateCheckRef = useRef(startupUpdateCheck);

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
        recordDiagnosticError(cause, ERROR_CODES.UPDATE_FAILED, "update:check");
        if (manual) {
          setUpdateStatus("error");
          setUpdateError(describeUpdateError(cause, locale));
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
    [closePendingUpdate, locale],
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
    } catch (cause) {
      recordDiagnosticError(cause, ERROR_CODES.UPDATE_FAILED, "update:install");
      setUpdateStatus("error");
      const reason = describeUpdateError(cause, locale);
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
  }, [currentVersion, locale]);

  const relaunchUpdatedApp = useCallback(async () => {
    try {
      await relaunchApp();
    } catch (cause) {
      recordDiagnosticError(cause, ERROR_CODES.UPDATE_FAILED, "update:relaunch");
      setUpdateStatus("error");
      setUpdateError(describeUpdateError(cause, locale));
      setUpdateNoticeVisible(true);
    }
  }, [locale]);

  const hideUpdateNotice = useCallback(() => {
    setUpdateNoticeVisible(false);
  }, []);

  const dismissUpdateNotice = useCallback(() => {
    setUpdateNoticeVisible(false);
    void closePendingUpdate();
  }, [closePendingUpdate]);

  const handleUpdateAction = useCallback(() => {
    if (updateActionForStatus(updateStatus) === "open") setUpdateNoticeVisible(true);
    else void checkForUpdates(true);
  }, [checkForUpdates, updateStatus]);

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

  return {
    currentVersion,
    updateStatus,
    availableUpdate,
    updateProgress,
    updateError,
    updateNoticeVisible,
    checkForUpdates,
    installUpdate,
    relaunchUpdatedApp,
    handleUpdateAction,
    hideUpdateNotice,
    dismissUpdateNotice,
  };
}
