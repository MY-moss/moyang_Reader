// @vitest-environment node
import { expect, it } from "vitest";
import packages from "./builtin-reader-packages.json";
import { analyzeDocument } from "./document-analysis";
import { validateOutput } from "./output";
import type { ExtensionInput, ExtensionOutput, ExtensionPackage } from "../../shared/extension-types";

async function run(id: string, text: string, format = "markdown") {
  const pkg = packages.find((item) => item.id === `moyang.${id}`) as ExtensionPackage;
  const module = (await import(
    /* @vite-ignore */ "data:text/javascript;base64," + Buffer.from(pkg.files![pkg.entry!]).toString("base64")
  )) as { default: (input: ExtensionInput) => ExtensionOutput };
  return validateOutput(
    module.default({
      command: pkg.commands![0].id,
      text,
      format,
      title: "资料",
      path: "notes.md",
      analysis: format === "markdown" ? analyzeDocument(text) : undefined,
    }),
    pkg.commands![0],
    text,
  );
}

it("builds the overview from real Markdown headings rather than nested code examples", async () => {
  const text = [
    "---",
    'title: "# 属性"',
    "---",
    "",
    "````markdown",
    "```js",
    "# code comment",
    "```",
    "````",
    "",
    "~~~markdown",
    "```",
    "# another example",
    "```",
    "~~~",
    "",
    "文档主题",
    "========",
    "",
    "## **真实**章节",
  ].join("\n");
  const result = await run("reading-report", text);
  expect(result.report).toContain("文档大纲\n# 文档主题\n## 真实章节");
  expect(result.report).not.toContain("# code comment");
  expect(result.report).not.toContain("# another example");
  expect(result.report).not.toContain("# 属性");
});

it("preserves literal frontmatter, indented code, fenced code, hard breaks and line endings", async () => {
  for (const ending of ["\n", "\r\n"]) {
    const protectedSections = [
      ["---", "description: |", "  first", "", "", "  second", "---"],
      ["    first", "", "", "    second"],
      ["````markdown", "```js", "", "", "# code comment", "```", "````"],
    ].map((lines) => lines.join(ending));
    const text = protectedSections.join(ending.repeat(3)) + ending.repeat(3) + "正文  " + ending + "继续" + ending;
    const result = await run("tidy-markdown", text);
    expect(result.replacement).toBe(
      protectedSections.join(ending.repeat(2)) + ending.repeat(2) + "正文  " + ending + "继续" + ending,
    );
    for (const section of protectedSections) expect(result.replacement).toContain(section);
  }
});

it("still processes plain text and empty documents without Markdown analysis", async () => {
  expect((await run("tidy-markdown", "first\r\n\r\n\r\nsecond\n", "text")).replacement).toBe("first\r\n\r\nsecond\n");
  expect((await run("tidy-markdown", "")).replacement).toBe("");
  expect((await run("reading-report", "中文 text", "text")).report).toContain("中文字符：2\n英文词数：1");
  expect((await run("reading-report", "Word 中文 text", "docx")).report).toContain("中文字符：2\n英文词数：2");
});

it("preserves TOML frontmatter blank lines while tidying the surrounding prose", async () => {
  const attributes = '+++\ndescription = """\nfirst\n\n\nsecond\n"""\n+++';
  const result = await run("tidy-markdown", attributes + "\n\n\n正文\n");
  expect(result.replacement).toBe(attributes + "\n\n正文\n");
});
