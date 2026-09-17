import { useEffect, useMemo, useRef, useState } from "react";
import { useModalBehavior } from "./useModalBehavior";

export type ReaderCommand = {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
};

function commandOptionId(commandId: string): string {
  return `command-palette-option-${encodeURIComponent(commandId)}`;
}

type CommandPaletteProps = {
  commands: ReaderCommand[];
  onClose: () => void;
  onExecute: (commandId: string) => void;
};

export function CommandPalette({ commands, onClose, onExecute }: CommandPaletteProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef(new Map<string, HTMLButtonElement>());
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCommands = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return commands.filter((command) => !normalized || command.label.toLocaleLowerCase().includes(normalized));
  }, [commands, query]);
  const activeCommandIndex = visibleCommands.length ? Math.min(activeIndex, visibleCommands.length - 1) : 0;
  const activeCommand = visibleCommands[activeCommandIndex];
  const activeCommandId = activeCommand?.id ?? null;
  const resultStatus = activeCommand
    ? `${activeCommandIndex + 1} / ${visibleCommands.length}，当前命令：${activeCommand.label}${
        activeCommand.disabled ? "，当前不可用" : ""
      }`
    : query.trim()
      ? "没有匹配的命令，请换个名称试试。"
      : "当前没有可用命令。";

  useModalBehavior({ containerRef: dialogRef, initialFocusRef: inputRef, onClose });

  useEffect(() => {
    setActiveIndex(0);
  }, [commands, query]);

  useEffect(() => {
    if (!activeCommandId) return;

    optionsRef.current.get(activeCommandId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeCommandId]);

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
      if (event.key === "Home") {
        if (!visibleCommands.length) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      }
      if (event.key === "End") {
        if (!visibleCommands.length) return;
        event.preventDefault();
        setActiveIndex(visibleCommands.length - 1);
        return;
      }
      if (event.key === "Enter") {
        const command = visibleCommands[activeCommandIndex];
        if (!command) return;
        event.preventDefault();
        if (command.disabled) return;
        onExecute(command.id);
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeCommandIndex, onClose, onExecute, visibleCommands]);

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
            role="combobox"
            aria-label="搜索命令"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-controls="command-palette-results"
            aria-activedescendant={activeCommand ? commandOptionId(activeCommand.id) : undefined}
            aria-describedby="command-palette-status"
            placeholder="输入命令名称…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Ctrl ⇧ P</kbd>
        </label>
        <div className="sr-only" id="command-palette-status" role="status" aria-live="polite" aria-atomic="true">
          {resultStatus}
        </div>
        <div className="command-palette-list" id="command-palette-results" role="listbox" aria-label="命令面板结果">
          {visibleCommands.length === 0 ? (
            <div className="command-palette-empty">
              <strong>{query.trim() ? "没有匹配的命令" : "当前没有可用命令"}</strong>
              <span>{query.trim() ? "换个命令名称试试" : "可先打开文档或添加阅读库"}</span>
            </div>
          ) : (
            visibleCommands.map((command, index) => (
              <button
                type="button"
                role="option"
                id={commandOptionId(command.id)}
                aria-selected={index === activeCommandIndex}
                aria-disabled={command.disabled || undefined}
                tabIndex={-1}
                disabled={command.disabled}
                className={`command-palette-item ${index === activeCommandIndex ? "active" : ""}`}
                key={command.id}
                ref={(element) => {
                  if (element) optionsRef.current.set(command.id, element);
                  else optionsRef.current.delete(command.id);
                }}
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
