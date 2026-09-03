import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceIndexEntry } from "../types";
import { RelatedPanel } from "./RelatedPanel";

const entry: WorkspaceIndexEntry = {
  file: {
    path: "C:\\Notes\\current.md",
    name: "current.md",
    relativePath: "current.md",
    size: 64,
    modifiedMs: null,
    kind: "markdown",
  },
  title: "当前文档",
  links: [],
  tags: [],
};

describe("RelatedPanel", () => {
  it("marks the relationship graph as the primary context action", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onOpenGraph = vi.fn();

    act(() => {
      root.render(
        <RelatedPanel
          entry={entry}
          backlinks={[]}
          outgoing={[]}
          canCreateNote={false}
          selectedTag={null}
          onOpenFile={vi.fn()}
          onCreateNote={vi.fn()}
          onOpenGraph={onOpenGraph}
          onSelectTag={vi.fn()}
        />,
      );
    });

    const graphButton = container.querySelector<HTMLButtonElement>("button");
    expect(graphButton?.textContent?.trim()).toBe("关系图");
    expect(graphButton?.classList.contains("primary")).toBe(true);

    act(() => graphButton?.click());
    expect(onOpenGraph).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
