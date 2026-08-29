import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DraftRecoveryComparisonDialog } from "./DraftRecoveryComparisonDialog";

describe("DraftRecoveryComparisonDialog", () => {
  it("shows a useful diff summary before allowing recovery", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onAction = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <DraftRecoveryComparisonDialog
          snapshot={{
            path: "C:/Notes/note.md",
            draft: "# Note\n\n草稿内容",
            baseSource: "# Note\n\n原始内容",
            savedAt: Date.now() - 60_000,
          }}
          comparisonSource="# Note\n\n原始内容"
          comparisonLabel="当前磁盘版本"
          currentDocumentModified={false}
          sourceChangedSinceDraft={false}
          actionLabel="恢复到编辑区"
          onAction={onAction}
          onClose={onClose}
        />,
      );
    });

    expect(container.textContent).toContain("新增行");
    expect(container.textContent).toContain("移除行");
    expect(container.textContent).toContain("存在未保存内容");
    expect(container.textContent).toContain("原始内容");
    expect(container.textContent).toContain("草稿内容");

    act(() => container.querySelector<HTMLButtonElement>('[data-testid="draft-comparison-action"]')?.click());
    expect(onAction).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });

  it("explains when recovery is unnecessary and disables the action", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onAction = vi.fn();

    act(() => {
      root.render(
        <DraftRecoveryComparisonDialog
          snapshot={{
            path: "C:/Notes/note.md",
            draft: "# Note\n\n同样内容",
            baseSource: "# Note\n\n同样内容",
            savedAt: Date.now() - 60_000,
          }}
          comparisonSource={"# Note\n\n同样内容"}
          comparisonLabel="当前磁盘版本"
          currentDocumentModified={false}
          sourceChangedSinceDraft={false}
          actionLabel="恢复到编辑区"
          onAction={onAction}
          onClose={vi.fn()}
        />,
      );
    });

    const action = container.querySelector<HTMLButtonElement>('[data-testid="draft-comparison-action"]');
    expect(container.textContent).toContain("无需恢复");
    expect(action?.disabled).toBe(true);
    act(() => action?.click());
    expect(onAction).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("asks the user to check the file when the disk version also changed", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <DraftRecoveryComparisonDialog
          snapshot={{
            path: "C:/Notes/note.md",
            draft: "# Note\n\n草稿内容",
            baseSource: "# Note\n\n原始内容",
            savedAt: Date.now() - 60_000,
          }}
          comparisonSource={"# Note\n\n磁盘新内容"}
          comparisonLabel="当前磁盘版本"
          currentDocumentModified={false}
          sourceChangedSinceDraft={true}
          actionLabel="恢复到编辑区"
          onAction={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("建议先核对");
    expect(container.textContent).toContain("原文件又发生了变化");

    act(() => root.unmount());
    container.remove();
  });
});
