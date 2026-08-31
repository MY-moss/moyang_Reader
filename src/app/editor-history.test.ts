import { describe, expect, it } from "vitest";
import {
  EDITOR_HISTORY_GROUP_WINDOW_MS,
  MAX_EDITOR_HISTORY_BYTES,
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

  it("groups rapid typing into one undo step", () => {
    let history = createEditorHistory("note.md", "one");
    history = recordEditorChange(history, "one two", { merge: true, timestamp: 0 });
    history = recordEditorChange(history, "one two three", {
      merge: true,
      timestamp: EDITOR_HISTORY_GROUP_WINDOW_MS - 1,
    });

    expect(undoEditorChange(history)).toMatchObject({ present: "one", future: ["one two three"] });
  });

  it("starts a new group after the typing window or an atomic change", () => {
    let history = createEditorHistory("note.md", "one");
    history = recordEditorChange(history, "one two", { merge: true, timestamp: 0 });
    history = recordEditorChange(history, "one two three", {
      merge: true,
      timestamp: EDITOR_HISTORY_GROUP_WINDOW_MS + 1,
    });

    expect(undoEditorChange(history)).toMatchObject({ present: "one two" });

    history = recordEditorChange(history, "one two three four", { timestamp: 1_000 });
    history = recordEditorChange(history, "one two three four five", { merge: true, timestamp: 1_001 });
    expect(undoEditorChange(history)).toMatchObject({ present: "one two three four" });
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

  it("keeps retained snapshots within the byte budget", () => {
    const largeSource = "x".repeat(MAX_EDITOR_HISTORY_BYTES / 2);
    let history = createEditorHistory("large.md", "start");
    history = recordEditorChange(history, largeSource, { timestamp: 0 });
    history = recordEditorChange(history, `${largeSource}1`, { timestamp: 1_000 });
    history = undoEditorChange(history);

    expect(history.pastBytes + history.futureBytes).toBeLessThanOrEqual(MAX_EDITOR_HISTORY_BYTES);
    expect(history.pastBytes).toBeGreaterThanOrEqual(0);
    expect(history.futureBytes).toBeGreaterThanOrEqual(0);
  });
});
