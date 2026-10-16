/** Poll only the cheap change token; never overlap checks or run while the page is hidden. */
export function watchAiChanges(read: () => Promise<string>, refresh: () => void, report: (error: unknown) => void) {
  let stopped = false,
    busy = false,
    requested = false,
    last: string | undefined;
  const visible = () => document.visibilityState !== "hidden";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = async (force = false) => {
    if (stopped || !visible()) return;
    if (busy) {
      requested ||= force;
      return;
    }
    busy = true;
    if (timer) clearTimeout(timer);
    try {
      const token = await read();
      if (stopped || !visible()) return;
      if (force || (last !== undefined && last !== token)) refresh();
      last = token;
    } catch (error) {
      if (!stopped) report(error);
    } finally {
      busy = false;
      if (!stopped && visible()) {
        if (requested) {
          requested = false;
          void check(true);
        } else timer = setTimeout(() => void check(), 12000);
      }
    }
  };
  const wake = () => {
    void check(true);
  };
  const visibility = () => {
    if (document.visibilityState === "hidden") {
      if (timer) clearTimeout(timer);
    } else wake();
  };
  const changed = () => {
    void check(true);
  };
  window.addEventListener("focus", wake);
  window.addEventListener("storage", changed);
  document.addEventListener("visibilitychange", visibility);
  void check();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener("focus", wake);
    window.removeEventListener("storage", changed);
    document.removeEventListener("visibilitychange", visibility);
  };
}
