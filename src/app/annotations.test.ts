import { describe, expect, it } from "vitest";
import {
  addAnnotation,
  annotationIdentity,
  createAnnotation,
  createSelectionAnchor,
  normalizeAnnotation,
  normalizeAnnotations,
  removeAnnotation,
  workspaceRelativePath,
} from "./annotations";

describe("text annotations", () => {
  it("creates a selection anchor with local context and stable offsets", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Read <strong>important</strong> now</p>";
    document.body.appendChild(root);
    const text = root.querySelector("strong")?.firstChild;
    expect(text).toBeInstanceOf(Text);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(text as Text, 0);
    range.setEnd(text as Text, text?.textContent?.length ?? 0);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const anchor = createSelectionAnchor(root, selection);
    expect(anchor).toEqual({
      quote: "important",
      prefix: "Read ",
      suffix: " now",
      start: 5,
      end: 14,
    });

    selection?.removeAllRanges();
    root.remove();
  });

  it("normalizes paths and rejects unsafe annotation records", () => {
    const annotation = normalizeAnnotation({
      id: "a-1",
      path: "Notes\\Today.md",
      quote: "  two   words ",
      prefix: "before",
      suffix: "after",
      start: 4,
      end: 13,
      note: "  remember this  ",
      createdAt: 1,
      updatedAt: 2,
    });
    expect(annotation?.path).toBe("Notes/Today.md");
    expect(annotation?.quote).toBe("two words");
    expect(annotation?.note).toBe("remember this");
    expect(normalizeAnnotation({ ...annotation, path: "../secret.md" })).toBeNull();
    expect(workspaceRelativePath("C:\\Vault", "c:\\vault\\Notes\\Today.md")).toBe("Notes/Today.md");
    expect(workspaceRelativePath("C:\\Vault", "C:\\Other\\Today.md")).toBeNull();
  });

  it("deduplicates a replacement and removes by id", () => {
    const first = createAnnotation("Today.md", { quote: "one", prefix: "", suffix: "", start: 0, end: 3 }, "", 1, "a");
    const second = createAnnotation("Today.md", { quote: "two", prefix: "", suffix: "", start: 0, end: 3 }, "", 2, "b");
    const replacement = createAnnotation(
      "Today.md",
      { quote: "one", prefix: "", suffix: "", start: 0, end: 3 },
      "updated",
      3,
      "c",
    );
    const added = addAnnotation([first, second], replacement);
    expect(added).toHaveLength(2);
    expect(added.find((annotation) => annotation.quote === "one")?.id).toBe("c");
    expect(removeAnnotation(added, "b")).toEqual([added[0]]);
    expect(normalizeAnnotations([first, first])).toHaveLength(1);
    expect(annotationIdentity(first)).toBe(annotationIdentity(replacement));
  });
});
