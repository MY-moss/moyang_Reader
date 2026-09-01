import { normalizeAnnotationText, type TextAnnotation } from "./annotations";
import { collectSearchTextNodes } from "./search-highlighter";

export const ANNOTATION_HIGHLIGHT_NAME = "moyang-annotation";

type HighlightRegistryLike = {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => boolean;
};

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

export type AnnotationHighlightEnvironment = {
  css?: {
    highlights?: HighlightRegistryLike;
  };
  Highlight?: HighlightConstructorLike;
};

export type AnnotationHighlightStrategy = "custom" | "dom";
export type AnnotationLocationStatus = "located" | "stale";

export type AnnotationLocation = {
  annotation: TextAnnotation;
  status: AnnotationLocationStatus;
  start: number;
  end: number;
  ranges: Range[];
  scrollTarget: Element | null;
};

export type AnnotationHighlightController = {
  readonly strategy: AnnotationHighlightStrategy;
  update: (annotations: readonly TextAnnotation[]) => AnnotationLocation[];
  scrollTo: (id: string) => boolean;
  clear: () => void;
  dispose: () => void;
};

type TextSpan = {
  node: Text;
  start: number;
  end: number;
};

type NormalizedTextMap = {
  text: string;
  rawStart: number[];
  rawEnd: number[];
};

type AnnotationTextIndex = NormalizedTextMap & {
  spans: TextSpan[];
};

const ANNOTATION_MARK_CLASS = "moyang-annotation-hit";
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

