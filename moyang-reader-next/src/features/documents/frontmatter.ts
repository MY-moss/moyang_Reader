import { isMap, isSeq, parseDocument } from "yaml";

export function splitFrontmatter(source: string) {
  const match = source.match(/^(\uFEFF?---[^\S\r\n]*\r?\n)([\s\S]*?)(\r?\n(?:---|\.\.\.)[^\S\r\n]*(?:\r?\n|$))/);
  if (match) return { yaml: match[2], body: source.slice(match[0].length), opening: match[1], closing: match[3] };
  if (/^\uFEFF?---[^\S\r\n]*\r?\n/.test(source)) throw new Error("文档属性缺少结束分隔线，请先在源文本中修复。");
  return {
    yaml: "",
    body: source.replace(/^\uFEFF/, ""),
    opening: `${source.startsWith("\uFEFF") ? "\uFEFF" : ""}---\n`,
    closing: "\n---\n",
  };
}

export function validateProperties(yaml: string) {
  if (yaml.length > 100_000) throw new Error("属性超过 100 KB，请使用源文本编辑。");
  const document = parseDocument(yaml, { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors[0].message);
  if (document.contents && !isMap(document.contents))
    throw new Error("文档属性必须是“字段: 值”的映射，可包含列表和嵌套属性。");
  return document;
}

export function replaceProperties(source: string, yaml: string): string {
  validateProperties(yaml);
  const parts = splitFrontmatter(source);
  const lineEnding = parts.opening.includes("\r\n") ? "\r\n" : "\n";
  return parts.opening + yaml.replace(/\r?\n/g, lineEnding).replace(/[\r\n]+$/, "") + parts.closing + parts.body;
}

export function summarizeProperties(source: string): Array<[string, string]> {
  try {
    const doc = validateProperties(splitFrontmatter(source).yaml);
    if (!isMap(doc.contents)) return [];
    return doc.contents.items.map((item) => [String(item.key), String(item.value ?? "（空）")]);
  } catch {
    return [];
  }
}

export function commonProperties(yaml: string): { title: string; tags: string; valid: boolean } {
  try {
    const doc = validateProperties(yaml);
    const tags = doc.get("tags", true);
    return {
      title: String(doc.get("title") ?? ""),
      tags: isSeq(tags) ? tags.items.map(String).join(", ") : String(tags ?? ""),
      valid: true,
    };
  } catch {
    return { title: "", tags: "", valid: false };
  }
}

/** Editing ordinary fields retains custom YAML nodes and their comments. */
export function updateCommonProperty(yaml: string, field: "title" | "tags", value: string): string {
  const doc = validateProperties(yaml);
  doc.set(
    field,
    field === "tags"
      ? value
          .split(/[,，]/)
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
      : value,
  );
  return doc.toString();
}
