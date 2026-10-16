import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { aiRequest } from "../../platform/ai-bridge";
import { emptyAiFields } from "../../shared/ai-types";
import { useAiSpace } from "./useAiSpace";
vi.mock("../../platform/ai-bridge", () => ({ aiRequest: vi.fn() }));
vi.mock("./draft-store", () => ({
  readAiDrafts: async () => [],
  writeAiDraft: async () => {},
  removeAiDraft: async () => {},
}));
it("finishes an explicit save pressed during autosave and keeps the latest input", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  vi.mocked(aiRequest).mockImplementation(async (_operation, payload) => {
    count++;
    if (count === 1) await gate;
    return { ...(payload as object), id: "record", revision: count };
  });
  let model!: ReturnType<typeof useAiSpace>;
  function Harness() {
    model = useAiSpace(false);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<Harness />));
    const fields = { ...emptyAiFields("knowledge"), title: "测试", body: "原输入" };
    await act(async () => model.setDraft({ key: "draft", fields, dirty: true }));
    let auto!: Promise<void>, manual!: Promise<void>;
    await act(async () => {
      auto = model.save(false);
    });
    await act(async () =>
      model.setDraft({ ...model.draft!, fields: { ...fields, body: "保存期间的新输入" }, dirty: true }),
    );
    await act(async () => {
      manual = model.save(true);
    });
    await act(async () => {
      release();
      await auto;
      await manual;
    });
    expect(model.draft).toBeNull();
    expect(model.selected?.body).toBe("保存期间的新输入");
    expect(count).toBe(2);
  } finally {
    await act(async () => root.unmount());
  }
});
