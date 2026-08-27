export function decodeHeadingAnchor(anchor: string): string {
  try {
    return decodeURIComponent(anchor);
  } catch {
    return anchor;
  }
}

export function findHeadingInArticle(article: HTMLElement | null, anchor: string): HTMLElement | null {
  if (!article) return null;

  const id = decodeHeadingAnchor(anchor.replace(/^#/, ""));
  if (!id) return null;

  return Array.from(article.querySelectorAll<HTMLElement>("[id]")).find((element) => element.id === id) ?? null;
}

export function scrollHeadingInContainer(
  anchor: string,
  contentArea: HTMLElement | null,
  article: HTMLElement | null,
  behavior: ScrollBehavior = "smooth",
): boolean {
  const target = findHeadingInArticle(article, anchor);
  if (!target) return false;

  if (!contentArea) {
    target.scrollIntoView({ behavior, block: "start" });
    return true;
  }

  const areaRect = contentArea.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const maxScrollTop = Math.max(0, contentArea.scrollHeight - contentArea.clientHeight);
  const targetTop = contentArea.scrollTop + targetRect.top - areaRect.top - 24;

  contentArea.scrollTo({
    top: Math.min(maxScrollTop, Math.max(0, targetTop)),
    behavior,
  });
  return true;
}
