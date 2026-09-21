import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSearchResult } from "./types";
import { useWorkspaceSearchController } from "./workspace-search-controller";

const reactGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

const result: WorkspaceSearchResult = {
  file: {
    path: "C:/library/guide.md",
    name: "guide.md",
    relativePath: "guide.md",
    size: 128,
    kind: "markdown",
  },
  preview: "命中内容",
};

type HarnessProps = {
  workspacePath: string | null;
  workspaceRevision: number;
  isNative?: boolean;
  searchWorkspace: (root: string, query: string) => Promise<WorkspaceSearchResult[]>;
  setError: (message: string | null) => void;
};

function SearchHarness({ workspacePath, workspaceRevision, isNative = true, searchWorkspace, setError }: HarnessProps) {
  const controller = useWorkspaceSearchController({
    workspacePath,
    workspaceRevision,
    isNative,
    searchWorkspace,
    setError,
  });

  return createElement(
    "div",
    null,
    createElement(
      "button",
      { type: "button", "data-set-short": true, onClick: () => controller.setWorkspaceQuery("a") },
      "短查询",
    ),
    createElement(
      "button",
      { type: "button", "data-set-query": true, onClick: () => controller.setWorkspaceQuery("  alpha  ") },
      "设置查询",
    ),
    createElement(
      "button",
      { type: "button", "data-set-second": true, onClick: () => controller.setWorkspaceQuery("second") },
      "设置第二个查询",
    ),
    createElement("output", { "data-query": true }, controller.workspaceQuery),
    createElement("output", { "data-loading": true }, String(controller.workspaceSearchLoading)),
    createElement("output", { "data-result-count": true }, String(controller.workspaceResults.length)),
    createElement("output", { "data-preview": true }, controller.workspaceResults[0]?.preview ?? ""),
  );
}

const roots: Root[] = [];

function renderHarness(props: HarnessProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(createElement(SearchHarness, props));
  });
  return {
    container,
    rerender: (nextProps: HarnessProps) => {
      act(() => {
        root.render(createElement(SearchHarness, nextProps));
      });
    },
  };
}

async function advanceSearchDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(180);
  });
}

beforeEach(() => {
  reactGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.replaceChildren();
  delete reactGlobal.IS_REACT_ACT_ENVIRONMENT;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("workspace search controller", () => {
  it("debounces a trimmed query and exposes the current library results", async () => {
    vi.useFakeTimers();
    const searchWorkspace = vi.fn(async () => [result]);
    const setError = vi.fn();
    const { container } = renderHarness({
      workspacePath: "C:/library",
      workspaceRevision: 0,
      searchWorkspace,
      setError,
    });

    act(() => container.querySelector<HTMLButtonElement>("[data-set-short]")?.click());
    await advanceSearchDebounce();
    expect(searchWorkspace).not.toHaveBeenCalled();

    act(() => container.querySelector<HTMLButtonElement>("[data-set-query]")?.click());
    expect(container.querySelector("[data-loading]")?.textContent).toBe("true");
    await advanceSearchDebounce();

    expect(searchWorkspace).toHaveBeenCalledWith("C:/library", "alpha");
    expect(container.querySelector("[data-result-count]")?.textContent).toBe("1");
    expect(container.querySelector("[data-preview]")?.textContent).toBe("命中内容");
    expect(container.querySelector("[data-loading]")?.textContent).toBe("false");
    expect(setError).not.toHaveBeenCalled();
  });

  it("ignores results from an obsolete query and retries after a revision change", async () => {
    vi.useFakeTimers();
    const pending: Array<{
      root: string;
      query: string;
      resolve: (results: WorkspaceSearchResult[]) => void;
    }> = [];
    const searchWorkspace = vi.fn(
      (root: string, query: string) =>
        new Promise<WorkspaceSearchResult[]>((resolve) => pending.push({ root, query, resolve })),
    );
    const setError = vi.fn();
    const props: HarnessProps = {
      workspacePath: "C:/library",
      workspaceRevision: 0,
      searchWorkspace,
      setError,
    };
    const { container, rerender } = renderHarness(props);

    act(() => container.querySelector<HTMLButtonElement>("[data-set-query]")?.click());
    await advanceSearchDebounce();
    expect(pending.map(({ query }) => query)).toEqual(["alpha"]);

    act(() => container.querySelector<HTMLButtonElement>("[data-set-second]")?.click());
    await advanceSearchDebounce();
    expect(pending.map(({ query }) => query)).toEqual(["alpha", "second"]);

    await act(async () => {
      pending[0].resolve([result]);
      await Promise.resolve();
    });
    expect(container.querySelector("[data-result-count]")?.textContent).toBe("0");

    const refreshedResult = { ...result, preview: "刷新后的命中内容" };
    await act(async () => {
      pending[1].resolve([refreshedResult]);
      await Promise.resolve();
    });
    expect(container.querySelector("[data-preview]")?.textContent).toBe("刷新后的命中内容");

    rerender({ ...props, workspaceRevision: 1 });
    await advanceSearchDebounce();
    expect(pending.map(({ query }) => query)).toEqual(["alpha", "second", "second"]);
    expect(pending[2].root).toBe("C:/library");
  });

  it("clears results when the library or query is unavailable", async () => {
    vi.useFakeTimers();
    const searchWorkspace = vi.fn(async () => [result]);
    const setError = vi.fn();
    const props: HarnessProps = {
      workspacePath: "C:/library",
      workspaceRevision: 0,
      searchWorkspace,
      setError,
    };
    const { container, rerender } = renderHarness(props);

    act(() => container.querySelector<HTMLButtonElement>("[data-set-query]")?.click());
    await advanceSearchDebounce();
    expect(container.querySelector("[data-result-count]")?.textContent).toBe("1");

    rerender({ ...props, workspacePath: null });
    expect(container.querySelector("[data-result-count]")?.textContent).toBe("0");
    expect(container.querySelector("[data-loading]")?.textContent).toBe("false");

    act(() => container.querySelector<HTMLButtonElement>("[data-set-short]")?.click());
    await advanceSearchDebounce();
    expect(searchWorkspace).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it("reports search failures and resets the loading state", async () => {
    vi.useFakeTimers();
    const searchWorkspace = vi.fn(async () => {
      throw new Error("索引暂时不可用");
    });
    const setError = vi.fn();
    const { container } = renderHarness({
      workspacePath: "C:/library",
      workspaceRevision: 0,
      searchWorkspace,
      setError,
    });

    act(() => container.querySelector<HTMLButtonElement>("[data-set-query]")?.click());
    await advanceSearchDebounce();

    expect(container.querySelector("[data-result-count]")?.textContent).toBe("0");
    expect(container.querySelector("[data-loading]")?.textContent).toBe("false");
    expect(setError).toHaveBeenCalledWith("当前阅读库搜索失败：索引暂时不可用");
  });
});
