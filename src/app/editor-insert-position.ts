export type EditorInsertAnchor = Readonly<{
  left: number;
  top: number;
  bottom: number;
}>;

export type EditorInsertPosition = Readonly<{
  left: number;
  top: number;
}>;

export const EDITOR_INSERT_VIEWPORT_MARGIN = 12;
export const EDITOR_INSERT_GAP = 10;

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function calculateEditorInsertPosition(
  anchor: EditorInsertAnchor | null | undefined,
  popoverWidth: number,
  popoverHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): EditorInsertPosition {
  const width = Math.max(0, finite(popoverWidth, 0));
  const height = Math.max(0, finite(popoverHeight, 0));
  const safeViewportWidth = Math.max(0, finite(viewportWidth, 0));
  const safeViewportHeight = Math.max(0, finite(viewportHeight, 0));
  const margin = EDITOR_INSERT_VIEWPORT_MARGIN;
  const gap = EDITOR_INSERT_GAP;
  const maxLeft = safeViewportWidth - width - margin;
  const maxTop = safeViewportHeight - height - margin;

  if (!anchor) {
    return {
      left: clamp(margin, margin, maxLeft),
      top: clamp(margin, margin, maxTop),
    };
  }

  const left = finite(anchor.left, margin);
  const top = finite(anchor.top, margin);
  const bottom = finite(anchor.bottom, top);
  const below = bottom + gap;
  const above = top - height - gap;
  const preferredTop = below + height <= safeViewportHeight - margin ? below : above >= margin ? above : below;

  return {
    left: clamp(left, margin, maxLeft),
    top: clamp(preferredTop, margin, maxTop),
  };
}
