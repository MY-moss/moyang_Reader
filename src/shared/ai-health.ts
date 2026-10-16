import type { AiKind, AiRecord } from "./ai-types";
export type AiHealthIssue = "duplicate" | "expired" | "missing_source" | "broken_links";
export type AiHealthQuery = {
  project?: string;
  agent?: string;
  include_global?: boolean;
  kind?: AiKind;
  issue?: AiHealthIssue;
  offset?: number;
  limit?: number;
};
export type AiHealthItem = Pick<
  AiRecord,
  "id" | "kind" | "title" | "project" | "agent" | "revision" | "expires_at" | "source"
> & {
  sharing: string;
  excerpt: string;
  issues: AiHealthIssue[];
  duplicate_count: number;
  duplicate_peers: Array<{ id: string; title: string }>;
  broken_link_ids: string[];
};
export type AiHealthReport = {
  checked_at: number;
  scanned: number;
  counts: Record<AiHealthIssue, number>;
  total: number;
  offset: number;
  limit: number;
  items: AiHealthItem[];
};
export const healthLabels: Record<AiHealthIssue, string> = {
  duplicate: "正文相同",
  expired: "已到期",
  missing_source: "未填写来源",
  broken_links: "关联已删除",
};

// Browser preview follows the same review rules; native SQLite is authoritative on desktop.
export function previewHealth(records: AiRecord[], q: AiHealthQuery): AiHealthReport {
  const time = Date.now();
  const allIds = new Set(records.map((r) => r.id));
  const scoped = records
    .filter(
      (r) =>
        r.state === "active" &&
        (!q.kind || r.kind === q.kind) &&
        (q.project == null || r.project === q.project || (q.include_global && !r.project)) &&
        ((r.sharing !== "legacy" && r.sharing != null) ||
          q.agent == null ||
          r.agent === q.agent ||
          (q.include_global && !r.agent)),
    )
    .sort((a, b) => b.updated_at - a.updated_at || a.id.localeCompare(b.id));
  const groups = new Map<string, AiRecord[]>();
  const groupKey = (r: AiRecord) =>
    JSON.stringify([
      r.kind,
      r.project,
      r.sharing ?? "legacy",
      (r.sharing ?? "legacy") === "legacy" ? r.agent : "",
      r.body.replace(/\r\n/g, "\n").trim(),
    ]);
  for (const r of scoped) {
    if (r.body.trim()) {
      const key = groupKey(r);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
  }
  const counts: AiHealthReport["counts"] = { duplicate: 0, expired: 0, missing_source: 0, broken_links: 0 };
  const findings = scoped
    .map((r) => {
      const issues: AiHealthIssue[] = [];
      if (r.expires_at != null && r.expires_at <= time) issues.push("expired");
      if (!r.source.trim() && !r.snapshot?.uri.trim()) issues.push("missing_source");
      const broken = r.links.filter((id) => !allIds.has(id));
      if (broken.length) issues.push("broken_links");
      const group = groups.get(groupKey(r)) ?? [];
      if (group.length > 1) issues.push("duplicate");
      for (const issue of issues) counts[issue]++;
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        project: r.project,
        agent: r.agent,
        sharing: r.sharing ?? "legacy",
        revision: r.revision,
        expires_at: r.expires_at,
        source: [...(r.source.trim() ? r.source : (r.snapshot?.uri ?? ""))].slice(0, 240).join(""),
        excerpt: [...r.body].slice(0, 180).join(""),
        issues,
        duplicate_count: group.length > 1 ? group.length : 0,
        duplicate_peers: group
          .filter((p) => p.id !== r.id)
          .slice(0, 3)
          .map((p) => ({ id: p.id, title: p.title })),
        broken_link_ids: broken,
      };
    })
    .filter((r) => r.issues.length && (!q.issue || r.issues.includes(q.issue)));
  const offset = Math.max(0, q.offset ?? 0),
    limit = Math.max(1, Math.min(100, q.limit ?? 30));
  return {
    checked_at: time,
    scanned: scoped.length,
    counts,
    total: findings.length,
    offset,
    limit,
    items: findings.slice(offset, offset + limit),
  };
}
