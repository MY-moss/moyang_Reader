
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeExportLinks(html: string): string {
  return html
    .replace(/(src|href)="moyang-embed:([^"]+)"/g, "$1=\"$2\"")
    .replace(/href="moyang-wiki:([^"]+)"/g, (_match, target: string) => {
      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = /\.[A-Za-z0-9]+$/.test(rawPath) ? rawPath : rawPath + ".md";
      return "href=\"" + path + (rawAnchor ? "#" + rawAnchor : "") + "\"";
    });
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
): Promise<string> {
  const sources = Array.from(html.matchAll(/\bsrc="([^"]+)"/g), (match) => match[1]);
  const replacements = new Map<string, string>();

  await Promise.all(Array.from(new Set(sources)).map(async (source) => {
    const localPath = resolveLocalPath(source);
    if (!localPath) return;

    try {
      const bytes = await readBinary(localPath);
      if (bytes.length > MAX_INLINE_IMAGE_BYTES) return;
      replacements.set(source, `data:${mimeTypeForPath(localPath)};base64,${bytesToBase64(bytes)}`);
    } catch {
      // Keep an unreadable local image as a relative link so export still succeeds.
    }
  }));

  return html.replace(/\bsrc="([^"]+)"/g, (match, source: string) => {
    const replacement = replacements.get(source);

    return replacement ? `src="${replacement}"` : match;
  });
}

export function buildHtmlExport(title: string, body: string): string {
  return "<!doctype html>\n" +
    "<html lang=\"zh-CN\">\n" +
    "<head>\n" +
    "  <meta charset=\"utf-8\">\n" +
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
    "  <title>" + escapeHtml(title) + "</title>\n" +
    "  <style>\n" +
    "    @page { size: auto; margin: 22mm 18mm; }\n" +
    "    :root { color-scheme: light; }\n" +
    "    body { max-width: 860px; margin: 0 auto; color: #35332f; background: #fff; font-family: Georgia, \"Songti SC\", \"STSong\", serif; font-size: 17px; line-height: 1.85; }\n" +
    "    h1, h2, h3, h4 { color: #292825; font-family: Georgia, \"Songti SC\", \"STSong\", serif; font-weight: 500; line-height: 1.25; }\n" +
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
    "  <main class=\"reader-content\">" + normalizeExportLinks(body) + "</main>\n" +
    "</body>\n" +
    "</html>\n";
}

export type HtmlExportDocument = {
  title: string;
  body: string;
};

export function buildBatchHtmlExport(title: string, documents: HtmlExportDocument[]): string {
  const index = documents.map((document, index) => (
    `<li><a href="#moyang-document-${index}">${escapeHtml(document.title)}</a></li>`
  )).join("");
  const content = [
    `<nav class="batch-index"><strong>文档目录</strong><ol>${index}</ol></nav>`,
    ...documents.map((document, index) => (
      `<section id="moyang-document-${index}" class="batch-document"><h1>${escapeHtml(document.title)}</h1>${document.body}</section>`
    )),
  ].join("\n");

  return buildHtmlExport(title, content);
}
