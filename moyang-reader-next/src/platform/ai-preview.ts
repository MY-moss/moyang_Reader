// Browser-only preview storage. Native desktop and MCP always use the shared Rust/SQLite engine.
import { emptyAiFields, type AiBackup, type AiRecord, type AiRevision } from "../shared/ai-types";
const key = "moyang-ai-preview-v1";
export function previewRequest(operation: string, payload: any): unknown {
  const raw = localStorage.getItem(key);
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
    case "cancel_search":
      return null;
    case "get":
      return structuredClone(get(payload.id));
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
    case "activity":
      return {
        checkpoints: db.checkpoints ?? [],
        pending: [],
        conflicts: db.conflicts ?? [],
        activities: db.activities ?? [],
      };
    case "asset":
      return structuredClone(get(payload.id).assets.find((a) => a.path === payload.path));
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
      result = { imported: imported.length, skipped: payload.records.length - imported.length };
      break;
    }
    default:
      throw new Error("此能力需要桌面版的本地 AI 服务。");
  }
  localStorage.setItem(key, JSON.stringify(db));
  return structuredClone(result);
}
