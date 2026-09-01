export type ClipboardPayload = {
  text: string;
  html: string;
  files: File[];
};

type ClipboardReader = {
  read?: () => Promise<readonly ClipboardItem[]>;
  readText?: () => Promise<string>;
};

function imageFileName(type: string, index: number): string {
  const extension = type.split("/", 2)[1]?.toLowerCase().replace("+xml", "") || "bin";
  const normalized = extension === "jpeg" ? "jpg" : extension;
  return `clipboard-${index + 1}.${normalized}`;
}

export function clipboardPayloadHasContent(payload: ClipboardPayload): boolean {
  return Boolean(payload.text || payload.html || payload.files.length);
}

export async function readClipboardPayload(
  clipboard: ClipboardReader | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard,
): Promise<ClipboardPayload> {
  if (!clipboard?.read && !clipboard?.readText) {
    throw new Error("当前环境不支持访问剪贴板。");
  }

  if (clipboard.read) {
    try {
      const items = await clipboard.read();
      let text = "";
      let html = "";
      const files: File[] = [];

      for (const item of items) {
        for (const type of item.types) {
          if (type === "text/plain") {
            text = await (await item.getType(type)).text();
          } else if (type === "text/html") {
            html = await (await item.getType(type)).text();
          } else if (type.toLowerCase().startsWith("image/")) {
            const blob = await item.getType(type);
            files.push(new File([blob], imageFileName(type, files.length), { type: blob.type || type }));
          }
        }
      }

      return { text, html, files };
    } catch (cause) {
      // Some WebView versions expose read() but deny it while still allowing
      // readText() for a user-initiated menu action. Preserve that fallback.
      if (!clipboard.readText) throw cause;
    }
  }

  if (clipboard.readText) return { text: await clipboard.readText(), html: "", files: [] };
  throw new Error("当前环境不支持访问剪贴板。");
}

export function createClipboardDataTransfer(payload: ClipboardPayload): DataTransfer | null {
  if (typeof DataTransfer === "undefined") return null;

  const data = new DataTransfer();
  if (payload.text) data.setData("text/plain", payload.text);
  if (payload.html) data.setData("text/html", payload.html);
  for (const file of payload.files) data.items.add(file);
  return data;
}

export function dispatchClipboardPaste(target: HTMLElement, payload: ClipboardPayload): boolean {
  const clipboardData = createClipboardDataTransfer(payload);
  if (!clipboardData) return false;

  let event: ClipboardEvent;
  try {
    event = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData,
    });
  } catch {
    event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { configurable: true, value: clipboardData });
  }

  target.dispatchEvent(event);
  return event.defaultPrevented;
}
