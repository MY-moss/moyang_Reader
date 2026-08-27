import { describe, expect, it } from "vitest";
import { DEFAULT_PANE_WIDTHS, PANE_WIDTH_LIMITS, clampPaneWidth, normalizePaneWidths } from "./pane-layout";

describe("pane layout", () => {
  it("clamps dragged widths to safe desktop bounds", () => {
    expect(clampPaneWidth("sidebar", 100)).toBe(PANE_WIDTH_LIMITS.sidebar.min);
    expect(clampPaneWidth("context", 999)).toBe(PANE_WIDTH_LIMITS.context.max);
    expect(clampPaneWidth("sidebar", Number.NaN)).toBe(DEFAULT_PANE_WIDTHS.sidebar);
  });

  it("normalizes malformed persisted widths without throwing", () => {
    expect(normalizePaneWidths({ sidebar: 311.4, context: -4 })).toEqual({ sidebar: 311, context: 260 });
    expect(normalizePaneWidths({ sidebar: "wide" })).toEqual(DEFAULT_PANE_WIDTHS);
    expect(normalizePaneWidths(null)).toEqual(DEFAULT_PANE_WIDTHS);
  });
});
