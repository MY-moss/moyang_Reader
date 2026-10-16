import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import type { Nodes } from "mdast";
import type { ExtensionDocumentAnalysis, ExtensionLocation } from "../../shared/extension-types";

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ["yaml", "toml"]);
function plain(node: Nodes): string {
  if ("value" in node) return node.value;
  if ("alt" in node) return node.alt ?? "";
  return "children" in node ? node.children.map((child) => plain(child as Nodes)).join("") : "";
}
function location(node: Nodes): ExtensionLocation {
  return { line: node.position!.start.line, from: node.position!.start.offset!, to: node.position!.end.offset! };
}
/** Parsed on demand inside the extension worker, never while typing. */
export function analyzeDocument(text: string): ExtensionDocumentAnalysis {
  const tree = parser.parse(text);
  const result: ExtensionDocumentAnalysis = { headings: [], tasks: [], links: [], tables: [] };
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    if (!definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
  });
  visit(tree, (node) => {
    if (node.type === "heading") result.headings.push({ ...location(node), depth: node.depth, text: plain(node) });
    if (node.type === "listItem" && typeof node.checked === "boolean") {
      const paragraph = node.children.find((child) => child.type === "paragraph");
      result.tasks.push({
        ...location(paragraph ?? node),
        checked: node.checked,
        text: paragraph ? plain(paragraph) : "",
      });
    }
    if (node.type === "link" || node.type === "image")
      result.links.push({ ...location(node), text: plain(node), url: node.url, image: node.type === "image" });
    if (node.type === "linkReference" || node.type === "imageReference")
      result.links.push({
        ...location(node),
        text: plain(node),
        url: definitions.get(node.identifier) ?? "",
        image: node.type === "imageReference",
      });
    if (node.type === "table")
      result.tables.push({ ...location(node), rows: node.children.map((row) => row.children.map(plain)) });
  });
  return result;
}
