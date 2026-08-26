import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { DraftRecoveryNotice } from "./DraftRecoveryNotice";

describe("DraftRecoveryNotice", () => {
  it("offers a non-destructive later action alongside recovery and discard", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onRecover = vi.fn();
    const onLater = vi.fn();
    const onDiscard = vi.fn();

    act(() => {
      root.render(
        <DraftRecoveryNotice
          snapshot={{ path: "C:/Notes/note.md", draft: "draft", baseSource: "source", savedAt: 1_000 }}
          onRecover={onRecover}
          onLater={onLater}
          onDiscard={onDiscard}
        />,
      );
    });

    const laterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "稍后处理",
    );
    expect(laterButton).toBeTruthy();
    act(() => laterButton?.click());
    expect(onLater).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
