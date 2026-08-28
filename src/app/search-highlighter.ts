export const SEARCH_HIGHLIGHT_NAME = "moyang-search-hit";
export const ACTIVE_SEARCH_HIGHLIGHT_NAME = "moyang-search-hit-active";

const SEARCH_MARK_SELECTOR = `mark.${SEARCH_HIGHLIGHT_NAME}`;
const SHOW_TEXT = 4;

type HighlightRegistryLike = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => boolean;
};

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

export type SearchHighlightEnvironment = {
  css?: {
    highlights?: HighlightRegistryLike;
  };
  Highlight?: HighlightConstructorLike;
};

export type SearchHighlightStrategy = "custom" | "dom";

type MutableSearchHit = {
  range: Range;
  scrollTarget: Element | null;
  mark?: HTMLElement;
};

export type SearchHighlightController = {
  readonly strategy: SearchHighlightStrategy;
  update: (query: string) => number;
  setActive: (index: number) => Element | null;
  clear: () => void;
  dispose: () => void;
};

function resolveEnvironment(environment: SearchHighlightEnvironment): {
  registry: HighlightRegistryLike | null;
  Highlight: HighlightConstructorLike | null;
} {
  const runtime = globalThis as unknown as {
    CSS?: { highlights?: HighlightRegistryLike };
    Highlight?: HighlightConstructorLike;
  };

  return {
    registry: environment.css?.highlights ?? runtime.CSS?.highlights ?? null,
    Highlight: environment.Highlight ?? runtime.Highlight ?? null,
  };
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isSearchableTextNode(node: Text, root: HTMLElement): boolean {
  let parent = node.parentElement;
  while (parent && parent !== root) {
    if (
      parent.tagName === "SCRIPT" ||
      parent.tagName === "STYLE" ||
      parent.tagName === "NOSCRIPT" ||
      parent.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    parent = parent.parentElement;
  }
  return true;
}

export function collectSearchTextNodes(root: HTMLElement): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_TEXT);
  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    if (isSearchableTextNode(textNode, root)) textNodes.push(textNode);
    currentNode = walker.nextNode();
  }
  return textNodes;
}

export function findSearchHits(textNodes: readonly Text[], query: string): MutableSearchHit[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return [];

  const hits: MutableSearchHit[] = [];
  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    const lowerValue = value.toLowerCase();
    let cursor = 0;
    while (true) {
      const position = lowerValue.indexOf(normalizedQuery, cursor);
      if (position < 0) break;

      const range = textNode.ownerDocument.createRange();
      range.setStart(textNode, position);
      range.setEnd(textNode, position + normalizedQuery.length);
      hits.push({ range, scrollTarget: textNode.parentElement });
      cursor = position + normalizedQuery.length;
    }
  }
  return hits;
}

function clearDomSearchMarks(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(SEARCH_MARK_SELECTOR));
  if (marks.length === 0) return;

  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    mark.remove();
  }
  root.normalize();
}

function renderDomSearchMarks(hits: MutableSearchHit[], document: Document): void {
  for (const hit of [...hits].reverse()) {
    const mark = document.createElement("mark");
    mark.className = SEARCH_HIGHLIGHT_NAME;
    hit.range.cloneRange().surroundContents(mark);
    hit.mark = mark;
  }
}

function deleteCustomHighlights(registry: HighlightRegistryLike | null): void {
  registry?.delete(SEARCH_HIGHLIGHT_NAME);
  registry?.delete(ACTIVE_SEARCH_HIGHLIGHT_NAME);
}

function setCustomHighlight(
  registry: HighlightRegistryLike,
  Highlight: HighlightConstructorLike,
  name: string,
  ranges: readonly Range[],
): void {
  registry.delete(name);
  if (ranges.length > 0) registry.set(name, new Highlight(...ranges));
}

export function createSearchHighlightController(
  root: HTMLElement,
  environment: SearchHighlightEnvironment = {},
): SearchHighlightController {
  const resolved = resolveEnvironment(environment);
  let strategy: SearchHighlightStrategy = resolved.registry && resolved.Highlight ? "custom" : "dom";
  let cachedTextNodes: Text[] | null = null;
  let hits: MutableSearchHit[] = [];

  const clear = () => {
    deleteCustomHighlights(resolved.registry);
    if (strategy === "dom") clearDomSearchMarks(root);
    hits = [];
  };

  const update = (query: string): number => {
    clear();
    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) return 0;

    let textNodes =
      strategy === "custom" ? (cachedTextNodes ??= collectSearchTextNodes(root)) : collectSearchTextNodes(root);
    let nextHits = findSearchHits(textNodes, normalizedQuery);

    if (strategy === "custom" && resolved.registry && resolved.Highlight) {
      try {
        setCustomHighlight(
          resolved.registry,
          resolved.Highlight,
          SEARCH_HIGHLIGHT_NAME,
          nextHits.map((hit) => hit.range),
        );
        hits = nextHits;
        return hits.length;
      } catch {
        strategy = "dom";
        cachedTextNodes = null;
        deleteCustomHighlights(resolved.registry);
        textNodes = collectSearchTextNodes(root);
        nextHits = findSearchHits(textNodes, normalizedQuery);
      }
    }

    renderDomSearchMarks(nextHits, root.ownerDocument);
    hits = nextHits;
    return hits.length;
  };

  const setActive = (index: number): Element | null => {
    if (hits.length === 0) {
      resolved.registry?.delete(ACTIVE_SEARCH_HIGHLIGHT_NAME);
      return null;
    }

    const nextIndex = Math.min(Math.max(index, 0), hits.length - 1);
    const hit = hits[nextIndex];
    if (strategy === "custom" && resolved.registry && resolved.Highlight) {
      try {
        setCustomHighlight(resolved.registry, resolved.Highlight, ACTIVE_SEARCH_HIGHLIGHT_NAME, [hit.range]);
      } catch {
        // The base custom highlight remains useful even if the active range cannot be registered.
      }
      return hit.scrollTarget;
    }

    hits.forEach((currentHit, hitIndex) => currentHit.mark?.classList.toggle("active", hitIndex === nextIndex));
    return hit.mark ?? hit.scrollTarget;
  };

  return {
    get strategy() {
      return strategy;
    },
    update,
    setActive,
    clear,
    dispose: () => {
      clear();
      cachedTextNodes = null;
    },
  };
}
