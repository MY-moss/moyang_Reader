import { afterEach, expect, it, vi } from "vitest";
import { defaultExportOptions } from "./export";
import {
  DOCX_EXPORT_WORKER_DOCUMENT_THRESHOLD,
  streamDocxExportWithWorker,
  shouldUseDocxExportWorker,
} from "./docx-export-worker-client";

let workerMode: "success" | "error" | "hang" = "success";
let workerTerminated = false;

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;

  postMessage(message: { type: string; chunkId?: number }): void {
    if (message.type === "start") {
      if (workerMode === "error") {
        queueMicrotask(() => this.onerror?.({ message: "worker unavailable" } as ErrorEvent));
        return;
      }
      queueMicrotask(() => this.onmessage?.({ data: { type: "started" } } as MessageEvent));
      if (workerMode === "success") {
        queueMicrotask(() =>
          this.onmessage?.({
            data: { type: "chunk", chunkId: 1, buffer: Uint8Array.from([1, 2, 3]).buffer },
          } as MessageEvent),
        );
      }
      return;
    }
    if (message.type === "ack") queueMicrotask(() => this.onmessage?.({ data: { type: "done" } } as MessageEvent));
  }

  terminate(): void {
    this.terminated = true;
    workerTerminated = true;
  }
}

const documents = Array.from({ length: DOCX_EXPORT_WORKER_DOCUMENT_THRESHOLD }, (_, index) => ({
  title: `文档-${index + 1}.md`,
  body: "<p>正文</p>",
}));

afterEach(() => {
  workerMode = "success";
  workerTerminated = false;
  vi.unstubAllGlobals();
});

it("only selects the worker for batches that justify its startup cost", () => {
  vi.stubGlobal("Worker", FakeWorker);
  expect(shouldUseDocxExportWorker(documents)).toBe(true);
  expect(shouldUseDocxExportWorker(documents.slice(0, -1))).toBe(false);
});

it("streams worker chunks with acknowledgement backpressure", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const chunks: Uint8Array[] = [];

  const mode = await streamDocxExportWithWorker("阅读库", documents, defaultExportOptions, async (chunk) => {
    chunks.push(chunk);
  });

  expect(mode).toBe("worker");
  expect(Array.from(chunks[0] ?? [])).toEqual([1, 2, 3]);
  expect(workerTerminated).toBe(true);
});

it("falls back to the existing main-thread stream before any bytes are written", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  workerMode = "error";
  const chunks: Uint8Array[] = [];

  const mode = await streamDocxExportWithWorker("阅读库", documents, defaultExportOptions, async (chunk) => {
    chunks.push(chunk);
  });

  expect(mode).toBe("main");
  expect(chunks.length).toBeGreaterThan(0);
});

it("cancels and terminates a worker that has not produced output", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  workerMode = "hang";
  const controller = new AbortController();
  const promise = streamDocxExportWithWorker(
    "阅读库",
    documents,
    defaultExportOptions,
    async () => {},
    controller.signal,
  );
  controller.abort();

  await expect(promise).rejects.toThrow("EXPORT_CANCELLED");
  expect(workerTerminated).toBe(true);
});
