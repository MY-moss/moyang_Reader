import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

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
});
