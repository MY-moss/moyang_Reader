import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ContextMenu, type ContextMenuGroup } from "./ContextMenu";

const groups: ContextMenuGroup[] = [
  {
    label: "操作",
    items: [
      { id: "first", label: "第一项", onSelect: vi.fn() },
      { id: "disabled", label: "不可用", disabled: true, onSelect: vi.fn() },
      { id: "second", label: "第二项", onSelect: vi.fn() },
    ],
  },
];

function ControlledMenu({
  trigger,
  fallback,
  onClosed,
}: {
  trigger: HTMLElement;
  fallback?: HTMLElement;
  onClosed: () => void;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <ContextMenu
      x={20}
      y={24}
      ariaLabel="测试菜单"
      groups={groups}
      restoreFocusTarget={trigger}
      fallbackFocusTarget={fallback}
      onClose={() => {
        onClosed();
        setOpen(false);
      }}
    />
  );
}

function keyboardEvent(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
}

describe("ContextMenu", () => {
  it("renders outside a containing content area so fixed coordinates stay in the viewport", () => {
    const contentArea = document.createElement("div");
    contentArea.className = "content-area";
    contentArea.style.containerType = "inline-size";
    const container = document.createElement("div");
    contentArea.appendChild(container);
    document.body.appendChild(contentArea);
    const root = createRoot(container);

    act(() => {
      root.render(<ContextMenu x={24} y={28} ariaLabel="测试菜单" groups={groups} onClose={vi.fn()} />);
    });

    const menu = document.body.querySelector<HTMLElement>('[role="menu"][aria-label="测试菜单"]');
    expect(menu).toBeTruthy();
    expect(menu?.parentElement).toBe(document.body);
    expect(contentArea.contains(menu)).toBe(false);

    Object.defineProperty(menu, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          width: 220,
          height: 160,
          top: 0,
          left: 0,
          right: 220,
          bottom: 160,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    const x = window.innerWidth - 20;
    const y = window.innerHeight - 20;

    act(() => {
      root.render(<ContextMenu x={x} y={y} ariaLabel="测试菜单" groups={groups} onClose={vi.fn()} />);
    });

    expect(menu?.style.left).toBe(`${Math.max(8, window.innerWidth - 220 - 8)}px`);
    expect(menu?.style.top).toBe(`${Math.max(8, window.innerHeight - 160 - 8)}px`);

    act(() => root.unmount());
    contentArea.remove();
  });

  it("cycles enabled items with Tab and arrow keys without resetting after rerenders", () => {
    const container = document.createElement("div");
    const trigger = document.createElement("button");
    document.body.append(trigger, container);
    trigger.focus();
    const root = createRoot(container);

    act(() => {
      root.render(<ContextMenu x={20} y={24} ariaLabel="测试菜单" groups={groups} onClose={vi.fn()} />);
    });

    const menu = document.body.querySelector<HTMLElement>('[role="menu"][aria-label="测试菜单"]');
    const items = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(menu).toBeTruthy();
    expect(document.activeElement).toBe(items()[0]);

    act(() => {
      items()[0]?.dispatchEvent(keyboardEvent("ArrowDown"));
    });
    expect(document.activeElement).toBe(items()[2]);

    act(() => {
      const event = keyboardEvent("Tab");
      items()[2]?.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
    expect(document.activeElement).toBe(items()[0]);

    act(() => {
      const event = keyboardEvent("Tab", { shiftKey: true });
      items()[0]?.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
    expect(document.activeElement).toBe(items()[2]);

    act(() => {
      items()[2]?.dispatchEvent(keyboardEvent("Home"));
    });
    expect(document.activeElement).toBe(items()[0]);
    act(() => {
      items()[0]?.dispatchEvent(keyboardEvent("End"));
    });
    expect(document.activeElement).toBe(items()[2]);

    act(() => {
      root.render(
        <ContextMenu
          x={20}
          y={24}
          title="更新后的标题"
          ariaLabel="测试菜单"
          groups={groups}
          onClose={() => undefined}
        />,
      );
    });
    expect(document.activeElement).toBe(items()[2]);

    act(() => root.unmount());
    container.remove();
    trigger.remove();
  });

  it("restores focus after Escape, outside close, and item selection", () => {
    const container = document.createElement("div");
    const trigger = document.createElement("button");
    const fallback = document.createElement("button");
    const outside = document.createElement("button");
    document.body.append(trigger, fallback, outside, container);
    const root = createRoot(container);
    const onClosed = vi.fn();
    const renderControlled = (key: number) => {
      act(() => {
        root.render(<ControlledMenu key={key} trigger={trigger} fallback={fallback} onClosed={onClosed} />);
      });
    };

    trigger.focus();
    renderControlled(1);
    const menu = () => document.body.querySelector<HTMLElement>('[role="menu"][aria-label="测试菜单"]');

    act(() => {
      const event = keyboardEvent("Escape");
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
    expect(onClosed).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);

    renderControlled(2);
    trigger.focus();
    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClosed).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(trigger);

    renderControlled(3);
    trigger.focus();
    act(() => {
      document.body.querySelector<HTMLButtonElement>('[role="menu"][aria-label="测试菜单"] [role="menuitem"]')?.click();
    });
    expect(onClosed).toHaveBeenCalledTimes(3);
    expect(document.activeElement).toBe(trigger);

    renderControlled(4);
    trigger.remove();
    act(() => {
      menu()?.dispatchEvent(keyboardEvent("Escape"));
    });
    expect(document.activeElement).toBe(fallback);

    act(() => root.unmount());
    container.remove();
    fallback.remove();
    outside.remove();
  });
});
