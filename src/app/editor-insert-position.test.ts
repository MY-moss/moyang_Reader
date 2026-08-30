import { describe, expect, it } from "vitest";
import { calculateEditorInsertPosition } from "./editor-insert-position";

describe("editor insert popover positioning", () => {
  it("places the popover below the caret when the viewport has room", () => {
    expect(calculateEditorInsertPosition({ left: 120, top: 240, bottom: 260 }, 320, 180, 1280, 800)).toEqual({
      left: 120,
      top: 270,
    });
  });

  it("flips above a caret near the bottom edge", () => {
    expect(calculateEditorInsertPosition({ left: 120, top: 700, bottom: 720 }, 320, 180, 1280, 800)).toEqual({
      left: 120,
      top: 510,
    });
  });

  it("keeps the popover inside every viewport edge", () => {
    expect(calculateEditorInsertPosition({ left: 2, top: 2, bottom: 20 }, 320, 180, 640, 400)).toEqual({
      left: 12,
      top: 30,
    });
    expect(calculateEditorInsertPosition({ left: 620, top: 360, bottom: 380 }, 320, 180, 640, 400)).toEqual({
      left: 308,
      top: 170,
    });
  });

  it("falls back to a comfortable viewport margin without an anchor", () => {
    expect(calculateEditorInsertPosition(null, 320, 180, 640, 400)).toEqual({ left: 12, top: 12 });
  });
});
