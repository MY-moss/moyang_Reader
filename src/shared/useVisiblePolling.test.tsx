import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useVisiblePolling } from "./useVisiblePolling";

it("serializes slow reads, drops prior activation responses and pauses while hidden", async () => {
  vi.useFakeTimers();
  let visible = "visible",
    enabled = true;
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockImplementation(() => visible as DocumentVisibilityState);
  const completions: ((value: number) => void)[] = [];
  const read = vi.fn(() => new Promise<number>((resolve) => completions.push(resolve)));
  const receive = vi.fn();
  function Harness() {
    useVisiblePolling(enabled, read, receive, () => {}, 100);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<Harness />));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(read).toHaveBeenCalledTimes(1);
    enabled = false;
    await act(async () => root.render(<Harness />));
    await act(async () => completions[0](1));
    expect(receive).not.toHaveBeenCalled();
    enabled = true;
    visible = "hidden";
    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(read).toHaveBeenCalledTimes(1);
    visible = "visible";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => completions[1](2));
    expect(receive).toHaveBeenLastCalledWith(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    enabled = false;
    await act(async () => root.render(<Harness />));
    enabled = true;
    await act(async () => root.render(<Harness />));
    visible = "hidden";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    visible = "visible";
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => completions[2](3));
    expect(read).toHaveBeenCalledTimes(4);
    expect(receive).not.toHaveBeenCalledWith(3);
    await act(async () => completions[3](4));
    expect(receive).toHaveBeenLastCalledWith(4);
  } finally {
    await act(async () => root.unmount());
    visibility.mockRestore();
    vi.useRealTimers();
  }
});
