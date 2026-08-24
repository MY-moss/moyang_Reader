import { escapeHtml } from "../lib/text";

export function fileNameWithExtension(name: string, extension: string): string {
  const baseName = name.replace(/\.[^./\\]+$/, "") || "moyang-reader";
  return baseName + "." + extension;
}

export function pathWithExtension(path: string, extension: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const directory = separator >= 0 ? path.slice(0, separator + 1) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  return directory + fileNameWithExtension(name, extension);
}

export function pathWithNameSuffix(path: string, suffix: string, extension: string): string {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const directory = separator >= 0 ? path.slice(0, separator + 1) : "";
  const name = separator >= 0 ? path.slice(separator + 1) : path;
  const baseName = name.replace(/\.[^./\\]+$/, "") || "moyang-reader";
  return directory + baseName + suffix + "." + extension;
}

function normalizeExportLinks(html: string): string {
  return html
    .replace(/(src|href)="moyang-embed:([^"]+)"/g, '$1="$2"')
    .replace(/href="moyang-wiki:([^"]+)"/g, (_match, target: string) => {
      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = /\.[A-Za-z0-9]+$/.test(rawPath) ? rawPath : rawPath + ".md";
      return 'href="' + path + (rawAnchor ? "#" + rawAnchor : "") + '"';
    });
}

export function htmlToPlainText(html: string): string {
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return (parsed.body.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function copyRichText(html: string): Promise<void> {
  const normalizedHtml = normalizeExportLinks(html);
  const plainText = htmlToPlainText(normalizedHtml);

  if (!navigator.clipboard) throw new Error("当前环境不支持复制到剪贴板。");

  if (typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
    const clipboardItem = new ClipboardItem({
      "text/html": new Blob([normalizedHtml], { type: "text/html" }),
      "text/plain": new Blob([plainText], { type: "text/plain" }),
    });
    await navigator.clipboard.write([clipboardItem]);
    return;
  }

  if (typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(plainText);
    return;
  }

  throw new Error("当前环境不支持复制到剪贴板。");
}

const MAX_INLINE_IMAGE_BYTES = 12 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function inlineLocalImages(
  html: string,
  resolveLocalPath: (source: string) => string | null,
  readBinary: (path: string) => Promise<Uint8Array>,
  mimeTypeForPath: (path: string) => string,
  getSize?: (path: string) => Promise<number>,
): Promise<string> {
  const sources = Array.from(html.matchAll(/\bsrc="([^"]+)"/g), (match) => match[1]);
  const replacements = new Map<string, string>();

  await Promise.all(
    Array.from(new Set(sources)).map(async (source) => {
      const localPath = resolveLocalPath(source);
      if (!localPath) return;

      try {
        if (getSize && (await getSize(localPath)) > MAX_INLINE_IMAGE_BYTES) return;
        const bytes = await readBinary(localPath);
        if (bytes.length > MAX_INLINE_IMAGE_BYTES) return;
        replacements.set(source, `data:${mimeTypeForPath(localPath)};base64,${bytesToBase64(bytes)}`);
      } catch {
        // Keep an unreadable local image as a relative link so export still succeeds.
      }
    }),
  );

  return html.replace(/\bsrc="([^"]+)"/g, (match, source: string) => {
    const replacement = replacements.get(source);

    return replacement ? `src="${replacement}"` : match;
  });
}

export function buildHtmlExport(title: string, body: string): string {
  return (
    "<!doctype html>\n" +
    '<html lang="zh-CN">\n' +
    "<head>\n" +
    '  <meta charset="utf-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" +
    escapeHtml(title) +
    "</title>\n" +
    "  <style>\n" +
    "    @page { size: auto; margin: 22mm 18mm; }\n" +
    "    :root { color-scheme: light; }\n" +
    '    body { max-width: 860px; margin: 0 auto; color: #35332f; background: #fff; font-family: Georgia, "Songti SC", "STSong", serif; font-size: 17px; line-height: 1.85; }\n' +
    '    h1, h2, h3, h4 { color: #292825; font-family: Georgia, "Songti SC", "STSong", serif; font-weight: 500; line-height: 1.25; }\n' +
    "    h1 { margin: 0 0 30px; font-size: 42px; }\n" +
    "    h2 { margin: 50px 0 16px; font-size: 29px; }\n" +
    "    h3 { margin: 35px 0 12px; font-size: 23px; }\n" +
    "    .batch-index { margin: 0 0 42px; padding: 16px 20px; border: 1px solid #d9d5cc; background: #f8f7f3; }\n" +
    "    .batch-index strong { display: block; margin-bottom: 8px; color: #292825; }\n" +
    "    .batch-index ol { margin: 0; padding-left: 22px; }\n" +
    "    p, ul, ol, blockquote, pre, table { margin: 0 0 20px; }\n" +
    "    .batch-document + .batch-document { break-before: page; }\n" +
    "    a { color: #28655f; }\n" +
    "    img { max-width: 100%; height: auto; }\n" +
    "    blockquote { border-left: 3px solid #9abdb4; padding-left: 16px; color: #6d716b; }\n" +
    "    code { padding: 2px 5px; background: #f0eee9; font-family: Consolas, monospace; font-size: .88em; }\n" +
    "    pre { overflow: auto; padding: 14px 16px; background: #f3f1ec; font-family: Consolas, monospace; font-size: .85em; line-height: 1.55; }\n" +
    "    table { width: 100%; border-collapse: collapse; }\n" +
    "    th, td { border: 1px solid #d9d5cc; padding: 7px 9px; text-align: left; }\n" +
    "    th { background: #f0eee9; }\n" +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    '  <main class="reader-content">' +
    normalizeExportLinks(body) +
    "</main>\n" +
    "</body>\n" +
    "</html>\n"
  );
}

