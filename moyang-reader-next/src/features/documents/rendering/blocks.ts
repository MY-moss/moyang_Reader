import type { Root as HastRoot } from "hast";
import { visit } from "unist-util-visit";

/** Assign only generated, namespaced IDs after HTML sanitization. Code is untouched. */
export function rehypeBlockIds() {
  return (tree: HastRoot) => {
    const used = new Set<string>();
    visit(tree, "element", (node) => {
      if (!["p", "li", "blockquote"].includes(node.tagName)) return;
      const last = node.children.at(-1);
      if (last?.type !== "text") return;
      const match = last.value.match(/(?:^|\s)\^([A-Za-z0-9_-]+)\s*$/);
      if (!match || used.has(match[1])) return;
      used.add(match[1]);
      last.value = last.value.slice(0, match.index).trimEnd();
      node.properties.id = `block-${match[1]}`;
    });
  };
}

export function normalizeBlockAnchor(anchor: string) {
  return anchor.startsWith("^") ? `block-${anchor.slice(1)}` : anchor;
}
