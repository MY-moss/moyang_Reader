import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  it("localizes document status and exposes external changes as an action", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onShowExternalChange = vi.fn();

    act(() => {
      root.render(
        <StatusBar
          locale="en-US"
          documentPath="C:/Notes/reader.md"
          documentKind="markdown"
          characterCount={1234}
          externallyModified
          currentVersion="1.0.0"
          onShowExternalChange={onShowExternalChange}
        />,
      );
    });

    expect(container.querySelector("footer")?.getAttribute("aria-label")).toBe("Document status");
    expect(container.querySelector(".statusbar-path")?.textContent).toBe("C:/Notes/reader.md");
    expect(container.querySelector(".statusbar-kind")?.textContent).toBe("1,234 characters");
    expect(container.querySelector(".statusbar-version")?.textContent).toBe("v1.0.0");

    act(() => container.querySelector<HTMLButtonElement>(".statusbar-external-change")?.click());
    expect(onShowExternalChange).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });
});
