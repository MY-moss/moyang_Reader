import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { FileDropState } from "../file-drop";
import { FileDropOverlay } from "./FileDropOverlay";

const activeState: FileDropState = {
  active: true,
  support: "mixed",
  source: "browser",
};

function mount(state: FileDropState) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<FileDropOverlay state={state} />);
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("FileDropOverlay", () => {
  it("renders non-modal mixed-file guidance with source metadata", () => {
    const { container, root } = mount(activeState);
    const overlay = container.querySelector('[data-testid="file-drop-overlay"]');

    expect(overlay?.getAttribute("data-drop-support")).toBe("mixed");
    expect(overlay?.getAttribute("data-drop-source")).toBe("browser");
    expect(overlay?.textContent).toContain("松开即可打开可识别文件");
    expect(overlay?.textContent).toContain("不支持的文件会被跳过");

    act(() => root.unmount());
  });

  it("does not render while idle", () => {
    const { container, root } = mount({ ...activeState, active: false });
    expect(container.querySelector('[data-testid="file-drop-overlay"]')).toBeNull();
    act(() => root.unmount());
  });
});
