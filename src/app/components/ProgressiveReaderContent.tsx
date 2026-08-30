import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { PROGRESSIVE_READER_CHUNK_SIZE, shouldUseProgressiveReader, splitHtmlIntoBlocks } from "../progressive-render";

type ProgressiveReaderContentProps = {
  html: string;
  onReady?: (html: string) => void;
};

export type ProgressiveReaderContentHandle = {
  revealAll: () => void;
};

function scheduleReaderFrame(task: () => void): () => void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    const frame = window.requestAnimationFrame(task);
    return () => window.cancelAnimationFrame(frame);
  }

  const timer = window.setTimeout(task, 16);
  return () => window.clearTimeout(timer);
}

export const ProgressiveReaderContent = forwardRef<ProgressiveReaderContentHandle, ProgressiveReaderContentProps>(
  function ProgressiveReaderContent({ html, onReady }, ref) {
    const chunks = useMemo(
      () => (shouldUseProgressiveReader(html) ? splitHtmlIntoBlocks(html, PROGRESSIVE_READER_CHUNK_SIZE) : [html]),
      [html],
    );
    const [visibleChunkCount, setVisibleChunkCount] = useState(() => Math.min(1, chunks.length));
    const visibleChunkCountRef = useRef(visibleChunkCount);
    const chunksRef = useRef(chunks);
    const htmlRef = useRef(html);
    const onReadyRef = useRef(onReady);
    const scheduledCancelRef = useRef<(() => void) | null>(null);
    const readySignalledRef = useRef(false);

    chunksRef.current = chunks;
    htmlRef.current = html;
    onReadyRef.current = onReady;

    const signalReady = useCallback(() => {
      if (readySignalledRef.current) return;
      readySignalledRef.current = true;
      onReadyRef.current?.(htmlRef.current);
    }, []);

    const revealAll = useCallback(() => {
      scheduledCancelRef.current?.();
      scheduledCancelRef.current = null;
      const total = chunksRef.current.length;
      visibleChunkCountRef.current = total;
      setVisibleChunkCount(total);
      if (total > 1) signalReady();
    }, [signalReady]);

    useImperativeHandle(ref, () => ({ revealAll }), [revealAll]);

    useEffect(() => {
      scheduledCancelRef.current?.();
      scheduledCancelRef.current = null;
      readySignalledRef.current = false;

      const initialCount = Math.min(1, chunks.length);
      visibleChunkCountRef.current = initialCount;
      setVisibleChunkCount(initialCount);
      if (chunks.length <= 1) return;

      let active = true;
      const mountNextChunk = () => {
        if (!active) return;

        const nextCount = Math.min(chunks.length, visibleChunkCountRef.current + 1);
        visibleChunkCountRef.current = nextCount;
        setVisibleChunkCount(nextCount);
        if (nextCount >= chunks.length) {
          scheduledCancelRef.current = null;
          signalReady();
          return;
        }

        scheduledCancelRef.current = scheduleReaderFrame(mountNextChunk);
      };

      scheduledCancelRef.current = scheduleReaderFrame(mountNextChunk);
      return () => {
        active = false;
        scheduledCancelRef.current?.();
        scheduledCancelRef.current = null;
      };
    }, [chunks, signalReady]);

    if (chunks.length === 1) return <div dangerouslySetInnerHTML={{ __html: html }} />;

    const mountedChunkCount = Math.min(visibleChunkCount, chunks.length);
    const isReady = mountedChunkCount >= chunks.length;

    return (
      <div
        className="progressive-reader-content"
        data-progressive-reader="true"
        data-progressive-reader-mounted={mountedChunkCount}
        data-progressive-reader-ready={isReady ? "true" : "false"}
        data-progressive-reader-total={chunks.length}
      >
        {chunks.slice(0, mountedChunkCount).map((chunk, index) => (
          <div
            key={`${index}-${chunk.length}`}
            className="progressive-reader-chunk"
            data-progressive-reader-chunk={index + 1}
            dangerouslySetInnerHTML={{ __html: chunk }}
          />
        ))}
        {!isReady && (
          <div className="progressive-reader-loading" role="status" aria-live="polite">
            正在继续载入文档…
          </div>
        )}
      </div>
    );
  },
);

ProgressiveReaderContent.displayName = "ProgressiveReaderContent";
