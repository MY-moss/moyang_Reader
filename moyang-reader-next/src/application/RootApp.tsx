import type { SourceLocation } from "../shared/bookroom-types";
import { ConflictDialog } from "./views/ConflictDialog";
import { useBookroom, type BookroomPage } from "./useBookroom";
import { BookroomPageView, ExcerptComposer } from "./views/BookroomPage";
import { lazy, Suspense, useEffect, useLayoutEffect, useState, type CSSProperties, type SetStateAction } from "react";
import { App } from "./App";
import { subscribeToFileDrop, subscribeToOpenPaths } from "../platform/bridge";
import { useReaderApplication } from "./useReaderApplication";
import { useWorkbenchPanes } from "./useWorkbenchPanes";
import { LibrarySidebar } from "./views/LibrarySidebar";
import { Icon } from "../shared/components/Icon";
import { PaneResizeHandle } from "../shared/components/PaneResizeHandle";
import { PANE_WIDTH_LIMITS } from "../features/reader/pane-layout";
const AiSpace = lazy(() => import("../features/ai/AiSpace"));
export function RootApp() {
  const model = useReaderApplication();
  const panes = useWorkbenchPanes(model);
  const bookroom = useBookroom(model, panes);
  const [excerpt, setExcerpt] = useState<SourceLocation | null>(null);
  const setBookroomPage = bookroom.setPage;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "f" &&
        document.body.dataset.activeSpace !== "ai"
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setBookroomPage("search");
      }
    };
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  }, [setBookroomPage]);
  const [space, setSpace] = useState<"reader" | "ai">(() =>
    localStorage.getItem("moyang.activeSpace") === "ai" ? "ai" : "reader",
  );
  const [visitedAi, setVisitedAi] = useState(space === "ai");
  const [aiSidebar, setAiSidebar] = useState<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [density, setDensity] = useState(() =>
    localStorage.getItem("moyang.density") === "compact" ? "compact" : "comfortable",
  );
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigateSource = bookroom.navigate,
    reportSourceError = bookroom.setError;
  useEffect(() => {
    const open = (event: Event) => {
      const location = (event as CustomEvent<SourceLocation>).detail;
      if (!location?.path) return;
      setSpace("reader");
      setSettingsOpen(false);
      void navigateSource(location).catch((error) => reportSourceError(String(error)));
    };
    window.addEventListener("moyang:open-ai-source", open);
    return () => window.removeEventListener("moyang:open-ai-source", open);
  }, [navigateSource, reportSourceError]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const changed = () => {
      setNarrow(query.matches);
      setNavigationOpen(false);
    };
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!narrow) return;
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "KeyB") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setNavigationOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  }, [narrow]);
  useEffect(() => {
    let active = true;
    const disposers: Array<() => void> = [];
    for (const subscribe of [subscribeToOpenPaths, subscribeToFileDrop]) {
      void subscribe(() => {
        if (active) setSpace("reader");
      })
        .then((dispose) => {
          if (dispose) {
            if (active) disposers.push(dispose);
            else dispose();
          }
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      disposers.forEach((dispose) => dispose());
    };
  }, []);
  useLayoutEffect(() => {
    document.body.dataset.activeSpace = space;
    document.body.dataset.density = density;
    try {
      localStorage.setItem("moyang.activeSpace", space);
      localStorage.setItem("moyang.density", density);
    } catch {
      /* view preferences only */
    }
  }, [space, density]);
  const collapsed = (narrow ? !navigationOpen : model.sidebarCollapsed) || (space === "reader" && model.focusMode);
  const shellModel = narrow
    ? {
        ...model,
        sidebarCollapsed: !navigationOpen,
        setSidebarCollapsed: (value: SetStateAction<boolean>) =>
          setNavigationOpen((open) => !(typeof value === "function" ? value(!open) : value)),
      }
    : model;
  return (
    <div
      className={`product-shell workbench-shell${collapsed ? " workbench-sidebar-hidden" : ""}${narrow ? " workbench-narrow" : ""}`}
      style={{ "--workbench-sidebar-width": `${model.paneWidths.sidebar}px` } as CSSProperties}
    >
      {narrow && !collapsed && (
        <button className="navigation-backdrop" aria-label="收起导航" onClick={() => setNavigationOpen(false)} />
      )}
      <aside className="workbench-sidebar" aria-label="工作台导航">
        <div className="workbench-identity">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <strong>Moyang Reader</strong>
        </div>
        <label className="workbench-space-select">
          <span className="sr-only">工作空间</span>
          <select
            aria-label="工作空间"
            value={space}
            onChange={(event) => {
              setSettingsOpen(false);
              setNavigationOpen(false);
              const next = event.target.value as "reader" | "ai";
              if (next === "ai") setVisitedAi(true);
              setSpace(next);
            }}
          >
            <option value="reader">阅读空间</option>
            <option value="ai">AI 空间</option>
          </select>
        </label>
        <div className="workbench-primary-actions">
          <button
            onClick={() => {
              if (space === "reader") {
                bookroom.setPage("search");
                setNavigationOpen(false);
              } else document.querySelector<HTMLInputElement>(".ai-search")?.focus();
            }}
          >
            <Icon name="search" />
            <span>搜索</span>
            <kbd>{space === "reader" ? "Ctrl Shift F" : ""}</kbd>
          </button>
          {space === "reader" && (
            <button
              onClick={() => {
                setNavigationOpen(false);
                if (model.workspacePath) void model.handleCreateWorkspaceNote("");
                else void model.openSelectedFile();
              }}
            >
              <Icon name="plus" />
              <span>{model.workspacePath ? "新建笔记" : "打开文档"}</span>
            </button>
          )}
        </div>
        <div className="workbench-sidebar-content" hidden={space !== "reader"}>
          <nav className="reader-collection-nav" aria-label="阅读内容">
            {(
              [
                ["recent", "最近打开"],
                ["bookmarks", "收藏"],
                ["annotations", "摘录与批注"],
                ["views", "保存的视图"],
                ["recovery", "恢复中心"],
              ] as Array<[BookroomPage, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                aria-current={bookroom.page === value ? "page" : undefined}
                onClick={() => {
                  bookroom.setPage(value);
                  setNavigationOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <LibrarySidebar
            model={{
              ...model,
              handleSelectTab: async (path) => {
                bookroom.setPage("document");
                setNavigationOpen(false);
                await panes.openFile(path);
              },
            }}
          />
        </div>
        <div
          className="workbench-sidebar-content"
          hidden={space !== "ai"}
          ref={setAiSidebar}
          onClickCapture={(event) => {
            if (narrow && (event.target as Element).closest("nav button")) setNavigationOpen(false);
          }}
        />
        <footer className="workbench-sidebar-footer">
          <button
            onClick={() => {
              setNavigationOpen(false);
              setSettingsOpen(true);
            }}
          >
            <Icon name="settings" />
            设置
          </button>
          <button
            onClick={() => {
              setNavigationOpen(false);
              model.setGuideOpen(true);
            }}
          >
            <Icon name="help" />
            使用帮助
          </button>
          <label>
            界面密度
            <select aria-label="界面密度" value={density} onChange={(event) => setDensity(event.target.value)}>
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
        </footer>
        {!narrow && (
          <PaneResizeHandle
            side="sidebar"
            value={model.paneWidths.sidebar}
            min={PANE_WIDTH_LIMITS.sidebar.min}
            max={PANE_WIDTH_LIMITS.sidebar.max}
            onResizeBy={(delta) => model.resizePane("sidebar", delta)}
            onReset={() => model.resetPane("sidebar")}
          />
        )}
      </aside>
      <div className="workbench-main">
        {collapsed && space === "ai" && (
          <button className="restore-sidebar" onClick={() => shellModel.setSidebarCollapsed(false)}>
            <Icon name="sidebar" />
            显示导航
          </button>
        )}
        <div className="space-pane" hidden={space !== "reader"}>
          <App
            model={shellModel}
            panes={panes}
            settingsOpen={settingsOpen}
            onSettingsClose={() => setSettingsOpen(false)}
            content={bookroom.page !== "document" ? <BookroomPageView bookroom={bookroom} model={model} /> : undefined}
            documentTools={
              model.documentState && (
                <>
                  <button
                    aria-label="收藏当前位置"
                    title="收藏当前位置"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void bookroom.bookmark().catch((cause) => bookroom.setError(String(cause)))}
                  >
                    <Icon name="bookmark" />
                  </button>
                  <button
                    aria-label="添加摘录"
                    title="摘录与批注"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      void bookroom
                        .currentLocation()
                        .then(setExcerpt)
                        .catch((cause) => bookroom.setError(String(cause)))
                    }
                  >
                    <Icon name="excerpt" />
                  </button>
                  <button aria-label="文档历史" title="文档历史与恢复" onClick={() => bookroom.setPage("recovery")}>
                    <Icon name="history" />
                  </button>
                </>
              )
            }
          />
        </div>
        {visitedAi && (
          <div className="space-pane" hidden={space !== "ai"}>
            <Suspense
              fallback={
                <div className="ai-loading" role="status">
                  正在打开 AI 空间…
                </div>
              }
            >
              <AiSpace active={space === "ai"} sidebarTarget={aiSidebar} />
            </Suspense>
          </div>
        )}
      </div>
      {bookroom.notice && (
        <div className="workbench-notice" role="status">
          {bookroom.notice}
          <button aria-label="关闭提示" onClick={() => bookroom.setNotice("")}>
            ×
          </button>
        </div>
      )}
      {model.conflictPath && (
        <ConflictDialog model={model} path={model.conflictPath} onClose={() => model.setConflictPath(null)} />
      )}
      {excerpt !== null && (
        <ExcerptComposer
          quote={excerpt.quote ?? ""}
          onSave={(quote, comment) => bookroom.addAnnotation(excerpt, quote, comment)}
          onClose={() => setExcerpt(null)}
        />
      )}
    </div>
  );
}
