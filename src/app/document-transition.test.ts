import { describe, expect, it } from "vitest";
import {
  formatTransitionConfirmation,
  isSameDocumentPath,
  shouldConfirmDocumentReplacement,
  shouldConfirmWorkspaceSwitch,
} from "./document-transition";

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

  it("compares document paths without depending on separator or case", () => {
    expect(isSameDocumentPath("C:\\Notes\\draft.md", "c:/notes/draft.md/")).toBe(true);
    expect(isSameDocumentPath("C:\\Notes\\draft.md", "C:/Notes/other.md")).toBe(false);
  });

  it("confirms when any next document would replace the active document", () => {
    expect(shouldConfirmDocumentReplacement(modifiedDocument, ["C:/Notes/draft.md", "C:/Notes/other.md"])).toBe(true);
  });

  it("only confirms a workspace switch when the root changes", () => {
    expect(shouldConfirmWorkspaceSwitch(true, "C:/Notes", "c:\\notes\\")).toBe(false);
    expect(shouldConfirmWorkspaceSwitch(true, "C:/Notes", "D:/Archive")).toBe(true);
    expect(shouldConfirmWorkspaceSwitch(false, "C:/Notes", "D:/Archive")).toBe(false);
  });

  it("describes whether the latest edit was preserved as a draft", () => {
    expect(formatTransitionConfirmation("切换文档", true)).toBe(
      "当前文档的最新修改已自动保留为草稿，可在“草稿”中心恢复。仍要切换文档吗？",
    );
    expect(formatTransitionConfirmation("切换文档", false)).toBe(
      "当前文档有未保存修改，切换文档后将丢失这些修改。继续吗？",
    );
  });
});

