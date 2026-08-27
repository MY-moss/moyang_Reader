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

export function ContextMenu({ x, y, title, ariaLabel, groups, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ left: x, top: y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition(clampMenuPosition(x, y, rect.width, rect.height));
  }, [x, y]);

  useEffect(() => {
    const menuElement = menuRef.current;
    const firstItem = menuElement?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)');
    firstItem?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)'));
      if (!items.length) return;
      const activeIndex = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
      let nextIndex: number;
      if (event.key === "ArrowDown") nextIndex = (activeIndex + 1) % items.length;
      else if (event.key === "ArrowUp") nextIndex = (activeIndex - 1 + items.length) % items.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = items.length - 1;
      else return;

      event.preventDefault();
      items[nextIndex]?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    menuElement?.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      menuElement?.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="moyang-context-menu"
      role="menu"
      aria-label={ariaLabel}
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
