import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";

const slash = (path: string) => path.replaceAll("\\", "/");
const key = (path: string) => slash(path).toLowerCase();
const parent = (path: string) => slash(path).split("/").slice(0, -1).join("/");
const extensionless = (path: string) => path.replace(/\.(md|markdown|mdown|mkd)$/i, "");
function joined(directory: string, target: string): string {
  const parts: string[] = [];
  for (const part of `${directory}/${target}`.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}
function relative(directory: string, target: string): string {
  const from = directory.split("/").filter(Boolean);
  const to = target.split("/").filter(Boolean);
  while (from.length && to.length && key(from[0]) === key(to[0])) {
    from.shift();
    to.shift();
  }
  return [...from.map(() => ".."), ...to].join("/");
}
export function renamedRelativePath(path: string, from: string, to: string): string {
  const p = slash(path),
    old = slash(from);
  return key(p) === key(old) || key(p).startsWith(key(old) + "/") ? slash(to) + p.slice(old.length) : p;
}
export type RenameLinkResult = { source: string; changed: number; ambiguous: string[] };
/** Change only destination spans, leaving Markdown, aliases, anchors and code byte-for-byte intact. */
export function rewriteRenamedLinks(
  source: string,
  documentPath: string,
  files: string[],
  from: string,
  to: string,
): RenameLinkResult {
  documentPath = slash(documentPath);
  files = files.map(slash);
  const movedDocument = renamedRelativePath(documentPath, from, to);
  const edits: Array<{ start: number; end: number; value: string }> = [];
  const protectedRanges: Array<[number, number]> = [];
  const ambiguous: string[] = [];
  const rewrite = (raw: string, wiki: boolean): string => {
    const split = raw.search(/[?#]/);
    const pathPart = split < 0 ? raw : raw.slice(0, split);
    const suffix = split < 0 ? "" : raw.slice(split);
    if (!pathPart || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(pathPart)) return raw;
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathPart.replace(/\\([ ()])/g, "$1"));
    } catch {
      return raw;
    }
    const matches = (candidate: string) =>
      files.filter(
        (file) =>
          key(file) === key(candidate) ||
          (wiki && !/\.[^/]+$/.test(decoded) && key(extensionless(file)) === key(candidate)),
      );
    let candidates = decoded.startsWith("/")
      ? matches(decoded.slice(1))
      : matches(joined(parent(documentPath), decoded));
    if (wiki && !candidates.length) candidates = matches(decoded);
    if (wiki && !candidates.length)
      candidates = files.filter(
        (file) =>
          key(extensionless(file)).endsWith("/" + key(extensionless(decoded))) ||
          key(extensionless(file)) === key(extensionless(decoded)),
      );
    if (candidates.length !== 1) {
      if (candidates.some((file) => renamedRelativePath(file, from, to) !== file)) ambiguous.push(raw);
      return raw;
    }
    const target = renamedRelativePath(candidates[0], from, to);
    if (target === candidates[0] && movedDocument === documentPath) return raw;
    let next = wiki || decoded.startsWith("/") ? target : relative(parent(movedDocument), target);
    if (wiki && !/\.(md|markdown|mdown|mkd)$/i.test(pathPart)) next = extensionless(next);
    if (decoded.startsWith("/")) next = "/" + next;
    if (!wiki && pathPart.startsWith("./") && !next.startsWith(".")) next = "./" + next;
    if (!wiki)
      next = next
        .replaceAll("%", "%25")
        .replaceAll(" ", "%20")
        .replaceAll("(", "%28")
        .replaceAll(")", "%29")
        .replaceAll("#", "%23");
    return next + suffix;
  };
  const tree = unified().use(remarkParse).parse(source);
  visit(tree, (node) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    if (["code", "inlineCode", "html"].includes(node.type)) {
      protectedRanges.push([start, end]);
      return;
    }
    if (!["link", "image", "definition"].includes(node.type)) return;
    const raw = source.slice(start, end);
    let cursor: number;
    if (node.type === "definition") {
      const match = /^\s*\[[^\]]+\]:\s*/.exec(raw);
      if (!match) return;
      cursor = match[0].length;
    } else {
      const match = /\]\(\s*/.exec(raw);
      if (!match) return;
      cursor = match.index + match[0].length;
    }
    const angle = raw[cursor] === "<";
    if (angle) cursor += 1;
    const begin = cursor;
    let depth = 0;
    while (cursor < raw.length) {
      const ch = raw[cursor];
      if (ch === "\\") {
        cursor += 2;
        continue;
      }
      if (angle ? ch === ">" : (ch === ")" && depth === 0) || /\s/.test(ch)) break;
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      cursor += 1;
    }
    const old = raw.slice(begin, cursor);
    const value = rewrite(old, false);
    if (old !== value) edits.push({ start: start + begin, end: start + cursor, value });
  });
  for (const match of source.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const start = match.index!;
    if (
      protectedRanges.some(([a, b]) => start >= a && start < b) ||
      (source.slice(0, start).match(/\\+$/)?.[0].length ?? 0) % 2
    )
      continue;
    const old = match[1].split("|", 1)[0];
    const value = rewrite(old, true);
    if (old !== value) edits.push({ start: start + 2, end: start + 2 + old.length, value });
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = result.slice(0, edit.start) + edit.value + result.slice(edit.end);
  return { source: result, changed: edits.length, ambiguous: [...new Set(ambiguous)] };
}
