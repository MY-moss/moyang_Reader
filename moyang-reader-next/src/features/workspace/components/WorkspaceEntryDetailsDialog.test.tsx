import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceEntryDetailsDialog } from "./WorkspaceEntryDetailsDialog";

describe("WorkspaceEntryDetailsDialog", () => {
  it("shows file metadata and closes through the modal controls", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <WorkspaceEntryDetailsDialog
          details={{
            kind: "file",
            name: "readme.md",
            relativePath: "docs/readme.md",
            absolutePath: "C:/vault/docs/readme.md",
            documentKind: "markdown",
            size: 2048,
          }}
          onClose={onClose}
        />,
      );
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain("readme.md");
    expect(container.textContent).toContain("2 KB");
    expect(container.textContent).toContain("C:/vault/docs/readme.md");

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="关闭属性"]')?.click());
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
