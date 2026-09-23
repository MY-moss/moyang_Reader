import { describe, expect, it } from "vitest";
import { localizedEditorContextMenuGroups } from "./editor-context-menu";

describe("localized editor context menu", () => {
  it("preserves action IDs and shortcuts across locales", () => {
    const zh = localizedEditorContextMenuGroups("zh-CN");
    const en = localizedEditorContextMenuGroups("en-US");
    expect(en.map((group) => group.label)).toEqual(["Edit", "Format", "Paragraph", "Insert"]);
    expect(en[0]?.items[0]?.label).toBe("Undo");
    expect(zh.flatMap((group) => group.items.map((item) => [item.action, item.shortcut]))).toEqual(
      en.flatMap((group) => group.items.map((item) => [item.action, item.shortcut])),
    );
  });
});
