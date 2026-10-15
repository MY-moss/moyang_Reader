import { describe, expect, it } from "vitest";
import { captureEditorViewport, restoreEditorViewport } from "./editor-history-viewport";

describe("editor history viewport", () => {
  it("restores the central reading position after an editor state update", () => {
    const contentArea = document.createElement("main");
    contentArea.scrollTop = 840;
    contentArea.scrollLeft = 12;

    const snapshot = captureEditorViewport(contentArea, null);
    contentArea.scrollTop = 0;
    contentArea.scrollLeft = 0;

    restoreEditorViewport(snapshot);

    expect(contentArea.scrollTop).toBe(840);
    expect(contentArea.scrollLeft).toBe(12);
  });

  it("restores CodeMirror's nested scroll position as well", () => {
    const contentArea = document.createElement("main");
    const editorSurface = document.createElement("section");
    const scroller = document.createElement("div");
    scroller.className = "cm-scroller";
    editorSurface.append(scroller);
    contentArea.scrollTop = 240;
    scroller.scrollTop = 560;

    const snapshot = captureEditorViewport(contentArea, editorSurface);
    contentArea.scrollTop = 0;
    scroller.scrollTop = 0;

    restoreEditorViewport(snapshot);

    expect(contentArea.scrollTop).toBe(240);
    expect(scroller.scrollTop).toBe(560);
  });
});
