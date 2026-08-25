import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ExternalChangeNotice } from "./ExternalChangeNotice";

describe("ExternalChangeNotice", () => {
  it("offers safe resolution choices and keeps dismiss separate", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onReload = vi.fn();
    const onOverwrite = vi.fn();
    const onSaveAs = vi.fn();
    const onDismiss = vi.fn();

    act(() => {
      root.render(
        <ExternalChangeNotice
          fileName="today.md"
          onReload={onReload}
          onOverwrite={onOverwrite}
          onSaveAs={onSaveAs}
          onDismiss={onDismiss}
        />,
      );
    });

    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    for (const [label, callback] of [
      ["重新载入", onReload],
      ["覆盖保存", onOverwrite],
      ["另存为", onSaveAs],
      ["稍后处理", onDismiss],
    ] as const) {
      const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
      expect(button).toBeTruthy();
      act(() => button?.click());
      expect(callback).toHaveBeenCalledOnce();
    }

    act(() => root.unmount());
    container.remove();
  });
});
