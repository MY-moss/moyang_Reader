import { describe, expect, it } from "vitest";
import { locateSource, locateText, scrollToSource, selectionSourceLocation, sourceBlocks } from "./source-locator";
describe("source relocation", () => {
  const root = (html: string) => new DOMParser().parseFromString(html, "text/html");
  it("locates the requested occurrence in an unchanged long document", () => {
    const document = root("<h1>标题</h1><p>重复证据</p><p>重复证据</p>");
    const found = locateSource(document, { path: "a.md", paragraph: 3, quote: "重复证据" }, true);
    expect(found.status).toBe("found");
    expect(found.element).toBe(sourceBlocks(document)[2]);
  });
  it("relocates a unique quote after surrounding paragraphs change", () => {
    const found = locateSource(
      root("<p>新增</p><p>唯一 的\n 证据</p>"),
      { path: "a.md", paragraph: 1, quote: "唯一 的 证据" },
      false,
    );
    expect(found.status).toBe("moved");
    expect(found.element?.tagName).toBe("P");
  });
  it("does not pretend an ambiguous or removed quote was located", () => {
    expect(locateSource(root("<p>相同</p><p>相同</p>"), { path: "a", quote: "相同" }, false).status).toBe("ambiguous");
    expect(locateSource(root("<p>新内容</p>"), { path: "a", quote: "旧内容" }, false).status).toBe("missing");
  });
  it("locates a deep TXT range instead of the top of its single pre element", () => {
    const text = "first line\n".repeat(500) + "deep evidence";
    const document = root(`<div class="content-area"><pre>${text}</pre></div>`);
    const found = locateSource(
      document,
      { path: "long.txt", offset: text.indexOf("deep evidence"), quote: "deep evidence" },
      true,
    );
    expect(found.range?.toString()).toBe("deep evidence");
    expect(found.range?.startOffset).toBe(text.indexOf("deep evidence"));
    const container = document.querySelector<HTMLElement>(".content-area")!;
    Object.defineProperty(container, "clientHeight", { value: 400 });
    container.getBoundingClientRect = () => ({ top: 10 }) as DOMRect;
    found.range!.getBoundingClientRect = () => ({ top: 900, height: 20, width: 100 }) as DOMRect;
    scrollToSource(found.element!, found.range);
    expect(container.scrollTop).toBe(690);
  });
  it("retains a selected range across inline markup and multiple paragraphs", () => {
    const document = root("<p>start <strong>evidence</strong></p><p>second paragraph end</p>");
    const selection = window.getSelection()!;
    // Selection belongs to the live document, as in the actual reader.
    const host = window.document.createElement("div");
    host.innerHTML = document.body.innerHTML;
    window.document.body.append(host);
    const range = window.document.createRange();
    range.setStart(host.querySelector("strong")!.firstChild!, 0);
    range.setEnd(host.querySelectorAll("p")[1].firstChild!, 6);
    selection.removeAllRanges();
    selection.addRange(range);
    const location = selectionSourceLocation(host, selection)!;
    expect(location.quote).toBe("evidence\n\nsecond");
    const found = locateSource(host, { path: "note.md", ...location }, true);
    expect(found.status).toBe("found");
    expect(found.range?.toString()).toBe("evidencesecond");
    host.insertAdjacentHTML("afterbegin", "<p>new introduction</p>");
    expect(locateSource(host, { path: "note.md", ...location }, false).status).toBe("moved");
    host.remove();
    selection.removeAllRanges();
  });
  it("uses unchanged offsets to distinguish repeated text within one block", () => {
    const text = "same quote then same quote";
    expect(locateText(text, { path: "a.txt", offset: 16, quote: "same quote" }, true).from).toBe(16);
    expect(locateText(text, { path: "a.txt", offset: 16, quote: "same quote" }, false).status).toBe("ambiguous");
  });
});
