// Browser-only preview storage. Native desktop and MCP always use the shared Rust/SQLite engine.
import { emptyAiFields, type AiBackup, type AiRecord, type AiRevision } from "../shared/ai-types";
import { previewRecordView } from "../shared/ai-resource-metadata";
import { previewHealth } from "../shared/ai-health";
import { previewSourceInventory } from "../shared/ai-sources";
const key = "moyang-ai-preview-v1";
let previousRaw: string | null | undefined;
let changeGeneration = 0;
let nextExpiry = Infinity;
export function previewRequest(operation: string, payload: any): unknown {
  const raw = localStorage.getItem(key);
  if (operation === "change_token") {
    if (raw !== previousRaw || nextExpiry <= Date.now()) {
      previousRaw = raw;
      changeGeneration++;
      const records = (raw ? JSON.parse(raw).records : []) as AiRecord[];
      nextExpiry = records.reduce(
        (earliest, r) =>
          r.state === "active" && r.expires_at && r.expires_at > Date.now()
            ? Math.min(earliest, r.expires_at)
            : earliest,
        Infinity,
      );
    }
    return String(changeGeneration);
  }
  const db: AiBackup = raw
    ? JSON.parse(raw)
    : { format: "moyang-ai-space", version: 1, exported_at: Date.now(), records: [], history: [] };
  const get = (id: string) => {
    const r = db.records.find((r) => r.id === id);
    if (!r) throw new Error("记录不存在。");
    return r;
  };
  const version = (r: AiRecord, n: number) => {
    if (r.revision !== n) throw new Error("记录已更新，请重新读取后保存。");
  };
  const commit = (r: AiRecord, reason: string) => {
    db.records = [...db.records.filter((v) => v.id !== r.id), r];
    db.history.push({ record: structuredClone(r), reason, recorded_at: Date.now() });
  };
  const save = (p: any): AiRecord => {
    if (!p.title?.trim() || !p.body?.trim()) throw new Error("请填写标题和正文。");
    const old = p.id ? get(p.id) : null;
    if (old) version(old, p.expected_revision);
    const duplicate =
      !old &&
      db.records.find(
        (r) =>
          r.state === "active" &&
          r.kind === p.kind &&
          r.project === (p.project || "") &&
          r.agent === (p.agent || "") &&
          r.body.trim() === p.body.trim(),
      );
    if (duplicate) return duplicate;
    const fields = { ...p };
    delete fields.expected_revision;
    delete fields.reason;
    const r: AiRecord = {
      ...emptyAiFields(p.kind),
      ...fields,
      title: p.title.trim(),
      id: old?.id ?? crypto.randomUUID(),
      created_at: old?.created_at ?? Date.now(),
      updated_at: Date.now(),
      revision: (old?.revision ?? 0) + 1,
      state: old?.state ?? "active",
    };
    commit(r, p.reason || "手动保存");
    return r;
  };
  let result: unknown;
  switch (operation) {
    case "source_inventory":
      return previewSourceInventory(db.records, payload);
    case "health":
      return previewHealth(db.records, payload);
    case "context": {
      const results = previewRequest("search", { query: payload.query, project: payload.project ?? "", limit: 8 }) as {
        items: AiRecord[];
      };
      const pinned = db.records.filter(
        (r) =>
          r.pinned &&
          r.kind === "memory" &&
          r.state === "active" &&
          (!r.expires_at || r.expires_at > Date.now()) &&
          (!r.project || r.project === (payload.project ?? "")),
      );
      const records = [...new Map([...results.items.map((r) => get(r.id)), ...pinned].map((r) => [r.id, r])).values()];
      const limit = Math.max(200, Math.min(12000, Number(payload.max_chars) || 4000));
      let text = "";
      const ids: string[] = [];
      for (const record of records) {
        const fragment = `【${record.title} · ${record.source || record.id}】\n${record.body.slice(0, 1200)}\n\n`;
        const available = limit - text.length;
        if (available < 100) break;
        text += fragment.slice(0, available);
        ids.push(record.id);
      }
      return { text, ids, warning: "浏览器预览使用关键词检索；桌面版提供完整的本地召回。" };
    }
    case "cancel_search":
      return null;
    case "get":
      return structuredClone(get(payload.id));
    case "get_if_changed": {
      const record = get(payload.id);
      return record.revision === payload.revision ? null : structuredClone(record);
    }
    case "stats":
      return {
        knowledge: db.records.filter((r) => r.kind === "knowledge" && r.state === "active").length,
        memory: db.records.filter((r) => r.kind === "memory" && r.state === "active").length,
        skill: db.records.filter((r) => r.kind === "skill" && r.state === "active").length,
        archived: db.records.filter((r) => r.state === "archived").length,
        expired: db.records.filter((r) => r.expires_at && r.expires_at <= Date.now()).length,
        projects: [...new Set(db.records.map((r) => r.project).filter(Boolean))].sort(),
        agents: [...new Set(db.records.map((r) => r.agent).filter(Boolean))].sort(),
        database_path: "浏览器独立存储（桌面版使用 SQLite）",
        indexed_chunks: db.records.length,
        embedded_chunks: 0,
        semantic: { enabled: false, endpoint: "http://127.0.0.1:11434", model: "qwen3-embedding:0.6b" },
      };
    case "search": {
      const text = String(payload.query || "").toLowerCase();
      const terms = text.split(/\s+/).filter(Boolean);
      const matches = db.records
        .filter(
          (r) =>
            (!payload.kind || r.kind === payload.kind) &&
            r.state === (payload.state || "active") &&
            (payload.include_expired || !r.expires_at || r.expires_at > Date.now()) &&
            (payload.project == null ||
              r.project === payload.project ||
              (payload.include_global !== false && !r.project)) &&
            ((r.sharing && r.sharing !== "legacy") ||
              payload.agent == null ||
              r.agent === payload.agent ||
              (payload.include_global !== false && !r.agent)) &&
            (!terms.length ||
              terms.some((t) => `${r.title} ${r.summary} ${r.body} ${r.tags.join(" ")}`.toLowerCase().includes(t))),
        )
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at - a.updated_at);
      return {
        items: matches
          .slice(payload.offset || 0, (payload.offset || 0) + (payload.limit || 30))
          .map((r) => ({ ...r, body: undefined, assets: undefined, excerpt: r.body.slice(0, 400), score: 1 })),
        total: matches.length,
        warning: null,
      };
    }
    case "save":
      result = save(payload);
      break;
    case "state": {
      const old = get(payload.id);
      version(old, payload.expected_revision);
      result = { ...old, state: payload.state, revision: old.revision + 1, updated_at: Date.now() };
      commit(result as AiRecord, "归档状态变更");
      break;
    }
    case "history":
      return db.history.filter((h) => h.record.id === payload.id).sort((a, b) => b.record.revision - a.record.revision);
    case "history_page": {
      get(payload.id);
      const limit = Math.max(1, Math.min(50, payload.limit ?? 20));
      const revisions = db.history
        .filter(
          (h) =>
            h.record.id === payload.id &&
            (payload.before_revision == null || h.record.revision < payload.before_revision),
        )
        .sort((a, b) => b.record.revision - a.record.revision);
      const items = revisions.slice(0, limit).map((h) => ({
        revision: h.record.revision,
        title: h.record.title,
        reason: h.reason,
        recorded_at: h.recorded_at,
        body_chars: [...h.record.body].length,
        resource_count: h.record.assets.length,
      }));
      return { items, next_before: revisions.length > limit ? items.at(-1)!.revision : null };
    }
    case "revision_view": {
      const h = db.history.find((h) => h.record.id === payload.id && h.record.revision === payload.revision);
      if (!h) throw new Error("历史版本不存在。");
      return previewRecordView(h.record).then((record) => ({ ...h, record }));
    }
    case "activity_page": {
      const limit = Math.max(1, Math.min(50, payload.limit ?? 20)),
        offset = payload.offset ?? 0;
      const scope = (p: string) => payload.project == null || p === payload.project || (payload.include_global && !p);
      const all: Record<string, any[]> = {
        checkpoints: (db.checkpoints ?? []).filter((c: any) => c.status !== "pending" && scope(c.project ?? "")),
        pending: (db.checkpoints ?? []).filter((c: any) => c.status === "pending" && scope(c.project ?? "")),
        conflicts: (db.conflicts ?? [])
          .filter((c: any) => c.status === "pending" && scope(c.proposal?.project ?? ""))
          .map((c: any) => ({ id: c.id, title: c.proposal?.title, updated_at: c.updated_at })),
        activities: (db.activities ?? []).filter((a: any) =>
          scope(
            (db.checkpoints as any[])?.find((c) => c.id === a.checkpoint_id)?.project ??
              db.records.find((r) => r.id === a.record_id)?.project ??
              "",
          ),
        ),
      };
      return {
        offset,
        limit,
        has_more: Object.values(all).some((items) => items.length > offset + limit),
        ...Object.fromEntries(
          Object.entries(all).map(([k, items]) => [
            k,
            items.sort((a, b) => b.updated_at - a.updated_at || a.id.localeCompare(b.id)).slice(offset, offset + limit),
          ]),
        ),
      };
    }
    case "conflict_detail": {
      const conflict = (db.conflicts as any[])?.find((c) => c.id === payload.id);
      if (!conflict) throw new Error("冲突不存在。");
      return conflict;
    }
    case "activity":
      return {
        checkpoints: db.checkpoints ?? [],
        pending: [],
        conflicts: db.conflicts ?? [],
        activities: db.activities ?? [],
      };
    case "asset": {
      const record =
        payload.revision == null
          ? get(payload.id)
          : db.history.find((h) => h.record.id === payload.id && h.record.revision === payload.revision)?.record;
      const asset = record?.assets.find((a) => a.path === payload.path);
      if (!asset) throw new Error("技能资源不存在。");
      return structuredClone(asset);
    }
    case "revision_detail":
      return db.history.find((h) => h.record.id === payload.id && h.record.revision === payload.revision);
    case "restore": {
      const old = get(payload.id);
      version(old, payload.expected_revision);
      const h = db.history.find((h) => h.record.id === payload.id && h.record.revision === payload.revision);
      if (!h) throw new Error("历史不存在。");
      result = { ...h.record, revision: old.revision + 1, updated_at: Date.now() };
      commit(result as AiRecord, "恢复历史");
      break;
    }
    case "delete": {
      version(get(payload.id), payload.expected_revision);
      db.records = db.records.filter((r) => r.id !== payload.id);
      db.history = db.history.filter((h) => h.record.id !== payload.id);
      result = null;
      break;
    }
    case "merge": {
      const records: AiRecord[] = payload.ids.map(get);
      records.forEach((r, i) => version(r, payload.revisions[i]));
      if (
        records.length < 2 ||
        records.some(
          (r) =>
            r.kind !== "memory" ||
            r.state !== "active" ||
            r.project !== records[0].project ||
            r.agent !== records[0].agent,
        )
      )
        throw new Error("请选择同一范围内的有效记忆。");
      result = save({
        ...records[0],
        id: undefined,
        title: payload.title,
        body: payload.body,
        links: payload.ids,
        source: "合并记忆",
      });
      for (const r of records)
        commit({ ...r, state: "archived", revision: r.revision + 1, updated_at: Date.now() }, "合并归档");
      break;
    }
    case "feedback":
      get(payload.id);
      return null;
    case "backup":
      return { ...db, exported_at: Date.now() };
    case "import": {
      if (
        payload.format !== "moyang-ai-space" ||
        ![1, 2].includes(payload.version) ||
        !Array.isArray(payload.records) ||
        !Array.isArray(payload.history)
      )
        throw new Error("备份格式无效。");
      const imported: string[] = [];
      for (const r of payload.records as AiRecord[]) {
        if (!r.id || !r.title || !r.body) throw new Error("备份记录不完整。");
        if (!db.records.some((v) => v.id === r.id)) {
          db.records.push(r);
          imported.push(r.id);
        }
      }
      db.history.push(...(payload.history as AiRevision[]).filter((h) => imported.includes(h.record.id)));
      db.feedback = [
        ...(db.feedback ?? []),
        ...(payload.feedback ?? []).filter((f: { id: string }) => imported.includes(f.id)),
      ];
      result = { imported: imported.length, skipped: payload.records.length - imported.length };
      break;
    }
    default:
      throw new Error("此能力需要桌面版的本地 AI 服务。");
  }
  localStorage.setItem(key, JSON.stringify(db));
  return structuredClone(result);
}
