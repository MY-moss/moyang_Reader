import { BodyIndexer } from "../features/workspace/body-indexer";
import { isSameDocumentPath } from "../features/recovery/document-transition";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  locateSource,
  locateText,
  scrollToSource,
  selectionSourceLocation,
  sourceBlocks,
} from "../features/reader/source-locator";
import {
  readSourceSelection,
  revealSourceSelection,
  sourceSelectionLocation,
  subscribeSourceSelection,
} from "../features/editor/source-selection";
import { relocatePdfSource } from "../features/reader/pdf-source-location";
import { bookroomRequest } from "../platform/bookroom-bridge";
import { isTauriRuntime, readBinaryFile } from "../platform/bridge";
import { contentHash, extractSourceChunks } from "../features/documents/source-chunks";
import type {
  Annotation,
  Bookmark,
  ReaderSearchPage,
  RecycledEntry,
  RecyclePreview,
  SavedVersion,
  SavedView,
  SourceLocation,
} from "../shared/bookroom-types";
import type { ReaderApplication } from "./useReaderApplication";
import type { WorkbenchPanes } from "./useWorkbenchPanes";
import { flushLiveEditors } from "../shared/pending-work";

export type BookroomPage = "document" | "recent" | "search" | "bookmarks" | "annotations" | "views" | "recovery";
export function useBookroom(model: ReaderApplication, panes: WorkbenchPanes) {
  const [page, setPage] = useState<BookroomPage>("document");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<"relevance" | "name">("relevance");
  const [results, setResults] = useState<ReaderSearchPage>({ items: [], total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [recycled, setRecycled] = useState<RecycledEntry[]>([]);
  const [recyclePreview, setRecyclePreview] = useState<RecyclePreview | null>(null);
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [versionPreview, setVersionPreview] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [indexProgress, setIndexProgress] = useState("");
  const [indexErrors, setIndexErrors] = useState<string[]>([]);
  const [indexRevision, setIndexRevision] = useState(0);
  const appliedSourceLocation = useRef<SourceLocation | null>(null);
  const {
    sourceLocation,
    mode,
    sourceDraft,
    articleRef,
    setSettingsNotice,
    workspacePath,
    workspaceFiles,
    workspaceIndex,
    selectedFileKind,
    selectedTag,
    documentState,
    setMode,
    setSearchQuery,
    setSearchOpen,
    setSourceLocation,
  } = model;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    void Promise.all([
      bookroomRequest<Bookmark[]>({ action: "metadata.list", category: "bookmark" }),
      bookroomRequest<Annotation[]>({ action: "metadata.list", category: "annotation" }),
      bookroomRequest<SavedView[]>({ action: "metadata.list", category: "view" }),
    ])
      .then(([b, a, v]) => {
        if (active) {
          setBookmarks(b);
          setAnnotations(a);
          setViews(v);
        }
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const indexer = useRef<BodyIndexer | null>(null);
  useEffect(() => {
    setIndexProgress("");
    setIndexErrors([]);
    if (!workspacePath || !isTauriRuntime()) return;
    const worker = new BodyIndexer(workspacePath, (progress, errors, changed) => {
      setIndexProgress(progress);
      setIndexErrors(errors);
      if (changed) setIndexRevision((value) => value + 1);
    });
    indexer.current = worker;
    return () => {
      worker.dispose();
      indexer.current = null;
    };
  }, [workspacePath]);
  useEffect(() => {
    indexer.current?.update(workspaceFiles, workspaceIndex);
  }, [workspacePath, workspaceFiles, workspaceIndex]);
  useEffect(() => {
    if (page !== "search" || !workspacePath) {
      setResults({ items: [], total: 0 });
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      void bookroomRequest<ReaderSearchPage>({
        action: "search",
        root: workspacePath,
        query,
        offset,
        sort,
        kind: selectedFileKind,
        tag: selectedTag,
      })
        .then((found) => {
          if (active) setResults(found);
        })
        .catch((cause) => {
          if (active) setError(`搜索失败，已保留上一次结果。${String(cause)}`);
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, workspacePath, query, offset, indexRevision, selectedFileKind, selectedTag, sort, revision]);
  useEffect(() => {
    setOffset(0);
  }, [workspacePath, selectedFileKind, selectedTag]);
  useEffect(() => {
    if (page !== "recovery") return;
    let active = true;
    setVersionPreview(null);
    void Promise.all([
      workspacePath
        ? bookroomRequest<RecycledEntry[]>({ action: "trash.list", root: workspacePath })
        : Promise.resolve([]),
      documentState?.path && !documentState.path.startsWith("browser://")
        ? bookroomRequest<SavedVersion[]>({ action: "history.list", path: documentState.path })
        : Promise.resolve([]),
    ])
      .then(([trash, history]) => {
        if (active) {
          setRecycled(trash);
          setVersions(history);
        }
      })
      .catch((cause) => {
        if (active) setError(String(cause));
      });
    return () => {
      active = false;
    };
  }, [page, workspacePath, documentState?.path, revision]);
  useEffect(() => {
    const location = sourceLocation;
    if (
      page !== "document" ||
      !documentState ||
      !location ||
      location.path !== documentState.path ||
      (location.source ? mode !== "source" : mode !== "rendered") ||
      (!location.quote && !location.paragraph && !location.page && location.offset === undefined)
    )
      return;
    let active = true;
    const report = (status: string) => {
      if (status === "moved") setSettingsNotice("来源已变化，已根据引用文字重新定位。");
      if (status === "changed") setSettingsNotice("PDF 来源已变化，原页码可能不再对应原文。已保留摘录，请核对来源。");
      if (status === "missing" || status === "ambiguous")
        setSettingsNotice(
          status === "ambiguous"
            ? "原文中存在多处相同文字，无法唯一定位。已保留原摘录，请在文档中核对。"
            : "原文已经变化，未能找到原位置。已保留原摘录，请在文档中核对。",
        );
    };
    const locate = async () => {
      if (location.source && appliedSourceLocation.current === location) return;
      if (location.source) {
        const pane = document.querySelector(".reader-pane.is-active");
        const selection = pane && readSourceSelection(pane);
        if (!pane || !selection) return;
        const hash = await contentHash(selection.text);
        if (!active) return;
        const found = locateText(selection.text, location, location.hash === hash);
        if (found.from !== undefined && revealSourceSelection(pane, found.from, found.to!))
          appliedSourceLocation.current = location;
        report(found.status);
        return;
      }
      const hash = documentState.sourceHash ?? (await contentHash(sourceDraft));
      if (!active) return;
      if (location.page && documentState.kind === "pdf") {
        if (!location.hash || location.hash === hash) return;
        let chunks: import("../shared/bookroom-types").SourceChunk[] = [];
        if (location.quote?.trim()) {
          const bytes = documentState.previewUrl
            ? new Uint8Array(await (await fetch(documentState.previewUrl)).arrayBuffer())
            : await readBinaryFile(documentState.path);
          chunks = (await extractSourceChunks(documentState.path, "pdf", bytes)).chunks;
        }
        if (!active) return;
        const found = relocatePdfSource(location, hash, chunks);
        report(found.status);
        if (found.status === "moved") setSourceLocation({ ...location, hash, page: found.page });
        return;
      }
      {
        if (!active) return;
        const body = articleRef.current?.querySelector("[data-source-body]");
        if (!body) return;
        const found = locateSource(body, location, location.hash === hash);
        body.querySelectorAll("[data-source-target]").forEach((node) => node.removeAttribute("data-source-target"));
        if (found.element) {
          scrollToSource(found.element, found.range);
        }
        report(found.status);
      }
    };
    const run = () => {
      void locate().catch((cause) => {
        if (active) setError(String(cause));
      });
    };
    const unsubscribe = location.source ? subscribeSourceSelection(run) : undefined;
    run();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [page, documentState, sourceLocation, mode, sourceDraft, articleRef, setSettingsNotice, setSourceLocation]);
  const navigate = async (location: SourceLocation) => {
    await panes.openFile(location.path, false);
    const opened = model.documentSessions.active()?.document.path;
    if (!opened || !isSameDocumentPath(opened, location.path)) return;
    setPage("document");
    setSourceLocation({ ...location, path: opened });
    setMode(location.source ? "source" : "rendered");
    setSearchOpen(false);
    setSearchQuery("");
  };
  const currentLocation = async (): Promise<SourceLocation | null> => {
    if (!documentState) return null;
    flushLiveEditors();
    const pane = document.querySelector(".reader-pane.is-active");
    const sourceSelection = mode === "source" && pane ? readSourceSelection(pane) : undefined;
    if (sourceSelection)
      return {
        path: documentState.path,
        hash: await contentHash(sourceSelection.text),
        ...sourceSelectionLocation(sourceSelection),
      };
    const selection = window.getSelection();
    const body =
      articleRef.current?.querySelector("[data-source-body]") ??
      document.querySelector(".reader-pane.is-active .ProseMirror");
    const anchor = selection?.anchorNode;
    const selectedHere = !!(
      anchor &&
      selection?.focusNode &&
      body?.contains(anchor) &&
      body.contains(selection.focusNode)
    );
    const selectedLocation = body ? selectionSourceLocation(body, selection) : null;
    const blocks = body ? sourceBlocks(body) : [];
    const viewport = body?.closest(".content-area")?.getBoundingClientRect();
    const selectedBlock = selectedHere ? blocks.find((node) => node.contains(anchor)) : undefined;
    const visibleBlock = viewport
      ? blocks.find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > viewport.top + 8 && rect.top < viewport.bottom;
        })
      : undefined;
    const block = selectedBlock ?? visibleBlock;
    const quote =
      (selectedHere ? selection?.toString().trim() : "") || block?.textContent?.trim().slice(0, 300) || undefined;
    // Editor block structure may differ from rendered Markdown; quotes remain portable.
    const paragraph = block && body?.hasAttribute("data-source-body") ? blocks.indexOf(block) + 1 : 0;
    return {
      paragraph: paragraph || undefined,
      path: documentState.path,
      ...(documentState.kind === "pdf"
        ? { page: sourceLocation?.path === documentState.path ? (sourceLocation.page ?? 1) : 1 }
        : {}),
      hash:
        documentState.sourceHash ??
        (await contentHash(model.documentSessions.get(documentState.path)?.draft ?? sourceDraft)),
      quote,
      ...selectedLocation,
    };
  };
  const bookmark = async () => {
    const location = await currentLocation();
    if (!location) return;
    await bookroomRequest({
      action: "metadata.put",
      category: "bookmark",
      item: {
        id: crypto.randomUUID(),
        title:
          documentState?.name +
          (location.page ? ` · 第 ${location.page} 页` : location.quote ? ` · ${location.quote.slice(0, 40)}` : ""),
        location,
        created: Date.now(),
      },
    });
    refresh();
    setNotice("已加入收藏");
  };
  const bookmarkSearch = async () => {
    if (!workspacePath) return;
    const id = crypto.randomUUID();
    const title = query.trim() || "筛选后的阅读库";
    await bookroomRequest({
      action: "metadata.put",
      category: "bookmark",
      item: {
        id,
        title,
        location: { path: workspacePath },
        created: Date.now(),
        view: { id, title, root: workspacePath, query, kind: selectedFileKind, tag: selectedTag, sort },
      },
    });
    refresh();
    setNotice("已收藏当前搜索与筛选");
  };
  const previewRecycled = async (id: string) =>
    setRecyclePreview(await bookroomRequest<RecyclePreview>({ action: "trash.preview", root: workspacePath, id }));
  const addAnnotation = async (location: SourceLocation, quote: string, comment: string) => {
    await bookroomRequest({
      action: "metadata.put",
      category: "annotation",
      item: { id: crypto.randomUUID(), location: { ...location, quote }, quote, comment, created: Date.now() },
    });
    refresh();
    setNotice("摘录已保存");
  };
  const remove = async (category: string, id: string) => {
    await bookroomRequest({ action: "metadata.delete", category, id });
    refresh();
  };
  const saveView = async (title: string) => {
    await bookroomRequest({
      action: "metadata.put",
      category: "view",
      item: {
        id: crypto.randomUUID(),
        title,
        root: workspacePath,
        query,
        tag: selectedTag,
        kind: selectedFileKind,
        sort,
      },
    });
    refresh();
    setNotice("已保存当前视图");
  };
  const applyView = async (view: SavedView) => {
    if (view.root !== workspacePath) await model.handleOpenRecentWorkspace(view.root);
    model.setSelectedTag(view.tag);
    model.setSelectedFileKind(view.kind as typeof selectedFileKind);
    setQuery(view.query);
    setSort(view.sort);
    setOffset(0);
    setPage("search");
  };
  const restore = async (id: string) => {
    const path = await bookroomRequest<string>({ action: "trash.restore", root: workspacePath, id });
    refresh();
    setRecyclePreview(null);
    setNotice(`已恢复：${path}`);
    await model.handleRefreshWorkspaceEntry("");
  };
  const previewVersion = async (id: number) => {
    setVersionPreview(await bookroomRequest<string>({ action: "history.get", path: documentState?.path, id }));
  };
  const restoreVersion = async () => {
    if (versionPreview === null) return;
    model.updateSource(versionPreview);
    setPage("document");
    setMode("source");
    setNotice("历史内容已放入编辑器，可检查、撤销或保存");
  };
  return {
    bookmarkSearch,
    recyclePreview,
    setRecyclePreview,
    previewRecycled,
    page,
    setPage,
    sort,
    setSort,
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setOffset(0);
    },
    offset,
    setOffset,
    results,
    busy,
    error,
    setError,
    notice,
    setNotice,
    bookmarks,
    annotations,
    views,
    recycled,
    versions,
    versionPreview,
    indexProgress,
    indexErrors,
    refresh,
    retryIndex: () => indexer.current?.retry(),
    navigate,
    currentLocation,
    bookmark,
    addAnnotation,
    remove,
    saveView,
    applyView,
    restore,
    previewVersion,
    restoreVersion,
  };
}
export type Bookroom = ReturnType<typeof useBookroom>;
