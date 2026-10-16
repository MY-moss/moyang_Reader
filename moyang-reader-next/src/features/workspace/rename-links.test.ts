import { describe, expect, it } from "vitest";
import { rewriteRenamedLinks } from "./rename-links";
describe("rename link maintenance", () => {
  const files = ["folder/note.md", "folder/target.md", "other/target.md", "image.png"];
  it("preserves aliases, fragments and untouched source syntax", () => {
    const source =
      '[[target#标题|别名]] ![[target]] [标题](./target.md#标题 "说明")\n\n`[[target]]`\n\n```md\n[[target]]\n```';
    const result = rewriteRenamedLinks(source, files[0], files, files[1], "folder/new.md");
    expect(result.source).toContain('[[folder/new#标题|别名]] ![[folder/new]] [标题](./new.md#标题 "说明")');
    expect(result.source).toContain("`[[target]]`");
    expect(result.source).toContain("```md\n[[target]]\n```");
    expect(result.changed).toBe(3);
  });
  it("keeps ambiguous links untouched and reports them", () => {
    const result = rewriteRenamedLinks("[[target]]", "index.md", files, files[1], "folder/new.md");
    expect(result.source).toBe("[[target]]");
    expect(result.ambiguous).toEqual(["target"]);
  });
  it("rebases outbound image and reference links when their document moves", () => {
    const result = rewriteRenamedLinks(
      '![封面](../image.png)\n\n[x]: ../image.png "图"',
      files[0],
      files,
      "folder",
      "deep/next",
    );
    expect(result.source).toBe('![封面](../../image.png)\n\n[x]: ../../image.png "图"');
  });
  it("ignores external links and escaped wiki text", () => {
    expect(
      rewriteRenamedLinks("https://example.org/target.md \\[[target]]", files[0], files, files[1], "new.md").changed,
    ).toBe(0);
  });
});
