import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AiAsset } from "../../shared/ai-types";
import { downloadAi } from "./transfers";
export function AiResources({
  assets,
  onChange,
  onLoading,
}: {
  assets: AiAsset[];
  onChange?: (assets: AiAsset[]) => void;
  onLoading?: (value: boolean) => void;
}) {
  const [previewPath, setPreviewPath] = useState<string | null>(null),
    [error, setError] = useState(""),
    target = useRef<string | null>(null),
    input = useRef<HTMLInputElement>(null);
  const latest = useRef({ assets, onChange, onLoading });
  const mounted = useRef(false);
  const [loading, setLoading] = useState(false);
  const preview = assets.find((asset) => asset.path === previewPath);
  useLayoutEffect(() => {
    latest.current = { assets, onChange, onLoading };
  }, [assets, onChange, onLoading]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      latest.current.onLoading?.(false);
    };
  }, []);
  return (
    <section className="ai-resources">
      <h2>
        技能资源 <small>{assets.length} 个</small>
      </h2>
      {onChange && (
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            target.current = null;
            input.current?.click();
          }}
        >
          添加资源
        </button>
      )}
      <input
        type="file"
        hidden
        ref={input}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !onChange) return;
          const path = target.current ?? file.name;
          setLoading(true);
          latest.current.onLoading?.(true);
          try {
            if (file.size > 25_000_000) throw new Error("资源不能超过 25 MB。");
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!mounted.current) return;
            let encoding: AiAsset["encoding"] = "utf8",
              content = "";
            try {
              content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            } catch {
              encoding = "base64";
              let binary = "";
              for (const byte of bytes) binary += String.fromCharCode(byte);
              content = btoa(binary);
            }
            const current = latest.current;
            const next = [...current.assets.filter((a) => a.path !== path), { path, encoding, content }];
            latest.current = { ...current, assets: next };
            current.onChange?.(next);
            setError("");
          } catch (e) {
            if (mounted.current) setError(String(e));
          } finally {
            if (mounted.current) {
              setLoading(false);
              latest.current.onLoading?.(false);
            }
          }
        }}
      />
      {assets.map((a) => (
        <div key={a.path} className="ai-resource-row">
          <button type="button" onClick={() => setPreviewPath(a.path)}>
            {a.path}
          </button>
          <div>
            <button
              type="button"
              onClick={() => {
                const bytes =
                  a.encoding === "utf8"
                    ? new TextEncoder().encode(a.content)
                    : Uint8Array.from(atob(a.content), (c) => c.charCodeAt(0));
                void downloadAi(a.path.split("/").pop()!, bytes, "resource").catch((e) => setError(String(e)));
              }}
            >
              下载
            </button>
            {onChange && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    target.current = a.path;
                    input.current?.click();
                  }}
                >
                  替换
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    onChange(assets.filter((v) => v.path !== a.path));
                    if (previewPath === a.path) setPreviewPath(null);
                  }}
                >
                  移除
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      {loading && <p role="status">正在读取资源，完成后即可保存。</p>}
      {preview && (
        <aside className="ai-resource-preview" aria-label="资源预览">
          <div>
            <strong>{preview.path}</strong>
            <button type="button" aria-label="关闭资源预览" onClick={() => setPreviewPath(null)}>
              关闭
            </button>
          </div>
          <ResourcePreview asset={preview} />
        </aside>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function ResourcePreview({ asset }: { asset: AiAsset }) {
  const [url, setUrl] = useState("");
  const extension = asset.path.split(".").pop()?.toLowerCase() ?? "";
  const { encoding, content } = asset;
  const mime = (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
    } as Record<string, string>
  )[extension];
  useEffect(() => {
    if (!mime) return;
    const bytes =
      encoding === "utf8" ? new TextEncoder().encode(content) : Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
    const next = URL.createObjectURL(new Blob([bytes], { type: mime }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [encoding, content, mime]);
  if (mime?.startsWith("image/") && url) return <img className="ai-resource-image" src={url} alt={asset.path} />;
  if (mime === "application/pdf" && url)
    return <iframe title={`预览 ${asset.path}`} className="ai-resource-pdf" src={url} />;
  return asset.encoding === "utf8" ? <pre>{asset.content}</pre> : <p>此格式请下载后用对应程序打开。</p>;
}
