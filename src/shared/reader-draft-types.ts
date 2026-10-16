export type DraftSnapshot = { path: string; draft: string; baseSource: string; savedAt: number };
export type DraftSummary = { path: string; preview: string; savedAt: number };
export const READER_DRAFT_BUDGET = 256 * 1024 * 1024;
export function draftBytes(item: DraftSnapshot) {
  return (item.draft.length + item.baseSource.length) * 2;
}
export function draftSummary(item: DraftSnapshot): DraftSummary {
  return { path: item.path, savedAt: item.savedAt, preview: item.draft.slice(0, 160) };
}
