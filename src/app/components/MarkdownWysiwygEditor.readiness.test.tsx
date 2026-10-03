import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "../i18n";
import { editorText } from "../editor-i18n";

type EditorStub = {
  ctx: { get: (key: unknown) => unknown };
  action: (action: unknown) => void;
};

const milkdown = vi.hoisted(() => ({
  loading: true,
  mounted: false,
  editor: null as EditorStub | null,
}));

// Control only the asynchronous library boundary. The editor shell, toolbar,
// insert handler and popover remain the production components.
vi.mock("@milkdown/react", () => ({
  Milkdown: () => (milkdown.mounted ? <div contentEditable suppressContentEditableWarning /> : null),
  MilkdownProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useEditor: () => ({ loading: milkdown.loading, get: () => milkdown.editor }),
}));

import { MarkdownWysiwygEditor } from "./MarkdownWysiwygEditor";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function renderEditor(locale: Locale, overrides: Partial<Parameters<typeof MarkdownWysiwygEditor>[0]> = {}): void {
  act(() => {
    root.render(
      <MarkdownWysiwygEditor
        locale={locale}
        source="# Draft"
        documentKey="draft.md"
        ariaLabel="Markdown editor"
        onChange={vi.fn()}
        canUndo
        canRedo
        {...overrides}
      />,
    );
  });
}

function readyEditor(): EditorStub {
  const view = {
    focus: vi.fn(),
    dispatch: vi.fn(),
    coordsAtPos: () => ({ left: 20, top: 30, bottom: 50 }),
    state: {
      doc: { textBetween: () => "", content: { size: 8 } },
      selection: { from: 1, to: 1 },
    },
  };
  return {
    ctx: {
      get: (key) => {
        if (key === editorViewCtx) return view;
        if (key === serializerCtx) return () => "# Draft";
        throw new Error("Unexpected Milkdown context requested by readiness test");
      },
    },
    action: vi.fn(),
  };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("__MOYANG_DESKTOP_E2E__", false);
  milkdown.loading = true;
  milkdown.mounted = false;
  milkdown.editor = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe.each(["zh-CN", "en-US"] as const)("MarkdownWysiwygEditor readiness (%s)", (locale) => {
  it("does not advertise usable editing actions while initialization is pending", () => {
    renderEditor(locale);

    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    const insert = toolbar!.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "insert")}"]`);
    expect(insert!.disabled, "Insert must not appear usable before a view exists").toBe(true);
    const controls = toolbar!.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select");
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls)
      expect(control.disabled, control.getAttribute("aria-label") ?? "control").toBe(true);

    act(() =>
      toolbar!.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "insert")}"]`)!.click(),
    );
    expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();
  });

  it("keeps editing actions unavailable when initialization completes without a mounted view", () => {
    milkdown.loading = false;
    renderEditor(locale);

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(editorText(locale, "wysiwygError"));
    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    const insert = toolbar!.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "insert")}"]`);
    expect(insert!.disabled, "Insert must not appear usable after a failed mount").toBe(true);
    for (const control of toolbar!.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select")) {
      expect(control.disabled, control.getAttribute("aria-label") ?? "control").toBe(true);
    }
    expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();
  });

  it("enables editing actions and opens the real insert popover after the view mounts", () => {
    renderEditor(locale);
    milkdown.loading = false;
    milkdown.mounted = true;
    milkdown.editor = readyEditor();
    renderEditor(locale);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    const insert = container.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "insert")}"]`);
    const bold = container.querySelector<HTMLButtonElement>(`button[aria-label="${editorText(locale, "bold")}"]`);
    expect(insert).not.toBeNull();
    expect(insert!.disabled).toBe(false);
    expect(bold!.disabled).toBe(false);

    act(() => insert!.click());
    const dialog = document.body.querySelector('.editor-insert-popover[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelectorAll('[role="tab"]')).toHaveLength(4);
    expect(dialog!.textContent).toContain(editorText(locale, "insertContent"));
  });

  it("waits to acknowledge a requested insertion until the mounted view can open it, exactly once", () => {
    const onInsertRequestHandled = vi.fn();
    const request = { requestedInsertKind: "link" as const, onInsertRequestHandled };
    renderEditor(locale, request);

    expect.soft(onInsertRequestHandled).not.toHaveBeenCalled();
    expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();

    milkdown.loading = false;
    milkdown.mounted = true;
    milkdown.editor = readyEditor();
    renderEditor(locale, request);

    expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).not.toBeNull();
    expect(onInsertRequestHandled).toHaveBeenCalledOnce();
    renderEditor(locale, request);
    expect(onInsertRequestHandled).toHaveBeenCalledOnce();
  });
});

it("does not carry a pending insertion across an unmount and a new document", () => {
  const onInsertRequestHandled = vi.fn();
  renderEditor("en-US", { requestedInsertKind: "link", onInsertRequestHandled });
  act(() => root.unmount());

  root = createRoot(container);
  milkdown.loading = false;
  milkdown.mounted = true;
  milkdown.editor = readyEditor();
  renderEditor("en-US", { documentKey: "other.md", onInsertRequestHandled });

  expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).toBeNull();
  expect(onInsertRequestHandled).not.toHaveBeenCalled();
});

it("opens a new insertion request when a locale change reconnects the ready view", () => {
  milkdown.loading = false;
  milkdown.mounted = true;
  milkdown.editor = readyEditor();
  renderEditor("zh-CN");
  const onInsertRequestHandled = vi.fn();

  renderEditor("en-US", { requestedInsertKind: "link", onInsertRequestHandled });

  expect(document.body.querySelector('.editor-insert-popover[role="dialog"]')).not.toBeNull();
  expect(onInsertRequestHandled).toHaveBeenCalledOnce();
});
