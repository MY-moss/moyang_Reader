import { act } from "react";
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

    expect(container.textContent).toContain("已挂载阅读库 · 2 / 5");
    const switchButton = container.querySelector<HTMLElement>('summary[aria-label="切换阅读库"]');
    expect(switchButton).toBeTruthy();
    act(() => switchButton?.click());

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
    const exportMenu = container.querySelector<HTMLDetailsElement>(".workspace-export-menu");
    const switcherMenu = container.querySelector<HTMLDetailsElement>(".workspace-switcher");
    expect(container.querySelector(".workspace-actions")?.getAttribute("aria-label")).toBe("阅读库操作");
    expect(createMenu).toBeTruthy();
    expect(exportMenu).toBeTruthy();
    expect(switcherMenu).toBeTruthy();

    act(() => (createMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(createMenu?.open).toBe(true);
    expect(exportMenu?.open).toBe(false);

    act(() => (exportMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(createMenu?.open).toBe(false);
    expect(exportMenu?.open).toBe(true);

    const htmlButton = Array.from(exportMenu?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) =>
      button.textContent?.includes("HTML"),
    );
    act(() => htmlButton?.click());
    expect(onExportWorkspace).toHaveBeenCalledWith("html");
    expect(exportMenu?.open).toBe(false);

    act(() => (switcherMenu?.querySelector("summary") as HTMLElement | null)?.click());
    expect(switcherMenu?.open).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(switcherMenu?.open).toBe(false);
    cleanup(container, root);
  });

  it("does not silently evict a mounted library when the limit is reached", () => {
    const { container, root } = renderPanel(
      Array.from({ length: 5 }, (_, index) => ({ path: `C:\\Vault-${index}`, name: `Vault ${index}` })),
      { workspaceLimitReached: true },
    );

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
});
