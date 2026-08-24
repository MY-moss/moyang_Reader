import { describe, expect, it } from "vitest";
import { filterSwitchableWorkspaces } from "./workspace-switcher";

describe("workspace switcher", () => {
  const workspaces = [
    { name: "Notes", path: "C:\\Notes" },
    { name: "Archive", path: "D:/Archive/" },
  ];

  it("hides the active workspace while preserving recent order", () => {
    expect(filterSwitchableWorkspaces(workspaces, "c:/notes/")).toEqual([workspaces[1]]);
  });

  it("returns all recent workspaces before a workspace is active", () => {
    expect(filterSwitchableWorkspaces(workspaces, null)).toEqual(workspaces);
  });
});
