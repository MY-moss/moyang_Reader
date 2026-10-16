/** Small in-memory trace compiled only into the explicitly opted-in desktop test build. */
export function recordDesktopTestEvent(event: string, data: unknown): void {
  if (!__MOYANG_DESKTOP_E2E__) return;
  const target = window as Window & { __readerTestEvents?: unknown[] };
  const entries = (target.__readerTestEvents ??= []);
  entries.push({ event, data, time: Date.now() });
  if (entries.length > 100) entries.shift();
}
