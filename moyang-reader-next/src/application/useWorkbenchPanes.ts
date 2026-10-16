import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizePathKey } from "../platform/path-key";
import { isSameDocumentPath as samePath } from "../features/recovery/document-transition";
import { readPaneView, rebasePaneViews } from "../features/reader/pane-view-state";
import { rebaseWorkspacePath } from "../features/workspace/workspace-entry";
import { reorderTabs } from "../features/workspace/tab-order";
import type { ReaderApplication } from "./useReaderApplication";
export type WorkbenchPane = { id: number; paths: string[]; activePath: string | null; previewPath: string | null };
const emptyPane = (id: number): WorkbenchPane => ({ id, paths: [], activePath: null, previewPath: null });
const KEY = "moyang.workbench.panes.v1";
export function useWorkbenchPanes(model: ReaderApplication) {
  const [panes, setPanes] = useState<[WorkbenchPane, WorkbenchPane]>(() => [emptyPane(0), emptyPane(1)]);
  const [split, setSplit] = useState(false);
  const [activePane, setActivePane] = useState<0 | 1>(0);
  const activeRef = useRef<0 | 1>(0);
  const pendingOpen = useRef(0);
  const [navigation, setNavigation] = useState<{ paths: string[]; cursor: number }>({ paths: [], cursor: -1 });
  const navigating = useRef(false);
  const [ratio, setRatio] = useState(50);
  const restored = useRef(false);
  const pendingViewRestore = useRef<number | null>(null);
  const { documentSessions, handleSelectTab, openTabs } = model;
  const { handleCloseTabs, setSourceLocation } = model;
  useEffect(() => {
    const renamed = (event: Event) => {
      const { from, to } = (event as CustomEvent<{ from: string; to: string }>).detail;
      const path = (value: string | null) => (value ? rebaseWorkspacePath(value, from, to) : null);
      rebasePaneViews(from, to);
      setNavigation((current) => ({ ...current, paths: current.paths.map((value) => path(value)!) }));
      setPanes(
        (current) =>
          current.map((pane) => ({
            ...pane,
            paths: pane.paths.map((p) => path(p)!),
            activePath: path(pane.activePath),
            previewPath: path(pane.previewPath),
          })) as [WorkbenchPane, WorkbenchPane],
      );
    };
    const closed = (event: Event) => {
      const paths = new Set((event as CustomEvent<string[]>).detail.map(normalizePathKey));
      setPanes(
        (current) =>
          current.map((pane) => {
            const remaining = pane.paths.filter((p) => !paths.has(normalizePathKey(p)));
            return {
              ...pane,
              paths: remaining,
              activePath:
                pane.activePath && paths.has(normalizePathKey(pane.activePath))
                  ? (remaining.at(-1) ?? null)
                  : pane.activePath,
              previewPath: pane.previewPath && paths.has(normalizePathKey(pane.previewPath)) ? null : pane.previewPath,
            };
          }) as [WorkbenchPane, WorkbenchPane],
      );
    };
    window.addEventListener("moyang:path-renamed", renamed);
    window.addEventListener("moyang:paths-closed", closed);
    return () => {
      window.removeEventListener("moyang:path-renamed", renamed);
      window.removeEventListener("moyang:paths-closed", closed);
    };
  }, []);
  const assign = useCallback(
    (index: 0 | 1, path: string, preview: boolean) => {
      setPanes((current) => {
        const pane = current[index];
        const existing = pane.paths.find((item) => samePath(item, path));
        path = existing ?? path;
        let paths = pane.paths;
        if (!existing) {
          paths = paths.filter((p) => p !== pane.previewPath || documentSessions.get(p)?.document.modified);
          paths = [...paths, path];
        }
        const next: [WorkbenchPane, WorkbenchPane] = [...current];
        next[index] = {
          ...pane,
          paths,
          activePath: path,
          previewPath: existing ? pane.previewPath : preview ? path : null,
        };
        return next;
      });
    },
    [documentSessions],
  );
  const openFile = useCallback(
    async (path: string, preview = true, index = activeRef.current) => {
      activeRef.current = index;
      setActivePane(index);
      pendingOpen.current += 1;
      try {
        const previous = panes[index].previewPath;
        const view = readPaneView(panes[index].id, path);
        await handleSelectTab(path);
        const openedPath = documentSessions.active()?.document.path;
        if (openedPath && samePath(openedPath, path)) {
          if (view.mode) documentSessions.setMode(view.mode);
          setSourceLocation({ path: openedPath, page: view.page });
          assign(index, openedPath, preview);
          if (
            previous &&
            !samePath(previous, path) &&
            !documentSessions.get(previous)?.document.modified &&
            !panes[index === 0 ? 1 : 0].paths.includes(previous)
          )
            await handleCloseTabs([previous]);
        }
      } finally {
        pendingOpen.current -= 1;
      }
    },
    [assign, documentSessions, handleSelectTab, handleCloseTabs, panes, setSourceLocation],
  );
  useEffect(() => {
    const path = model.documentState?.path;
    if (!path || pendingOpen.current) return;
    assign(activeRef.current, path, false);
  }, [model.documentState?.path, assign]);
  useEffect(() => {
    const path = model.documentState?.path;
    if (path && !navigating.current)
      setNavigation((current) =>
        current.paths[current.cursor] === path
          ? current
          : {
              paths: [...current.paths.slice(0, current.cursor + 1), path].slice(-100),
              cursor: Math.min(99, current.cursor + 1),
            },
      );
  }, [model.documentState?.path]);
  useEffect(() => {
    if (restored.current || !openTabs.length) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (!saved || !Array.isArray(saved.panes) || saved.panes.length !== 2) return;
      const valid = new Set(openTabs.map((tab) => normalizePathKey(tab.path)));
      const parse = (pane: WorkbenchPane, index: number): WorkbenchPane => {
        const paths = Array.isArray(pane.paths)
          ? pane.paths.filter((p) => typeof p === "string" && valid.has(normalizePathKey(p)))
          : [];
        return {
          id: typeof pane.id === "number" ? pane.id : index,
          paths,
          activePath: paths.includes(pane.activePath ?? "") ? pane.activePath : (paths[0] ?? null),
          previewPath: null,
        };
      };
      const recovered: [WorkbenchPane, WorkbenchPane] = [parse(saved.panes[0], 0), parse(saved.panes[1], 1)];
      const currentPath = documentSessions.active()?.document.path;
      const recoveredIndex =
        saved.split &&
        (saved.activePane === 1 ||
          (saved.activePane === undefined &&
            currentPath &&
            recovered[1].activePath &&
            samePath(recovered[1].activePath, currentPath)))
          ? 1
          : 0;
      activeRef.current = recoveredIndex;
      setActivePane(recoveredIndex);
      setPanes(recovered);
      if (currentPath) assign(recoveredIndex, currentPath, false);
      setSplit(Boolean(saved.split));
      setRatio(typeof saved.ratio === "number" ? Math.max(30, Math.min(70, saved.ratio)) : 50);
      const paneId = recovered[recoveredIndex].id;
      if (currentPath) {
        const view = readPaneView(paneId, currentPath);
        if (view.mode) documentSessions.setMode(view.mode);
        setSourceLocation({ path: currentPath, page: view.page });
      } else pendingViewRestore.current = paneId;
    } catch {
      /* Invalid view preferences do not affect files. */
    }
  }, [openTabs, documentSessions, assign, setSourceLocation]);
  useLayoutEffect(() => {
    const path = model.documentState?.path;
    if (!path || pendingViewRestore.current === null) return;
    const view = readPaneView(pendingViewRestore.current, path);
    pendingViewRestore.current = null;
    if (view.mode) documentSessions.setMode(view.mode);
    setSourceLocation({ path, page: view.page });
  }, [model.documentState?.path, documentSessions, setSourceLocation]);
  useEffect(() => {
    if (!panes.some((pane) => pane.paths.length)) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ panes, split, ratio, activePane }));
    } catch {
      /* Content is stored separately. */
    }
  }, [panes, split, ratio, activePane]);
  useEffect(() => {
    if (!model.documentState?.modified) return;
    const path = model.documentState.path;
    setPanes(
      (current) =>
        current.map((pane) => (pane.previewPath === path ? { ...pane, previewPath: null } : pane)) as [
          WorkbenchPane,
          WorkbenchPane,
        ],
    );
  }, [model.documentState?.modified, model.documentState?.path]);
  const activate = (index: 0 | 1) => {
    activeRef.current = index;
    setActivePane(index);
    const path = panes[index].activePath;
    if (path) void openFile(path, false, index);
  };
  const toggleSplit = () => {
    if (split) {
      const currentPath = model.documentState?.path;
      if (currentPath) assign(0, currentPath, false);
      activeRef.current = 0;
      setActivePane(0);
      setSplit(false);
    } else {
      const path = model.documentState?.path;
      if (path && !panes[1].activePath) assign(1, path, false);
      setSplit(true);
    }
  };
  const close = async (index: 0 | 1, path: string) => {
    pendingOpen.current += 1;
    try {
      const other = panes[index === 0 ? 1 : 0];
      const session = documentSessions.get(path);
      if (session?.document.modified && !other.paths.includes(path) && !path.startsWith("browser://")) {
        if (!(await model.saveDocument(false, path))) return;
      }
      if (!other.paths.includes(path)) {
        const closed = await model.handleCloseTabs([path]);
        if (closed === false) return;
      }
      const nextPaths = panes[index].paths.filter((p) => p !== path);
      const nextActive = panes[index].activePath === path ? (nextPaths.at(-1) ?? null) : panes[index].activePath;
      setPanes(
        (current) =>
          current.map((pane, i) =>
            i === index
              ? {
                  ...pane,
                  paths: nextPaths,
                  activePath: nextActive,
                  previewPath: pane.previewPath === path ? null : pane.previewPath,
                }
              : pane,
          ) as [WorkbenchPane, WorkbenchPane],
      );
      if (activeRef.current === index && nextActive) await openFile(nextActive, false, index);
      else if (activeRef.current === index && !nextActive && other.activePath) activate(index === 0 ? 1 : 0);
    } finally {
      pendingOpen.current -= 1;
    }
  };
  const navigateHistory = async (delta: number) => {
    const cursor = navigation.cursor + delta;
    const path = navigation.paths[cursor];
    if (!path) return;
    navigating.current = true;
    try {
      await openFile(path, false);
      if (documentSessions.active()?.document.path === path) setNavigation((current) => ({ ...current, cursor }));
    } finally {
      setTimeout(() => {
        navigating.current = false;
      }, 0);
    }
  };
  return {
    canGoBack: navigation.cursor > 0,
    canGoForward: navigation.cursor + 1 < navigation.paths.length,
    navigateHistory,
    panes,
    split,
    activePane,
    ratio,
    setRatio,
    openFile,
    activate,
    toggleSplit,
    close,
    reorder: (index: 0 | 1, source: string, target: string) =>
      setPanes(
        (current) =>
          current.map((pane, i) =>
            i === index
              ? {
                  ...pane,
                  paths: reorderTabs(
                    pane.paths.map((path) => ({ path })),
                    source,
                    target,
                  ).map((tab) => tab.path),
                }
              : pane,
          ) as [WorkbenchPane, WorkbenchPane],
      ),
    pin: (index: 0 | 1) =>
      setPanes(
        (current) =>
          current.map((pane, i) => (i === index ? { ...pane, previewPath: null } : pane)) as [
            WorkbenchPane,
            WorkbenchPane,
          ],
      ),
    swap: () => {
      setPanes(([a, b]) => [b, a]);
      const next = activeRef.current === 0 ? 1 : 0;
      activeRef.current = next;
      setActivePane(next);
    },
  };
}
export type WorkbenchPanes = ReturnType<typeof useWorkbenchPanes>;
