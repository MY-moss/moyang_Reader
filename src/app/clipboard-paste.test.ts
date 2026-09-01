import { describe, expect, it } from "vitest";
import { clipboardPayloadHasContent, readClipboardPayload } from "./clipboard-paste";

describe("clipboard paste helpers", () => {
  it("reads plain text, HTML, and image clipboard items", async () => {
    const image = new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" });
    const textBlob = (value: string) => ({ text: async () => value }) as unknown as Blob;
    const payload = await readClipboardPayload({
      read: async () => [
        {
          types: ["text/plain", "text/html", "image/png"],
          getType: async (type: string) =>
            type === "text/plain" ? textBlob("plain") : type === "text/html" ? textBlob("<b>rich</b>") : image,
        } as unknown as ClipboardItem,
      ],
    });

    expect(payload.text).toBe("plain");
    expect(payload.html).toBe("<b>rich</b>");
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0]?.name).toBe("clipboard-1.png");
    expect(clipboardPayloadHasContent(payload)).toBe(true);
  });

  it("falls back to readText when rich clipboard access is unavailable", async () => {
    const payload = await readClipboardPayload({
      read: async () => {
        throw new Error("permission denied");
      },
      readText: async () => "fallback text",
    });

    expect(payload).toEqual({ text: "fallback text", html: "", files: [] });
  });

  it("reports an empty clipboard without treating it as a successful paste", async () => {
    const payload = await readClipboardPayload({ readText: async () => "" });

    expect(clipboardPayloadHasContent(payload)).toBe(false);
  });
});
