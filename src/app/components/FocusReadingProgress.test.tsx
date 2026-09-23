import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FocusReadingProgress } from "./FocusReadingProgress";

describe("FocusReadingProgress", () => {
  it("clamps progress and localizes its accessible status", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<FocusReadingProgress locale="en-US" progress={1.4} currentHeading={null} />);
    });

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("100");
    expect(progressbar?.getAttribute("aria-label")).toBe("Focus reading progress");
    expect(container.textContent).toContain("100% read");
    expect(container.textContent).toContain("Document start");

    act(() => root.unmount());
    container.remove();
  });
});
