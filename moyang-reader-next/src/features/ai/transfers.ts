import { parseDocument, stringify } from "yaml";
import { aiRequest } from "../../platform/ai-bridge";
import {
  chooseSavePath,
  isTauriRuntime,
  writeBinaryFile,
  readBinaryFile,
  authorizeStoredPath,
} from "../../platform/bridge";
import { emptyAiFields, type AiAsset, type AiFields, type AiKind, type AiRecord } from "../../shared/ai-types";
import { contentHash, extractSourceChunks, textChunks } from "../documents/source-chunks";
import { Readability } from "@mozilla/readability";

export async function downloadAi(name: string, bytes: Uint8Array, format: "json" | "markdown" | "zip" | "resource") {
  if (isTauriRuntime()) {
    const path = await chooseSavePath(name, format);
    if (!path) return false;
    await writeBinaryFile(path, bytes);
    return true;
  }
  const blob = new Blob([new Uint8Array(bytes)]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export function skillMarkdown(fields: AiFields): string {
  return `---\n${stringify({ ...fields.skill_meta, name: fields.title, description: fields.summary })}---\n\n${fields.body}`;
}
export function parseSkill(text: string): AiFields {
  const match = text.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error("SKILL.md 需要 name 和 description 属性。");
  const doc = parseDocument(match[1]);
  if (doc.errors.length) throw new Error(doc.errors[0].message);
  const meta = doc.toJS() as Record<string, unknown>;
  if (!meta || typeof meta.name !== "string" || typeof meta.description !== "string")
    throw new Error("技能需要 name 和 description。");
  const { name, description, ...skill_meta } = meta;
  return { ...emptyAiFields("skill"), title: name, summary: description, body: match[2].trim(), skill_meta };
}
export async function importAiFile(file: File, kind: AiKind): Promise<AiFields> {
  if (file.size > 25_000_000) throw new Error("请将文件控制在 25 MB 以内。");
  if (kind === "skill" && /\.zip$/i.test(file.name)) {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const mains = entries.filter((f) => /(^|\/)SKILL\.md$/.test(f.name));
    if (mains.length !== 1) throw new Error("每个技能包应包含一个 SKILL.md。");
    const main = mains[0];
    const prefix = main.name.slice(0, -8);
    const fields = parseSkill(await main.async("string"));
    const assets: AiAsset[] = [];
    let size = 0;
    for (const entry of entries) {
      if (entry === main) continue;
      if (!entry.name.startsWith(prefix)) throw new Error("资源应放在 SKILL.md 所在目录中。");
      const path = entry.name.slice(prefix.length);
      if (!path || path.split("/").includes("..") || path.includes("\\")) throw new Error("资源路径无效。");
      const bytes = await entry.async("uint8array");
      size += bytes.length;
      if (size > 25_000_000 || assets.length >= 200) throw new Error("解压后的技能资源过大，请拆分技能包。");
      const textFile = /\.(md|txt|json|ya?ml|toml|csv|py|[cm]?js|tsx?|sh|ps1|html|css|rs|xml|svg)$/i.test(path);
      if (textFile) {
        try {
          assets.push({ path, content: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "utf8" });
          continue;
        } catch {
          /* Non-UTF-8 resources retain their exact bytes below. */
        }
      }
      assets.push({ path, content: await entry.async("base64"), encoding: "base64" });
    }
    return { ...fields, assets, source: file.name };
  }
  if (kind === "skill") return { ...parseSkill(await file.text()), source: file.name };
  const format = /\.pdf$/i.test(file.name)
    ? "pdf"
    : /\.docx$/i.test(file.name)
      ? "docx"
      : /\.md|\.markdown$/i.test(file.name)
        ? "markdown"
        : "text";
  if (!/\.(md|markdown|txt|docx|pdf)$/i.test(file.name)) throw new Error("请选择 Markdown、TXT、DOCX 或文字型 PDF。");
  const source = format === "pdf" || format === "docx" ? new Uint8Array(await file.arrayBuffer()) : await file.text();
  const extracted = await extractSourceChunks(file.name, format, source);
  const body = typeof source === "string" ? source : extracted.text;
  return {
    ...emptyAiFields(kind),
    title: file.name.replace(/\.[^.]+$/, ""),
    body,
    source: file.name,
    snapshot: {
      uri: file.name,
      format,
      fingerprint: extracted.hash,
      imported_at: Date.now(),
      checked_at: null,
      locations: extracted.chunks.map((c) => ({
        uri: file.name,
        fingerprint: extracted.hash,
        page: c.location.page ?? null,
        paragraph: c.location.paragraph ?? null,
        quote: c.location.quote ?? "",
      })),
    },
  };
}
export async function importAiWeb(uri: string): Promise<AiFields> {
  const page = await aiRequest<{ uri: string; html: string; content_type: string }>("fetch_web", { uri });
  const document = new DOMParser().parseFromString(page.html, "text/html");
  const base = document.createElement("base");
  base.href = page.uri;
  document.head.prepend(base);
  const article = new Readability(document).parse();
  const body = page.content_type.includes("text/plain") ? page.html : article?.textContent?.trim();
  if (!body || body.length < 80)
    throw new Error("没有提取到完整正文；页面可能需要登录或运行脚本。请粘贴正文，或导入保存的文件。");
  const fingerprint = await contentHash(body);
  return {
    ...emptyAiFields("knowledge"),
    title: article?.title || new URL(page.uri).hostname,
    summary: article?.excerpt || "",
    body,
    source: page.uri,
    snapshot: {
      uri: page.uri,
      format: "web",
      fingerprint,
      imported_at: Date.now(),
      checked_at: null,
      locations: textChunks(page.uri, body, fingerprint).map((c) => ({
        uri: page.uri,
        fingerprint,
        page: null,
        paragraph: c.location.paragraph ?? null,
        quote: c.location.quote ?? "",
      })),
    },
  };
}
export async function importAiPath(path: string, kind: AiKind): Promise<AiFields> {
  await authorizeStoredPath(path, false);
  const bytes = await readBinaryFile(path);
  const fields = await importAiFile(new File([new Uint8Array(bytes)], path.split(/[\\/]/).pop()!), kind);
  return {
    ...fields,
    source: path,
    snapshot: fields.snapshot
      ? { ...fields.snapshot, uri: path, locations: fields.snapshot.locations.map((l) => ({ ...l, uri: path })) }
      : null,
  };
}
export async function importAiDirectory(files: File[]): Promise<AiFields> {
  const main = files.find((f) => /(^|\/)SKILL\.md$/.test(f.webkitRelativePath || f.name));
  if (!main) throw new Error("技能目录中没有 SKILL.md。");
  const base = (main.webkitRelativePath || main.name).slice(0, -8);
  if (files.filter((f) => /(^|\/)SKILL\.md$/.test(f.webkitRelativePath || f.name)).length !== 1)
    throw new Error("请每次导入一个技能目录。");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let size = 0;
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    if (!path.startsWith(base)) continue;
    size += file.size;
    if (size > 25_000_000) throw new Error("技能资源超过 25 MB。");
    zip.file(path, await file.arrayBuffer());
  }
  return importAiFile(
    new File([new Uint8Array(await zip.generateAsync({ type: "uint8array" }))], "skill.zip"),
    "skill",
  );
}
export async function exportAiRecord(record: AiRecord) {
  if (record.kind === "skill") {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    zip.file(`${record.title}/SKILL.md`, skillMarkdown(record));
    for (const asset of record.assets)
      zip.file(`${record.title}/${asset.path}`, asset.content, { base64: asset.encoding === "base64" });
    return downloadAi(`${record.title}.zip`, await zip.generateAsync({ type: "uint8array" }), "zip");
  }
  const name = record.title.replace(/[<>:"/\\|?*]/g, "-").slice(0, 100);
  const front = stringify({
    title: record.title,
    kind: record.kind,
    source: record.source,
    tags: record.tags,
    project: record.project,
    agent: record.agent,
  });
  return downloadAi(`${name}.md`, new TextEncoder().encode(`---\n${front}---\n\n${record.body}`), "markdown");
}
export async function exportAiBackup() {
  const data = await aiRequest("backup");
  return downloadAi(
    `moyang-ai-${new Date().toISOString().slice(0, 10)}.json`,
    new TextEncoder().encode(JSON.stringify(data, null, 2)),
    "json",
  );
}
