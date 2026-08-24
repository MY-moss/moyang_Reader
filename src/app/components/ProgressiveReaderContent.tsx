import { useMemo } from "react";
import { PROGRESSIVE_READER_CHUNK_SIZE, shouldUseProgressiveReader, splitHtmlIntoBlocks } from "../progressive-render";

type ProgressiveReaderContentProps = {
  html: string;
};

export function ProgressiveReaderContent({ html }: ProgressiveReaderContentProps) {
  const chunks = useMemo(
    () => (shouldUseProgressiveReader(html) ? splitHtmlIntoBlocks(html, PROGRESSIVE_READER_CHUNK_SIZE) : [html]),
    [html],
  );

  if (chunks.length === 1) return <div dangerouslySetInnerHTML={{ __html: html }} />;

  return (
    <div className="progressive-reader-content" data-progressive-reader="true">
      {chunks.map((chunk, index) => (
        <div
          key={`${index}-${chunk.length}`}
          className="progressive-reader-chunk"
          data-progressive-reader-chunk={index + 1}
          dangerouslySetInnerHTML={{ __html: chunk }}
        />
      ))}
    </div>
  );
}
