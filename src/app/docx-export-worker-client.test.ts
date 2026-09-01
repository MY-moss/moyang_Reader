import { afterEach, expect, it, vi } from "vitest";
import { defaultExportOptions } from "./export";
import {
  DOCX_EXPORT_WORKER_DOCUMENT_THRESHOLD,
  streamDocxExportWithWorker,
  shouldUseDocxExportWorker,
} from "./docx-export-worker-client";

let workerMode: "success" | "error" | "hang" | "partial-error" | "cancelled" = "success";
let workerTerminated = false;
let resetOutputCalls = 0;

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
      if (workerMode === "cancelled") {
        queueMicrotask(() =>
          this.onmessage?.({ data: { type: "cancelled", message: "EXPORT_CANCELLED" } } as MessageEvent),
        );
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
      if (workerMode === "partial-error") {
        queueMicrotask(() =>
          this.onmessage?.({
            data: { type: "chunk", chunkId: 1, buffer: Uint8Array.from([1, 2, 3]).buffer },
          } as MessageEvent),
        );
      }
      return;
    }
    if (message.type === "ack") {
      if (workerMode === "partial-error") {
        queueMicrotask(() =>
          this.onmessage?.({ data: { type: "error", message: "压缩线程在分卷中途失败" } } as MessageEvent),
        );
        return;
      }
      queueMicrotask(() => this.onmessage?.({ data: { type: "done" } } as MessageEvent));
    }
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
  resetOutputCalls = 0;
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

it("resets and replays a partially written volume when the worker fails", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  workerMode = "partial-error";
  const chunks: Uint8Array[] = [];

  const mode = await streamDocxExportWithWorker(
    "阅读库",
    documents,
    defaultExportOptions,
    async (chunk) => {
      chunks.push(chunk);
    },
    undefined,
    async () => {
      resetOutputCalls += 1;
    },
  );

  expect(mode).toBe("main");
  expect(resetOutputCalls).toBe(1);
  expect(chunks.length).toBeGreaterThan(1);
});

it("surfaces worker cancellation without retrying the export", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  workerMode = "cancelled";
  const chunks: Uint8Array[] = [];
  const resetOutput = vi.fn(async () => {});

  const promise = streamDocxExportWithWorker(
    "阅读库",
    documents,
    defaultExportOptions,
    async (chunk) => {
      chunks.push(chunk);
    },
    undefined,
    resetOutput,
  );

  await expect(promise).rejects.toThrow("EXPORT_CANCELLED");
  expect(chunks).toHaveLength(0);
  expect(resetOutput).not.toHaveBeenCalled();
  expect(workerTerminated).toBe(true);
});

it("keeps the original worker reason when the main-thread fallback also fails", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  workerMode = "error";

  const promise = streamDocxExportWithWorker("阅读库", documents, defaultExportOptions, async () => {
    throw new Error("主线程导出失败");
  });

  await expect(promise).rejects.toThrow("主线程导出失败");
  await expect(promise).rejects.toThrow("worker unavailable");
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
