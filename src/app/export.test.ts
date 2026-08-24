import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  buildBatchHtmlExport,
  buildBatchDocxExport,
  buildDocxExport,
  buildHtmlExport,
  copyRichText,
  htmlToPlainText,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
  printHtmlDocument,
} from "./export";

describe("document export helpers", () => {
  it("keeps the directory while changing the export extension", () => {
    expect(fileNameWithExtension("笔记.markdown", "html")).toBe("笔记.html");
    expect(pathWithExtension("C:\\Notes\\笔记.md", "html")).toBe("C:\\Notes\\笔记.html");
    expect(pathWithNameSuffix("C:\\Notes\\笔记.docx", " - 导出", "docx")).toBe("C:\\Notes\\笔记 - 导出.docx");
  });

  it("creates a standalone HTML document and normalizes reader-only links", () => {
    const html = buildHtmlExport(
      "<标题>",
      '<p>正文</p><img src="moyang-embed:cover.png"><a href="moyang-wiki:下一篇">下一篇</a>',
    );

    expect(html).toContain("&lt;标题&gt;");
    expect(html).toContain('src="cover.png"');
    expect(html).toContain('href="下一篇.md"');
    expect(html).toContain("<!doctype html>");
  });

  it("converts rendered HTML into a compact plain-text fallback", () => {
    expect(htmlToPlainText("<h1>标题</h1><p>第一段</p><p>第二段&nbsp;内容</p>")).toBe("标题第一段第二段 内容");
  });

  it("falls back to plain text when rich clipboard writing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const previousClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      await copyRichText("<h1>标题</h1><p>正文</p>");
      expect(writeText).toHaveBeenCalledWith("标题正文");
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: previousClipboard,
      });
    }
  });

  it("embeds readable local images while preserving external images", async () => {
    const reads: string[] = [];
    const html = await inlineLocalImages(
      '<img src="moyang-embed:cover.png"><img src="https://example.com/remote.png"><img src="moyang-embed:cover.png">',
      (source) => (source.startsWith("moyang-embed:") ? `C:\\Notes\\${source.slice("moyang-embed:".length)}` : null),
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

  it("skips oversized local images before reading their bytes", async () => {
    const reads: string[] = [];
    const sizes: string[] = [];
    const html = await inlineLocalImages(
      '<img src="moyang-embed:large.png">',
      () => "C:\\Notes\\large.png",
      async (path) => {
        reads.push(path);
        return Uint8Array.from([0, 1, 2]);
      },
      () => "image/png",
      async (path) => {
        sizes.push(path);
        return 12 * 1024 * 1024 + 1;
      },
    );

    expect(sizes).toEqual(["C:\\Notes\\large.png"]);
    expect(reads).toEqual([]);
    expect(html).toContain('src="moyang-embed:large.png"');
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

  it("opens a generated HTML document in a temporary print frame", async () => {
    vi.useFakeTimers();
    const print = vi.fn();
    const focus = vi.fn();
    let afterPrint: (() => void) | undefined;
    const printWindow = {
      addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "afterprint") {
          afterPrint = () => {
            if (typeof listener === "function") listener(new Event("afterprint"));
          };
        }
      }),
      focus,
      print,
    } as unknown as Window;
    const previousContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow");
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      configurable: true,
      get: () => printWindow,
    });

    try {
      const pending = printHtmlDocument("<!doctype html><p>批量内容</p>");
      await vi.advanceTimersByTimeAsync(120);
      await pending;

      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Moyang Reader 打印预览"]');
      expect(frame).not.toBeNull();
      expect(printWindow.addEventListener).toHaveBeenCalledOnce();
      expect(print).toHaveBeenCalledOnce();
      expect(focus).toHaveBeenCalledOnce();

      afterPrint?.();
      expect(document.querySelector('iframe[title="Moyang Reader 打印预览"]')).toBeNull();
    } finally {
      if (previousContentWindow)
        Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", previousContentWindow);
      else Reflect.deleteProperty(HTMLIFrameElement.prototype, "contentWindow");
      vi.useRealTimers();
      document.querySelector('iframe[title="Moyang Reader 打印预览"]')?.remove();
    }
  });

  it("builds a DOCX package with core blocks and embedded images", async () => {
    const bytes = await buildDocxExport(
      "导出标题",
      '<h1>章节</h1><p>正文 <strong>重点</strong></p><ul><li>项目</li></ul><pre><code>const answer = 42;</code></pre><table><tbody><tr><th>字段</th><td>内容</td></tr></tbody></table><p><img src="data:image/png;base64,AAEC" alt="封面"></p>',
    );
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const relationshipsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const documentXmlTree = new DOMParser().parseFromString(documentXml ?? "", "application/xml");

    expect(documentXmlTree.querySelector("parsererror")).toBeNull();
    expect(documentXml).toContain("导出标题");
    expect(documentXml).toContain('w:pStyle w:val="Heading1"');
    expect(documentXml).toContain("重点");
    expect(documentXml).toContain("const answer = 42;");
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain('r:embed="rId1"');
    expect(relationshipsXml).toContain('Target="media/image1.png"');
    expect(zip.file("word/media/image1.png")).not.toBeNull();
  });

  it("builds a paginated DOCX package for a batch of documents", async () => {
    const bytes = await buildBatchDocxExport("阅读库", [
      { title: "第一篇.md", body: "<p>第一篇正文</p>" },
      { title: "第二篇.md", body: "<p>第二篇正文</p>" },
    ]);
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain("第一篇.md");
    expect(documentXml).toContain("第二篇.md");
    expect(documentXml).toContain("第一篇正文");
    expect(documentXml).toContain("第二篇正文");
    expect(documentXml).toContain("<w:pageBreakBefore/>");
  });
});
