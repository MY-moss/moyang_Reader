import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  documentKindFromPath,
  emptyRenderedDocument,
  isEditableDocument,
  renderDocx,
  renderHtmlFragment,
} from "./document-adapters";

async function createMinimalDocx(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>测试 Word 文档</w:t></w:r></w:p>
          <w:sectPr />
        </w:body>
      </w:document>`,
  );

  return new Uint8Array(await zip.generateAsync({ type: "arraybuffer" }));
}

describe("document adapters", () => {
  it("routes supported extensions to the correct reader", () => {
    expect(documentKindFromPath("C:\\Notes\\Guide.DOCX")).toBe("docx");
    expect(documentKindFromPath("C:\\Notes\\Guide.pdf?download=1")).toBe("pdf");
    expect(documentKindFromPath("C:\\Notes\\Cover.PNG")).toBe("image");
    expect(documentKindFromPath("C:\\Notes\\Today.LOG")).toBe("text");
    expect(documentKindFromPath("C:\\Notes\\Today.markdown")).toBe("markdown");
    expect(documentKindFromPath("C:\\Notes\\Legacy.doc")).toBeNull();
    expect(documentKindFromPath("C:\\Notes\\binary")).toBeNull();
  });

  it("only exposes source editing for text-based documents", () => {
    expect(isEditableDocument("markdown")).toBe(true);
    expect(isEditableDocument("text")).toBe(true);
    expect(isEditableDocument("docx")).toBe(false);
    expect(isEditableDocument("pdf")).toBe(false);
  });

  it("provides an empty reading model for PDF previews", () => {
    expect(emptyRenderedDocument()).toEqual({ html: "", toc: [], wordCount: 0, readingMinutes: 0 });
  });

  it("sanitizes converted HTML before it reaches the reader", async () => {
    const result = await renderHtmlFragment("<h1>标题</h1><script>alert('x')</script><p>正文</p>");

    expect(result.html).toContain('<h1 id="标题">标题</h1>');
    expect(result.html).not.toContain("<script");
    expect(result.toc).toEqual([{ id: "标题", depth: 1, text: "标题" }]);
  });

  it("applies the remote resource preference to HTML fragments", async () => {
    const source = '<img src="https://example.com/pixel.png"><img src="data:image/png;base64,AA==">';
    const localOnly = await renderHtmlFragment(source);
    const remoteAllowed = await renderHtmlFragment(source, { allowRemoteResources: true });

    expect(localOnly.html).not.toContain('src="https://example.com/pixel.png"');
    expect(localOnly.html).toContain('src="data:image/png;base64,AA=="');
    expect(remoteAllowed.html).toContain('src="https://example.com/pixel.png"');
  });

  it("converts a minimal DOCX package into readable HTML", async () => {
    const result = await renderDocx(await createMinimalDocx());

    expect(result.html).toContain("测试 Word 文档");
    expect(result.wordCount).toBeGreaterThan(0);
  });
});
