import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

function renderEmptyState(hasWorkspace: boolean, showWorkspaceAction: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <EmptyState
        onOpen={() => {}}
        onChooseWorkspace={() => {}}
        onOpenGuide={() => {}}
        hasWorkspace={hasWorkspace}
        showWorkspaceAction={showWorkspaceAction}
      />,
    );
  });

  return { container, root };
}

describe("EmptyState", () => {
  it("keeps the first-run folder action in the main empty state", () => {
    const { container, root } = renderEmptyState(false, true);

    expect(container.textContent).toContain("把文档打开，专心阅读。");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "添加整个文件夹"),
    ).toBe(true);

    act(() => root.unmount());
    container.remove();
  });

  it("does not repeat the folder action after a workspace is mounted", () => {
    const { container, root } = renderEmptyState(true, false);

    expect(container.textContent).toContain("从阅读库开始阅读。");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "添加整个文件夹"),
    ).toBe(false);

    act(() => root.unmount());
    container.remove();
  });
});
