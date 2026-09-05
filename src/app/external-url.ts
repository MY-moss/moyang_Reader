const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function normalizeExternalUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("外部链接不能为空。");

  // Protocol-relative links are common in imported HTML. Resolve them
  // deterministically instead of inheriting a dev server / Tauri protocol.
  const candidate = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("外部链接格式无效。");
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(protocol)) {
    throw new Error(`不支持的外部链接协议：${protocol || "unknown"}`);
  }

  if ((protocol === "http:" || protocol === "https:") && (parsed.username || parsed.password)) {
    throw new Error("外部网页链接不能包含用户名或密码。");
  }

  return parsed.href;
}
