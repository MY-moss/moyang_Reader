import { describe, expect, it } from "vitest";
import { buildBatchHtmlExport, buildHtmlExport, fileNameWithExtension, inlineLocalImages, pathWithExtension } from "./export";

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

  it("embeds readable local images while preserving external images", async () => {
    const reads: string[] = [];
    const html = await inlineLocalImages(
      '<img src="moyang-embed:cover.png"><img src="https://example.com/remote.png"><img src="moyang-embed:cover.png">',
      (source) => source.startsWith("moyang-embed:") ? `C:\\Notes\\${source.slice("moyang-embed:".length)}` : null,
      async (path) => {
        reads.push(path);
        return Uint8Array.from([0, 1, 2]);
      },
      () => "image/png",
    );

    expect(reads).toEqual(["C:\\Notes\\cover.png"]);
    expect(html).toContain('src="data:image/png;base64,AAEC"');
    expect(html).toContain('src="https://example.com/remote.png"');
  });
  it("builds a single HTML document with a linked table of contents", () => {
    const html = buildBatchHtmlExport("阅读库", [
      { title: "notes/第一篇.md", body: "<p>第一篇</p>" },
      { title: "notes/第二篇.md", body: "<p>第二篇</p>" },
    ]);

    expect(html).toContain("文档目录");
    expect(html).toContain('href="#moyang-document-0"');
    expect(html).toContain('id="moyang-document-1"');
    expect(html).toContain("第二篇");
  });
});
