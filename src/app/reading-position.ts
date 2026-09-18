export type ReadingPositionAnchor = {
  headingId?: string;
  relativeOffset?: number;
  progressRatio?: number;
};

export type ReadingPositionSnapshot = ReadingPositionAnchor & {
  top: number;
};

export type ReadingPositionWriter = (path: string, top: number, anchor?: ReadingPositionAnchor) => void;

function normalizeReadingPosition(top: number): number {
  return Number.isFinite(top) ? Math.max(0, top) : 0;
}

function normalizeProgressRatio(value: number): number | undefined {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
}

function normalizedHeadingId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function normalizeReadingPositionAnchor(value: unknown): ReadingPositionAnchor {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const candidate = value as Partial<ReadingPositionAnchor>;
  const headingId = normalizedHeadingId(candidate.headingId);
  const relativeOffset =
    typeof candidate.relativeOffset === "number" && Number.isFinite(candidate.relativeOffset)
      ? Math.round(candidate.relativeOffset)
      : undefined;
  const progressRatio =
    typeof candidate.progressRatio === "number" ? normalizeProgressRatio(candidate.progressRatio) : undefined;

  return {
    ...(headingId ? { headingId } : {}),
    ...(relativeOffset !== undefined ? { relativeOffset } : {}),
    ...(progressRatio !== undefined ? { progressRatio } : {}),
  };
}

function maxScrollTop(contentArea: HTMLElement): number {
  return Math.max(0, contentArea.scrollHeight - contentArea.clientHeight);
}

function clampScrollTop(top: number, maxTop: number): number {
  return Math.min(maxTop, Math.max(0, Math.round(top)));
}

function currentHeadingElement(headings: readonly HTMLElement[], contentArea: HTMLElement): HTMLElement | null {
  if (headings.length === 0) return null;

  const maxTop = maxScrollTop(contentArea);
  if (contentArea.scrollTop >= maxTop - 2) return headings[headings.length - 1];

  const threshold = contentArea.getBoundingClientRect().top + 72;
  let current: HTMLElement | null = null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= threshold) current = heading;
    else break;
  }
  return current ?? headings[0];
}

export function captureReadingPosition(
  contentArea: HTMLElement,
  headings: readonly HTMLElement[],
): ReadingPositionSnapshot {
  const top = normalizeReadingPosition(contentArea.scrollTop);
  const maxTop = maxScrollTop(contentArea);
  const progressRatio = maxTop > 0 ? Math.min(1, Math.max(0, top / maxTop)) : 0;
  const heading = currentHeadingElement(headings, contentArea);
  if (!heading?.id) return { top, progressRatio };

  const relativeOffset = heading.getBoundingClientRect().top - contentArea.getBoundingClientRect().top;
  return {
    top,
    headingId: heading.id,
    relativeOffset: Math.round(relativeOffset),
    progressRatio,
  };
}

export function resolveReadingPositionTop(
  contentArea: HTMLElement,
  heading: HTMLElement | null,
  position: ReadingPositionSnapshot,
): number {
  const maxTop = maxScrollTop(contentArea);
  const anchor = normalizeReadingPositionAnchor(position);
  if (heading && anchor.relativeOffset !== undefined) {
    const areaRect = contentArea.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const targetTop = contentArea.scrollTop + headingRect.top - areaRect.top - anchor.relativeOffset;
    if (Number.isFinite(targetTop)) return clampScrollTop(targetTop, maxTop);
  }

  if (anchor.progressRatio !== undefined) return clampScrollTop(maxTop * anchor.progressRatio, maxTop);
  return clampScrollTop(position.top, maxTop);
}

export function createReadingPositionTracker(path: string, initialTop: number, write: ReadingPositionWriter) {
  let latestTop = normalizeReadingPosition(initialTop);
  let latestAnchor: ReadingPositionAnchor = {};

  return {
    update(top: number, anchor?: ReadingPositionAnchor) {
      latestTop = normalizeReadingPosition(top);
      latestAnchor = normalizeReadingPositionAnchor(anchor);
    },
    flush() {
      if (Object.keys(latestAnchor).length > 0) write(path, latestTop, latestAnchor);
      else write(path, latestTop);
    },
    current() {
      return latestTop;
    },
    currentAnchor() {
      return latestAnchor;
    },
  };
}
