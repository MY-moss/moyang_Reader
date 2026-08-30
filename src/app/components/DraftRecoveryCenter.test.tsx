import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DraftRecoveryCenter } from "./DraftRecoveryCenter";

describe("DraftRecoveryCenter", () => {
  it("does not present an old baseline as the current file difference", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPreview = vi.fn();

    act(() => {
      root.render(
        <DraftRecoveryCenter
          snapshots={[{ path: "C:/Notes/note.md", draft: "draft", baseSource: "old", savedAt: 1_000 }]}
          onOpen={vi.fn()}
          onPreview={onPreview}
          onDiscard={vi.fn()}
          onClearAll={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("查看差异时将读取当前文件");
    expect(container.textContent).not.toContain("草稿差异：");

    const preview = container.querySelector<HTMLButtonElement>('[aria-label="查看 note.md 当前文件与草稿的差异"]');
    expect(preview).toBeTruthy();
    act(() => preview?.click());
    expect(onPreview).toHaveBeenCalledWith("C:/Notes/note.md");

    act(() => root.unmount());
    container.remove();
  });
});
