import { describe, expect, it } from "vitest";
import { buildHtmlExport, fileNameWithExtension, pathWithExtension } from "./export";

describe("document export helpers", () => {
  it("keeps the directory while changing the export extension", () => {
    expect(fileNameWithExtension("笔记.markdown", "html")).toBe("笔记.html");
    expect(pathWithExtension("C:\\Notes\\笔记.md", "html")).toBe("C:\\Notes\\笔记.html");
  });

  it("creates a standalone HTML document and normalizes reader-only links", () => {
    const html = buildHtmlExport("<标题>", '<p>正文</p><img src="moyang-embed:cover.png"><a href="moyang-wiki:下一篇">下一篇</a>');

    expect(html).toContain("&lt;标题&gt;");
    expect(html).toContain('src="cover.png"');
    expect(html).toContain('href="下一篇.md"');
    expect(html).toContain("<!doctype html>");
  });
});
