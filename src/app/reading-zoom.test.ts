import { describe, expect, it } from "vitest";
import {
  READING_ZOOM_DEFAULT,
  READING_ZOOM_MAX,
  READING_ZOOM_MIN,
  normalizeReadingZoom,
  readingScaleFromZoom,
  readingZoomFromScale,
  stepReadingZoom,
} from "./reading-zoom";

describe("reading zoom", () => {
  it("keeps persisted values bounded and aligned to the light-weight step", () => {
    expect(normalizeReadingZoom(undefined)).toBe(READING_ZOOM_DEFAULT);
    expect(normalizeReadingZoom(1)).toBe(READING_ZOOM_MIN);
    expect(normalizeReadingZoom(999)).toBe(READING_ZOOM_MAX);
    expect(normalizeReadingZoom(103)).toBe(105);
  });

  it("steps keyboard zoom without crossing the supported range", () => {
    expect(stepReadingZoom(100, "in")).toBe(110);
    expect(stepReadingZoom(100, "out")).toBe(90);
    expect(stepReadingZoom(145, "in")).toBe(150);
    expect(stepReadingZoom(80, "out")).toBe(75);
  });

  it("keeps legacy size presets meaningful", () => {
    expect(readingZoomFromScale("small")).toBe(90);
    expect(readingZoomFromScale("medium")).toBe(100);
    expect(readingZoomFromScale("large")).toBe(115);
    expect(readingScaleFromZoom(75)).toBe("small");
    expect(readingScaleFromZoom(100)).toBe("medium");
    expect(readingScaleFromZoom(150)).toBe("large");
  });
});

