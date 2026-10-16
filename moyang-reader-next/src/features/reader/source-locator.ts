import type { SourceLocation } from "../../shared/bookroom-types";

const selector = "p,h1,h2,h3,h4,h5,h6,li,pre,td,blockquote";
export function sourceBlocks(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((element) => !element.querySelector(selector));
}
type Status = "found" | "moved" | "ambiguous" | "missing";
const normalized = (value: string) => value.replace(/\s+/g, " ").trim();

/** Compare whitespace while retaining the original UTF-16 character offsets. */
function normalizedText(text: string) {
  let value = "";
  let whitespace = true;
  const offsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) {
      if (!whitespace) {
        value += " ";
        offsets.push(i);
        whitespace = true;
      }
    } else {
      value += text[i];
      offsets.push(i);
      whitespace = false;
    }
  }
  return { value: value.trimEnd(), offsets };
}
export function locateText(
  text: string,
  location: SourceLocation,
  unchanged: boolean,
): { from?: number; to?: number; status: Status } {
  const quote = normalized(location.quote ?? "");
  const offset = location.offset;
  if (unchanged && offset !== undefined && offset >= 0 && offset <= text.length) {
    const to = location.endOffset ?? offset + (location.quote?.length ?? 0);
    if (!quote || normalized(text.slice(offset, to)) === quote)
      return { from: offset, to: Math.min(text.length, to), status: "found" };
  }
  if (!quote) return { status: "missing" };
  const haystack = normalizedText(text);
  const matches: Array<{ from: number; to: number }> = [];
  for (let at = haystack.value.indexOf(quote); at >= 0; at = haystack.value.indexOf(quote, at + 1)) {
    matches.push({ from: haystack.offsets[at], to: haystack.offsets[at + quote.length - 1] + 1 });
  }
  if (unchanged && offset !== undefined) {
    const exact = matches.find((match) => match.from >= offset && /^\s*$/.test(text.slice(offset, match.from)));
    if (exact) return { ...exact, status: "found" };
  }
  return matches.length === 1
    ? { ...matches[0], status: unchanged ? "found" : "moved" }
    : { status: matches.length > 1 ? "ambiguous" : "missing" };
}

function textMap(root: ParentNode) {
  const blocks = sourceBlocks(root);
  const segments: Array<{ node: Text; from: number; to: number; element: HTMLElement }> = [];
  const starts: number[] = [];
  let text = "";
  for (const element of blocks) {
    if (starts.length) text += "\n\n";
    starts.push(text.length);
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const from = text.length;
      text += node.textContent ?? "";
      segments.push({ node: node as Text, from, to: text.length, element });
    }
  }
  return { blocks, starts, segments, text };
}
export function selectionSourceLocation(root: ParentNode, selection: Selection | null): Partial<SourceLocation> | null {
  if (
    !selection?.rangeCount ||
    selection.isCollapsed ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode)
  )
    return null;
  const range = selection.getRangeAt(0);
  const map = textMap(root);
  const point = (node: Node, offset: number) => {
    const segment = map.segments.find((part) => part.node === node);
    if (segment) return segment.from + offset;
    const before = map.segments.find((part) => {
      const probe = range.cloneRange();
      probe.selectNodeContents(part.node);
      probe.collapse(true);
      const boundary = range.cloneRange();
      boundary.setStart(node, offset);
      boundary.collapse(true);
      return probe.compareBoundaryPoints(Range.START_TO_START, boundary) >= 0;
    });
    return before?.from ?? map.text.length;
  };
  const from = point(range.startContainer, range.startOffset),
    to = point(range.endContainer, range.endOffset);
  return {
    offset: from,
    endOffset: to,
    quote: map.text.slice(from, to),
    paragraph: map.starts.filter((start) => start <= from).length,
  };
}
export function locateSource(
  root: ParentNode,
  location: SourceLocation,
  unchanged: boolean,
): { element?: HTMLElement; range?: Range; status: Status } {
  const map = textMap(root);
  const original = location.paragraph ? map.blocks[location.paragraph - 1] : undefined;
  let found = locateText(map.text, location, unchanged);
  if (found.status === "ambiguous" && unchanged && original && location.offset === undefined) {
    const local = locateText(original.textContent ?? "", location, true);
    if (local.from !== undefined)
      found = {
        ...local,
        from: map.starts[location.paragraph! - 1] + local.from,
        to: map.starts[location.paragraph! - 1] + local.to!,
      };
  }
  if (found.from === undefined) {
    if (unchanged && original && !location.quote) return { element: original, status: "found" };
    return { status: found.status };
  }
  const from = found.from,
    to = found.to ?? from;
  const start = map.segments.find((part) => part.to > from);
  const end = [...map.segments].reverse().find((part) => part.from < Math.max(to, from + 1));
  if (!start || !end) return { status: "missing" };
  const range = start.node.ownerDocument.createRange();
  range.setStart(start.node, Math.max(0, from - start.from));
  range.setEnd(end.node, Math.min(end.node.length, Math.max(0, to - end.from)));
  return { element: start.element, range, status: found.status };
}

export function scrollToSource(element: HTMLElement, range?: Range) {
  element.dataset.sourceTarget = "true";
  const container = element.closest<HTMLElement>(".content-area");
  const rect = range?.getBoundingClientRect?.();
  if (container && rect && (rect.height || rect.width)) {
    container.scrollTop += rect.top - container.getBoundingClientRect().top - container.clientHeight / 2;
  } else element.scrollIntoView({ block: "center" });
  if (range && !range.collapsed) {
    const selection = element.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}
