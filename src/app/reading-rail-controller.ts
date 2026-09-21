import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";

import { readingHeadingFromElement, readingProgressPercent, type ReadingHeading } from "./reading-rail";
import type { DocumentKind, ReaderMode } from "./types";

export type ReadingRailControllerOptions = {
  articleRef: RefObject<HTMLElement | null>;
  contentAreaRef: RefObject<HTMLElement | null>;
  documentKind: DocumentKind | null | undefined;
  documentPath: string | null | undefined;
  mode: ReaderMode;
  progressiveReaderReady: boolean;
  readingHeadingsRef: MutableRefObject<HTMLElement[]>;
  renderedHtml: string;
};

export type ReadingRailController = {
  currentHeading: string | null;
  currentHeadingId: string | null;
  readingProgress: number;
};

function currentHeadingFromElements(headings: HTMLElement[], contentArea: HTMLElement | null): ReadingHeading | null {
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

  return readingHeadingFromElement(currentHeading ?? headings[0]);
}

export function useReadingRailController({
  articleRef,
  contentAreaRef,
  documentKind,
  documentPath,
  mode,
  progressiveReaderReady,
  readingHeadingsRef,
  renderedHtml,
}: ReadingRailControllerOptions): ReadingRailController {
  const [readingProgress, setReadingProgress] = useState(0);
  const [currentHeading, setCurrentHeading] = useState<string | null>(null);
  const [currentHeadingId, setCurrentHeadingId] = useState<string | null>(null);
  const readingHeadingObserverRef = useRef<IntersectionObserver | null>(null);
  const readingHeadingCandidatesRef = useRef(new Set<HTMLElement>());

  const setReadingHeading = useCallback((heading: ReadingHeading | null) => {
    const nextHeading = heading?.text ?? null;
    const nextHeadingId = heading?.id || null;
    setCurrentHeading((current) => (current === nextHeading ? current : nextHeading));
    setCurrentHeadingId((current) => (current === nextHeadingId ? current : nextHeadingId));
  }, []);

  const updateReadingRail = useCallback(() => {
    const contentArea = contentAreaRef.current;
    const maxScrollTop = contentArea ? Math.max(0, contentArea.scrollHeight - contentArea.clientHeight) : 0;
    const nextProgress =
      maxScrollTop > 0 && contentArea ? Math.min(1, Math.max(0, contentArea.scrollTop / maxScrollTop)) : 0;
    const nextProgressPercent = readingProgressPercent(nextProgress);
    setReadingProgress((current) => (readingProgressPercent(current) === nextProgressPercent ? current : nextProgress));

    const headings = readingHeadingsRef.current;
    if (headings.length === 0) {
      setReadingHeading(null);
      return;
    }

    if (!contentArea || contentArea.scrollTop <= 1) {
      setReadingHeading(readingHeadingFromElement(headings[0]));
    } else if (contentArea.scrollTop >= maxScrollTop - 2) {
      setReadingHeading(readingHeadingFromElement(headings[headings.length - 1]));
    } else if (!readingHeadingObserverRef.current) {
      setReadingHeading(currentHeadingFromElements(headings, contentArea));
    }
  }, [contentAreaRef, readingHeadingsRef, setReadingHeading]);

  useEffect(() => {
    const article = articleRef.current;
    const contentArea = contentAreaRef.current;
    const candidates = readingHeadingCandidatesRef.current;
    const canTrackHeadings =
      mode === "rendered" &&
      progressiveReaderReady &&
      documentKind !== "pdf" &&
      documentKind !== "image" &&
      Boolean(article && contentArea);

    readingHeadingObserverRef.current?.disconnect();
    readingHeadingObserverRef.current = null;
    candidates.clear();
    readingHeadingsRef.current = canTrackHeadings
      ? Array.from(article?.querySelectorAll<HTMLElement>("h1, h2, h3, h4") ?? [])
      : [];

    const headings = readingHeadingsRef.current;
    if (!canTrackHeadings || !contentArea || headings.length === 0) {
      setReadingHeading(null);
      return;
    }

    setReadingHeading(readingHeadingFromElement(headings[0]));
    if (typeof IntersectionObserver === "undefined") return;

    const headingBandHeight = Math.min(72, Math.max(1, contentArea.clientHeight));
    const bottomMarginPercent = 100 - (headingBandHeight / Math.max(1, contentArea.clientHeight)) * 100;
    const observer = new IntersectionObserver(
      (entries) => {
        const currentArea = contentAreaRef.current;
        const maxScrollTop = currentArea ? Math.max(0, currentArea.scrollHeight - currentArea.clientHeight) : 0;
        if (currentArea && currentArea.scrollTop <= 1) {
          setReadingHeading(readingHeadingFromElement(headings[0]));
          return;
        }
        if (currentArea && currentArea.scrollTop >= maxScrollTop - 2) {
          setReadingHeading(readingHeadingFromElement(headings[headings.length - 1]));
          return;
        }

        entries.forEach((entry) => {
          const heading = entry.target as HTMLElement;
          if (entry.isIntersecting) candidates.add(heading);
          else candidates.delete(heading);
        });

        for (let index = headings.length - 1; index >= 0; index -= 1) {
          const heading = headings[index];
          if (candidates.has(heading)) {
            setReadingHeading(readingHeadingFromElement(heading));
            return;
          }
        }

        setReadingHeading(currentHeadingFromElements(headings, currentArea));
      },
      { root: contentArea, rootMargin: `0px 0px -${bottomMarginPercent}% 0px`, threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    readingHeadingObserverRef.current = observer;
    return () => {
      observer.disconnect();
      candidates.clear();
      if (readingHeadingObserverRef.current === observer) readingHeadingObserverRef.current = null;
    };
  }, [
    articleRef,
    contentAreaRef,
    documentKind,
    documentPath,
    mode,
    progressiveReaderReady,
    readingHeadingsRef,
    renderedHtml,
    setReadingHeading,
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
  }, [contentAreaRef, documentPath, mode, progressiveReaderReady, renderedHtml, updateReadingRail]);

  useEffect(() => {
    if (documentPath && mode === "rendered" && documentKind !== "pdf" && documentKind !== "image") return;
    setReadingProgress(0);
    setCurrentHeading(null);
    setCurrentHeadingId(null);
  }, [documentKind, documentPath, mode]);

  return { currentHeading, currentHeadingId, readingProgress };
}
