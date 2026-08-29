import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { DraftRecoveryNotice } from "./DraftRecoveryNotice";

describe("DraftRecoveryNotice", () => {
  it("offers a visible diff action alongside later and discard", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPreview = vi.fn();
    const onLater = vi.fn();
    const onDiscard = vi.fn();

    act(() => {
      root.render(
        <DraftRecoveryNotice
          snapshot={{ path: "C:/Notes/note.md", draft: "draft", baseSource: "source", savedAt: 1_000 }}
          currentSource="source"
          onPreview={onPreview}
          onLater={onLater}
          onDiscard={onDiscard}
        />,
      );
    });

    const laterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "稍后处理",
    );
    expect(laterButton).toBeTruthy();
    const previewButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "查看差异",
    );
    expect(previewButton).toBeTruthy();
    act(() => previewButton?.click());
    expect(onPreview).toHaveBeenCalledOnce();
    act(() => laterButton?.click());
    expect(onLater).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
