import type { SourceLocation } from "../../shared/bookroom-types";

const selector = "p,h1,h2,h3,h4,h5,h6,li,pre,td,blockquote";
export function sourceBlocks(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((element) => !element.querySelector(selector));
}
const normalized = (value: string) => value.replace(/\s+/g, " ").trim();
export function locateSource(
  root: ParentNode,
  location: SourceLocation,
  unchanged: boolean,
): { element?: HTMLElement; status: "found" | "moved" | "ambiguous" | "missing" } {
  const blocks = sourceBlocks(root);
  const quote = normalized(location.quote ?? "");
  const original = location.paragraph ? blocks[location.paragraph - 1] : undefined;
  if (unchanged && original && (!quote || normalized(original.textContent ?? "").includes(quote)))
    return { element: original, status: "found" };
  const matches = quote ? blocks.filter((element) => normalized(element.textContent ?? "").includes(quote)) : [];
  if (matches.length === 1) return { element: matches[0], status: unchanged ? "found" : "moved" };
  return { status: matches.length > 1 ? "ambiguous" : "missing" };
}
