import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { PreviousVersionNotice } from "./PreviousVersionNotice";

describe("PreviousVersionNotice", () => {
  it("explains the previous saved version before offering recovery", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPreview = vi.fn();
    const onDismiss = vi.fn();

    act(() => {
      root.render(
        <PreviousVersionNotice
          path="C:/Notes/note.md"
          currentSource="# Note\n\n当前内容"
          previousSource="# Note\n\n上一版内容"
          onPreview={onPreview}
          onDismiss={onDismiss}
        />,
      );
    });

    expect(container.textContent).toContain("上一保存版本");
    expect(container.textContent).toContain("不会自动覆盖当前文件");
    const previewButton = container.querySelector<HTMLButtonElement>('[data-testid="previous-version-preview"]');
    expect(previewButton?.getAttribute("aria-label")).toContain("上一保存版本");

    act(() => previewButton?.click());
    expect(onPreview).toHaveBeenCalledOnce();
    const dismissButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "忽略",
    );
    act(() => dismissButton?.click());
    expect(onDismiss).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
