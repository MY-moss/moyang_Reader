import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  buildBatchHtmlExport,
  buildBatchDocxExport,
  buildDocxExport,
  buildHtmlExport,
  copyRichText,
  formatExportCancellationNotice,
  htmlToPlainText,
  fileNameWithExtension,
  inlineLocalImages,
  pathWithExtension,
  pathWithNameSuffix,
  printHtmlDocument,
  summarizeExportFailures,
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
    expect(html).toContain("@page { size: A4 portrait; margin: 22mm 18mm; }");
    expect(html).toContain("MOYANG READER · EXPORT");
  });

  it("applies custom paper, orientation, and margin settings to HTML export", () => {
    const html = buildHtmlExport("报告", "<p>正文</p>", {
      paper: "letter",
      orientation: "landscape",
      margin: "compact",
    });

    expect(html).toContain("@page { size: Letter landscape; margin: 14mm 14mm; }");
  });

  it("adds a linked outline to a single-document HTML export", () => {
    const html = buildHtmlExport("报告", '<h1 id="intro">介绍</h1><h2 id="details">细节</h2>', undefined, [
      { id: "intro", depth: 1, text: "介绍" },
      { id: "details", depth: 2, text: "细节" },
    ]);

    expect(html).toContain('class="export-toc"');
    expect(html).toContain('href="#intro"');
    expect(html).toContain('href="#details"');
    expect(html).toContain("padding-left:12px");
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

  it("summarizes unique export failures without hiding the count", () => {
    expect(summarizeExportFailures([])).toBe("");
    expect(summarizeExportFailures(["a.md", "a.md", "b.docx"], 3)).toBe("a.md、b.docx");
    expect(summarizeExportFailures(["a.md", "b.docx", "c.txt", "d.pdf"], 3)).toBe("a.md、b.docx、c.txt 等 4 个");
  });

  it("explains that cancelling a batch export leaves no partial output", () => {
    expect(formatExportCancellationNotice(4)).toBe("已取消批量导出，已整理 4 篇文档，未写入文件。");
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

  it("keeps ordered list numbers in DOCX exports", async () => {
    const bytes = await buildDocxExport(
      "有序列表",
      "<ol><li>第一项<ol><li>嵌套第一项</li></ol></li><li>第二项</li></ol>",
    );
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const documentXmlTree = new DOMParser().parseFromString(documentXml ?? "", "application/xml");
    const textRuns = Array.from(
      documentXmlTree.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t"),
    )
      .map((node) => node.textContent ?? "")
      .join("");

    expect(textRuns).toContain("1. 第一项");
    expect(textRuns).toContain("1. 嵌套第一项");
    expect(textRuns).toContain("2. 第二项");
  });

  it("preserves safe external hyperlinks in DOCX exports", async () => {
    const bytes = await buildDocxExport(
      "链接",
      '<p><a href="https://example.com/?a=1&amp;b=2">官网</a> <a href="mailto:hello@example.com">邮件</a> <a href="tel:+8613800138000">电话</a> <a href="guide/intro.md">相对文档</a> <a href="moyang-wiki:Note">内部笔记</a></p>',
    );
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const relationshipsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");

    expect(documentXml).toContain('<w:hyperlink r:id="rIdLink1">');
    expect(documentXml).toContain('<w:hyperlink r:id="rIdLink2">');
    expect(documentXml).toContain('<w:hyperlink r:id="rIdLink3">');
    expect(documentXml).toContain('<w:hyperlink r:id="rIdLink4">');
    expect(documentXml).toContain('<w:hyperlink r:id="rIdLink5">');
    expect(relationshipsXml).toContain('Target="https://example.com/?a=1&amp;b=2"');
    expect(relationshipsXml).toContain('Target="mailto:hello@example.com"');
    expect(relationshipsXml).toContain('Target="tel:+8613800138000"');
    expect(relationshipsXml).toContain('Target="guide/intro.md"');
    expect(relationshipsXml).toContain('Target="Note.md"');
    expect(relationshipsXml).toContain('TargetMode="External"');
    expect(relationshipsXml).not.toContain("moyang-wiki:");
  });

  it("applies custom page layout settings to DOCX export", async () => {
    const bytes = await buildDocxExport("Letter", "<p>正文</p>", {
      paper: "letter",
      orientation: "landscape",
      margin: "wide",
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    expect(documentXml).toContain('w:w="15840" w:h="12240" w:orient="landscape"');
    expect(documentXml).toContain('w:top="2160" w:right="2160" w:bottom="2160" w:left="2160"');
  });

  it("adds reusable header, footer, and page-number fields to DOCX exports", async () => {
    const bytes = await buildDocxExport("页眉页脚示例", "<p>正文</p>");
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    const headerXml = await zip.file("word/header1.xml")?.async("string");
    const footerXml = await zip.file("word/footer1.xml")?.async("string");
    const relationshipsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");

    expect(documentXml).toContain('w:headerReference w:type="default" r:id="rIdHeader"');
    expect(documentXml).toContain('w:footerReference w:type="default" r:id="rIdFooter"');
    expect(headerXml).toContain("页眉页脚示例");
    expect(footerXml).toContain('w:fldSimple w:instr="PAGE"');
    expect(footerXml).toContain('w:fldSimple w:instr="NUMPAGES"');
    expect(relationshipsXml).toContain('Id="rIdHeader"');
    expect(relationshipsXml).toContain('Id="rIdFooter"');
    expect(contentTypesXml).toContain("/word/header1.xml");
    expect(contentTypesXml).toContain("/word/footer1.xml");
  });
});
