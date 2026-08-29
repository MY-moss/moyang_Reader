import {
  defaultExportOptions,
  estimateBatchExportDocumentBytes,
  streamDocxExport,
  type ExportOptions,
  type HtmlExportDocument,
} from "./export";
import type { DocxExportWorkerEvent } from "./docx-export-worker-protocol";

export const DOCX_EXPORT_WORKER_DOCUMENT_THRESHOLD = 8;
export const DOCX_EXPORT_WORKER_ESTIMATED_BYTES_THRESHOLD = 2 * 1024 * 1024;

export function shouldUseDocxExportWorker(documents: readonly HtmlExportDocument[]): boolean {
  if (typeof Worker === "undefined") return false;
  return (
    documents.length >= DOCX_EXPORT_WORKER_DOCUMENT_THRESHOLD ||
    documents.some(
      (document) => estimateBatchExportDocumentBytes(document) >= DOCX_EXPORT_WORKER_ESTIMATED_BYTES_THRESHOLD,
    )
  );
}

function normalizedError(cause: unknown, fallbackMessage: string): Error {
  return cause instanceof Error ? cause : new Error(typeof cause === "string" ? cause : fallbackMessage);
}

export async function streamDocxExportWithWorker(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
): Promise<"worker" | "main"> {
  if (!shouldUseDocxExportWorker(documents)) {
    await streamDocxExport(title, documents, options, writeChunk, signal);
    return "main";
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL("./docx-export.worker.ts", import.meta.url), { type: "module" });
  } catch {
    await streamDocxExport(title, documents, options, writeChunk, signal);
    return "main";
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let wroteChunk = false;
    let pendingWrites = 0;
    let workerFinished = false;

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const finish = (mode: "worker" | "main") => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(mode);
    };
    const fail = (cause: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(normalizedError(cause, "DOCX_EXPORT_WORKER_FAILED"));
    };
    const fallbackToMainThread = (cause: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      void streamDocxExport(title, documents, options, writeChunk, signal)
        .then(() => resolve("main"))
        .catch((fallbackCause) =>
          reject(normalizedError(fallbackCause, normalizedError(cause, "DOCX_EXPORT_FAILED").message)),
        );
    };
    const handleWorkerFailure = (cause: unknown) => {
      if (wroteChunk || pendingWrites > 0) {
        fail(cause);
        return;
      }
      fallbackToMainThread(cause);
    };
    const onAbort = () => {
      if (settled) return;
      try {
        worker.postMessage({ type: "abort" });
      } catch {
        // Termination below is the final cancellation boundary.
      }
      fail(new Error("EXPORT_CANCELLED"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<DocxExportWorkerEvent>) => {
      if (settled) return;
      const message = event.data;
      if (message.type === "chunk") {
        if (!(message.buffer instanceof ArrayBuffer)) {
          handleWorkerFailure(new Error("DOCX_EXPORT_WORKER_INVALID_CHUNK"));
          return;
        }
        wroteChunk = true;
        pendingWrites += 1;
        void Promise.resolve()
          .then(() => writeChunk(new Uint8Array(message.buffer)))
          .then(() => {
            pendingWrites -= 1;
            if (settled) return;
            worker.postMessage({ type: "ack", chunkId: message.chunkId });
            if (workerFinished && pendingWrites === 0) finish("worker");
          })
          .catch(fail);
        return;
      }
      if (message.type === "done") {
        workerFinished = true;
        if (pendingWrites === 0) finish("worker");
        return;
      }
      if (message.type === "error") handleWorkerFailure(new Error(message.message));
    };
    worker.onerror = (event) => handleWorkerFailure(new Error(event.message || "DOCX_EXPORT_WORKER_FAILED"));
    worker.onmessageerror = () => handleWorkerFailure(new Error("DOCX_EXPORT_WORKER_MESSAGE_FAILED"));

    if (signal?.aborted) {
      onAbort();
      return;
    }

    try {
      worker.postMessage({ type: "start", title, documents, options });
    } catch (cause) {
      handleWorkerFailure(cause);
    }
  });
}
