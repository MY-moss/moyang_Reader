import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { RecentWorkspace } from "../types";
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

  act(() => {
    root.render(
      <WorkspacePanel
        workspacePath="C:\\Notes"
        files={[]}
        visibleFiles={[]}
        visibleResultCount={0}
        exportableFiles={[]}
        recentFiles={[]}
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
        onExportWorkspace={vi.fn()}
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

  return { container, root, onAddWorkspace, onOpenWorkspace };
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
});
