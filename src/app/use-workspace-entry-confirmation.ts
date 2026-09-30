import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceEntryConfirmationRequest } from "./workspace-entry-operations-controller";

/** Owns only the modal decision; file operations remain in the workspace controller. */
export function useWorkspaceEntryConfirmation() {
  const [request, setRequest] = useState<WorkspaceEntryConfirmationRequest | null>(null);
  const resolveRef = useRef<((accepted: boolean) => void) | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const confirm = useCallback((next: WorkspaceEntryConfirmationRequest): Promise<boolean> => {
    if (!mountedRef.current || resolveRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setRequest(next);
    });
  }, []);

  const decide = useCallback((accepted: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(accepted);
  }, []);

  return { request, confirm, decide };
}
