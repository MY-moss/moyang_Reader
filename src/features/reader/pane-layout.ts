export type PaneSide = "sidebar" | "context";

export type PaneWidths = {
  sidebar: number;
  context: number;
};

export const DEFAULT_PANE_WIDTHS: PaneWidths = {
  sidebar: 260,
  context: 320,
};

export const PANE_WIDTH_LIMITS: Record<PaneSide, { min: number; max: number }> = {
  sidebar: { min: 220, max: 380 },
  context: { min: 260, max: 440 },
};

export function clampPaneWidth(side: PaneSide, value: number): number {
  const limits = PANE_WIDTH_LIMITS[side];
  const safeValue = Number.isFinite(value) ? value : DEFAULT_PANE_WIDTHS[side];
  return Math.round(Math.min(limits.max, Math.max(limits.min, safeValue)));
}

export function normalizePaneWidths(value: unknown): PaneWidths {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_PANE_WIDTHS };

  const candidate = value as Partial<PaneWidths>;
  return {
    sidebar: clampPaneWidth("sidebar", candidate.sidebar ?? DEFAULT_PANE_WIDTHS.sidebar),
    context: clampPaneWidth("context", candidate.context ?? DEFAULT_PANE_WIDTHS.context),
  };
}
