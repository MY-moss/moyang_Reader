import { useEffect, useState } from "react";
import { documentKindFromPath, renderDocx, renderSource } from "../../documents/rendering/document-adapters";
import { readTextFile, readBinaryFile } from "../../../platform/bridge";
import { PdfPreview } from "./PdfPreview";
import { ProgressiveReaderContent } from "./ProgressiveReaderContent";

/** A read-only preview never changes the selected document or its draft. */
export function DocumentPreview({
  path,
  name,
  draft,
  html: cachedHtml,
  previewUrl,
  allowRemoteResources = false,
  page,
  onPageChange,
  zoom,
  onZoomChange,
}: {
  name?: string;
  path: string;
  draft?: string;
  html?: string;
  previewUrl?: string;
  allowRemoteResources?: boolean;
  page?: number;
  onPageChange?: (page: number) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}) {
  const [state, setState] = useState<{ html?: string; url?: string; error?: string; path: string }>({ path: "" });
  const [retry, setRetry] = useState(0);
  const kind = documentKindFromPath(name ?? path);
  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setState((previous) => (previous.path === path ? previous : { path: "" }));
    const timer = setTimeout(
      () => {
        void (async () => {
          if (kind === "pdf" || kind === "image") {
            if (previewUrl) return { path, url: previewUrl };
            const bytes = await readBinaryFile(path);
            objectUrl = URL.createObjectURL(
              new Blob([bytes.slice() as Uint8Array<ArrayBuffer>], {
                type: kind === "pdf" ? "application/pdf" : undefined,
              }),
            );
            return { path, url: objectUrl };
          }
          if (draft === undefined && cachedHtml !== undefined) return { path, html: cachedHtml };
          const rendered =
            kind === "docx"
              ? await renderDocx(await readBinaryFile(path), { allowRemoteResources })
              : await renderSource(name ?? path, draft ?? (await readTextFile(path)), { allowRemoteResources });
          return { path, html: rendered.html };
        })()
          .then((value) => {
            if (active) setState(value);
            else if (objectUrl) URL.revokeObjectURL(objectUrl);
          })
          .catch((cause) => {
            if (active) setState({ path, error: String(cause) });
          });
      },
      draft === undefined ? 0 : 160,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, name, kind, draft, cachedHtml, previewUrl, retry, allowRemoteResources]);
  if (state.path !== path) return <p role="status">正在预览…</p>;
  if (state.error)
    return (
      <div role="alert">
        <p>{state.error}</p>
        <button onClick={() => setRetry((v) => v + 1)}>重试</button>
      </div>
    );
  if (kind === "pdf")
    return (
      <PdfPreview
        name={path.split(/[\\/]/).at(-1) ?? path}
        src={state.url}
        page={page}
        onPageChange={onPageChange}
        zoom={zoom}
        onZoomChange={onZoomChange}
      />
    );
  if (kind === "image") return <img className="preview-image" src={state.url} alt={path.split(/[\\/]/).at(-1)} />;
  return (
    <article className="reader-content markdown-body">
      <ProgressiveReaderContent html={state.html ?? ""} />
    </article>
  );
}
