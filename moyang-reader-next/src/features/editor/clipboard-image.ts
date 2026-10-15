const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const MAX_CLIPBOARD_IMAGE_BYTES = 10 * 1024 * 1024;

export function findClipboardImage(data: DataTransfer | null): File | null {
  if (!data) return null;

  for (const item of Array.from(data.items)) {
    if (item.kind !== "file" || !item.type.toLocaleLowerCase().startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }

  return Array.from(data.files).find((file) => file.type.toLocaleLowerCase().startsWith("image/")) ?? null;
}

export function insertTextAtSelection(source: string, start: number, end: number, insertion: string): string {
  const safeStart = Math.max(0, Math.min(start, source.length));
  const safeEnd = Math.max(safeStart, Math.min(end, source.length));
  return `${source.slice(0, safeStart)}${insertion}${source.slice(safeEnd)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localTimestamp(date: Date): string {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("") +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function shortHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function clipboardAssetFileName(bytes: Uint8Array, date = new Date()): string {
  return `${localTimestamp(date)}-${shortHash(bytes)}.png`;
}

function documentDirectory(path: string): string {
  const lastSeparator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastSeparator < 0) return ".";
  if (lastSeparator === 0) return path.slice(0, 1);
  return path.slice(0, lastSeparator);
}

function joinPath(...parts: string[]): string {
  const separator = parts[0]?.includes("\\") ? "\\" : "/";
  const firstPart = parts[0] ?? "";
  const isRoot = firstPart === "/" || firstPart === "\\";
  return parts
    .map((part, index) => {
      if (index === 0) return part.replace(/[\\/]+$/, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .filter(Boolean)
    .join(separator)
    .replace(/^/, isRoot ? separator : "");
}

export function clipboardAssetPath(documentPath: string, fileName: string): string {
  return joinPath(documentDirectory(documentPath), "assets", fileName);
}

export function clipboardAssetReference(fileName: string): string {
  return `![[assets/${fileName}]]`;
}

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

export async function clipboardImageToPng(file: Blob): Promise<Uint8Array> {
  const source = new Uint8Array(await file.arrayBuffer());
  if (isPng(source)) return source;
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("当前剪贴板图片无法转换为 PNG，请复制 PNG 格式图片后重试。");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前环境无法处理剪贴板图片。");
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("当前剪贴板图片无法转换为 PNG，请重试。");
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
