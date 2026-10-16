import { normalizeBlockAnchor } from "./blocks";

export async function renderDocumentEmbed(source: string, anchor = "", allowRemoteResources = false): Promise<string> {
  const { renderMarkdown } = await import("./markdown");
  const rendered = await renderMarkdown(source, { allowRemoteResources });
  const parsed = new DOMParser().parseFromString(rendered.html, "text/html");
  const fragment = parsed.createElement("div");
  if (anchor) {
    const id = normalizeBlockAnchor(anchor);
    const target = Array.from(parsed.body.querySelectorAll("[id]")).find((element) => element.id === id);
    if (!target) throw new Error(`找不到引用位置：${anchor}`);
    fragment.append(target.cloneNode(true));
    if (/^H[1-6]$/.test(target.tagName)) {
      let sibling = target.nextElementSibling;
      while (sibling && !(/^H[1-6]$/.test(sibling.tagName) && sibling.tagName <= target.tagName)) {
        fragment.append(sibling.cloneNode(true));
        sibling = sibling.nextElementSibling;
      }
    }
  } else fragment.innerHTML = parsed.body.innerHTML;
  // Nested embeds remain explicit links: bounded work and no cyclic transclusion.
  fragment.querySelectorAll('img[src^="moyang-embed:"]').forEach((image) => {
    const link = parsed.createElement("a");
    link.setAttribute("href", (image.getAttribute("src") ?? "").replace("moyang-embed:", "moyang-wiki:"));
    link.textContent = image.getAttribute("alt") || "打开嵌入文档";
    image.replaceWith(link);
  });
  fragment.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  return fragment.innerHTML;
}
