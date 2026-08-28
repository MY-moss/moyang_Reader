import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { ReaderContextMenu } from "./ReaderContextMenu";

describe("ReaderContextMenu", () => {
  it("offers selection, link, document and edit actions", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onCopySelection = vi.fn();
    const onFindSelection = vi.fn();
    const onCopyLink = vi.fn();
    const onOpenLink = vi.fn();
    const onEdit = vi.fn();
    const onCopyDocumentPath = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <ReaderContextMenu
          target={{ x: 12, y: 18, selectedText: "选中的文字", linkHref: "https://example.com" }}
          documentPath="C:/vault/Today.md"
          canEdit
          editLabel="进入所见即所得编辑"
          onCopySelection={onCopySelection}
          onFindSelection={onFindSelection}
          onCopyLink={onCopyLink}
          onOpenLink={onOpenLink}
          onEdit={onEdit}
          onCopyDocumentPath={onCopyDocumentPath}
          onClose={onClose}
        />,
      );
    });

    const menuItems = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    expect(menuItems().map((button) => button.textContent?.trim())).toEqual([
      "复制选中文本Ctrl C",
      "查找选中文本Ctrl F",
      "复制链接地址",
      "打开链接",
      "进入所见即所得编辑",
      "复制文档路径",
    ]);

    act(() => menuItems()[0]?.click());
    expect(onCopySelection).toHaveBeenCalledWith("选中的文字");

    act(() => {
      root.render(
        <ReaderContextMenu
          target={{ x: 12, y: 18, selectedText: "", linkHref: null }}
          canEdit={false}
          editLabel="进入编辑"
          onCopySelection={onCopySelection}
          onFindSelection={onFindSelection}
          onCopyLink={onCopyLink}
          onOpenLink={onOpenLink}
          onEdit={onEdit}
          onCopyDocumentPath={onCopyDocumentPath}
          onClose={onClose}
        />,
      );
    });

    expect(menuItems()).toHaveLength(2);
    expect(menuItems()[0]?.disabled).toBe(true);
    expect(menuItems()[1]?.disabled).toBe(true);

    act(() => root.unmount());
    container.remove();
  });
});
