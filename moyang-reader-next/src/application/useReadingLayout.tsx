import { useCallback, useEffect, type WheelEvent as ReactWheelEvent } from "react";
import { clampPaneWidth, DEFAULT_PANE_WIDTHS, type PaneSide } from "../features/reader/pane-layout";
import { normalizeReadingZoom, READING_ZOOM_STEP, readingScaleFromZoom } from "../features/reader/reading-zoom";
import { serializeAppSettings } from "../features/settings/app-settings";
import { saveReaderPreferences, type ReaderPreferences } from "../features/settings/preferences";
import { isTauriRuntime, writeAppSettings } from "../platform/bridge";
import type { TocItem } from "../shared/types";
import { currentHeadingFromArticle, PendingAppSettingsWrite, scrollToHeading } from "./support";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "contentAreaRef"
  | "setReadingProgress"
  | "articleRef"
  | "setCurrentHeading"
  | "setCurrentHeadingId"
  | "setPaneWidths"
  | "settingsWriteRevisionRef"
  | "nativeSettingsWriteQueueRef"
  | "setSettingsPersistenceStatus"
  | "lastNativeSettingsWriteRef"
  | "appSettingsFlushTimerRef"
  | "pendingAppSettingsWriteRef"
  | "pendingHeadingRef"
  | "mode"
  | "setMode"
  | "preferencesRef"
  | "setPreferences"
  | "setReadingZoomNotice"
  | "readingZoomNoticeTimerRef"
  | "documentStateRef"
>;
export function useReadingLayout({
  contentAreaRef,
  setReadingProgress,
  articleRef,
  setCurrentHeading,
  setCurrentHeadingId,
  setPaneWidths,
  settingsWriteRevisionRef,
  nativeSettingsWriteQueueRef,
  setSettingsPersistenceStatus,
  lastNativeSettingsWriteRef,
  appSettingsFlushTimerRef,
  pendingAppSettingsWriteRef,
  pendingHeadingRef,
  mode,
  setMode,
  preferencesRef,
  setPreferences,
  setReadingZoomNotice,
  readingZoomNoticeTimerRef,
  documentStateRef,
}: Input) {
  const updateReadingRail = useCallback(() => {
    const contentArea = contentAreaRef.current;
    const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
    const nextProgress = maxScrollTop > 0 ? Math.min(1, Math.max(0, contentArea!.scrollTop / maxScrollTop)) : 0;
    setReadingProgress((current) => (Math.abs(current - nextProgress) < 0.001 ? current : nextProgress));
    const heading = currentHeadingFromArticle(articleRef.current, contentArea);
    setCurrentHeading((current) => (current === (heading?.text ?? null) ? current : (heading?.text ?? null)));
    setCurrentHeadingId((current) => (current === (heading?.id || null) ? current : heading?.id || null));
  }, [articleRef, contentAreaRef, setCurrentHeading, setCurrentHeadingId, setReadingProgress]);

  const scrollToReaderEdge = useCallback(
    (edge: "top" | "bottom") => {
      const contentArea = contentAreaRef.current;
      if (!contentArea) return;
      contentArea.scrollTo({ top: edge === "top" ? 0 : contentArea.scrollHeight, behavior: "smooth" });
    },
    [contentAreaRef],
  );

  const resizePane = useCallback(
    (side: PaneSide, delta: number) => {
      setPaneWidths((current) => {
        const nextWidth = clampPaneWidth(side, current[side] + delta);
        if (nextWidth === current[side]) return current;
        return { ...current, [side]: nextWidth };
      });
    },
    [setPaneWidths],
  );

  const resetPane = useCallback(
    (side: PaneSide) => {
      setPaneWidths((current) => ({
        ...current,
        [side]: DEFAULT_PANE_WIDTHS[side],
      }));
    },
    [setPaneWidths],
  );

  const enqueueNativeSettingsWrite = useCallback(
    (pending: PendingAppSettingsWrite): Promise<boolean> => {
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
    },
    [lastNativeSettingsWriteRef, nativeSettingsWriteQueueRef, setSettingsPersistenceStatus, settingsWriteRevisionRef],
  );

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
  }, [appSettingsFlushTimerRef, enqueueNativeSettingsWrite, lastNativeSettingsWriteRef, pendingAppSettingsWriteRef]);

  const navigateToHeading = useCallback(
    (item: TocItem) => {
      pendingHeadingRef.current = item.id;
      if (mode !== "rendered") {
        setMode("rendered");
        return;
      }
      pendingHeadingRef.current = null;
      scrollToHeading(item.id, contentAreaRef.current, articleRef.current);
    },
    [articleRef, contentAreaRef, mode, pendingHeadingRef, setMode],
  );

  const setReaderPreferences = useCallback(
    (changes: Partial<ReaderPreferences>) => {
      const next = { ...preferencesRef.current, ...changes };
      preferencesRef.current = next;
      saveReaderPreferences(next);
      setPreferences(next);
    },
    [preferencesRef, setPreferences],
  );

  const announceReadingZoom = useCallback(
    (zoom: number) => {
      setReadingZoomNotice(zoom);
      if (readingZoomNoticeTimerRef.current !== null) {
        window.clearTimeout(readingZoomNoticeTimerRef.current);
      }
      readingZoomNoticeTimerRef.current = window.setTimeout(() => {
        readingZoomNoticeTimerRef.current = null;
        setReadingZoomNotice(null);
      }, 1_200);
    },
    [readingZoomNoticeTimerRef, setReadingZoomNotice],
  );

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
    [documentStateRef, mode, preferencesRef, setReadingZoom],
  );

  useEffect(
    () => () => {
      if (readingZoomNoticeTimerRef.current !== null) window.clearTimeout(readingZoomNoticeTimerRef.current);
    },
    [readingZoomNoticeTimerRef],
  );
  return {
    updateReadingRail,
    scrollToReaderEdge,
    resizePane,
    resetPane,
    enqueueNativeSettingsWrite,
    flushAppSettings,
    navigateToHeading,
    setReaderPreferences,
    setReadingZoom,
    handleReaderWheel,
  };
}
