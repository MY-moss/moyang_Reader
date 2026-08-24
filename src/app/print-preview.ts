import type { ExportMargin, ExportOrientation, ExportPaper } from "./types";

const CSS_PIXELS_PER_MM = 96 / 25.4;

const PAPER_SIZE_MM: Record<ExportPaper, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

const VERTICAL_MARGIN_MM: Record<ExportMargin, number> = {
  compact: 14,
  standard: 22,
  wide: 28,
};

export function printPageContentHeightPx(
  paper: ExportPaper,
  orientation: ExportOrientation,
  margin: ExportMargin,
): number {
  const size = PAPER_SIZE_MM[paper];
  const pageHeightMm = orientation === "landscape" ? size.width : size.height;
  return (pageHeightMm - VERTICAL_MARGIN_MM[margin] * 2) * CSS_PIXELS_PER_MM;
}

export function estimatePrintPageCount(
  contentHeightPx: number,
  paper: ExportPaper,
  orientation: ExportOrientation,
  margin: ExportMargin,
): number | null {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) return null;

  const pageContentHeight = printPageContentHeightPx(paper, orientation, margin);
  if (!Number.isFinite(pageContentHeight) || pageContentHeight <= 0) return null;

  return Math.max(1, Math.ceil(contentHeightPx / pageContentHeight));
}
