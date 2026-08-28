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

    act(() => {
      folder?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const collapse = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "折叠文件夹",
    );
    expect(collapse).toBeTruthy();
    act(() => collapse?.click());

    act(() => {
      folder?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const expand = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "展开文件夹",
    );
    expect(expand).toBeTruthy();
    act(() => expand?.click());

    act(() => root.unmount());
    container.remove();
  });

  it("offers file management and path actions from the file context menu", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenFile = vi.fn();
    const onRenameEntry = vi.fn();
    const onDeleteEntry = vi.fn();
    const onDuplicateEntry = vi.fn();
    const onRevealEntry = vi.fn();
    const onCopyPath = vi.fn();
    const onCopyRelativePath = vi.fn();

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[file(0)]}
          activePath={null}
          onOpenFile={onOpenFile}
          onRenameEntry={onRenameEntry}
          onDeleteEntry={onDeleteEntry}
          onDuplicateEntry={onDuplicateEntry}
          onRevealEntry={onRevealEntry}
          onCopyPath={onCopyPath}
          onCopyRelativePath={onCopyRelativePath}
        />,
      );
    });

    const fileButton = container.querySelector<HTMLButtonElement>(".workspace-file");
    expect(fileButton).toBeTruthy();
    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });

    const menuItems = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    expect(menuItems().some((button) => button.textContent?.includes("打开文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("重命名文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("删除文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("复制文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("复制完整路径"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("复制相对路径"))).toBe(true);

    const rename = menuItems().find((button) => button.textContent?.includes("重命名文件"));
    act(() => rename?.click());
    expect(onRenameEntry).toHaveBeenCalledWith("notes/0.md", "file");

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const duplicate = menuItems().find((button) => button.textContent?.includes("复制文件"));
    act(() => duplicate?.click());
    expect(onDuplicateEntry).toHaveBeenCalledWith("notes/0.md", "file");

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const relativePath = menuItems().find((button) => button.textContent?.includes("复制相对路径"));
    act(() => relativePath?.click());
    expect(onCopyRelativePath).toHaveBeenCalledWith("notes/0.md");

    act(() => root.unmount());
    container.remove();
  });

  it("keeps the root context menu available for an empty workspace", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCreateNote = vi.fn();

    act(() => {
      root.render(<WorkspaceTreeView files={[]} activePath={null} onOpenFile={() => {}} onCreateNote={onCreateNote} />);
    });

    act(() => {
      container
        .querySelector<HTMLDivElement>(".workspace-tree")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const createNote = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "新建笔记",
    );
    expect(createNote).toBeTruthy();
    act(() => createNote?.click());
    expect(onCreateNote).toHaveBeenCalledWith("");

    act(() => root.unmount());
    container.remove();
  });
});
