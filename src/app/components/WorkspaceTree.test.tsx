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
    const onCopyRelativePath = vi.fn();
    const onCopyName = vi.fn();
    const onRefresh = vi.fn();

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[]}
          folders={[{ path: "C:/vault/Archive", name: "Archive", relativePath: "Archive" }]}
          activePath={null}
          onOpenFile={() => {}}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
          onCopyRelativePath={onCopyRelativePath}
          onCopyName={onCopyName}
          onRefresh={onRefresh}
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
    const folderRelativePath = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "复制相对路径",
    );
    act(() => folderRelativePath?.click());
    expect(onCopyRelativePath).toHaveBeenCalledWith("Archive");

    act(() => {
      folder?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const folderCopyName = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "复制名称",
    );
    act(() => folderCopyName?.click());
    expect(onCopyName).toHaveBeenCalledWith("Archive");

    act(() => {
      folder?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const folderRefresh = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")).find(
      (button) => button.textContent?.trim() === "刷新文件夹",
    );
    act(() => folderRefresh?.click());
    expect(onRefresh).toHaveBeenCalledWith("Archive");

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
    const onCloseFile = vi.fn();
    const onRenameEntry = vi.fn();
    const onDeleteEntry = vi.fn();
    const onDuplicateEntry = vi.fn();
    const onShowDetails = vi.fn();
    const onRevealEntry = vi.fn();
    const onCopyPath = vi.fn();
    const onCopyRelativePath = vi.fn();
    const onCopyName = vi.fn();
    const onRefresh = vi.fn();

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[file(0)]}
          activePath={file(0).path}
          onOpenFile={onOpenFile}
          onCloseFile={onCloseFile}
          onRenameEntry={onRenameEntry}
          onDeleteEntry={onDeleteEntry}
          onDuplicateEntry={onDuplicateEntry}
          onShowDetails={onShowDetails}
          onRevealEntry={onRevealEntry}
          onCopyPath={onCopyPath}
          onCopyRelativePath={onCopyRelativePath}
          onCopyName={onCopyName}
          onRefresh={onRefresh}
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
    expect(menuItems().some((button) => button.textContent?.includes("关闭当前标签"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("重命名文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("删除文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("复制文件"))).toBe(true);
    expect(menuItems().some((button) => button.textContent?.includes("查看属性"))).toBe(true);
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
    const details = menuItems().find((button) => button.textContent?.includes("查看属性"));
    act(() => details?.click());
    expect(onShowDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "file",
        name: "0.md",
        relativePath: "notes/0.md",
        absolutePath: "C:/vault/notes/0.md",
        size: 1,
      }),
    );

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const relativePath = menuItems().find((button) => button.textContent?.includes("复制相对路径"));
    act(() => relativePath?.click());
    expect(onCopyRelativePath).toHaveBeenCalledWith("notes/0.md");

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const closeTab = menuItems().find((button) => button.textContent?.includes("关闭当前标签"));
    act(() => closeTab?.click());
    expect(onCloseFile).toHaveBeenCalledWith(file(0).path);

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const copyName = menuItems().find((button) => button.textContent?.includes("复制名称"));
    act(() => copyName?.click());
    expect(onCopyName).toHaveBeenCalledWith("notes/0.md");

    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const refresh = menuItems().find((button) => button.textContent?.includes("刷新所在文件夹"));
    act(() => refresh?.click());
    expect(onRefresh).toHaveBeenCalledWith("notes");

    act(() => root.unmount());
    container.remove();
  });


  it("supports cutting and pasting an entry into another folder", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onTransferEntry = vi.fn();

    act(() => {
      root.render(
        <WorkspaceTreeView
          files={[file(0)]}
          folders={[{ path: "C:/vault/Archive", name: "Archive", relativePath: "Archive" }]}
          activePath={null}
          onOpenFile={() => {}}
          onTransferEntry={onTransferEntry}
        />,
      );
    });

    const fileButton = container.querySelector<HTMLButtonElement>(".workspace-file");
    expect(fileButton).toBeTruthy();
    act(() => {
      fileButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 }));
    });
    const menuItems = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    const cut = menuItems().find((button) => button.textContent?.includes("剪切到其他文件夹"));
    expect(cut).toBeTruthy();
    act(() => cut?.click());

    const archive = Array.from(container.querySelectorAll<HTMLButtonElement>(".workspace-folder")).find(
      (button) => button.querySelector(".workspace-folder-name")?.textContent === "Archive",
    );
    expect(archive).toBeTruthy();
    act(() => {
      archive?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 30, clientY: 40 }));
    });
    const paste = menuItems().find((button) => button.textContent?.includes("粘贴到此处"));
    expect(paste).toBeTruthy();
    expect(paste?.disabled).toBe(false);
    await act(async () => {
      paste?.click();
      await Promise.resolve();
    });

    expect(onTransferEntry).toHaveBeenCalledWith("notes/0.md", "Archive", "move", "file");

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
