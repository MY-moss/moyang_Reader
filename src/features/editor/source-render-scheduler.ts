export const SOURCE_RENDER_DEBOUNCE_MS = 180;

export function scheduleSourceRender(callback: () => void): () => void {
  const timer = window.setTimeout(callback, SOURCE_RENDER_DEBOUNCE_MS);
  return () => window.clearTimeout(timer);
}
