import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PaneSide } from "../pane-layout";

type PaneResizeHandleProps = {
  side: PaneSide;
  value: number;
  min: number;
  max: number;
  onResizeBy: (delta: number) => void;
  onResizePreview?: (delta: number) => void;
  onResizeCommit?: () => void;
  onReset: () => void;
};

const KEYBOARD_STEP = 16;
const KEYBOARD_LARGE_STEP = 48;

export function PaneResizeHandle({
  side,
  value,
  min,
  max,
  onResizeBy,
  onResizePreview,
  onResizeCommit,
  onReset,
}: PaneResizeHandleProps) {
  const lastPointerX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const finishDragging = useCallback(() => {
    const wasDragging = lastPointerX.current !== null;
    lastPointerX.current = null;
    if (wasDragging) onResizeCommit?.();
    setDragging(false);
    document.documentElement.classList.remove("pane-resizing");
  }, [onResizeCommit]);

  useEffect(() => {
    return () => {
      lastPointerX.current = null;
      document.documentElement.classList.remove("pane-resizing");
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    lastPointerX.current = event.clientX;
    setDragging(true);
    document.documentElement.classList.add("pane-resizing");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previousX = lastPointerX.current;
    if (previousX === null) return;

    const delta = event.clientX - previousX;
    if (delta === 0) return;
    lastPointerX.current = event.clientX;
    const signedDelta = side === "sidebar" ? delta : -delta;
    (onResizePreview ?? onResizeBy)(signedDelta);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    if (event.key === "Home") {
      event.preventDefault();
      onResizeBy(min - value);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onResizeBy(max - value);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const expandsPane = side === "sidebar" ? event.key === "ArrowRight" : event.key === "ArrowLeft";
    onResizeBy(expandsPane ? step : -step);
  };

  return (
    <div
      className={`pane-resize-handle pane-resize-handle-${side}${dragging ? " is-dragging" : ""}`}
      role="separator"
      aria-label={side === "sidebar" ? "调整左侧栏宽度" : "调整右侧栏宽度"}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDragging}
      onPointerCancel={finishDragging}
      onLostPointerCapture={finishDragging}
      onDoubleClick={onReset}
    />
  );
}
