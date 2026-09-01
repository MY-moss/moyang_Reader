import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { EditorInsertPopover } from "./EditorInsertPopover";

function renderPopover(overrides: Record<string, unknown> = {}): {
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const props = {
    open: true,
    kind: "link" as const,
    onCancel: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  } as unknown as Parameters<typeof EditorInsertPopover>[0];
  act(() => {
    root.render(<EditorInsertPopover {...props} />);
  });
  return { container, root };
}

function cleanup(container: HTMLDivElement, root: ReturnType<typeof createRoot>): void {
  act(() => root.unmount());
  container.remove();
  document.body.querySelector(".editor-insert-popover")?.remove();
}

describe("EditorInsertPopover", () => {
  it("uses roving tab focus and ArrowRight to move between insert kinds", () => {
    const { container, root } = renderPopover();
    const tabs = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    expect(tabs()).toHaveLength(4);
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(tabs()[0]?.getAttribute("aria-selected")).toBe("true");

    act(() => {
      tabs()[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    });

    expect(tabs()[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs()[1]);
    cleanup(container, root);
  });

  it("prevents the outside pointer default before restoring editor focus", () => {
    const onCancel = vi.fn();
    const { container, root } = renderPopover({ onCancel });
    const event = new Event("pointerdown", { bubbles: true, cancelable: true });

    act(() => {
      document.body.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledOnce();
    cleanup(container, root);
  });

  it("fills the image source returned by the native image picker", async () => {
    const onPickImage = vi.fn().mockResolvedValue("images/cover.png");
    const { container, root } = renderPopover({
      kind: "image",
      onPickImage,
    });

    const browse = document.body.querySelector<HTMLButtonElement>('button[aria-label="浏览图片"]');
    expect(browse).toBeTruthy();

    await act(async () => {
      browse?.click();
    });

    const input = document.body.querySelector<HTMLInputElement>(".editor-insert-image-source-row input");
    expect(onPickImage).toHaveBeenCalledOnce();
    expect(input?.value).toBe("images/cover.png");
    cleanup(container, root);
  });
});
