import { useCallback, useEffect, type MouseEvent } from "react";
import { imageMimeType } from "../features/documents/rendering/document-adapters";
import { saveLocale } from "../features/settings/i18n";
import { findIndexEntry, findLinkedEntry } from "../features/workspace/workspace-index";
import { isTauriRuntime, openExternalUrl, readBinaryFile, readTextFile } from "../platform/bridge";
import { renderDocumentEmbed } from "../features/documents/rendering/embeds";
import { copyPlainText, resolveRelativePath, resolveWikiPath, safeDecode, scrollToHeading } from "./support";
import type { useDocumentTabs } from "./useDocumentTabs";
import type { useReaderState } from "./useReaderState";
type Input = Pick<
  ReturnType<typeof useReaderState>,
  | "documentState"
  | "sourceDraft"
  | "preferences"
  | "workspaceIndex"
  | "setError"
  | "contentAreaRef"
  | "articleRef"
  | "setReaderContextMenu"
  | "setSettingsNotice"
  | "documentStateRef"
  | "mode"
  | "theme"
  | "locale"
  | "selectedTag"
  | "workspacePath"
  | "setSelectedTag"
  | "setDebouncedSearchQuery"
  | "searchQuery"
  | "setSearchResultCount"
  | "setSearchResultIndex"
  | "debouncedSearchQuery"
  | "searchResultIndex"
> &
  Pick<ReturnType<typeof useDocumentTabs>, "handleSelectTab">;
