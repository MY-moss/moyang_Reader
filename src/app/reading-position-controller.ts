import { useEffect, useRef, type RefObject } from "react";

import {
  captureReadingPosition,
  createReadingPositionTracker,
  resolveReadingPositionTop,
  type ReadingPositionAnchor,
} from "./reading-position";
import { findHeadingInArticle } from "./heading-navigation";
import { loadReadingPositionAnchor, saveReadingPosition, type ReadingPosition } from "./storage";
import type { ReaderMode } from "./types";

export type ReadingPositionControllerOptions = {
  articleRef: RefObject<HTMLElement | null>;
  contentAreaRef: RefObject<HTMLElement | null>;
  loadPosition?: (path: string) => ReadingPosition | null;
  mode: ReaderMode;
  path: string | null | undefined;
  progressiveReaderReady: boolean;
  readingHeadingsRef: RefObject<HTMLElement[]>;
  renderedHtml: string;
  savePosition?: (path: string, top: number, anchor?: ReadingPositionAnchor) => void;
};

export function useReadingPositionController({
  articleRef,
  contentAreaRef,
  loadPosition = loadReadingPositionAnchor,
  mode,
  path,
  progressiveReaderReady,
  readingHeadingsRef,
  renderedHtml,
  savePosition = saveReadingPosition,
}: ReadingPositionControllerOptions): void {
  const readingPositionRef = useRef<ReadingPosition | null>(null);

  useEffect(() => {
    if (!path || path.startsWith("browser://") || mode !== "rendered") return;

    const storedPosition = loadPosition(path);
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
      const heading = storedPosition?.headingId
        ? findHeadingInArticle(articleRef.current, storedPosition.headingId)
        : null;
      const maxScrollTop = Math.max(0, contentArea.scrollHeight - contentArea.clientHeight);
      const hasPositiveFallback = Boolean(
        storedPosition && (storedPosition.top > 0 || (storedPosition.progressRatio ?? 0) > 0),
      );
      if (
        (storedPosition?.headingId && !heading && !progressiveReaderReady) ||
        (hasPositiveFallback && maxScrollTop === 0)
      ) {
        retryRestore();
        return;
      }

      const restoredTop = storedPosition ? resolveReadingPositionTop(contentArea, heading, storedPosition) : 0;
      contentArea.scrollTop = Math.min(restoredTop, maxScrollTop);
      readingPositionRef.current = storedPosition
        ? { ...storedPosition, path, top: contentArea.scrollTop }
        : { path, top: contentArea.scrollTop };
      if (hasPositiveFallback && contentArea.scrollTop === 0) retryRestore();
    };
    const timer = window.setTimeout(restorePosition, 0);
    return () => {
      window.clearTimeout(timer);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [articleRef, contentAreaRef, loadPosition, mode, path, progressiveReaderReady, renderedHtml]);

  useEffect(() => {
    if (!path || path.startsWith("browser://")) return;

    const contentArea = contentAreaRef.current;
    if (!contentArea) return;

    let timer: number | null = null;
    const initialPosition = readingPositionRef.current?.path === path ? readingPositionRef.current : null;
    const initialTop = initialPosition?.top ?? contentArea.scrollTop;
    const tracker = createReadingPositionTracker(path, initialTop, (trackedPath, top, anchor) => {
      readingPositionRef.current = { path: trackedPath, top, ...(anchor ?? {}) };
      savePosition(trackedPath, top, anchor);
    });
    const persistPosition = () => {
      const snapshot = captureReadingPosition(contentArea, readingHeadingsRef.current ?? []);
      const anchor: ReadingPositionAnchor = {
        ...(snapshot.headingId ? { headingId: snapshot.headingId } : {}),
        ...(snapshot.relativeOffset !== undefined ? { relativeOffset: snapshot.relativeOffset } : {}),
        ...(snapshot.progressRatio !== undefined ? { progressRatio: snapshot.progressRatio } : {}),
      };
      tracker.update(snapshot.top, anchor);
      readingPositionRef.current = { path, top: tracker.current(), ...anchor };
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
      const latestPosition = readingPositionRef.current?.path === path ? readingPositionRef.current : null;
      const latestAnchor: ReadingPositionAnchor = {
        ...(latestPosition?.headingId ? { headingId: latestPosition.headingId } : {}),
        ...(latestPosition?.relativeOffset !== undefined ? { relativeOffset: latestPosition.relativeOffset } : {}),
        ...(latestPosition?.progressRatio !== undefined ? { progressRatio: latestPosition.progressRatio } : {}),
      };
      tracker.update(latestPosition?.top ?? tracker.current(), latestAnchor);
      tracker.flush();
    };
  }, [contentAreaRef, path, readingHeadingsRef, savePosition]);
}
