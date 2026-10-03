import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Locale } from "../i18n";
import { editorText } from "../editor-i18n";

const codeMirrorImport = vi.hoisted(() => {
  let reject: (cause: Error) => void = () => {};
  let markStarted: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pending = new Promise<void>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { pending, reject, started, markStarted };
});

// Delay and reject only the actual lazy import boundary. The source editor,
// toolbar, fallback textarea and insertion popover are production components.
vi.mock("codemirror", async () => {
  codeMirrorImport.markStarted();
  await codeMirrorImport.pending;
  return {};
});

import { SourceEditor } from "./SourceEditor";

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

it("waits for a usable source surface and handles a pending insertion exactly once in the editable import-failure fallback", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__MOYANG_DESKTOP_E2E__", false);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  const onInsertRequestHandled = vi.fn();

  function Harness({ locale }: { locale: Locale }) {
    const [value, setValue] = useState("# Draft");
    return (
      <SourceEditor
        locale={locale}
        value={value}
        ariaLabel="Markdown source"
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        requestedInsertKind="link"
        onInsertRequestHandled={onInsertRequestHandled}
        canUndo
        canRedo
      />
    );
  }

  try {
    act(() => root.render(<Harness locale="zh-CN" />));
    await codeMirrorImport.started;

    for (const locale of ["zh-CN", "en-US"] as const) {
      act(() => root.render(<Harness locale={locale} />));
      expect(container.querySelector('[contenteditable="true"], textarea')).toBeNull();
      const insert = container.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "insert")}"]`);
      expect(insert).not.toBeNull();
      expect
        .soft(insert!.disabled, `Insert must be unavailable while ${locale} source initialization is pending`)
        .toBe(true);
      expect
        .soft(onInsertRequestHandled, "An insertion without a source surface must remain pending")
        .not.toHaveBeenCalled();
      expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();
    }

    await act(async () => {
      codeMirrorImport.reject(new Error("Controlled CodeMirror import failure"));
      await vi.dynamicImportSettled();
    });

    const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea!.disabled).toBe(false);
    expect(textarea!.readOnly).toBe(false);
    const insert = container.querySelector<HTMLButtonElement>('button[aria-label="Insert"]');
    expect(insert!.disabled).toBe(false);
    expect
      .soft(
        document.body.querySelector('.editor-insert-popover[role="dialog"]'),
        "The pending request opens once fallback mounts",
      )
      .not.toBeNull();
    expect.soft(onInsertRequestHandled).toHaveBeenCalledOnce();
    act(() => root.render(<Harness locale="en-US" />));
    expect
      .soft(onInsertRequestHandled, "A rerender must not acknowledge the same request again")
      .toHaveBeenCalledOnce();

    // Also verify the real fallback remains useful even when the old code has
    // already dropped the pending request. The soft assertions above retain RED.
    if (!document.body.querySelector('.editor-insert-popover[role="dialog"]')) act(() => insert!.click());
    const dialog = document.body.querySelector<HTMLElement>('.editor-insert-popover[role="dialog"]');
    expect(dialog).not.toBeNull();
    const inputs = dialog!.querySelectorAll<HTMLInputElement>("input");
    act(() => {
      setInputValue(inputs[0]!, "Guide");
      setInputValue(inputs[1]!, "https://example.com/guide");
    });
    act(() => {
      dialog!
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();
    expect(textarea!.value).toContain("[Guide](https://example.com/guide)");
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining("[Guide](https://example.com/guide)"));

    act(() => setInputValue(textarea!, "# Editable fallback"));
    expect(textarea!.value).toBe("# Editable fallback");
    expect(onChange).toHaveBeenLastCalledWith("# Editable fallback");
    expect.soft(onInsertRequestHandled).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
