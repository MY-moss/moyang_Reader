import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { RecentFile, RecentWorkspace, WorkspaceFile } from "../types";
import { WorkspacePanel } from "./WorkspacePanel";

function renderPanel(
  mountedWorkspaces: RecentWorkspace[],
  overrides: Partial<React.ComponentProps<typeof WorkspacePanel>> = {},
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onAddWorkspace = vi.fn();
  const onOpenWorkspace = vi.fn();
  const onExportWorkspace = vi.fn();

  act(() => {
    root.render(
      <WorkspacePanel
        workspacePath="C:\\Notes"
        files={[]}
        visibleFiles={[]}
        visibleResultCount={0}
        exportableFiles={[]}
        recentFiles={[]}
        readingHistory={[]}
        onRequestClearReadingHistory={vi.fn()}
        recentWorkspaces={[]}
        mountedWorkspaces={mountedWorkspaces}
        activePath={null}
        searchQuery=""
        searchResults={[]}
        searchLoading={false}
        tagOptions={[]}
        selectedTag={null}
        selectedKind="all"
        onAddWorkspace={onAddWorkspace}
        workspaceLimitReached={false}
        onOpenWorkspace={onOpenWorkspace}
        onRemoveWorkspace={vi.fn()}
        onExportWorkspace={onExportWorkspace}
        onCancelWorkspaceExport={vi.fn()}
        workspaceExporting={false}
        workspaceExportProgress={null}
        workspaceExportFailures={[]}
        onCopyExportFailures={vi.fn()}
        onSaveExportFailures={vi.fn()}
        workspaceExportNotice={null}
        workspaceIndexLoading={false}
        workspaceListingStatus={{ truncated: false, scannedTotal: 0 }}
        onOpenFile={vi.fn()}
        onSearchQueryChange={vi.fn()}
        onTagChange={vi.fn()}
        onKindChange={vi.fn()}
        onClearFilters={vi.fn()}
        {...overrides}
      />,
    );
  });

  return { container, root, onAddWorkspace, onOpenWorkspace, onExportWorkspace };
}

function cleanup(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  act(() => root.unmount());
  container.remove();
}

