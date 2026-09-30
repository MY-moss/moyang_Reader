import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useDocumentTransitionConfirmation } from "./use-document-transition-confirmation";
import { DocumentTransitionConfirmationDialog } from "./components/DocumentTransitionConfirmationDialog";
import type { DocumentTransitionConfirmationRequest } from "./document-session-controller";

function mount(request: DocumentTransitionConfirmationRequest, locale: "zh-CN" | "en-US" = "en-US") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const result = vi.fn();
  let api!: ReturnType<typeof useDocumentTransitionConfirmation>;
  function Harness() {
    api = useDocumentTransitionConfirmation();
    return (
      <>
        <button onClick={() => void api.confirm(request).then(result)}>Switch</button>
        {api.request && (
          <DocumentTransitionConfirmationDialog locale={locale} request={api.request} onDecision={api.decide} />
        )}
      </>
    );
  }
  act(() => root.render(<Harness />));
  return {
    container,
    result,
    getApi: () => api,
    trigger: container.querySelector<HTMLButtonElement>("button")!,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const request: DocumentTransitionConfirmationRequest = {
  action: "switch",
  path: "C:/Notes/笔记.txt",
  targets: ["C:/Notes/next.txt"],
  draftSaved: true,
};

describe("document transition confirmation UI", () => {
  it("uses a current-document fallback if the original trigger no longer exists", async () => {
    const tab = document.createElement("div");
    tab.className = "tab-item active";
    const label = document.createElement("button");
    label.className = "tab-label";
    tab.appendChild(label);
    document.body.appendChild(tab);
    const { container, trigger, getApi, unmount } = mount(request);
    trigger.focus();
    act(() => trigger.click());
    trigger.remove();
    await act(async () => {
      getApi().decide(false);
    });
    expect(document.activeElement).toBe(label);
    container.appendChild(trigger);
    unmount();
    tab.remove();
  });
  it("explains recovery, focuses Cancel, traps Tab and restores focus on Escape", async () => {
    const { container, trigger, result, unmount } = mount(request);
    trigger.focus();
    act(() => trigger.click());
    const cancel = container.querySelector<HTMLButtonElement>('[data-testid="document-transition-confirm-cancel"]')!;
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="document-transition-confirm-confirm"]')!;
    expect(document.activeElement).toBe(cancel);
    expect(container.textContent).toContain("Restore them from Drafts");
    expect(container.textContent).toContain("C:/Notes/笔记.txt");
    act(() => {
      cancel.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(confirm);
    await act(async () => {
      confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  it("warns of unrecoverable browser edits and resolves only one decision", async () => {
    const { container, trigger, result, getApi, unmount } = mount({ ...request, draftSaved: false });
    act(() => trigger.click());
    expect(container.textContent).toContain("Continuing loses unsaved edits");
    expect(container.textContent).not.toContain("A recoverable draft copy has been kept");
    expect(await getApi().confirm(request)).toBe(false);
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="document-transition-confirm-confirm"]')!;
    await act(async () => {
      confirm.click();
      confirm.click();
    });
    expect(result).toHaveBeenCalledExactlyOnceWith(true);
    unmount();
  });

  it("cancels pending decisions on unmount", async () => {
    const { trigger, result, unmount } = mount(request);
    act(() => trigger.click());
    unmount();
    await Promise.resolve();
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("states batch-close scope and reload consequences in Chinese", () => {
    const close = mount({ ...request, action: "close-tabs", targets: ["one.txt", "two.txt"] }, "zh-CN");
    act(() => close.trigger.click());
    expect(close.container.textContent).toContain("将关闭 2 个标签");
    close.unmount();
    const reload = mount({ ...request, action: "reload", targets: [] }, "zh-CN");
    act(() => reload.trigger.click());
    expect(reload.container.textContent).toContain("不会覆盖磁盘文件");
    expect(reload.container.textContent).toContain("最新修改已自动保留");
    reload.unmount();
  });
});
