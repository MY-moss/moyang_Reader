export type ReadingPositionWriter = (path: string, top: number) => void;

function normalizeReadingPosition(top: number): number {
  return Number.isFinite(top) ? Math.max(0, top) : 0;
}

export function createReadingPositionTracker(path: string, initialTop: number, write: ReadingPositionWriter) {
  let latestTop = normalizeReadingPosition(initialTop);

  return {
    update(top: number) {
      latestTop = normalizeReadingPosition(top);
    },
    flush() {
      write(path, latestTop);
    },
    current() {
      return latestTop;
    },
  };
}