describe("WorkspacePanel", () => {
  it("makes adding another reading library explicit and keeps the active count visible", () => {
    const { container, root, onAddWorkspace } = renderPanel([
      { path: "C:\\Notes", name: "Notes" },
      { path: "D:\\Archive", name: "Archive" },
    ]);

    const manageMenu = container.querySelector<HTMLDetailsElement>(".workspace-manage-menu");
    act(() => (manageMenu?.querySelector("summary") as HTMLElement | null)?.click());
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "添加阅读库",
    );
    expect(addButton).toBeTruthy();
    expect(container.textContent).toContain("2 个阅读库");

    act(() => addButton?.click());
    expect(onAddWorkspace).toHaveBeenCalledTimes(1);
    cleanup(container, root);
  });

  it("switches between mounted libraries without hiding the active one", () => {
    const { container, root, onOpenWorkspace } = renderPanel([
      { path: "C:\\Notes", name: "Notes" },
      { path: "D:\\Archive", name: "Archive" },
    ]);

    const manageMenu = container.querySelector<HTMLDetailsElement>(".workspace-manage-menu");
    act(() => (manageMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(container.textContent).toContain("已挂载阅读库 · 2 / 5");

    const archiveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Archive") && button.getAttribute("role") === "menuitem",
    );
    expect(archiveButton).toBeTruthy();
    act(() => archiveButton?.click());
    expect(onOpenWorkspace).toHaveBeenCalledWith("D:\\Archive");
    cleanup(container, root);
  });

  it("keeps workspace action menus in one flow and dismisses them without overlap", () => {
    const exportableFile: WorkspaceFile = {
      path: "C:\\Notes\\guide.md",
      name: "guide.md",
      relativePath: "guide.md",
      size: 24,
      modifiedMs: null,
      kind: "markdown",
    };
    const { container, root, onExportWorkspace } = renderPanel(
      [
        { path: "C:\\Notes", name: "Notes" },
        { path: "D:\\Archive", name: "Archive" },
      ],
      {
        exportableFiles: [exportableFile],
        onCreateNote: vi.fn(),
        onCreateFolder: vi.fn(),
      },
    );

    const createMenu = container.querySelector<HTMLDetailsElement>(".workspace-create-menu");
    const manageMenu = container.querySelector<HTMLDetailsElement>(".workspace-manage-menu");
    expect(container.querySelector(".workspace-actions")?.getAttribute("aria-label")).toBe("阅读库操作");
    expect(createMenu).toBeTruthy();
    expect(manageMenu).toBeTruthy();

    act(() => (createMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(createMenu?.open).toBe(true);
    expect(manageMenu?.open).toBe(false);

    act(() => (manageMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(createMenu?.open).toBe(false);
    expect(manageMenu?.open).toBe(true);

    const htmlButton = Array.from(manageMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) =>
      button.textContent?.includes("HTML"),
    );
    act(() => htmlButton?.click());
    expect(onExportWorkspace).toHaveBeenCalledWith("html");
    expect(manageMenu?.open).toBe(false);

    act(() => (manageMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(manageMenu?.open).toBe(true);
    const manageTrigger = manageMenu?.querySelector<HTMLElement>("summary");
    act(() => {
      manageTrigger?.focus();
      manageTrigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(manageMenu?.querySelector('[role="menuitem"]:not([disabled])'));
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(manageMenu?.open).toBe(false);
    cleanup(container, root);
  });

  it("does not silently evict a mounted library when the limit is reached", () => {
    const { container, root } = renderPanel(
      Array.from({ length: 5 }, (_, index) => ({ path: `C:\\Vault-${index}`, name: `Vault ${index}` })),
      { workspaceLimitReached: true },
    );

    const manageMenu = container.querySelector<HTMLDetailsElement>(".workspace-manage-menu");
    act(() => (manageMenu?.querySelector("summary") as HTMLElement | null)?.click());
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "添加阅读库",
    );
    expect(addButton?.hasAttribute("disabled")).toBe(true);
    expect(addButton?.getAttribute("title")).toContain("5 个阅读库上限");
    cleanup(container, root);
  });

  it("shows relative open times and a safe fallback for legacy recent files", () => {
    const recentFiles: RecentFile[] = [
      { path: "C:\\Notes\\today.md", name: "today.md", lastOpenedAt: Date.now() - 3_600_000 },
      { path: "C:\\Notes\\legacy.md", name: "legacy.md" },
    ];
    const { container, root } = renderPanel([], { workspacePath: null, recentFiles });

    const recentSection = container.querySelector<HTMLElement>('[aria-label="最近打开"]');
    expect(recentSection?.textContent).toContain("最近打开：1 小时前");
    expect(recentSection?.textContent).toContain("打开时间未知");
    cleanup(container, root);
  });

  it("keeps search available to the shortcut while its controls are collapsed", () => {
    const searchInputRef = createRef<HTMLInputElement>();
    const { container, root } = renderPanel([], { searchInputRef });
    const searchInput = container.querySelector<HTMLInputElement>(".workspace-search");

    expect(searchInput?.getAttribute("aria-label")).toBe("当前阅读库搜索");
    expect(searchInput?.getAttribute("placeholder")).toBe("搜索当前阅读库内容");
    expect(container.querySelector(".workspace-search-controls")?.classList.contains("is-open")).toBe(false);

    act(() => searchInputRef.current?.focus());
    expect(document.activeElement).toBe(searchInput);
    expect(container.querySelector(".workspace-search-controls")?.classList.contains("is-open")).toBe(true);
    cleanup(container, root);
  });

  it("explains when the current reading library has no matches", () => {
    const { container, root } = renderPanel([], {
      searchQuery: "missing",
      searchResults: [],
      visibleResultCount: 0,
    });

    expect(container.textContent).toContain("当前阅读库没有匹配文档。");
    cleanup(container, root);
  });

  it("shows file navigation first and keeps reading history independently collapsible", () => {
    const { container, root } = renderPanel([], { workspacePath: "C:\\Notes" });
    expect(container.querySelector(".workspace-files")).toBeTruthy();
    const history = container.querySelector<HTMLDetailsElement>(".workspace-history-disclosure");
    expect(history?.open).toBe(false);
    act(() => (history?.querySelector("summary") as HTMLElement | null)?.click());
    expect(history?.open).toBe(true);
    cleanup(container, root);
  });

  it("localizes the migrated sidebar controls in English", () => {
    const { container, root } = renderPanel([], { locale: "en-US" });
    expect(container.querySelector("#workspace-title")?.textContent).toBe("Library");
    expect(container.querySelector(".workspace-search-toggle")?.textContent).toContain("Search");
    expect(container.querySelector(".workspace-manage-menu summary")?.getAttribute("aria-label")).toBe(
      "Manage library",
    );
    cleanup(container, root);
  });
});
