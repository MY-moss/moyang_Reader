import { describe, expect, it, vi } from "vitest";
import {
  readSourceSelection,
  registerSourceSelection,
  revealSourceSelection,
  sourceSelectionLocation,
  subscribeSourceSelection,
} from "./source-selection";

describe("source editor locations", () => {
  it.each(["# heading\n**selected** tail", "first line\nselected text\nlast line"])(
    "captures the exact source coordinate and selection in %s",
    (text) => {
      const from = text.indexOf("selected"),
        to = from + 8;
      const location = sourceSelectionLocation({ text, from, to });
      expect(location).toEqual({ source: true, offset: from, endOffset: to, quote: "selected" });
    },
  );
  it("captures the current line when only the caret is present", () => {
    expect(sourceSelectionLocation({ text: "first\ncurrent line\nlast", from: 10, to: 10 })).toEqual({
      source: true,
      offset: 6,
      endOffset: 18,
      quote: "current line",
    });
  });
  it("keeps a caret on an initial empty line at offset zero", () => {
    expect(sourceSelectionLocation({ text: "\nnext line", from: 0, to: 0 })).toEqual({
      source: true,
      offset: 0,
      endOffset: 0,
      quote: "",
    });
  });
  it("isolates providers by pane and notifies a late-mounted source editor", () => {
    const left = document.createElement("section"),
      right = document.createElement("section");
    const child = left.appendChild(document.createElement("div"));
    const ready = vi.fn(),
      reveal = vi.fn();
    const unsubscribe = subscribeSourceSelection(ready);
    const remove = registerSourceSelection(child, { read: () => ({ text: "left", from: 1, to: 3 }), reveal });
    expect(ready).toHaveBeenCalledOnce();
    expect(readSourceSelection(right)).toBeUndefined();
    expect(readSourceSelection(left)?.text).toBe("left");
    expect(revealSourceSelection(left, 1, 3)).toBe(true);
    expect(reveal).toHaveBeenCalledWith(1, 3);
    remove();
    unsubscribe();
    expect(readSourceSelection(left)).toBeUndefined();
  });
});