export function useReaderLinks({
  documentState,
  sourceDraft,
  preferences,
  workspaceIndex,
  setError,
  handleSelectTab,
  contentAreaRef,
  articleRef,
  setReaderContextMenu,
  setSettingsNotice,
  documentStateRef,
  mode,
  theme,
  locale,
  selectedTag,
  workspacePath,
  setSelectedTag,
  setDebouncedSearchQuery,
  searchQuery,
  setSearchResultCount,
  setSearchResultIndex,
  debouncedSearchQuery,
  searchResultIndex,
}: Input) {
  const handleOpenReaderLink = useCallback(
    (href: string) => {
      if (href.startsWith("moyang-wiki:")) {
        const target = safeDecode(href.slice("moyang-wiki:".length));
        const [rawPath, rawAnchor] = target.split("#", 2);
        if (!rawPath && rawAnchor) {
          scrollToHeading(rawAnchor, contentAreaRef.current, articleRef.current);
          return;
        }
        const currentEntry = documentState ? findIndexEntry(workspaceIndex, documentState.path) : undefined;
        const linkedEntry = currentEntry ? findLinkedEntry(workspaceIndex, currentEntry, rawPath) : undefined;
        const path =
          linkedEntry?.file.path ??
          (documentState ? resolveWikiPath(documentState.path, rawPath || documentState.path) : null);
        if (!path) {
          setError("浏览器预览模式无法解析文档内链接，请在 Moyang Reader 桌面版中打开。");
          return;
        }
        void handleSelectTab(path).then(() => {
          if (rawAnchor) scrollToHeading(safeDecode(rawAnchor), contentAreaRef.current, articleRef.current);
        });
        return;
      }

      const target = safeDecode(href);
      if (target.startsWith("#")) {
        scrollToHeading(target.slice(1), contentAreaRef.current, articleRef.current);
        return;
      }

      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
        const normalized = target.startsWith("//") ? `https:${target}` : target;
        try {
          const externalUrl = new URL(normalized, window.location.href);
          if (!["http:", "https:", "mailto:", "tel:"].includes(externalUrl.protocol)) {
            setError("已阻止不受支持的外部链接协议。");
            return;
          }
          void openExternalUrl(externalUrl.toString()).catch((cause) => {
            setError(cause instanceof Error ? cause.message : "无法打开外部链接。");
          });
        } catch {
          setError("无法解析这个外部链接。");
        }
        return;
      }
      if (!documentState || documentState.path.startsWith("browser://")) {
        setError("浏览器预览模式无法解析本地文档链接，请在 Moyang Reader 桌面版中打开。");
        return;
      }

      const [rawPath, rawAnchor] = target.split("#", 2);
      const path = resolveRelativePath(documentState.path, rawPath);
      if (!path) {
        setError("无法解析这个本地文档链接。");
        return;
      }
      void handleSelectTab(path).then(() => {
        if (rawAnchor) scrollToHeading(safeDecode(rawAnchor), contentAreaRef.current, articleRef.current);
      });
    },
    [articleRef, contentAreaRef, documentState, handleSelectTab, setError, workspaceIndex],
  );

  const handleReaderClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const anchor = (event.target as HTMLElement).closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;

      event.preventDefault();
      handleOpenReaderLink(href);
    },
    [handleOpenReaderLink],
  );

  const handleReaderContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      const anchor = (event.target as HTMLElement).closest("a");
      setReaderContextMenu({
        x: event.clientX,
        y: event.clientY,
        selectedText: window.getSelection()?.toString() ?? "",
        linkHref: anchor?.getAttribute("href") ?? null,
      });
    },
    [setReaderContextMenu],
  );

  const handleCopyReaderText = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value) return;

      try {
        await copyPlainText(value);
        setSettingsNotice("选中文本已复制。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制选中文本失败。");
      }
    },
    [setError, setSettingsNotice],
  );

  const handleCopyReaderLink = useCallback(
    async (href: string) => {
      try {
        await copyPlainText(href);
        setSettingsNotice("链接地址已复制。");
        setError(null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "复制链接地址失败。");
      }
    },
    [setError, setSettingsNotice],
  );

  const handleCopyReaderDocumentPath = useCallback(async () => {
    const path = documentStateRef.current?.path;
    if (!path || path.startsWith("browser://")) {
      setError("当前文档没有可复制的本地路径。");
      return;
    }

    try {
      await copyPlainText(path);
      setSettingsNotice("文档路径已复制。");
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "复制文档路径失败。");
    }
  }, [documentStateRef, setError, setSettingsNotice]);

  useEffect(() => {
    setReaderContextMenu(null);
  }, [documentState?.path, mode, setReaderContextMenu]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }

    try {
      localStorage.setItem("moyang-reader-theme", theme);
    } catch {
      // Local storage may be unavailable in a restricted browser preview.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === "en-US" ? "en" : "zh-CN";
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!selectedTag || !workspacePath || workspaceIndex.some((entry) => entry.tags.includes(selectedTag))) return;
    setSelectedTag(null);
  }, [selectedTag, setSelectedTag, workspaceIndex, workspacePath]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 160);
    return () => window.clearTimeout(timer);
  }, [searchQuery, setDebouncedSearchQuery]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || mode !== "rendered") {
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    root.querySelectorAll("mark.moyang-search-hit").forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
      parent.normalize();
    });

    const query = debouncedSearchQuery.trim().toLocaleLowerCase();
    if (!query) {
      setSearchResultCount(0);
      setSearchResultIndex(0);
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      if (currentNode.parentElement?.tagName !== "SCRIPT" && currentNode.parentElement?.tagName !== "STYLE") {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const value = textNode.nodeValue ?? "";
      const lowerValue = value.toLocaleLowerCase();
      const positions: number[] = [];
      let cursor = 0;
      while (true) {
        const position = lowerValue.indexOf(query, cursor);
        if (position < 0) break;
        positions.push(position);
        cursor = position + query.length;
      }

      for (const position of positions.reverse()) {
        const range = document.createRange();
        range.setStart(textNode, position);
        range.setEnd(textNode, position + query.length);
        const mark = document.createElement("mark");
        mark.className = "moyang-search-hit";
        range.surroundContents(mark);
      }
    }

    const hits = Array.from(root.querySelectorAll<HTMLElement>("mark.moyang-search-hit"));
    setSearchResultCount(hits.length);
    setSearchResultIndex((current) => (hits.length ? Math.min(current, hits.length - 1) : 0));
  }, [
    articleRef,
    debouncedSearchQuery,
    documentState?.rendered.html,
    mode,
    setSearchResultCount,
    setSearchResultIndex,
  ]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root || mode !== "rendered") return;

    const hits = Array.from(root.querySelectorAll<HTMLElement>("mark.moyang-search-hit"));
    const nextIndex = hits.length ? Math.min(searchResultIndex, hits.length - 1) : 0;
    hits.forEach((hit, index) => hit.classList.toggle("active", index === nextIndex));
    hits[nextIndex]?.scrollIntoView({ block: "center" });
  }, [articleRef, debouncedSearchQuery, documentState?.rendered.html, mode, searchResultIndex]);

  useEffect(() => {
    const root = articleRef.current;
    const currentPath = documentState?.path;
    if (!root || mode !== "rendered" || !currentPath) return;

    let active = true;
    const objectUrls = new Set<string>();
    const replacedEmbeds: Array<[HTMLElement, HTMLImageElement]> = [];
    void (async () => {
      const images = Array.from(root.querySelectorAll<HTMLImageElement>("img[src]"));
      for (const image of images) {
        if (!active) break;
        const source = image.dataset.originalSource ?? image.getAttribute("src") ?? "";
        const target = source.startsWith("moyang-embed:") ? source.slice("moyang-embed:".length) : source;
        const [embedPath, anchor = ""] = safeDecode(target).split("#", 2);
        if (
          source.startsWith("moyang-embed:") &&
          (!/\.[a-z0-9]+$/i.test(embedPath) || /\.(md|markdown|mdown|mkd)$/i.test(embedPath))
        ) {
          const figure = document.createElement("figure");
          figure.className = "document-embed";
          try {
            const currentEntry = documentState ? findIndexEntry(workspaceIndex, currentPath) : undefined;
            const linked = currentEntry ? findLinkedEntry(workspaceIndex, currentEntry, embedPath) : undefined;
            const resolved = linked?.file.path ?? resolveWikiPath(currentPath, embedPath);
            if (embedPath && (!resolved || !isTauriRuntime()))
              throw new Error("请在桌面版打开阅读库后查看跨文档嵌入。");
            const contents = embedPath ? await readTextFile(resolved!) : sourceDraft;
            if (contents.length > 2_000_000) throw new Error("嵌入文档过大，请单独打开阅读。");
            figure.innerHTML = await renderDocumentEmbed(contents, anchor, preferences.allowRemoteResources);
            const basePath = embedPath ? resolved! : currentPath;
            figure.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
              const href = link.getAttribute("href") ?? "";
              if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) return;
              const [targetPath, fragment = ""] = safeDecode(href.replace(/^moyang-wiki:/, "")).split("#", 2);
              const target = targetPath
                ? href.startsWith("moyang-wiki:")
                  ? resolveWikiPath(basePath, targetPath)
                  : resolveRelativePath(basePath, targetPath)
                : basePath;
              if (target)
                link.setAttribute(
                  "href",
                  `moyang-wiki:${encodeURIComponent(target)}${fragment ? `#${encodeURIComponent(fragment)}` : ""}`,
                );
            });
            figure.querySelectorAll<HTMLImageElement>("img[src]").forEach((embeddedImage) => {
              embeddedImage.dataset.basePath = basePath;
              images.push(embeddedImage);
            });
          } catch (cause) {
            figure.textContent = cause instanceof Error ? cause.message : "无法读取嵌入文档";
          }
          if (active) {
            image.replaceWith(figure);
            replacedEmbeds.push([figure, image]);
          }
          continue;
        }
        if (!isTauriRuntime()) continue;
        if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue;
        const localPath = resolveRelativePath(image.dataset.basePath ?? currentPath, safeDecode(target));
        if (!localPath) continue;
        image.dataset.originalSource = source;

        try {
          const bytes = await readBinaryFile(localPath);
          const binary = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          const objectUrl = URL.createObjectURL(new Blob([binary], { type: imageMimeType(localPath) }));
          if (!active) {
            URL.revokeObjectURL(objectUrl);
            continue;
          }
          objectUrls.add(objectUrl);
          image.src = objectUrl;
        } catch {
          // Keep the original source when a relative attachment is unavailable or unauthorized.
        }
      }
    })();

    return () => {
      active = false;
      replacedEmbeds.forEach(([figure, image]) => {
        if (root.contains(figure)) figure.replaceWith(image);
      });
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, [articleRef, documentState, sourceDraft, mode, workspaceIndex, preferences.allowRemoteResources]);
  return {
    handleOpenReaderLink,
    handleReaderClick,
    handleReaderContextMenu,
    handleCopyReaderText,
    handleCopyReaderLink,
    handleCopyReaderDocumentPath,
  };
}
