import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { RecentFile } from "../types";
import { Tabs } from "./Tabs";

const tabs: RecentFile[] = [
  { path: "C:/one.md", name: "one.md" },
  { path: "C:/two.md", name: "two.md" },
];

function mountTabs() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onClose = vi.fn();
  const onCloseMany = vi.fn();
  const onReorder = vi.fn();
  const onSelect = vi.fn();

  act(() => {
    root.render(
      <Tabs
        tabs={tabs}
        activePath="C:/one.md"
        externallyModified={false}
        onShowExternalChange={vi.fn()}
        onSelect={onSelect}
        onClose={onClose}
        onCloseMany={onCloseMany}
        onReorder={onReorder}
      />,
    );
  });

  return { container, root, onClose, onCloseMany, onReorder, onSelect };
}

function withDataTransfer(event: Event, dataTransfer: DataTransfer) {
  Object.defineProperty(event, "dataTransfer", { configurable: true, value: dataTransfer });
  return event;
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
}

describe("Tabs", () => {
  it("keeps one document tab in the tab order and moves it with arrow keys", async () => {
    const { container, root, onSelect } = mountTabs();
    const labels = container.querySelectorAll<HTMLButtonElement>(".tab-label");

    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([0, -1]);
    labels[0]?.focus();

    await act(async () => {
      labels[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });

    expect(onSelect).toHaveBeenCalledWith("C:/two.md");
    expect(document.activeElement).toBe(labels[1]);
    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([-1, 0]);

    await act(async () => {
      labels[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });

    expect(onSelect).toHaveBeenLastCalledWith("C:/one.md");
    expect(document.activeElement).toBe(labels[0]);
    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([0, -1]);

    await act(async () => {
      labels[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(labels[1]);
    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([-1, 0]);

    await act(async () => {
      labels[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(labels[0]);
    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([0, -1]);
    cleanup(container, root);
  });

  it("leaves modified arrow shortcuts available to the application", () => {
    const { container, root, onSelect } = mountTabs();
    const labels = container.querySelectorAll<HTMLButtonElement>(".tab-label");
    labels[1]?.focus();

    act(() => {
      labels[1]?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(labels[1]);
    expect(Array.from(labels).map((label) => label.tabIndex)).toEqual([0, -1]);
    cleanup(container, root);
  });

  it("closes a tab on middle click", () => {
    const { container, root, onClose } = mountTabs();
    const tab = container.querySelector<HTMLElement>(".tab-item");

    act(() => {
      tab?.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledWith("C:/one.md");
    cleanup(container, root);
  });

  it("hands native drag and drop ordering to the parent", () => {
    const { container, root, onReorder } = mountTabs();
    const items = container.querySelectorAll<HTMLElement>(".tab-item");
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(() => "C:/one.md"),
    } as unknown as DataTransfer;

    expect(items[0]?.draggable).toBe(true);
    act(() => {
      items[0]?.dispatchEvent(withDataTransfer(new Event("dragstart", { bubbles: true }), dataTransfer));
    });
    act(() => {
      items[1]?.dispatchEvent(withDataTransfer(new Event("dragover", { bubbles: true }), dataTransfer));
    });
    act(() => {
      items[1]?.dispatchEvent(withDataTransfer(new Event("drop", { bubbles: true }), dataTransfer));
    });

    expect(dataTransfer.setData).toHaveBeenCalledWith("text/plain", "C:/one.md");
    expect(onReorder).toHaveBeenCalledWith("C:/one.md", "C:/two.md");
    cleanup(container, root);
  });

  it("offers batch tab management from the context menu", () => {
    const { container, root, onCloseMany } = mountTabs();
    const tab = container.querySelector<HTMLElement>(".tab-item");

    act(() => {
      tab?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const closeRight = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "关闭右侧标签",
    );
    expect(closeRight).toBeTruthy();

    act(() => closeRight?.click());
    expect(onCloseMany).toHaveBeenCalledWith(["C:/two.md"]);
    cleanup(container, root);
  });
});
