import { useCallback, useEffect, useState } from "react";

import type { WorkspaceSearchResult } from "./types";

export type WorkspaceSearchControllerOptions = {
  workspacePath: string | null;
  workspaceRevision: number;
  isNative: boolean;
  searchWorkspace: (root: string, query: string) => Promise<WorkspaceSearchResult[]>;
  setError: (message: string | null) => void;
};

export type WorkspaceSearchController = {
  workspaceQuery: string;
  workspaceResults: WorkspaceSearchResult[];
  workspaceSearchLoading: boolean;
  setWorkspaceQuery: (query: string) => void;
  clearWorkspaceResults: () => void;
};

export function useWorkspaceSearchController({
  workspacePath,
  workspaceRevision,
  isNative,
  searchWorkspace,
  setError,
}: WorkspaceSearchControllerOptions): WorkspaceSearchController {
  const [workspaceQuery, setWorkspaceQueryState] = useState("");
  const [workspaceResults, setWorkspaceResults] = useState<WorkspaceSearchResult[]>([]);
  const [workspaceSearchLoading, setWorkspaceSearchLoading] = useState(false);

  const setWorkspaceQuery = useCallback((query: string) => {
    setWorkspaceQueryState(query);
  }, []);

  const clearWorkspaceResults = useCallback(() => {
    setWorkspaceResults([]);
  }, []);

  useEffect(() => {
    const query = workspaceQuery.trim();
    if (!isNative || !workspacePath || query.length < 2) {
      setWorkspaceResults([]);
      setWorkspaceSearchLoading(false);
      return;
    }

    let active = true;
    setWorkspaceSearchLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(workspacePath, query)
        .then((results) => {
          if (active) setWorkspaceResults(results);
        })
        .catch((cause) => {
          if (active) {
            setWorkspaceResults([]);
            setError(
              cause instanceof Error ? `当前阅读库搜索失败：${cause.message}` : "当前阅读库搜索失败，请稍后重试。",
            );
          }
        })
        .finally(() => {
          if (active) setWorkspaceSearchLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isNative, searchWorkspace, setError, workspacePath, workspaceQuery, workspaceRevision]);

  return {
    workspaceQuery,
    workspaceResults,
    workspaceSearchLoading,
    setWorkspaceQuery,
    clearWorkspaceResults,
  };
}
