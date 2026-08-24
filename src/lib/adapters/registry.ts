import type { DocumentKind } from "../../app/types";
import type { DocumentAdapter } from "./types";

const adaptersById = new Map<string, DocumentAdapter>();
const adaptersByExtension = new Map<string, DocumentAdapter>();

const builtInAdapters: readonly DocumentAdapter[] = [
  {
    id: "markdown",
    kind: "markdown",
    extensions: ["md", "markdown", "mdown", "mkd"],
    capabilities: { render: true, edit: true, exportHtml: true, exportDocx: true },
  },
  {
    id: "plain-text",
    kind: "text",
    extensions: ["txt", "text", "log"],
    capabilities: { render: true, edit: true, exportHtml: true, exportDocx: true },
  },
  {
    id: "docx",
    kind: "docx",
    extensions: ["docx"],
    capabilities: { render: true, edit: false, exportHtml: true, exportDocx: true },
  },
  {
    id: "pdf",
    kind: "pdf",
    extensions: ["pdf"],
    capabilities: { render: true, edit: false, exportHtml: false, exportDocx: false },
  },
  {
    id: "image",
    kind: "image",
    extensions: ["avif", "gif", "jpeg", "jpg", "png", "svg", "webp"],
    capabilities: { render: true, edit: false, exportHtml: false, exportDocx: false },
  },
];

function normalizeExtension(extension: string): string {
  return extension.trim().replace(/^\.+/, "").toLowerCase();
}

export function extensionFromPath(path: string): string {
  return path.split(/[?#]/, 1)[0].split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
}

function validateAdapter(adapter: DocumentAdapter): void {
  if (!adapter.id.trim()) throw new Error("文档适配器必须提供唯一 id。");
  if (adapter.extensions.length === 0) throw new Error(`文档适配器 ${adapter.id} 没有扩展名。`);
  if (adaptersById.has(adapter.id)) throw new Error(`文档适配器 ${adapter.id} 已注册。`);

  const normalizedExtensions = adapter.extensions.map(normalizeExtension);
  if (normalizedExtensions.some((extension) => !extension)) {
    throw new Error(`文档适配器 ${adapter.id} 包含空扩展名。`);
  }
  const duplicateExtension = normalizedExtensions.find(
    (extension, index) => normalizedExtensions.indexOf(extension) !== index,
  );
  if (duplicateExtension) throw new Error(`文档适配器 ${adapter.id} 重复声明扩展名 ${duplicateExtension}。`);
  const occupiedExtension = normalizedExtensions.find((extension) => adaptersByExtension.has(extension));
  if (occupiedExtension) throw new Error(`扩展名 .${occupiedExtension} 已被其他文档适配器占用。`);
}

export function registerDocumentAdapter(adapter: DocumentAdapter): () => void {
  validateAdapter(adapter);
  const normalizedExtensions = adapter.extensions.map(normalizeExtension);
  adaptersById.set(adapter.id, adapter);
  for (const extension of normalizedExtensions) adaptersByExtension.set(extension, adapter);

  return () => {
    if (adaptersById.get(adapter.id) !== adapter) return;
    adaptersById.delete(adapter.id);
    for (const extension of normalizedExtensions) {
      if (adaptersByExtension.get(extension) === adapter) adaptersByExtension.delete(extension);
    }
  };
}

for (const adapter of builtInAdapters) registerDocumentAdapter(adapter);

export function documentAdapterForPath(path: string): DocumentAdapter | null {
  return adaptersByExtension.get(extensionFromPath(path)) ?? null;
}

export function documentAdapterForKind(kind: DocumentKind): DocumentAdapter | null {
  return [...adaptersById.values()].find((adapter) => adapter.kind === kind) ?? null;
}

export function listDocumentAdapters(): readonly DocumentAdapter[] {
  return [...adaptersById.values()];
}
