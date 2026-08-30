import { describe, expect, it } from "vitest";

import { classifyFileDropPaths, hasFileDragPayload } from "./file-drop";

describe("file drop helpers", () => {
  it("classifies supported, mixed, unsupported, and empty paths", () => {
    const isSupported = (path: string) => /\.(?:md|txt)$/i.test(path);

    expect(classifyFileDropPaths(["note.md", "readme.txt"], isSupported)).toBe("supported");
    expect(classifyFileDropPaths(["note.md", "archive.zip"], isSupported)).toBe("mixed");
    expect(classifyFileDropPaths(["archive.zip"], isSupported)).toBe("unsupported");
    expect(classifyFileDropPaths([], isSupported)).toBe("unknown");
  });

  it("recognizes file payloads without treating internal text drags as files", () => {
    expect(hasFileDragPayload({ files: [], items: [], types: ["text/plain"] })).toBe(false);
    expect(hasFileDragPayload({ files: [], items: [{ kind: "file" } as DataTransferItem], types: [] })).toBe(true);
    expect(hasFileDragPayload({ files: [], items: [], types: ["Files"] })).toBe(true);
  });
});
