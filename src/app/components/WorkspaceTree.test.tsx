import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceFile } from "../types";
import { WorkspaceTreeView } from "./WorkspaceTree";

function file(index: number): WorkspaceFile {
  return {
    path: `C:/vault/notes/${index}.md`,
    name: `${index}.md`,
    relativePath: `notes/${index}.md`,
    size: 1,
    kind: "markdown",
  };
}

describe("WorkspaceTreeView", () => {
  it("shows the complete tree without an arbitrary display-all gate", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={Array.from({ length: 81 }, (_, index) => file(index))}
          activePath={null}
          onOpenFile={() => {}}
        />,
      );
    });

    expect(container.querySelectorAll(".workspace-file")).toHaveLength(81);
    expect(container.textContent).not.toContain("显示全部");
    expect(container.textContent).not.toContain("收起列表");

    act(() => root.unmount());
    container.remove();
  });

  it("does not render an empty path row for files at the workspace root", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[{ ...file(0), name: "README.md", relativePath: "README.md" }]}
          activePath={null}
          onOpenFile={() => {}}
        />,
      );
    });

    expect(container.querySelectorAll(".workspace-file small")).toHaveLength(0);

    act(() => root.unmount());
    container.remove();
  });

  it("opens folder management actions for an empty folder", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCreateNote = vi.fn();
    const onCreateFolder = vi.fn();

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[]}
          folders={[{ path: "C:/vault/Archive", name: "Archive", relativePath: "Archive" }]}
          activePath={null}
          onOpenFile={() => {}}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
        />,
      );
    });

    const folder = container.querySelector<HTMLButtonElement>(".workspace-folder");
    expect(folder).toBeTruthy();
    act(() => {
      folder?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });

    const createNote = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "新建笔记",
    );
    expect(createNote).toBeTruthy();
    act(() => createNote?.click());
    expect(onCreateNote).toHaveBeenCalledWith("Archive");

    act(() => root.unmount());
    container.remove();
  });
});
