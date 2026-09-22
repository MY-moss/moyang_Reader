import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ContextPanelTab } from "../types";
import { ContextPanel } from "./ContextPanel";

function ContextPanelHarness({ initialTab = "outline" }: { initialTab?: ContextPanelTab }) {
  const [activeTab, setActiveTab] = useState<ContextPanelTab>(initialTab);

  return (
    <ContextPanel
      documentState={null}
      backlinks={[]}
      outgoing={[]}
      bookmarks={[]}
      annotations={[]}
      annotationLocations={[]}
      annotationEnabled={true}
      currentAnnotationPath={null}
      knownPaths={[]}
      canCreateNote={false}
      selectedTag={null}
      toc={[]}
      activeHeadingId={null}
      currentHeading={null}
      readingProgress={0}
      mode="rendered"
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={vi.fn()}
      onOpenFile={vi.fn()}
      onOpenBookmark={vi.fn()}
      onDeleteBookmark={vi.fn()}
      onOpenAnnotation={vi.fn()}
      onDeleteAnnotation={vi.fn()}
      onCreateNote={vi.fn()}
      onOpenGraph={vi.fn()}
      onSelectTag={vi.fn()}
      onScrollToTop={vi.fn()}
      onScrollToBottom={vi.fn()}
      onNavigateHeading={vi.fn()}
    />
  );
}

function mountContextPanel(initialTab?: ContextPanelTab) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ContextPanelHarness initialTab={initialTab} />);
  });

  return { container, root };
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
}

describe("ContextPanel", () => {
  it("exposes one roving tab stop and explicit tabpanel relationships", () => {
    const { container, root } = mountContextPanel();
    const tabList = container.querySelector('[role="tablist"]');
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]');

    expect(tabList?.getAttribute("aria-label")).toBe("文档上下文视图");
    expect(tabList?.getAttribute("aria-orientation")).toBe("horizontal");
    expect(Array.from(tabs).map((tab) => tab.id)).toEqual([
      "context-panel-tab-outline",
      "context-panel-tab-bookmarks",
      "context-panel-tab-backlinks",
      "context-panel-tab-properties",
      "context-panel-tab-annotations",
    ]);
    expect(
      Array.from(container.querySelectorAll(".context-tab-group-label")).map((label) => label.textContent),
    ).toEqual(["导航", "理解"]);
    expect(Array.from(tabs).map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    expect(Array.from(tabs).map((tab) => tab.getAttribute("aria-controls"))).toEqual(
      Array.from({ length: 5 }, () => "context-panel-panel"),
    );
    expect(panel?.id).toBe("context-panel-panel");
    expect(panel?.getAttribute("aria-labelledby")).toBe("context-panel-tab-outline");

    cleanup(container, root);
  });

  it("moves selection and focus with horizontal arrows and Home/End", async () => {
    const { container, root } = mountContextPanel();
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    const panel = container.querySelector<HTMLElement>('[role="tabpanel"]');

    tabs[0]?.focus();
    await act(async () => {
      tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(tabs[1]);
    expect(Array.from(tabs).map((tab) => tab.tabIndex)).toEqual([-1, 0, -1, -1, -1]);
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(panel?.getAttribute("aria-labelledby")).toBe("context-panel-tab-bookmarks");

    await act(async () => {
      tabs[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(tabs[0]);

    await act(async () => {
      tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(tabs[4]);
    expect(tabs[4]?.getAttribute("aria-selected")).toBe("true");
    expect(panel?.getAttribute("aria-labelledby")).toBe("context-panel-tab-annotations");

    await act(async () => {
      tabs[4]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(tabs[0]);
    expect(Array.from(tabs).map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    cleanup(container, root);
  });

  it("wraps horizontal navigation without consuming modified shortcuts", async () => {
    const { container, root } = mountContextPanel("annotations");
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    tabs[4]?.focus();
    await act(async () => {
      tabs[4]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(tabs[0]);

    await act(async () => {
      tabs[0]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(Array.from(tabs).map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1]);

    cleanup(container, root);
  });
});
