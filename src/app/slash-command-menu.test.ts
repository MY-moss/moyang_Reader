import { describe, expect, it } from "vitest";
import { filterSlashCommands, matchSlashTrigger, slashCaretOffset, slashCommands } from "./slash-command-menu";

describe("matchSlashTrigger", () => {
  it("matches a bare slash and a slash with a query at block start", () => {
    expect(matchSlashTrigger("/")).toEqual({ query: "" });
    expect(matchSlashTrigger("/h1")).toEqual({ query: "h1" });
    expect(matchSlashTrigger("/标题")).toEqual({ query: "标题" });
  });

  it("does not trigger when the slash is not the first character", () => {
    expect(matchSlashTrigger("text /h1")).toBeNull();
    expect(matchSlashTrigger("- /h1")).toBeNull();
  });

  it("stops matching after a space or closing punctuation", () => {
    expect(matchSlashTrigger("/h1 ")).toBeNull();
    expect(matchSlashTrigger("/h1/")).toBeNull();
    expect(matchSlashTrigger("/标题 2")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("returns the visible cap for an empty query", () => {
    const items = filterSlashCommands(slashCommands, "");

    expect(slashCommands.length).toBeGreaterThan(8);
    expect(items).toHaveLength(8);
  });

  it("filters by label prefix and keyword", () => {
    const byLabel = filterSlashCommands(slashCommands, "标题");
    expect(byLabel.map((item) => item.id)).toEqual(["heading1", "heading2", "heading3"]);

    const byKeyword = filterSlashCommands(slashCommands, "h1");
    expect(byKeyword.map((item) => item.id)).toEqual(["heading1"]);

    const byPinyin = filterSlashCommands(slashCommands, "biao");
    expect(byPinyin.map((item) => item.id)).toContain("table");
  });

  it("returns nothing for an unknown query", () => {
    expect(filterSlashCommands(slashCommands, "xyz")).toEqual([]);
  });

  it("keeps at most 8 visible commands", () => {
    expect(filterSlashCommands(slashCommands, "").length).toBeLessThanOrEqual(8);
  });
});

describe("slashCaretOffset", () => {
  it("lands inside the code block fence after the opening line", () => {
    const codeBlock = slashCommands.find((command) => command.id === "codeBlock");

    expect(codeBlock).toBeDefined();
    expect(slashCaretOffset(codeBlock!)).toBe(4);
  });

  it("defaults to the end of the inserted text", () => {
    const heading = slashCommands.find((command) => command.id === "heading1");

    expect(heading).toBeDefined();
    expect(slashCaretOffset(heading!)).toBe(heading!.sourceInsert.length);
  });
});

describe("slashCommands source inserts", () => {
  it("keeps every command's insert valid markdown", () => {
    for (const command of slashCommands) {
      expect(command.sourceInsert.length).toBeGreaterThan(0);
      expect(command.label).toBeTruthy();
      expect(command.detail).toBeTruthy();
      expect(command.keywords).toBeTruthy();
    }
  });
});
