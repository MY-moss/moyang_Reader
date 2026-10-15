import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { AiAsset } from "../../shared/ai-types";
import { AiResources } from "./AiResources";

describe("AI resource imports", () => {
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
