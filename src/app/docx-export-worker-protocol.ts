import type { ExportOptions, HtmlExportDocument } from "./export";

export type DocxExportWorkerStartMessage = {
  type: "start";
  title: string;
  documents: HtmlExportDocument[];
  options: ExportOptions;
};

export type DocxExportWorkerCommand =
  DocxExportWorkerStartMessage | { type: "ack"; chunkId: number } | { type: "abort" };

export type DocxExportWorkerEvent =
  | { type: "started" }
  | { type: "chunk"; chunkId: number; buffer: ArrayBuffer }
  | { type: "done" }
  | { type: "cancelled"; message: string }
  | { type: "error"; message: string };
