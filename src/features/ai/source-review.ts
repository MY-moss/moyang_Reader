import { isTauriRuntime } from "../../platform/bridge";
import type { AiSourceEntry } from "../../shared/ai-sources";
import type { AiFields } from "../../shared/ai-types";
import { importAiPath, importAiWeb } from "./transfers";

export type SourceStatus = "unchecked" | "checking" | "unchanged" | "changed" | "manual" | "error";
export type SourceResult = { status: SourceStatus; checkedAt?: number; error?: string };
export const sourceStatusLabels: Record<SourceStatus, string> = {
  unchecked: "尚未检查",
  checking: "正在检查",
  unchanged: "没有变化",
  changed: "来源已变化",
  manual: "需重新选文件",
  error: "无法读取",
};
export async function readImportedSource(source: Pick<AiSourceEntry, "uri" | "format">): Promise<AiFields | null> {
  if (source.format === "web") return importAiWeb(source.uri);
  if (isTauriRuntime() && /^(?:[A-Z]:[\\/]|\/|\\\\)/i.test(source.uri)) return importAiPath(source.uri, "knowledge");
  return null;
}
export async function reviewSources(
  entries: AiSourceEntry[],
  onResult: (id: string, result: SourceResult) => void,
  stopped: () => boolean,
  read: (entry: AiSourceEntry) => Promise<AiFields | null> = readImportedSource,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (!stopped() && next < entries.length) {
      const entry = entries[next++];
      onResult(entry.id, { status: "checking" });
      let result: SourceResult;
      try {
        const incoming = await read(entry);
        if (incoming && !incoming.body.trim()) throw new Error("来源没有可读取的正文，已保留现有快照。");
        result = {
          status: !incoming ? "manual" : incoming.snapshot?.fingerprint === entry.fingerprint ? "unchanged" : "changed",
          checkedAt: Date.now(),
        };
      } catch (e) {
        result = { status: "error", checkedAt: Date.now(), error: String(e) };
      }
      if (!stopped()) onResult(entry.id, result);
    }
  };
  await Promise.all([worker(), worker()]);
}
