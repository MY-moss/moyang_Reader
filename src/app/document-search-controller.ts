import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { createSearchHighlightController, type SearchHighlightController } from "./search-highlighter";
import { resolveProgrammaticScrollBehavior } from "./scroll-behavior";
import type { ReaderMode } from "./types";

export type DocumentSearchControllerOptions = {
  articleRef: RefObject<HTMLElement | null>;
  mode: ReaderMode;
  renderedHtml: string;
  progressiveReaderReady: boolean;
  revealProgressiveReader: () => void;
  restoreFocusTarget: (target: HTMLElement | null) => boolean;
};

export type DocumentSearchController = {
  searchButtonRef: RefObject<HTMLButtonElement>;
  searchOpen: boolean;
  searchQuery: string;
  searchResultCount: number;
  searchResultIndex: number;
  setSearchQuery: (query: string) => void;
  resetSearch: () => void;
  openSearch: (restoreFocusTarget?: HTMLElement | null) => void;
  closeSearch: () => void;
  findText: (text: string, restoreFocusTarget?: HTMLElement | null) => void;
  moveResult: (step: number) => void;
};

export function useDocumentSearchController({
  articleRef,
  mode,
  renderedHtml,
  progressiveReaderReady,
  revealProgressiveReader,
  restoreFocusTarget,
}: DocumentSearchControllerOptions): DocumentSearchController {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQueryState] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const searchRestoreFocusRef = useRef<HTMLElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchHighlightRef = useRef<{
    root: HTMLElement;
    contentKey: string;
    controller: SearchHighlightController;
  } | null>(null);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setSearchResultIndex(0);
  }, []);

  const resetSearch = useCallback(() => {
    setSearchQuery("");
  }, [setSearchQuery]);

  const openSearch = useCallback((restoreFocusTarget?: HTMLElement | null) => {
    if (!searchRestoreFocusRef.current?.isConnected) {
      const activeElement =
        restoreFocusTarget ??
        (document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body &&
        document.activeElement !== document.documentElement
          ? document.activeElement
          : null);
      searchRestoreFocusRef.current = activeElement;
    }
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    const restoreTarget = searchRestoreFocusRef.current;
    searchRestoreFocusRef.current = null;
    setSearchOpen(false);
    resetSearch();

    if (!restoreFocusTarget(restoreTarget)) {
      restoreFocusTarget(searchButtonRef.current);
    }
  }, [resetSearch, restoreFocusTarget]);

  const findText = useCallback(
    (text: string, restoreFocusTarget?: HTMLElement | null) => {
      const query = text.trim();
      if (!query) return;
      openSearch(restoreFocusTarget);
      setSearchQuery(query);
    },
    [openSearch, setSearchQuery],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 160);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const root = articleRef.current;
    const contentKey = renderedHtml;
    if (!root || mode !== "rendered") {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    if (!progressiveReaderReady) {
      if (debouncedSearchQuery.trim()) revealProgressiveReader();
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    if (
      !searchHighlightRef.current ||
      searchHighlightRef.current.root !== root ||
      searchHighlightRef.current.contentKey !== contentKey
    ) {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = {
        root,
        contentKey,
        controller: createSearchHighlightController(root),
      };
    }

    const count = searchHighlightRef.current.controller.update(debouncedSearchQuery);
    setSearchResultCount(count);
    setSearchResultIndex((current) => (count ? Math.min(current, count - 1) : 0));
  }, [articleRef, debouncedSearchQuery, mode, progressiveReaderReady, renderedHtml, revealProgressiveReader]);

  useEffect(() => {
    if (mode !== "rendered" || !progressiveReaderReady) return;
    const target = searchHighlightRef.current?.controller.setActive(searchResultIndex);
    target?.scrollIntoView({ behavior: resolveProgrammaticScrollBehavior("auto"), block: "center" });
  }, [debouncedSearchQuery, mode, progressiveReaderReady, renderedHtml, searchResultIndex]);

  useEffect(
    () => () => {
      searchHighlightRef.current?.controller.dispose();
      searchHighlightRef.current = null;
    },
    [],
  );

  const moveResult = useCallback(
    (step: number) => {
      if (!searchResultCount) return;
      setSearchResultIndex((current) => (current + step + searchResultCount) % searchResultCount);
    },
    [searchResultCount],
  );

  return {
    searchButtonRef,
    searchOpen,
    searchQuery,
    searchResultCount,
    searchResultIndex,
    setSearchQuery,
    resetSearch,
    openSearch,
    closeSearch,
    findText,
    moveResult,
  };
}
