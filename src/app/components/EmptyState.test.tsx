import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

function renderEmptyState(hasWorkspace: boolean, showWorkspaceAction: boolean, locale: "zh-CN" | "en-US" = "zh-CN") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <EmptyState
        locale={locale}
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
  it("uses the shared brand logo instead of the legacy letter mark", () => {
    const { container, root } = renderEmptyState(false, true);

    const logo = container.querySelector<HTMLImageElement>(".empty-logo");
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute("src")).toMatch(/moyang-reader-logo/);
    expect(logo?.alt).toBe("");
    expect(logo?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".empty-mark")?.textContent).not.toContain("M");

    act(() => root.unmount());
    container.remove();
  });

  it("keeps the first-run folder action in the main empty state", () => {
    const { container, root } = renderEmptyState(false, true);

    expect(container.textContent).toContain("打开文档，开始阅读");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "添加整个文件夹"),
    ).toBe(true);

    act(() => root.unmount());
    container.remove();
  });

  it("does not repeat the folder action after a workspace is mounted", () => {
    const { container, root } = renderEmptyState(true, false);

    expect(container.textContent).toContain("从阅读库继续阅读");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) => button.textContent === "添加整个文件夹"),
    ).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it("localizes the first-use path without changing its actions", () => {
    const { container, root } = renderEmptyState(false, true, "en-US");
    expect(container.textContent).toContain("Open a document and start reading");
    expect(container.querySelector(".empty-capabilities")?.getAttribute("aria-label")).toBe("Supported document types");
    expect(Array.from(container.querySelectorAll("button")).map((button) => button.textContent)).toEqual([
      "Open a document",
      "Add a whole folder",
      "View getting started guide",
    ]);
    act(() => root.unmount());
    container.remove();
  });
});
