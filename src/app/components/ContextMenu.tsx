import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  tone?: "default" | "danger";
  onSelect: () => void;
};

export type ContextMenuGroup = {
  label?: string;
  items: readonly ContextMenuItem[];
};

type ContextMenuProps = {
  x: number;
  y: number;
  title?: string;
  ariaLabel: string;
  groups: readonly ContextMenuGroup[];
  onClose: () => void;
  restoreFocusTarget?: HTMLElement | null;
  fallbackFocusTarget?: HTMLElement | null;
};

type MenuPosition = {
  left: number;
  top: number;
};

function clampMenuPosition(x: number, y: number, width: number, height: number): MenuPosition {
  const viewportWidth = typeof window === "undefined" ? x + width + 16 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? y + height + 16 : window.innerHeight;
  return {
    left: Math.min(Math.max(8, x), Math.max(8, viewportWidth - width - 8)),
    top: Math.min(Math.max(8, y), Math.max(8, viewportHeight - height - 8)),
  };
}

function getEnabledMenuItems(menu: HTMLElement): HTMLButtonElement[] {
  return Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
}

function focusElement(element: HTMLElement | null | undefined): boolean {
  if (!element?.isConnected) return false;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return document.activeElement === element;
}

function restoreFocus(target: HTMLElement | null, fallback: HTMLElement | null): void {
  if (focusElement(target)) return;
  if (focusElement(fallback)) return;

  const body = document.body;
  if (!body) return;

  // `body` is the last-resort safe container when the triggering row/tab was
  // deleted while the menu was open. Keep the temporary tab stop out of the
  // user's document after focus has been placed there.
  const previousTabIndex = body.getAttribute("tabindex");
  if (previousTabIndex === null) body.setAttribute("tabindex", "-1");
  focusElement(body);
  if (previousTabIndex === null) body.removeAttribute("tabindex");
}

function activeElementOrNull(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

export function ContextMenu({
  x,
  y,
  title,
  ariaLabel,
  groups,
  onClose,
  restoreFocusTarget,
  fallbackFocusTarget,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ left: x, top: y });
  const onCloseRef = useRef(onClose);
  const restoreFocusTargetRef = useRef<HTMLElement | null>(restoreFocusTarget ?? activeElementOrNull());
  const fallbackFocusTargetRef = useRef<HTMLElement | null>(fallbackFocusTarget ?? null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition(clampMenuPosition(x, y, rect.width, rect.height));
  }, [x, y]);

  useEffect(() => {
    const menuElement = menuRef.current;
    if (!menuElement) return;
    const restoreTarget = restoreFocusTargetRef.current;
    const fallbackTarget = fallbackFocusTargetRef.current;

    const firstItem = getEnabledMenuItems(menuElement)[0];
    (firstItem ?? menuElement).focus();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) onCloseRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      // Native desktop drivers can deliver Escape to the document/webview
      // rather than the focused menu item. Closing must not depend on the
      // event target still being inside the menu.
      if (event.key === "Escape" || event.key === "Esc" || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (!(event.target instanceof Node) || !menu.contains(event.target)) return;

      const items = getEnabledMenuItems(menu);
      if (event.key === "Tab") {
        event.preventDefault();
        if (items.length === 0) {
          menu.focus();
          return;
        }

        const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex =
          activeIndex < 0
            ? event.shiftKey
              ? items.length - 1
              : 0
            : (activeIndex + (event.shiftKey ? -1 : 1) + items.length) % items.length;
        items[nextIndex]?.focus();
        return;
      }

      if (!items.length) return;
      const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      let nextIndex: number;
      if (event.key === "ArrowDown") nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      else if (event.key === "ArrowUp")
        nextIndex = activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = items.length - 1;
      else return;

      event.preventDefault();
      items[nextIndex]?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
      restoreFocus(restoreTarget, fallbackTarget);
    };
  }, []);

  return (
    <div
      ref={menuRef}
      className="moyang-context-menu"
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {title && <div className="moyang-context-menu-title">{title}</div>}
      {groups.map((group, groupIndex) => (
        <div className="moyang-context-menu-group" key={group.label ?? `group-${groupIndex}`}>
          {group.label && <div className="moyang-context-menu-label">{group.label}</div>}
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={item.tone === "danger" ? "context-menu-danger" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                onClose();
              }}
            >
              <span>{item.label}</span>
              {item.shortcut && <small>{item.shortcut}</small>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

