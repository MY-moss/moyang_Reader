import { useEffect, useMemo, useRef, useState } from "react";
import { useModalBehavior } from "./useModalBehavior";

export type ReaderCommand = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
};

type CommandPaletteProps = {
  commands: ReaderCommand[];
  onClose: () => void;
  onExecute: (commandId: string) => void;
};

export function CommandPalette({ commands, onClose, onExecute }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return commands.filter((command) => !normalized || command.label.toLocaleLowerCase().includes(normalized));
  }, [commands, query]);

  useModalBehavior({ containerRef: dialogRef, initialFocusRef: inputRef, onClose });

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => (visibleCommands.length ? (current + 1) % visibleCommands.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          visibleCommands.length ? (current - 1 + visibleCommands.length) % visibleCommands.length : 0,
        );
        return;
      }
      if (event.key === "Enter") {
        const command = visibleCommands[activeIndex];
        if (!command || command.disabled) return;
        event.preventDefault();
        onExecute(command.id);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, onClose, onExecute, visibleCommands]);

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="command-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        tabIndex={-1}
      >
        <div className="command-palette-header">
          <div>
            <div className="command-palette-kicker">COMMANDS</div>
            <h2 id="command-palette-title">命令面板</h2>
          </div>
          <kbd>ESC</kbd>
        </div>
        <label className="command-palette-input-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            aria-label="搜索命令"
            placeholder="输入命令名称…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Ctrl ⇧ P</kbd>
        </label>
        <div className="command-palette-list" role="listbox" aria-label="可用命令">
          {visibleCommands.length === 0 ? (
            <div className="command-palette-empty">没有匹配的命令</div>
          ) : (
            visibleCommands.map((command, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                disabled={command.disabled}
                className={`command-palette-item ${index === activeIndex ? "active" : ""}`}
                key={command.id}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onExecute(command.id);
                  onClose();
                }}
              >
                <span>{command.label}</span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>
        <footer className="command-palette-footer">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  );
}
