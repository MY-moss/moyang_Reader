
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
    "    p, ul, ol, blockquote, pre, table { margin: 0 0 20px; }\n" +
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