export type HtmlExportDocument = {
  title: string;
  body: string;
};

export function buildBatchHtmlExport(title: string, documents: HtmlExportDocument[]): string {
  const index = documents
    .map((document, index) => `<li><a href="#moyang-document-${index}">${escapeHtml(document.title)}</a></li>`)
    .join("");
  const content = [
    `<nav class="batch-index"><strong>文档目录</strong><ol>${index}</ol></nav>`,
    ...documents.map(
      (document, index) =>
        `<section id="moyang-document-${index}" class="batch-document"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`,
    ),
  ].join("\n");

  return buildHtmlExport(title, content);
}

type DocxImage = {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  relationshipId: string;
};

type DocxRenderState = {
  images: DocxImage[];
  nextImageId: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function runXml(value: string, properties = ""): string {
  if (!value) return "";
  const content = value
    .split(/\r?\n/)
    .map((line, index) => `${index > 0 ? "<w:br/>" : ""}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`)
    .join("");
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}${content}</w:r>`;
}

function imageExtension(contentType: string): string | null {
  return (
    {
      "image/gif": "gif",
      "image/jpeg": "jpeg",
      "image/png": "png",
    }[contentType] ?? null
  );
}

function imageXml(element: HTMLElement, state: DocxRenderState): string {
  const source = element.getAttribute("src") ?? "";
  const match = source.match(/^data:([^;,]+);base64,(.+)$/);
  const extension = match ? imageExtension(match[1].toLowerCase()) : null;
  if (!match || !extension) {
    return runXml(`[图片${element.getAttribute("alt") ? `：${element.getAttribute("alt")}` : ""}]`);
  }

  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const relationshipId = `rId${state.nextImageId}`;
    state.nextImageId += 1;
    state.images.push({
      bytes,
      contentType: match[1].toLowerCase(),
      extension,
      relationshipId,
    });

    const imageId = state.images.length;
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5486400" cy="3657600"/><wp:docPr id="${imageId}" name="图片 ${imageId}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${imageId}" name="图片 ${imageId}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3657600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  } catch {
    return runXml("[图片无法读取]");
  }
}

function inlineXml(node: Node, state: DocxRenderState, inheritedProperties = ""): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return runXml(node.nodeValue ?? "", inheritedProperties);
  }
  if (!(node instanceof HTMLElement)) return "";

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "<w:r><w:br/></w:r>";
  if (tag === "img") return imageXml(node, state);

  let properties = inheritedProperties;
  if (tag === "strong" || tag === "b") properties += "<w:b/>";
  if (tag === "em" || tag === "i") properties += "<w:i/>";
  if (tag === "u") properties += '<w:u w:val="single"/>';
  if (tag === "code" || tag === "kbd")
    properties += '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:fill="F0EEE9"/>';
  if (tag === "a") properties += '<w:color w:val="28655F"/><w:u w:val="single"/>';

  return Array.from(node.childNodes)
    .map((child) => inlineXml(child, state, properties))
    .join("");
}

function paragraphXml(content: string, style?: string, extraProperties = ""): string {
  const properties =
    style || extraProperties ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extraProperties}</w:pPr>` : "";
  return `<w:p>${properties}${content || "<w:r><w:t></w:t></w:r>"}</w:p>`;
}