function resolveEnvironment(environment: AnnotationHighlightEnvironment): {
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

function blockAncestor(node: Text, root: HTMLElement): Element | null {
  let element = node.parentElement;
  while (element && element !== root) {
    if (BLOCK_TAGS.has(element.tagName)) return element;
    element = element.parentElement;
  }
  return null;
}

function normalizeWithMap(raw: string): NormalizedTextMap {
  const text: string[] = [];
  const rawStart: number[] = [];
  const rawEnd: number[] = [];
  let inWhitespace = false;

  for (let index = 0; index < raw.length; index += 1) {
    if (/\s/.test(raw[index] ?? "")) {
      if (text.length > 0 && !inWhitespace) {
        text.push(" ");
        rawStart.push(index);
        rawEnd.push(index + 1);
        inWhitespace = true;
      } else if (inWhitespace) {
        rawEnd[rawEnd.length - 1] = index + 1;
      }
      continue;
    }

    text.push(raw[index] ?? "");
    rawStart.push(index);
    rawEnd.push(index + 1);
    inWhitespace = false;
  }

  if (inWhitespace) {
    text.pop();
    rawStart.pop();
    rawEnd.pop();
  }

  return { text: text.join(""), rawStart, rawEnd };
}

export function buildAnnotationTextIndex(root: HTMLElement): AnnotationTextIndex {
  const textNodes = collectSearchTextNodes(root);
  const rawParts: string[] = [];
  const spans: TextSpan[] = [];
  let rawLength = 0;
  let previousBlock: Element | null = null;

  for (const node of textNodes) {
    const block = blockAncestor(node, root);
    if (rawLength > 0 && block && previousBlock && block !== previousBlock) {
      rawParts.push("\n");
      rawLength += 1;
    }

    const value = node.nodeValue ?? "";
    if (value) {
      spans.push({ node, start: rawLength, end: rawLength + value.length });
      rawParts.push(value);
      rawLength += value.length;
    }
    if (block) previousBlock = block;
  }

  const normalized = normalizeWithMap(rawParts.join(""));
  return { ...normalized, spans };
}

function contextMatches(text: string, position: number, quote: string, annotation: TextAnnotation): boolean {
  const prefix = normalizeAnnotationText(annotation.prefix);
  const suffix = normalizeAnnotationText(annotation.suffix);
  const before = text.slice(0, position).trimEnd();
  const after = text.slice(position + quote.length).trimStart();
  return (!prefix || before.endsWith(prefix)) && (!suffix || after.startsWith(suffix));
}

function locateAnnotation(
  index: AnnotationTextIndex,
  annotation: TextAnnotation,
): { start: number; end: number } | null {
  const quote = normalizeAnnotationText(annotation.quote);
  if (!quote) return null;

  const candidates: number[] = [];
  let cursor = 0;
  while (true) {
    const position = index.text.indexOf(quote, cursor);
    if (position < 0) break;
    candidates.push(position);
    cursor = position + Math.max(1, quote.length);
  }
  if (candidates.length === 0) return null;

  const contextual = candidates.filter((position) => contextMatches(index.text, position, quote, annotation));
  if ((annotation.prefix || annotation.suffix) && contextual.length === 0) return null;
  const pool = contextual.length > 0 ? contextual : candidates;
  const start = pool.reduce((best, current) =>
    Math.abs(current - annotation.start) < Math.abs(best - annotation.start) ? current : best,
  );
  return { start, end: start + quote.length };
}

function createRanges(index: AnnotationTextIndex, start: number, end: number): Range[] {
  if (start < 0 || end <= start || end > index.rawStart.length) return [];
  const rawStart = index.rawStart[start];
  const rawEnd = index.rawEnd[end - 1];
  if (rawStart === undefined || rawEnd === undefined || rawEnd <= rawStart) return [];

  return index.spans.flatMap((span) => {
    const rangeStart = Math.max(rawStart, span.start);
    const rangeEnd = Math.min(rawEnd, span.end);
    if (rangeEnd <= rangeStart) return [];

    const range = span.node.ownerDocument.createRange();
    range.setStart(span.node, rangeStart - span.start);
    range.setEnd(span.node, rangeEnd - span.start);
    return [range];
  });
}

function clearDomAnnotationMarks(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark.${ANNOTATION_MARK_CLASS}`));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    mark.remove();
  }
  if (marks.length > 0) root.normalize();
}

function deleteCustomHighlight(registry: HighlightRegistryLike | null): void {
  registry?.delete(ANNOTATION_HIGHLIGHT_NAME);
}

function setCustomHighlight(
  registry: HighlightRegistryLike,
  Highlight: HighlightConstructorLike,
  ranges: readonly Range[],
): void {
  registry.delete(ANNOTATION_HIGHLIGHT_NAME);
  if (ranges.length > 0) registry.set(ANNOTATION_HIGHLIGHT_NAME, new Highlight(...ranges));
}

function renderDomAnnotationMarks(locations: AnnotationLocation[], document: Document): void {
  for (const location of [...locations].reverse()) {
    for (const range of [...location.ranges].reverse()) {
      try {
        const mark = document.createElement("mark");
        mark.className = ANNOTATION_MARK_CLASS;
        range.cloneRange().surroundContents(mark);
        if (!location.scrollTarget) location.scrollTarget = mark;
      } catch {
        // A malformed or overlapping DOM range should not hide the readable text.
      }
    }
  }
}

export function createAnnotationHighlightController(
  root: HTMLElement,
  environment: AnnotationHighlightEnvironment = {},
): AnnotationHighlightController {
  const resolved = resolveEnvironment(environment);
  let strategy: AnnotationHighlightStrategy = resolved.registry && resolved.Highlight ? "custom" : "dom";
  let locations: AnnotationLocation[] = [];

  const clear = () => {
    deleteCustomHighlight(resolved.registry);
    clearDomAnnotationMarks(root);
    locations = [];
  };

  const update = (annotations: readonly TextAnnotation[]): AnnotationLocation[] => {
    clear();
    const index = buildAnnotationTextIndex(root);
    locations = annotations.map((annotation) => {
      const match = locateAnnotation(index, annotation);
      if (!match) {
        return {
          annotation,
          status: "stale",
          start: annotation.start,
          end: annotation.end,
          ranges: [],
          scrollTarget: null,
        };
      }

      const ranges = createRanges(index, match.start, match.end);
      return {
        annotation,
        status: ranges.length > 0 ? "located" : "stale",
        start: match.start,
        end: match.end,
        ranges,
        scrollTarget: ranges[0]?.startContainer.parentElement ?? null,
      };
    });

    if (strategy === "custom" && resolved.registry && resolved.Highlight) {
      try {
        setCustomHighlight(
          resolved.registry,
          resolved.Highlight,
          locations.flatMap((location) => location.ranges),
        );
        return locations;
      } catch {
        strategy = "dom";
        deleteCustomHighlight(resolved.registry);
      }
    }

    renderDomAnnotationMarks(
      locations.filter((location) => location.status === "located"),
      root.ownerDocument,
    );
    return locations;
  };

  return {
    get strategy() {
      return strategy;
    },
    update,
    scrollTo: (id: string) => {
      const location = locations.find((candidate) => candidate.annotation.id === id);
      if (!location || location.status !== "located") return false;
      const target = location.scrollTarget;
      if (!target) return false;
      try {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        target.scrollIntoView();
      }
      return true;
    },
    clear,
    dispose: () => {
      clear();
    },
  };
}
