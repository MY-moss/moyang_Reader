import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentTransitionConfirmationRequest } from "./document-session-controller";

/** Owns the pending UI decision only; draft and transition safety stay in the session controller. */
export function useDocumentTransitionConfirmation() {
  const [request, setRequest] = useState<DocumentTransitionConfirmationRequest | null>(null);
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

  const confirm = useCallback((next: DocumentTransitionConfirmationRequest): Promise<boolean> => {
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