function tableXml(table: HTMLElement, state: DocxRenderState): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  const columnCount = Math.max(1, ...rows.map((row) => row.querySelectorAll(":scope > th, :scope > td").length));
  const grid = Array.from({ length: columnCount }, () => '<w:gridCol w:w="2200"/>').join("");
  const body = rows
    .map((row) => {
      const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
      return `<w:tr>${cells
        .map((cell) => {
          const isHeader = cell.tagName.toLowerCase() === "th";
          const content = Array.from(cell.childNodes)
            .map((child) => inlineXml(child, state, isHeader ? "<w:b/>" : ""))
            .join("");
          return `<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr>${paragraphXml(content)}</w:tc>`;
        })
        .join("")}</w:tr>`;
    })
    .join("");

  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D5CC"/><w:left w:val="single" w:sz="4" w:color="D9D5CC"/><w:bottom w:val="single" w:sz="4" w:color="D9D5CC"/><w:right w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideH w:val="single" w:sz="4" w:color="D9D5CC"/><w:insideV w:val="single" w:sz="4" w:color="D9D5CC"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function blockXml(node: Node, state: DocxRenderState): string {
  if (!(node instanceof HTMLElement)) {
    return node.nodeType === Node.TEXT_NODE && node.textContent?.trim() ? paragraphXml(runXml(node.textContent)) : "";
  }

  const tag = node.tagName.toLowerCase();
  const pageBreakPrefix = node.dataset.pageBreak === "true" ? paragraphXml("", "Normal", "<w:pageBreakBefore/>") : "";
  if (tag === "table") return pageBreakPrefix + tableXml(node, state);
  if (tag === "ul" || tag === "ol") {
    return (
      pageBreakPrefix +
      Array.from(node.children)
        .map((child) => blockXml(child, state))
        .join("")
    );
  }
  if (tag === "li") {
    const parentTag = node.parentElement?.tagName.toLowerCase();
    const content = Array.from(node.childNodes)
      .filter((child) => !(child instanceof HTMLElement && ["ul", "ol"].includes(child.tagName.toLowerCase())))
      .map((child) => inlineXml(child, state))
      .join("");
    const nested = Array.from(node.children)
      .filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()))
      .map((child) => blockXml(child, state))
      .join("");
    return pageBreakPrefix + paragraphXml(runXml(parentTag === "ol" ? "1. " : "• ") + content, "Normal") + nested;
  }
  if (/^h[1-4]$/.test(tag)) {
    return (
      pageBreakPrefix +
      paragraphXml(
        Array.from(node.childNodes)
          .map((child) => inlineXml(child, state))
          .join(""),
        `Heading${tag.slice(1)}`,
      )
    );
  }
  if (tag === "pre") {
    return (
      pageBreakPrefix +
      paragraphXml(
        inlineXml(node, state, '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>'),
        "CodeBlock",
      )
    );
  }
  if (tag === "blockquote") {
    return (
      pageBreakPrefix +
      paragraphXml(
        Array.from(node.childNodes)
          .map((child) => inlineXml(child, state, "<w:i/>"))
          .join(""),
        "Quote",
      )
    );
  }
  if (tag === "hr") {
    return (
      pageBreakPrefix +
      paragraphXml("", "Normal", '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="D9D5CC"/></w:pBdr>')
    );
  }
  if (tag === "img") return pageBreakPrefix + paragraphXml(imageXml(node, state));

  const blockChildren = Array.from(node.children).filter((child) =>
    /^(p|div|section|article|h[1-4]|ul|ol|table|blockquote|pre|hr)$/i.test(child.tagName),
  );
  if (blockChildren.length > 0) return pageBreakPrefix + blockChildren.map((child) => blockXml(child, state)).join("");
  return (
    pageBreakPrefix +
    paragraphXml(
      Array.from(node.childNodes)
        .map((child) => inlineXml(child, state))
        .join(""),
    )
  );
}

function docxStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="等线"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:color w:val="6D716B"/></w:rPr></w:style></w:styles>`;
}

function docxDocumentXml(title: string, body: string, state: DocxRenderState): string {
  const parsed = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  const content = root
    ? Array.from(root.childNodes)
        .map((node) => blockXml(node, state))
        .join("")
    : "";
  const titleParagraph = paragraphXml(runXml(title), "Title");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${titleParagraph}${content}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

function docxContentTypesXml(images: DocxImage[]): string {
  const imageTypes = Array.from(new Map(images.map((image) => [image.extension, image.contentType])))
    .map(([extension, contentType]) => `<Default Extension="${extension}" ContentType="${contentType}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${imageTypes}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function docxRelationshipsXml(images: DocxImage[]): string {
  const relationships = images
    .map(
      (image, index) =>
        `<Relationship Id="${image.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${index + 1}.${image.extension}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`;
}

export async function buildDocxExport(title: string, body: string): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const state: DocxRenderState = { images: [], nextImageId: 1 };
  const zip = new JSZip();
  zip.file("[Content_Types].xml", docxContentTypesXml(state.images));
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
  );
  zip.file("word/document.xml", docxDocumentXml(title, body, state));
  zip.file("word/styles.xml", docxStylesXml());
  zip.file("word/_rels/document.xml.rels", docxRelationshipsXml(state.images));
  zip.file(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${escapeXml(title)}</dc:title><dc:creator>Moyang Reader</dc:creator></cp:coreProperties>`,
  );
  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Moyang Reader</Application></Properties>`,
  );

  // The document XML is built before the content types and relationships are finalized.
  zip.file("[Content_Types].xml", docxContentTypesXml(state.images));
  zip.file("word/_rels/document.xml.rels", docxRelationshipsXml(state.images));
  state.images.forEach((image, index) => zip.file(`word/media/image${index + 1}.${image.extension}`, image.bytes));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function buildBatchDocxExport(title: string, documents: HtmlExportDocument[]): Promise<Uint8Array> {
  const content = documents
    .map(
      (document, index) =>
        `<section data-page-break="${index > 0 ? "true" : "false"}"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`,
    )
    .join("");

  return buildDocxExport(title, content);
}
