import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ExternalOverwriteDialog } from "./ExternalOverwriteDialog";

describe("ExternalOverwriteDialog", () => {
  it("focuses cancel and supports Escape cancellation", () => {
    const previousFocus = document.createElement("button");
    document.body.appendChild(previousFocus);
    previousFocus.focus();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ExternalOverwriteDialog onCancel={onCancel} onConfirm={onConfirm} />);
    });

    expect(document.activeElement).toBe(container.querySelector('[data-testid="external-overwrite-cancel"]'));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledOnce();

    act(() => root.unmount());
    expect(document.activeElement).toBe(previousFocus);
    container.remove();
    previousFocus.remove();
  });

  it("calls the explicit overwrite action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ExternalOverwriteDialog onCancel={onCancel} onConfirm={onConfirm} />);
    });
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="external-overwrite-confirm"]')?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("distinguishes the disk file and in-window edits in English", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <ExternalOverwriteDialog locale="en-US" fileName="chapter.md" onCancel={vi.fn()} onConfirm={vi.fn()} />,
      );
    });

    expect(container.textContent).toContain("chapter.md");
    expect(container.textContent).toContain("disk version changed externally");
    expect(container.textContent).toContain("edits are still in this window");
    expect(container.querySelector('[data-testid="external-overwrite-confirm"]')?.textContent).toBe(
      "Overwrite and save",
    );

    act(() => root.unmount());
    container.remove();
  });
});
