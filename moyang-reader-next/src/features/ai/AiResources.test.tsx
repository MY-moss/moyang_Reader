import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AiAsset } from "../../shared/ai-types";
import { AiResources } from "./AiResources";

describe("AI resource imports", () => {
  it("cancels a pending import when its draft is left or discarded", async () => {
    let resolve!: (buffer: ArrayBuffer) => void;
    const file = {
      name: "pending.txt",
      size: 3,
      arrayBuffer: () =>
        new Promise<ArrayBuffer>((done) => {
          resolve = done;
        }),
    };
    const change = vi.fn(),
      loading = vi.fn();
    const element = document.createElement("div");
    const root = createRoot(element);
    await act(async () => root.render(<AiResources assets={[]} onChange={change} onLoading={loading} />));
    const input = element.querySelector("input")!;
    Object.defineProperty(input, "files", { value: [file] });
    await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
    expect(loading).toHaveBeenLastCalledWith(true);
    await act(async () => root.unmount());
    await act(async () => resolve(new TextEncoder().encode("new").buffer));
    expect(change).not.toHaveBeenCalled();
    expect(loading).toHaveBeenLastCalledWith(false);
  });
  it("updates an open text preview when its resource changes and closes it on removal", async () => {
    const element = document.createElement("div");
    const root = createRoot(element);
    const asset: AiAsset = { path: "reference.txt", encoding: "utf8", content: "old text" };
    try {
      await act(async () => root.render(<AiResources assets={[asset]} />));
      await act(async () => (element.querySelector(".ai-resource-row button") as HTMLButtonElement).click());
      expect(element.querySelector(".ai-resource-preview pre")?.textContent).toBe("old text");
      await act(async () => root.render(<AiResources assets={[{ ...asset, content: "new text" }]} />));
      expect(element.querySelector(".ai-resource-preview pre")?.textContent).toBe("new text");
      await act(async () => root.render(<AiResources assets={[]} />));
      expect(element.querySelector(".ai-resource-preview")).toBeNull();
    } finally {
      await act(async () => root.unmount());
    }
  });

  it("replaces the image URL of an open preview and releases the previous resource", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:old").mockReturnValueOnce("blob:new");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const element = document.createElement("div");
    const root = createRoot(element);
    const asset: AiAsset = { path: "preview.png", encoding: "base64", content: "AQ==" };
    try {
      await act(async () => root.render(<AiResources assets={[asset]} />));
      await act(async () => (element.querySelector(".ai-resource-row button") as HTMLButtonElement).click());
      expect(element.querySelector("img")?.getAttribute("src")).toBe("blob:old");
      await act(async () => root.render(<AiResources assets={[{ ...asset }]} />));
      expect(create).toHaveBeenCalledTimes(1);
      await act(async () => root.render(<AiResources assets={[{ ...asset, content: "Ag==" }]} />));
      expect(element.querySelector("img")?.getAttribute("src")).toBe("blob:new");
      expect(revoke).toHaveBeenCalledWith("blob:old");
    } finally {
      await act(async () => root.unmount());
      create.mockRestore();
      revoke.mockRestore();
    }
  });

  it("keeps newer text and resource changes when a file finishes reading", async () => {
    let finishRead!: (buffer: ArrayBuffer) => void;
    const contents = new Promise<ArrayBuffer>((resolve) => {
      finishRead = resolve;
    });
    const file = { name: "new.txt", size: 3, arrayBuffer: () => contents };
    let edit!: () => void;
    let latest!: { title: string; assets: AiAsset[] };
    function Harness() {
      const [draft, setDraft] = useState({ title: "before", assets: [] as AiAsset[] });
      latest = draft;
      edit = () =>
        setDraft({ title: "newer title", assets: [{ path: "other.txt", encoding: "utf8", content: "other" }] });
      return <AiResources assets={draft.assets} onChange={(assets) => setDraft({ ...draft, assets })} />;
    }
    const element = document.createElement("div");
    const root = createRoot(element);
    try {
      await act(async () => root.render(<Harness />));
      const input = element.querySelector("input")!;
      Object.defineProperty(input, "files", { value: [file] });
      await act(async () => {
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => edit());
      await act(async () => finishRead(new TextEncoder().encode("new").buffer));
      expect(latest.title).toBe("newer title");
      expect(latest.assets.map((asset) => asset.path)).toEqual(["other.txt", "new.txt"]);
    } finally {
      await act(async () => root.unmount());
    }
  });
});
