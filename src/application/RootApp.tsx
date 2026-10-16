import type { SourceLocation } from "../shared/bookroom-types";
import { ConflictDialog } from "./views/ConflictDialog";
import { useBookroom } from "./useBookroom";
import { BookroomPageView, ExcerptComposer } from "./views/BookroomPage";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SetStateAction,
} from "react";
import { App } from "./App";
import { subscribeToFileDrop, subscribeToOpenPaths } from "../platform/bridge";
import { useReaderApplication } from "./useReaderApplication";
import { useWorkbenchPanes } from "./useWorkbenchPanes";
import { LibrarySidebar } from "./views/LibrarySidebar";
import { Icon } from "../shared/components/Icon";
import { useModalBehavior } from "../shared/components/useModalBehavior";
import { PaneResizeHandle } from "../shared/components/PaneResizeHandle";
import { PANE_WIDTH_LIMITS } from "../features/reader/pane-layout";
import { useExtensions } from "../features/extensions/useExtensions";
import { useReaderExtensions } from "./useReaderExtensions";
import { ExtensionResult } from "../features/extensions/ExtensionResult";
import { useInterfaceDensity } from "../features/settings/interface-density";
import type { ChatSource } from "../shared/chat-types";
import { UpdateNotice } from "../shell/components/UpdateNotice";
const ChatSpace = lazy(() => import("../features/chat/ChatSpace"));
const ExtensionMarket = lazy(() => import("../features/extensions/ExtensionMarket"));
const AiSpace = lazy(() => import("../features/ai/AiSpace"));
export function RootApp() {
  const model = useReaderApplication();
  const extensions = useExtensions();
  const readerExtensions = useReaderExtensions(model, extensions);
  const panes = useWorkbenchPanes(model);
  const bookroom = useBookroom(model, panes);
  const [excerpt, setExcerpt] = useState<SourceLocation | null>(null);
  const setBookroomPage = bookroom.setPage;
  const [space, setSpace] = useState<"reader" | "ai">(() =>
    localStorage.getItem("moyang.activeSpace") === "ai" ? "ai" : "reader",
  );
  const [visitedAi, setVisitedAi] = useState(space === "ai");
  const [aiSidebar, setAiSidebar] = useState<HTMLDivElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false),
    [visitedChat, setVisitedChat] = useState(false);
  const [chatSelection, setChatSelection] = useState<{ key: number; id: string } | null>(null);
  const assistants = useMemo(
    () =>
      extensions.state.installed
        .filter((i) => i.enabled && i.package.kind === "assistant" && i.package.assistant)
        .map((i) => ({ id: i.package.id, name: i.package.name, ...i.package.assistant! })),
    [extensions.state.installed],
  );
  const chatVisible = chatOpen && assistants.length > 0;
  const chatAttachment = useMemo<ChatSource | null>(() => {
    const doc = model.documentState;
    if (!doc || !["markdown", "text", "md", "txt", "docx"].includes(doc.kind)) return null;
    const text =
      doc.kind === "docx"
        ? (new DOMParser().parseFromString(doc.rendered?.html ?? "", "text/html").body.textContent ?? "")
        : (model.sourceDraft ?? doc.source ?? "");
    return {
      id: doc.path,
      title: doc.name + (text.length > 12000 ? "（前 12000 字符）" : ""),
      source: doc.path,
      text: text.slice(0, 12000),
    };
  }, [model.documentState, model.sourceDraft]);
  const openChat = (id?: string) => {
    setMarketOpen(false);
    setSettingsOpen(false);
    setSpace("ai");
    setVisitedAi(true);
    setVisitedChat(true);
    setChatOpen(true);
    setNavigationOpen(false);
    if (id) setChatSelection((previous) => ({ key: (previous?.key ?? 0) + 1, id }));
  };
  const [aiAction, setAiAction] = useState<{ key: number; type: "search" | "skill"; id?: string } | null>(null);
  const closeGlobalPage = () => {
    setSettingsOpen(false);
    setMarketOpen(false);
  };
  const [density] = useInterfaceDensity();
  const [narrow, setNarrow] = useState(() => window.innerWidth < 900);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const restoreNavigationRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSettingsOpen(false);
        setMarketOpen(false);
        setChatOpen(false);
        setNavigationOpen(false);
        if (document.body.dataset.activeSpace === "ai") setAiAction({ key: Date.now(), type: "search" });
        else setBookroomPage("search");
      }
    };
    window.addEventListener("keydown", shortcut, true);
    return () => window.removeEventListener("keydown", shortcut, true);
  }, [setBookroomPage]);
  const navigateSource = bookroom.navigate,
    reportSourceError = bookroom.setError;
  useEffect(() => {
    const open = (event: Event) => {
      const location = (event as CustomEvent<SourceLocation>).detail;
      if (!location?.path) return;
      setSpace("reader");
      setSettingsOpen(false);
      setMarketOpen(false);
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
        if (active) {
          setSpace("reader");
          setSettingsOpen(false);
          setMarketOpen(false);
        }
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
    document.body.dataset.globalPage = marketOpen ? "extensions" : settingsOpen ? "settings" : "";
    document.body.dataset.density = density;
    try {
      localStorage.setItem("moyang.activeSpace", space);
      localStorage.setItem("moyang.density", density);
    } catch {
      /* view preferences only */
    }
  }, [space, density, marketOpen, settingsOpen]);
  const collapsed =
    (narrow ? !navigationOpen : model.sidebarCollapsed) ||
    (space === "reader" && model.focusMode && !marketOpen && !settingsOpen);
  const modalNavigation = narrow && !collapsed;
  useModalBehavior({
    containerRef: navigationRef,
    backgroundRef: mainRef,
    restoreFocusRef: restoreNavigationRef,
    enabled: modalNavigation,
    onClose: () => setNavigationOpen(false),
  });
  const baseModel = narrow
    ? {
        ...model,
        sidebarCollapsed: !navigationOpen,
        setSidebarCollapsed: (value: SetStateAction<boolean>) =>
          setNavigationOpen((open) => !(typeof value === "function" ? value(!open) : value)),
      }
    : model;
  const shellModel = {
    ...baseModel,
    commandItems: [
      ...baseModel.commandItems,
      { id: "extension-market", label: "打开插件市场" },
      ...readerExtensions.commands,
    ],
    executeCommand: (id: string) =>
      id === "extension-market"
        ? (setSettingsOpen(false), setMarketOpen(true))
        : id.startsWith("extension:")
          ? readerExtensions.execute(id)
          : baseModel.executeCommand(id),
  };
  return (
    <div
      className={`product-shell workbench-shell${collapsed ? " workbench-sidebar-hidden" : ""}${narrow ? " workbench-narrow" : ""}`}
      style={{ "--workbench-sidebar-width": `${model.paneWidths.sidebar}px` } as CSSProperties}
    >
      {narrow && !collapsed && (
        <button className="navigation-backdrop" aria-label="收起导航" onClick={() => setNavigationOpen(false)} />
      )}
      <aside
        ref={navigationRef}
        className="workbench-sidebar"
        role={modalNavigation ? "dialog" : undefined}
        aria-modal={modalNavigation || undefined}
        aria-label="工作台导航"
        tabIndex={modalNavigation ? -1 : undefined}
      >
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
              closeGlobalPage();
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
              closeGlobalPage();
              if (space === "reader") {
                bookroom.setPage("search");
                setNavigationOpen(false);
              } else {
                setChatOpen(false);
                setAiAction({ key: Date.now(), type: "search" });
                setNavigationOpen(false);
              }
            }}
          >
            <Icon name="search" />
            <span>搜索</span>
            <kbd>Ctrl Shift F</kbd>
          </button>
          {space === "reader" && (
            <button
              onClick={() => {
                closeGlobalPage();
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
        <div
          className="workbench-sidebar-content"
          hidden={space !== "reader"}
          onClickCapture={(event) => {
            if ((event.target as Element).closest("button")) closeGlobalPage();
          }}
        >
          <nav className="reader-collection-nav" aria-label="阅读内容">
            {(
              [
                ["recent", "最近打开", "recent"],
                ["bookmarks", "收藏", "bookmark"],
                ["annotations", "摘录与批注", "excerpt"],
              ] as const
            ).map(([value, label, icon]) => (
              <button
                key={value}
                aria-current={bookroom.page === value ? "page" : undefined}
                onClick={() => {
                  bookroom.setPage(value);
                  setNavigationOpen(false);
                }}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
            <details className="reader-manage-nav">
              <summary>
                更多内容
                <Icon name="chevron" size={14} />
              </summary>
              {(
                [
                  ["views", "保存的视图", "views"],
                  ["recovery", "恢复中心", "history"],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  aria-current={bookroom.page === value ? "page" : undefined}
                  onClick={() => {
                    bookroom.setPage(value);
                    setNavigationOpen(false);
                  }}
                >
                  <Icon name={icon} />
                  {label}
                </button>
              ))}
            </details>
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
            if ((event.target as Element).closest("button")) closeGlobalPage();
            if (narrow && (event.target as Element).closest("nav button")) setNavigationOpen(false);
          }}
        />
        <footer className="workbench-sidebar-footer">
          <button
            aria-current={marketOpen ? "page" : undefined}
            onClick={() => {
              setNavigationOpen(false);
              setSettingsOpen(false);
              setMarketOpen(true);
            }}
          >
            <Icon name="extensions" />
            插件市场
          </button>
          <button
            aria-current={settingsOpen ? "page" : undefined}
            onClick={() => {
              setNavigationOpen(false);
              setMarketOpen(false);
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
      <div ref={mainRef} className="workbench-main">
        {collapsed && (space === "ai" || marketOpen) && (
          <button
            ref={restoreNavigationRef}
            className="restore-sidebar"
            onClick={() => shellModel.setSidebarCollapsed(false)}
          >
            <Icon name="sidebar" />
            显示导航
          </button>
        )}
        <div className="space-pane" hidden={space !== "reader" || marketOpen}>
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
          <div className="space-pane" hidden={space !== "ai" || marketOpen || chatVisible}>
            <Suspense
              fallback={
                <div className="ai-loading" role="status">
                  正在打开 AI 空间…
                </div>
              }
            >
              <AiSpace
                active={space === "ai" && !marketOpen && !chatVisible}
                chatEnabled={assistants.length > 0}
                chatActive={chatVisible}
                onOpenChat={() => openChat()}
                sidebarTarget={aiSidebar}
                action={aiAction}
                onNavigate={() => {
                  closeGlobalPage();
                  setChatOpen(false);
                  setNavigationOpen(false);
                }}
              />
            </Suspense>
          </div>
        )}
        {visitedChat && (
          <div className="space-pane" hidden={space !== "ai" || marketOpen || !chatVisible}>
            <Suspense
              fallback={
                <div role="status" className="ai-loading">
                  正在打开聊天…
                </div>
              }
            >
              <ChatSpace assistants={assistants} selection={chatSelection} attachment={chatAttachment} />
            </Suspense>
          </div>
        )}
        {marketOpen && (
          <Suspense
            fallback={
              <div className="ai-loading" role="status">
                正在打开插件市场…
              </div>
            }
          >
            <ExtensionMarket
              manager={extensions}
              onOpenAssistant={openChat}
              onClose={() => setMarketOpen(false)}
              onOpenSkill={(id) => {
                setMarketOpen(false);
                setChatOpen(false);
                setVisitedAi(true);
                setSpace("ai");
                setAiAction({ key: Date.now(), type: "skill", id });
              }}
            />
          </Suspense>
        )}
      </div>
      {readerExtensions.run && (
        <ExtensionResult run={readerExtensions.run} onClose={readerExtensions.close} onApply={readerExtensions.apply} />
      )}
      {model.updateNoticeVisible && model.updateStatus !== "idle" && model.updateStatus !== "checking" && (
        <div className="global-update-notice">
          <UpdateNotice
            status={model.updateStatus}
            version={model.availableUpdate?.version ?? null}
            notes={model.availableUpdate?.body ?? null}
            progress={model.updateProgress}
            error={model.updateError}
            onInstall={() => void model.installUpdate()}
            onRelaunch={() => void model.relaunchUpdatedApp()}
            onHide={() => model.setUpdateNoticeVisible(false)}
            onDismiss={model.dismissUpdateNotice}
          />
        </div>
      )}
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
