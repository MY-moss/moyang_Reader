export type ReadingHeading = {
  id: string;
  text: string;
};

export function readingHeadingFromElement(element: HTMLElement): ReadingHeading | null {
  const text = element.textContent?.trim() ?? "";
  return text ? { id: element.id, text } : null;
}

export function readingProgressPercent(value: number): number {
  const safeValue = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  return Math.round(safeValue * 100);
}
