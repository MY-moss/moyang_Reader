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

function fallbackError(workerCause: unknown, fallbackCause: unknown): Error {
  const workerError = normalizedError(workerCause, "DOCX_EXPORT_FAILED");
  const mainThreadError = normalizedError(fallbackCause, workerError.message);
  if (mainThreadError.message === "EXPORT_CANCELLED" || workerError.message === "DOCX_EXPORT_FAILED") {
    return mainThreadError;
  }
  if (mainThreadError.message.includes(workerError.message)) return mainThreadError;
  return new Error(`${mainThreadError.message}（Worker 原因：${workerError.message}）`);
}

export async function streamDocxExportWithWorker(
  title: string,
  documents: HtmlExportDocument[],
  options: ExportOptions = defaultExportOptions,
  writeChunk: (chunk: Uint8Array) => Promise<void>,
  signal?: AbortSignal,
  resetOutput?: () => Promise<void>,
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
    let pendingWrite: Promise<void> | null = null;
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
    const fallbackToMainThread = (cause: unknown, resetPartialOutput: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      const writeToSettle = pendingWrite;
      void (async () => {
        try {
          await writeToSettle;
          if (resetPartialOutput) await resetOutput?.();
          await streamDocxExport(title, documents, options, writeChunk, signal);
          resolve("main");
        } catch (fallbackCause) {
          reject(fallbackError(cause, fallbackCause));
        }
      })();
    };
    const handleWorkerFailure = (cause: unknown) => {
      const normalizedCause = normalizedError(cause, "DOCX_EXPORT_WORKER_FAILED");
      if (normalizedCause.message === "EXPORT_CANCELLED") {
        fail(normalizedCause);
        return;
      }
      if (wroteChunk || pendingWrites > 0) {
        if (!resetOutput) {
          fail(normalizedCause);
          return;
        }
        fallbackToMainThread(normalizedCause, true);
        return;
      }
      fallbackToMainThread(normalizedCause, false);
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
        const writePromise = Promise.resolve().then(() => writeChunk(new Uint8Array(message.buffer)));
        pendingWrite = writePromise;
        void writePromise
          .then(() => {
            pendingWrites -= 1;
            if (pendingWrite === writePromise) pendingWrite = null;
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
      if (message.type === "cancelled") {
        fail(new Error(message.message || "EXPORT_CANCELLED"));
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
