import { streamDocxExport } from "./export";
import type {
  DocxExportWorkerCommand,
  DocxExportWorkerEvent,
  DocxExportWorkerStartMessage,
} from "./docx-export-worker-protocol";

type PendingAcknowledgement = {
  chunkId: number;
  resolve: () => void;
  reject: (cause: unknown) => void;
};

type WorkerRuntime = {
  onmessage: ((event: MessageEvent<DocxExportWorkerCommand>) => void) | null;
  postMessage: (message: DocxExportWorkerEvent, transfer?: Transferable[]) => void;
};

const workerRuntime = globalThis as typeof globalThis & WorkerRuntime;
let activeController: AbortController | null = null;
let pendingAcknowledgement: PendingAcknowledgement | null = null;

function send(message: DocxExportWorkerEvent, transfer: Transferable[] = []): void {
  workerRuntime.postMessage(message, transfer);
}

function rejectPendingAcknowledgement(cause: unknown): void {
  const pending = pendingAcknowledgement;
  pendingAcknowledgement = null;
  pending?.reject(cause);
}

function waitForAcknowledgement(chunkId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingAcknowledgement = { chunkId, resolve, reject };
  });
}

async function runExport(message: DocxExportWorkerStartMessage, controller: AbortController): Promise<void> {
  let nextChunkId = 1;
  try {
    await streamDocxExport(
      message.title,
      message.documents,
      message.options,
      async (chunk) => {
        const payload = chunk.slice();
        const buffer = payload.buffer as ArrayBuffer;
        const chunkId = nextChunkId++;
        const acknowledgement = waitForAcknowledgement(chunkId);
        send({ type: "chunk", chunkId, buffer }, [buffer]);
        await acknowledgement;
      },
      controller.signal,
    );
    send({ type: "done" });
  } catch (cause) {
    send({ type: "error", message: cause instanceof Error ? cause.message : String(cause) });
  } finally {
    if (activeController === controller) activeController = null;
    rejectPendingAcknowledgement(new Error("EXPORT_CANCELLED"));
  }
}

workerRuntime.onmessage = (event) => {
  const message = event.data;
  if (message.type === "abort") {
    activeController?.abort();
    rejectPendingAcknowledgement(new Error("EXPORT_CANCELLED"));
    return;
  }
  if (message.type === "ack") {
    const pending = pendingAcknowledgement;
    if (!pending || pending.chunkId !== message.chunkId) return;
    pendingAcknowledgement = null;
    pending.resolve();
    return;
  }
  if (message.type !== "start" || activeController) return;

  const controller = new AbortController();
  activeController = controller;
  send({ type: "started" });
  void runExport(message, controller);
};
