import { afterEach, expect, it } from "vitest";
import { recentCommands, rememberCommand, searchCommands } from "./command-search";
afterEach(() => localStorage.clear());
const commands = [
  { id: "open", label: "打开文档" },
  { id: "save", label: "保存当前文档" },
];
it("finds Chinese, pinyin, initials and English commands", () => {
  for (const query of ["保存", "bao", "bc", "save"]) expect(searchCommands(commands, query, [])[0].id).toBe("save");
});
it("remembers recent commands once and handles damaged storage", () => {
  rememberCommand("save");
  rememberCommand("open");
  rememberCommand("save");
  expect(recentCommands()).toEqual(["save", "open"]);
  expect(searchCommands(commands, "", recentCommands())[0].id).toBe("save");
  localStorage.setItem("moyang-reader-recent-commands", "oops");
  expect(recentCommands()).toEqual([]);
});
