import { beforeEach, describe, expect, it, vi } from "vitest";
import { findHeadingInArticle, scrollHeadingInContainer } from "./heading-navigation";

describe("heading navigation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves encoded ids only inside the active article", () => {
    const article = document.createElement("article");
    article.innerHTML = '<h2 id="chapter-two">第二章</h2>';
    const outside = document.createElement("h2");
    outside.id = "outside";
    document.body.append(article, outside);

    expect(findHeadingInArticle(article, "chapter-two")).toBe(article.firstElementChild);
    expect(findHeadingInArticle(article, "chapter%2Dtwo")).toBe(article.firstElementChild);
    expect(findHeadingInArticle(article, "outside")).toBeNull();
  });

  it("scrolls the central content container instead of the window", () => {
    const contentArea = document.createElement("main");
    const article = document.createElement("article");
    const heading = document.createElement("h2");
    heading.id = "chapter-two";
    article.append(heading);
    contentArea.append(article);
    Object.defineProperties(contentArea, {
      clientHeight: { configurable: true, value: 500 },
      scrollHeight: { configurable: true, value: 2_000 },
      scrollTop: { configurable: true, value: 100 },
      scrollTo: { configurable: true, value: vi.fn() },
    });
    const scrollIntoView = vi.fn();
    Object.defineProperty(heading, "scrollIntoView", { configurable: true, value: scrollIntoView });
    vi.spyOn(contentArea, "getBoundingClientRect").mockReturnValue({ top: 40 } as DOMRect);
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 640 } as DOMRect);
    const scrollTo = vi.spyOn(contentArea, "scrollTo");

    expect(scrollHeadingInContainer("chapter-two", contentArea, article, "auto")).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 676, behavior: "auto" });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
