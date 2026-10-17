import { useEffect, useRef } from "react";

/** One request at a time; responses from a prior activation never reach the view. */
export function useVisiblePolling<T>(
  enabled: boolean,
  read: () => Promise<T>,
  receive: (value: T) => void,
  fail: (error: unknown) => void,
  delay = 1500,
) {
  const visible = () => document.visibilityState !== "hidden";
  const callbacks = useRef({ read, receive, fail });
  useEffect(() => {
    callbacks.current = { read, receive, fail };
  }, [read, receive, fail]);
  const pending = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    const poll = async () => {
      if (!active || !visible() || running) return;
      running = true;
      let task: Promise<T> | undefined;
      try {
        if (pending.current) await pending.current.catch(() => undefined);
        if (!active || !visible()) return;
        task = callbacks.current.read();
        pending.current = task;
        const value = await task;
        if (active && visible()) callbacks.current.receive(value);
      } catch (error) {
        if (active) callbacks.current.fail(error);
      } finally {
        if (pending.current === task) pending.current = null;
        running = false;
        if (active && visible()) timer = setTimeout(() => void poll(), delay);
      }
    };
    const visibility = () => {
      clearTimeout(timer);
      if (visible()) void poll();
    };
    timer = setTimeout(() => void poll(), delay);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, delay]);
}
