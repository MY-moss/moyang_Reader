import type { AiRecord } from "./ai-types";

export type AiSourceEntry = Pick<AiRecord, "id" | "title" | "project" | "agent" | "sharing" | "revision"> & {
  uri: string;
  format: string;
  fingerprint: string;
  imported_at: number;
};
export type AiSourceQuery = {
  project?: string;
  agent?: string;
  include_global?: boolean;
  cursor?: string;
  limit?: number;
};
export type AiSourcePage = { items: AiSourceEntry[]; total: number; next_cursor: string | null };
export function sourceEntry(record: AiRecord): AiSourceEntry {
  const { id, title, project, agent, sharing, revision, snapshot } = record;
  return {
    id,
    title,
    project,
    agent,
    sharing: sharing ?? "legacy",
    revision,
    uri: snapshot!.uri,
    format: snapshot!.format,
    fingerprint: snapshot!.fingerprint,
    imported_at: snapshot!.imported_at,
  };
}
export function previewSourceInventory(records: AiRecord[], q: AiSourceQuery): AiSourcePage {
  const entries = records
    .filter(
      (r) =>
        r.kind === "knowledge" &&
        r.state === "active" &&
        r.snapshot?.uri &&
        (q.project == null || r.project === q.project || (q.include_global && !r.project)) &&
        ((r.sharing ?? "legacy") !== "legacy" ||
          q.agent == null ||
          r.agent === q.agent ||
          (q.include_global && !r.agent)),
    )
    .map(sourceEntry)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const limit = Math.max(1, Math.min(100, q.limit ?? 50));
  const rest = entries.filter((r) => !q.cursor || r.id > q.cursor);
  const items = rest.slice(0, limit);
  return { items, total: entries.length, next_cursor: rest.length > limit ? items.at(-1)!.id : null };
}
