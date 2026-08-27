import type { ReadingScale } from "./types";

export const READING_ZOOM_DEFAULT = 100;
export const READING_ZOOM_MIN = 75;
export const READING_ZOOM_MAX = 150;
export const READING_ZOOM_STEP = 5;
export const READING_ZOOM_KEY_STEP = 10;

export function readingZoomFromScale(scale: ReadingScale): number {
  switch (scale) {
    case "small":
      return 90;
    case "large":
      return 115;
    default:
      return READING_ZOOM_DEFAULT;
  }
}

export function normalizeReadingZoom(value: unknown, fallback = READING_ZOOM_DEFAULT): number {
  const candidate = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const bounded = Math.min(READING_ZOOM_MAX, Math.max(READING_ZOOM_MIN, candidate));
  return Math.round(bounded / READING_ZOOM_STEP) * READING_ZOOM_STEP;
}

export function readingScaleFromZoom(value: number): ReadingScale {
  const zoom = normalizeReadingZoom(value);
  if (zoom <= 90) return "small";
  if (zoom >= 110) return "large";
  return "medium";
}

export function stepReadingZoom(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? READING_ZOOM_KEY_STEP : -READING_ZOOM_KEY_STEP;
  return normalizeReadingZoom(current + delta);
}

