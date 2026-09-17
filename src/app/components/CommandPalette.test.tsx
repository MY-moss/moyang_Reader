import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandPalette, type ReaderCommand } from "./CommandPalette";

const commands: ReaderCommand[] = [
  { id: "open", label: "打开文档", shortcut: "Ctrl O" },
  { id: "save", label: "保存当前文档", shortcut: "Ctrl S", disabled: true },
  { id: "focus", label: "进入专注阅读", shortcut: "Ctrl ⇧ Enter" },
];

function renderPalette(paletteCommands: ReaderCommand[] = commands): {
  container: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
  onClose: ReturnType<typeof vi.fn>;
  onExecute: ReturnType<typeof vi.fn>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onClose = vi.fn();
  const onExecute = vi.fn();
  act(() => {
    root.render(<CommandPalette commands={paletteCommands} onClose={onClose} onExecute={onExecute} />);
  });
  return { container, root, onClose, onExecute };
}

function cleanup(container: HTMLDivElement, root: ReturnType<typeof createRoot>): void {
  act(() => root.unmount());
  container.remove();
}

function pressKey(key: string): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("CommandPalette", () => {
  it("exposes a stable combobox and listbox relationship", () => {
    const { container, root } = renderPalette();
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(input?.getAttribute("role")).toBe("combobox");
    expect(input?.getAttribute("aria-label")).toBe("搜索命令");
    expect(input?.getAttribute("aria-autocomplete")).toBe("list");
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    expect(input?.getAttribute("aria-controls")).toBe("command-palette-results");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-open");
    expect(input?.getAttribute("aria-describedby")).toBe("command-palette-status");
    expect(container.querySelector('[role="listbox"]')?.getAttribute("id")).toBe("command-palette-results");
    expect(container.querySelector('[role="listbox"]')?.getAttribute("aria-label")).toBe("命令面板结果");
    expect(container.querySelector("#command-palette-option-open")?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#command-palette-option-save")?.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("#command-palette-status")?.textContent).toContain("1 / 3");

    cleanup(container, root);
  });

  it("supports arrow, Home, End and Enter navigation while keeping input focus", () => {
    const enabledCommands: ReaderCommand[] = [
      { id: "first", label: "第一个命令" },
      { id: "second", label: "第二个命令" },
      { id: "last", label: "最后一个命令" },
    ];
    const { container, root, onClose, onExecute } = renderPalette(enabledCommands);
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(document.activeElement).toBe(input);

    pressKey("ArrowDown");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-second");
    expect(document.activeElement).toBe(input);

    pressKey("End");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-last");

    pressKey("Home");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-first");

    pressKey("ArrowUp");
    expect(input?.getAttribute("aria-activedescendant")).toBe("command-palette-option-last");

    pressKey("Enter");
    expect(onExecute).toHaveBeenCalledWith("last");
    expect(onClose).toHaveBeenCalledOnce();

    cleanup(container, root);
  });

  it("keeps unavailable commands visible but prevents executing them", () => {
    const { container, root, onClose, onExecute } = renderPalette([
      { id: "save", label: "保存当前文档", disabled: true },
    ]);
    const enterEvent = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });

    act(() => {
      window.dispatchEvent(enterEvent);
    });

    expect(enterEvent.defaultPrevented).toBe(true);
    expect(onExecute).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector("#command-palette-status")?.textContent).toContain("当前不可用");

    cleanup(container, root);
  });

  it("scrolls the active command into view", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      const { container, root } = renderPalette();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

      scrollIntoView.mockClear();
      pressKey("ArrowDown");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

      cleanup(container, root);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalDescriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  });

  it("makes empty results explicit and clears the active descendant", () => {
    const { container, root } = renderPalette([]);
    const input = container.querySelector<HTMLInputElement>('input[type="search"]');

    expect(input?.getAttribute("aria-activedescendant")).toBeNull();
    expect(container.textContent).toContain("当前没有可用命令");
    expect(container.textContent).toContain("可先打开文档或添加阅读库");
    expect(container.querySelector("#command-palette-status")?.textContent).toContain("当前没有可用命令");

    cleanup(container, root);
  });

  it("restores the trigger focus when closed", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { container, root } = renderPalette();

    expect(document.activeElement).toBe(container.querySelector('input[type="search"]'));

    cleanup(container, root);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
