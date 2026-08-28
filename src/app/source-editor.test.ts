import { describe, expect, it } from "vitest";
import { shouldSyncSourceEditorValue } from "./components/SourceEditor";

describe("source editor value synchronization", () => {
  it("does not compare or replace the document after an internal edit", () => {
    expect(shouldSyncSourceEditorValue(true, "# Note\nchanged", "# Note\nchanged")).toBe(false);
  });

  it("syncs external changes only when the editor already exists", () => {
    expect(shouldSyncSourceEditorValue(true, "old", "new")).toBe(true);
    expect(shouldSyncSourceEditorValue(false, "old", "new")).toBe(false);
  });
});
