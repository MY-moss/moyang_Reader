import { describe, expect, it } from "vitest";
import {
  MAX_EDITOR_HISTORY_ENTRIES,
  canRedoEditorChange,
  canUndoEditorChange,
  createEditorHistory,
  redoEditorChange,
  recordEditorChange,
  undoEditorChange,
} from "./editor-history";

describe("editor history", () => {
  it("records changes and moves backward and forward", () => {
    let history = createEditorHistory("note.md", "one");
    history = recordEditorChange(history, "two");
    history = recordEditorChange(history, "three");

    expect(canUndoEditorChange(history)).toBe(true);
    expect(undoEditorChange(history)).toMatchObject({ present: "two", future: ["three"] });
    expect(redoEditorChange(undoEditorChange(history))).toMatchObject({ present: "three", future: [] });
  });

  it("does not create duplicate entries and clears redo after a new branch", () => {
    let history = createEditorHistory("note.md", "one");
    history = recordEditorChange(history, "two");
    history = undoEditorChange(history);
    expect(canRedoEditorChange(history)).toBe(true);

    history = recordEditorChange(history, "branch");
    expect(history).toMatchObject({ present: "branch", past: ["one"], future: [] });
    expect(recordEditorChange(history, "branch")).toBe(history);
    expect(canRedoEditorChange(history)).toBe(false);
  });

  it("keeps only the bounded number of past entries", () => {
    let history = createEditorHistory("large.md", "0");
    for (let index = 1; index <= MAX_EDITOR_HISTORY_ENTRIES + 5; index += 1) {
      history = recordEditorChange(history, String(index));
    }

    expect(history.past).toHaveLength(MAX_EDITOR_HISTORY_ENTRIES);
    expect(history.past[0]).toBe("5");
    expect(history.present).toBe(String(MAX_EDITOR_HISTORY_ENTRIES + 5));
  });
});
