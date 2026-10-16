import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Uses the existing sidebar scroller, keeping the whole file tree reachable. */
export function VirtualRows<T>({ rows, renderRow }: { rows: T[]; renderRow: (row: T, index: number) => ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 40 });
  const rowHeight = 36;
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest<HTMLElement>(".workbench-sidebar-content") ?? root?.closest<HTMLElement>(".sidebar");
    if (!root || !scroller) return;
    const update = () => {
      const offset = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const first = Math.max(0, Math.floor((scroller.scrollTop - offset) / rowHeight) - 8);
      const start = Math.min(first, Math.max(0, rows.length - 1));
      setRange({ start, end: Math.min(rows.length, start + Math.ceil(scroller.clientHeight / rowHeight) + 24) });
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [rows.length]);
  return (
    <div
      ref={rootRef}
      className="virtual-rows"
      data-total-rows={rows.length}
      style={{ height: rows.length * rowHeight }}
      onKeyDown={(event) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const current = Number(
          (event.target as HTMLElement).closest<HTMLElement>("[data-row-index]")?.dataset.rowIndex,
        );
        const root = rootRef.current,
          scroller = root?.closest<HTMLElement>(".workbench-sidebar-content") ?? root?.closest<HTMLElement>(".sidebar");
        if (!root || !scroller || !Number.isFinite(current)) return;
        event.preventDefault();
        const index = Math.min(
          rows.length - 1,
          Math.max(
            0,
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? rows.length - 1
                : current + (event.key === "ArrowDown" ? 1 : -1),
          ),
        );
        const offset = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTop = offset + index * rowHeight - rowHeight;
        setRange({ start: Math.max(0, index - 8), end: Math.min(rows.length, index + 25) });
        requestAnimationFrame(() =>
          root.querySelector<HTMLButtonElement>(`[data-row-index="${index}"] button`)?.focus({ preventScroll: true }),
        );
      }}
    >
      {rows.slice(range.start, range.end).map((row, offset) => (
        <div
          className="virtual-row"
          key={range.start + offset}
          data-row-index={range.start + offset}
          style={{ top: (range.start + offset) * rowHeight, height: rowHeight }}
        >
          {renderRow(row, range.start + offset)}
        </div>
      ))}
    </div>
  );
}
