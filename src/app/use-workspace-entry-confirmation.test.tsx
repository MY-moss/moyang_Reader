import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceEntryConfirmation } from "./use-workspace-entry-confirmation";
import { WorkspaceEntryConfirmationDialog } from "./components/WorkspaceEntryConfirmationDialog";

function mount(locale: "zh-CN" | "en-US" = "en-US") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result = vi.fn();
  let api!: ReturnType<typeof useWorkspaceEntryConfirmation>;
  function Harness() {
    api = useWorkspaceEntryConfirmation();
    return (
      <>
        <button
          onClick={() => void api.confirm({ type: "delete", path: "C:/Notes/Projects", kind: "folder" }).then(result)}
        >
          Delete
        </button>
        {api.request && (
          <WorkspaceEntryConfirmationDialog locale={locale} request={api.request} onDecision={api.decide} />
        )}
      </>
    );
  }
  act(() => root.render(<Harness />));
  const trigger = container.querySelector<HTMLButtonElement>("button")!;
  return {
    container,
    trigger,
    result,
    getApi: () => api,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("workspace confirmation UI boundary", () => {
  it("focuses Cancel, traps keyboard navigation and restores the trigger on Escape", async () => {
    const { container, trigger, result, unmount } = mount();
    trigger.focus();
    act(() => trigger.click());
    const cancel = container.querySelector<HTMLButtonElement>('[data-testid="workspace-entry-confirm-cancel"]')!;
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="workspace-entry-confirm-confirm"]')!;
    expect(document.activeElement).toBe(cancel);
    expect(container.textContent).toContain("everything inside it");
    expect(container.textContent).toContain("C:/Notes/Projects");
    act(() => {
      cancel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(confirm);
    await act(async () =>
      confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })),
    );
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.activeElement).toBe(trigger);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });

  it("resolves a decision once and refuses a second concurrent request", async () => {
    const { container, trigger, result, getApi, unmount } = mount();
    act(() => trigger.click());
    expect(await getApi().confirm({ type: "save", path: "other.md", action: "copy" })).toBe(false);
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="workspace-entry-confirm-confirm"]')!;
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    expect(result).toHaveBeenCalledExactlyOnceWith(true);
    unmount();
  });

  it("cancels a pending decision when the application unmounts", async () => {
    const { trigger, result, unmount } = mount();
    act(() => trigger.click());
    unmount();
    await Promise.resolve();
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("explains in Chinese that saving before deletion still sends the file to the Recycle Bin", async () => {
    const { container, getApi, unmount } = mount("zh-CN");
    let pending!: Promise<boolean>;
    act(() => {
      pending = getApi().confirm({ type: "save", path: "C:/Notes/笔记.md", action: "delete" });
    });
    expect(container.textContent).toContain("先保存，再删除？");
    expect(container.textContent).toContain("保存成功后，文件仍将移入 Windows 回收站");
    expect(container.querySelector('[data-testid="workspace-entry-confirm-confirm"]')?.textContent).toBe("保存并删除");
    act(() => getApi().decide(false));
    expect(await pending).toBe(false);
    unmount();
  });
});
