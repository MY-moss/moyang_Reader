import { describe, expect, it } from "vitest";
import { validateWorkspaceNameInput, type WorkspaceNameInputRequest } from "./workspace-name-input";

const request: WorkspaceNameInputRequest = {
  action: "create-note",
  kind: "file",
  root: "C:/Notes",
  parentPath: "",
  initialName: "Untitled",
};
describe("workspace name feedback", () => {
  it("applies inherited file type and distinct-name feedback to copies, not folder suffixes", () => {
    const copy: WorkspaceNameInputRequest = {
      ...request,
      action: "duplicate",
      sourcePath: "C:/Notes/source.txt",
      currentName: "source.txt",
    };
    expect(validateWorkspaceNameInput(copy, "source.txt")).toBe("unchanged");
    expect(validateWorkspaceNameInput(copy, "new copy")).toBeNull();
    expect(validateWorkspaceNameInput(copy, "copy.PDF")).toBeNull();
    expect(validateWorkspaceNameInput(copy, "copy.exe")).toBe("unsupportedType");
    expect(validateWorkspaceNameInput({ ...copy, kind: "folder" }, "Folder.exe")).toBeNull();
  });
  it.each([
    ["", "empty"],
    ["  ..  ", "empty"],
    ["Projects/note", "separator"],
    ["a\\b", "separator"],
    ["note?", "characters"],
    ["a\u0000b", "characters"],
    ["note.", "ending"],
    ["cOn.txt", "reserved"],
    ["lpt9", "reserved"],
    ["note.txt", "markdownOnly"],
  ] as const)("reports %s without sending a file operation", (name, error) => {
    expect(validateWorkspaceNameInput(request, name)).toBe(error);
  });
  it.each(["  笔记  ", "笔记.MD", "你好😀.markdown", ".hidden", "README.mdown", "COM0", "新笔记.mkd"])(
    "preserves existing accepted names: %s",
    (name) => {
      expect(validateWorkspaceNameInput(request, name)).toBeNull();
    },
  );
  it("lets folders use dots and preserves supported or inherited file extensions", () => {
    expect(
      validateWorkspaceNameInput({ ...request, action: "create-folder", kind: "folder" }, "Folder.txt"),
    ).toBeNull();
    const rename = { ...request, action: "rename" as const, currentName: "original.txt" };
    expect(validateWorkspaceNameInput(rename, "original.txt")).toBe("unchanged");
    expect(validateWorkspaceNameInput(rename, "renamed")).toBeNull();
    expect(validateWorkspaceNameInput(rename, "renamed.PDF")).toBeNull();
    expect(validateWorkspaceNameInput(rename, "renamed.exe")).toBe("unsupportedType");
  });
});
