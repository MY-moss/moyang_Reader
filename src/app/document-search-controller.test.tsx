import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDocumentSearchController } from "./document-search-controller";

const renderedHtml = "<p>needle one</p><p>needle two</p>";

function SearchHarness({ restoreFocusTarget }: { restoreFocusTarget: (target: HTMLElement | null) => boolean }) {
  const articleRef = useRef<HTMLElement>(null);
  const {
    searchButtonRef,
    searchOpen,
    searchQuery,
    searchResultCount,
    searchResultIndex,
    setSearchQuery,
    closeSearch,
    moveResult,
    openSearch,
  } = useDocumentSearchController({
    articleRef,
    mode: "rendered",
    renderedHtml,
    progressiveReaderReady: true,
    revealProgressiveReader: vi.fn(),
    restoreFocusTarget,
  });

  return (
    <div>
      <button ref={searchButtonRef} type="button" data-search-trigger onClick={() => openSearch()}>
        打开查找
      </button>
      <button type="button" data-set-query onClick={() => setSearchQuery("needle")}>
        设置查找
      </button>
      <button type="button" data-next onClick={() => moveResult(1)}>
        下一个
      </button>
      {searchOpen && (
        <>
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
          <button type="button" data-close-search onClick={closeSearch}>
            关闭查找
          </button>
        </>
      )}
      <article
        ref={articleRef}
        data-search-result-count={searchResultCount}
        data-search-active-result={searchResultCount ? searchResultIndex + 1 : 0}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}

function renderHarness(restoreFocusTarget: (target: HTMLElement | null) => boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<SearchHarness restoreFocusTarget={restoreFocusTarget} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("document search controller", () => {
  it("restores the trigger focus when document search closes", () => {
    const restoreFocusTarget = vi.fn((target: HTMLElement | null) => {
      if (!target?.isConnected) return false;
      target.focus();
      return document.activeElement === target;
    });
    const { container, root } = renderHarness(restoreFocusTarget);
    const trigger = container.querySelector<HTMLButtonElement>("[data-search-trigger]")!;

    act(() => {
      trigger.focus();
      trigger.click();
    });
    act(() => container.querySelector<HTMLButtonElement>("[data-close-search]")?.click());

    expect(restoreFocusTarget).toHaveBeenCalledWith(trigger);
    expect(document.activeElement).toBe(trigger);

    act(() => root.unmount());
  });

  it("debounces matches and cycles the active result", async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const restoreFocusTarget = vi.fn(() => false);
    const { container, root } = renderHarness(restoreFocusTarget);

    act(() => container.querySelector<HTMLButtonElement>("[data-set-query]")?.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(160);
    });

    const article = container.querySelector("article")!;
    expect(article.getAttribute("data-search-result-count")).toBe("2");
    expect(article.getAttribute("data-search-active-result")).toBe("1");

    act(() => container.querySelector<HTMLButtonElement>("[data-next]")?.click());
    expect(article.getAttribute("data-search-active-result")).toBe("2");
    expect(scrollIntoView).toHaveBeenCalled();

    act(() => root.unmount());
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
