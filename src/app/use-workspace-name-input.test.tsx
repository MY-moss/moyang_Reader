import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useWorkspaceNameInput } from "./use-workspace-name-input";
import type { WorkspaceNameInputRequest } from "./workspace-name-input";
import { workspaceNameMessages, workspaceNameError } from "./workspace-name-copy";

const request: WorkspaceNameInputRequest = {
  action: "create-note",
  kind: "file",
  root: "C:/Notes",
  parentPath: "",
  initialName: "Untitled",
};
function mount() {
  let api!: ReturnType<typeof useWorkspaceNameInput>;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Harness() {
    api = useWorkspaceNameInput();
    return null;
  }
  act(() => root.render(<Harness />));
  return {
    api: () => api,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}
describe("workspace name input boundary", () => {
  it("rejects concurrent requests, validates names and cancels once without IO", async () => {
    const harness = mount();
    const submit = vi.fn(async () => "done" as const);
    let pending!: Promise<boolean>;
    act(() => {
      pending = harness.api().requestName(request, submit);
    });
    expect(await harness.api().requestName(request, submit)).toBe(false);
    await act(async () => harness.api().submitName("CON"));
    expect(submit).not.toHaveBeenCalled();
    act(() => {
      harness.api().cancel();
      harness.api().cancel();
    });
    expect(await pending).toBe(false);
    harness.unmount();
  });
  it("holds the operation lock through IO, ignores double submit and busy cancellation", async () => {
    const harness = mount();
    let complete!: (outcome: "done") => void;
    const submit = vi.fn(
      () =>
        new Promise<"done">((resolve) => {
          complete = resolve;
        }),
    );
    let pending!: Promise<boolean>;
    act(() => {
      pending = harness.api().requestName(request, submit);
    });
    let operation!: Promise<void>;
    act(() => {
      operation = harness.api().submitName("  笔记  ");
      void harness.api().submitName("Second");
      harness.api().cancel();
    });
    expect(submit).toHaveBeenCalledExactlyOnceWith("笔记");
    expect(harness.api().state?.busy).toBe(true);
    await act(async () => {
      complete("done");
      await operation;
    });
    expect(await pending).toBe(true);
    expect(harness.api().state).toBeNull();
    harness.unmount();
  });
  it("retains the request after failure and accepts a corrected retry", async () => {
    const harness = mount();
    const cause = new Error("private backend details");
    const submit = vi.fn().mockRejectedValueOnce(cause).mockResolvedValueOnce("done");
    let pending!: Promise<boolean>;
    act(() => {
      pending = harness.api().requestName(request, submit);
    });
    await act(async () => harness.api().submitName("Taken"));
    expect(harness.api().state).toEqual({ request, busy: false, error: cause });
    await act(async () => harness.api().submitName("Corrected"));
    expect(await pending).toBe(true);
    harness.unmount();
  });
  it("resolves false on unmount, including an in-flight submission", async () => {
    const harness = mount();
    let complete!: (outcome: "done") => void;
    let pending!: Promise<boolean>;
    let operation!: Promise<void>;
    act(() => {
      pending = harness.api().requestName(
        request,
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      );
      operation = harness.api().submitName("Valid");
    });
    harness.unmount();
    expect(await pending).toBe(false);
    complete("done");
    await operation;
  });
  it("keeps locale keys aligned and never exposes backend prose", () => {
    expect(Object.keys(workspaceNameMessages["zh-CN"]).sort()).toEqual(
      Object.keys(workspaceNameMessages["en-US"]).sort(),
    );
    expect(workspaceNameError("en-US", new Error("私有后端详情"))).not.toContain("私有后端详情");
    expect(workspaceNameError("en-US", { code: "FILE_WRITE_FAILED" }, "create-note")).not.toContain("Your edits");
  });
});
