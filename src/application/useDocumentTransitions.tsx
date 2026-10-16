import { useCallback } from "react";
import {
  shouldConfirmDocumentReplacement,
  shouldConfirmWorkspaceSwitch,
} from "../features/recovery/document-transition";
import { closeWindow } from "../platform/bridge";
import type { useEditorHistory } from "./useEditorHistory";
import type { useReaderState } from "./useReaderState";
import type { useReadingLayout } from "./useReadingLayout";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "documentStateRef"
  | "workspacePathRef"
  | "closeConfirmationOpenRef"
  | "settingsCloseInFlightRef"
  | "setCloseConfirmationOpen"
  | "setError"
> &
  Pick<ReturnType<typeof useEditorHistory>, "flushCurrentDraft"> &
  Pick<ReturnType<typeof useReadingLayout>, "flushAppSettings">;
export function useDocumentTransitions({
  documentStateRef,
  flushCurrentDraft,
  workspacePathRef,
  closeConfirmationOpenRef,
  settingsCloseInFlightRef,
  setCloseConfirmationOpen,
  flushAppSettings,
  setError,
}: Input) {
  const confirmDocumentReplacement = useCallback(
    async (nextPaths: readonly string[], _action: string) => {
      if (!shouldConfirmDocumentReplacement(documentStateRef.current, nextPaths)) return true;
      const outcome = await flushCurrentDraft();
      if (outcome === "failed") return false;
      return true;
    },
    [documentStateRef, flushCurrentDraft],
  );

  const confirmWorkspaceSwitch = useCallback(
    async (nextWorkspacePath: string, _action: string) => {
      const currentDocument = documentStateRef.current;
      if (
        !shouldConfirmWorkspaceSwitch(Boolean(currentDocument?.modified), workspacePathRef.current, nextWorkspacePath)
      ) {
        return true;
      }
      const outcome = await flushCurrentDraft();
      if (outcome === "failed") return false;
      return true;
    },
    [documentStateRef, flushCurrentDraft, workspacePathRef],
  );

  const cancelCloseConfirmation = useCallback(() => {
    closeConfirmationOpenRef.current = false;
    settingsCloseInFlightRef.current = false;
    setCloseConfirmationOpen(false);
  }, [closeConfirmationOpenRef, setCloseConfirmationOpen, settingsCloseInFlightRef]);

  const confirmClose = useCallback(() => {
    closeConfirmationOpenRef.current = false;
    setCloseConfirmationOpen(false);
    settingsCloseInFlightRef.current = true;
    void (async () => {
      try {
        if (!(await flushAppSettings())) {
          setError("设置尚未成功写入本机，请稍后重试关闭窗口。");
          return;
        }
        await closeWindow();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "关闭窗口失败。");
      } finally {
        settingsCloseInFlightRef.current = false;
      }
    })();
  }, [closeConfirmationOpenRef, flushAppSettings, setCloseConfirmationOpen, setError, settingsCloseInFlightRef]);
  return { confirmDocumentReplacement, confirmWorkspaceSwitch, cancelCloseConfirmation, confirmClose };
}
