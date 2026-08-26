import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary";

function BrokenView(): ReactElement {
  throw new Error("render failed");
}

function mountBrokenView(reloadApp?: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ErrorBoundary reloadApp={reloadApp}>
        <BrokenView />
      </ErrorBoundary>,
    );
  });
  return { container, root };
}

const suppressRuntimeError = (event: ErrorEvent) => event.preventDefault();

beforeEach(() => {
  window.addEventListener("error", suppressRuntimeError);
});

afterEach(() => {
  window.removeEventListener("error", suppressRuntimeError);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("shows a recoverable fallback and reports render errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container, root } = mountBrokenView();

    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.textContent).toContain("界面暂时无法显示");
    expect(container.textContent).toContain("重新加载界面");
    expect(consoleError).toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("delegates the reload action to the injected app reload handler", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reloadApp = vi.fn();
    const { container, root } = mountBrokenView(reloadApp);
    const button = container.querySelector("button");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(reloadApp).toHaveBeenCalledOnce();
    act(() => root.unmount());
    container.remove();
  });
});
