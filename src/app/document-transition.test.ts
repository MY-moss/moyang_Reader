import { describe, expect, it } from "vitest";
import { shouldConfirmDocumentReplacement, shouldConfirmWorkspaceSwitch } from "./document-transition";

describe("document transition guards", () => {
  const modifiedDocument = { path: "C:\\Notes\\draft.md", modified: true };

  it("does not confirm when there is no unsaved document", () => {
    expect(shouldConfirmDocumentReplacement(null, ["C:/Notes/other.md"])).toBe(false);
    expect(shouldConfirmDocumentReplacement({ ...modifiedDocument, modified: false }, ["C:/Notes/other.md"])).toBe(
      false,
    );
  });

  it("does not confirm when the next path is the active document", () => {
    expect(shouldConfirmDocumentReplacement(modifiedDocument, ["c:/notes/draft.md/"])).toBe(false);
  });

  it("confirms when any next document would replace the active document", () => {
    expect(shouldConfirmDocumentReplacement(modifiedDocument, ["C:/Notes/draft.md", "C:/Notes/other.md"])).toBe(true);
  });

  it("only confirms a workspace switch when the root changes", () => {
    expect(shouldConfirmWorkspaceSwitch(true, "C:/Notes", "c:\\notes\\")).toBe(false);
    expect(shouldConfirmWorkspaceSwitch(true, "C:/Notes", "D:/Archive")).toBe(true);
    expect(shouldConfirmWorkspaceSwitch(false, "C:/Notes", "D:/Archive")).toBe(false);
  });
});
