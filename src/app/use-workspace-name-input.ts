import { useCallback, useEffect, useRef, useState } from "react";
import {
  validateWorkspaceNameInput,
  type WorkspaceNameInputRequest,
  type WorkspaceNameInputSubmit,
} from "./workspace-name-input";

type PendingName = {
  request: WorkspaceNameInputRequest;
  submit: WorkspaceNameInputSubmit;
  resolve: (accepted: boolean) => void;
  busy: boolean;
};
export type WorkspaceNameInputState = { request: WorkspaceNameInputRequest; busy: boolean; error: unknown | null };

/** Owns input and submission state only; the injected workspace operation owns all IO. */
export function useWorkspaceNameInput() {
  const [state, setState] = useState<WorkspaceNameInputState | null>(null);
  const pendingRef = useRef<PendingName | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    };
  }, []);
  const requestName = useCallback(
    (request: WorkspaceNameInputRequest, submit: WorkspaceNameInputSubmit): Promise<boolean> => {
      if (!mountedRef.current || pendingRef.current) return Promise.resolve(false);
      return new Promise((resolve) => {
        pendingRef.current = { request, submit, resolve, busy: false };
        setState({ request, busy: false, error: null });
      });
    },
    [],
  );
  const cancel = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending || pending.busy) return;
    pendingRef.current = null;
    setState(null);
    pending.resolve(false);
  }, []);
  const submitName = useCallback(async (value: string) => {
    const pending = pendingRef.current;
    if (!pending || pending.busy || validateWorkspaceNameInput(pending.request, value)) return;
    pending.busy = true;
    setState({ request: pending.request, busy: true, error: null });
    try {
      const outcome = await pending.submit(value.trim());
      if (!mountedRef.current || pendingRef.current !== pending) return;
      pendingRef.current = null;
      setState(null);
      pending.resolve(outcome === "done");
    } catch (error) {
      if (!mountedRef.current || pendingRef.current !== pending) return;
      pending.busy = false;
      setState({ request: pending.request, busy: false, error: error ?? new Error() });
    }
  }, []);
  const clearError = useCallback(() => setState((current) => current && { ...current, error: null }), []);
  return { state, requestName, cancel, submitName, clearError };
}
