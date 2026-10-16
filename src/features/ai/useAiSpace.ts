import { watchAiChanges } from "./change-watch";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import {
  emptyAiFields,
  type AiFields,
  type AiKind,
  type AiRecord,
  type AiSearch,
  type AiStats,
} from "../../shared/ai-types";
import { registerPendingWork, flushLiveEditors } from "../../shared/pending-work";
import { readAiDrafts, removeAiDraft, writeAiDraft } from "./draft-store";
import type { AiDraft } from "./AiEditor";

export function useAiSpace(active: boolean) {
  const [kind, setKind] = useState<AiKind>("knowledge");
  const [panel, setPanel] = useState<"library" | "connections" | "activity">("library");
  const connections = panel === "connections",
    activity = panel === "activity";
  const setConnections = useCallback(
    (open: boolean) => setPanel((current) => (open ? "connections" : current === "connections" ? "library" : current)),
    [],
  );
  const setActivity = useCallback(
    (open: boolean) => setPanel((current) => (open ? "activity" : current === "activity" ? "library" : current)),
    [],
  );
  const [query, setQuery] = useState(""),
    [project, setProject] = useState("*"),
    [agent, setAgent] = useState("");
  const [archived, setArchived] = useState(false),
    [includeExpired, setIncludeExpired] = useState(false),
    [page, setPage] = useState(0);
  const [stats, setStats] = useState<AiStats | null>(null),
    [search, setSearch] = useState<AiSearch>({ items: [], total: 0, warning: null });
  const [selected, setSelected] = useState<AiRecord | null>(null),
    [drafts, setDrafts] = useState<Record<string, AiDraft>>({}),
    [activeDraft, setActiveDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [semanticLoading, setSemanticLoading] = useState(false),
    [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null),
    [checked, setChecked] = useState<string[]>([]),
    [tick, setTick] = useState(0);
  const [conflict, setConflict] = useState<{ key: string; remote: AiRecord } | null>(null),
    [discarded, setDiscarded] = useState<AiDraft | null>(null),
    [composing, setComposing] = useState(false);
  const [resourceLoading, setResourceLoading] = useState(false);
  const all = useRef(drafts),
    activeKey = useRef(activeDraft),
    pending = useRef<Promise<unknown>>(Promise.resolve()),
    saving = useRef<Promise<void> | null>(null),
    sequence = useRef(0);
  useLayoutEffect(() => {
    activeKey.current = activeDraft;
  }, [activeDraft]);
  const notify = useCallback((text: string, error = false) => setMessage({ text, error }), []);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const persist = useCallback(
    (d: AiDraft) => {
      const work = pending.current.catch(() => {}).then(() => writeAiDraft(d));
      pending.current = work;
      void work.catch((e) => notify(`草稿暂存失败：${String(e)}`, true));
    },
    [notify],
  );
  const put = useCallback(
    (d: AiDraft) => {
      all.current = { ...all.current, [d.key!]: d };
      setDrafts(all.current);
      persist(d);
    },
    [persist],
  );
  const forget = useCallback(
    (key: string) => {
      const next = { ...all.current };
      delete next[key];
      all.current = next;
      setDrafts(next);
      if (activeKey.current === key) setActiveDraft(null);
      const work = pending.current.catch(() => {}).then(() => removeAiDraft(key));
      pending.current = work;
      void work.catch((e) => notify(String(e), true));
    },
    [notify],
  );
  const setDraft = useCallback(
    (value: AiDraft | null) => {
      if (!value) {
        const old = activeKey.current && all.current[activeKey.current];
        if (old) {
          setDiscarded(old);
          forget(old.key!);
        }
        return;
      }
      const existing = value.id && Object.values(all.current).find((d) => d.id === value.id);
      const d = {
        ...value,
        key: value.key ?? (existing ? existing.key : undefined) ?? crypto.randomUUID(),
        dirty: value.dirty ?? true,
      };
      put(d);
      setActiveDraft(d.key);
      setConnections(false);
      setActivity(false);
      if (d.key !== activeKey.current) setConflict(null);
    },
    [forget, put, setConnections, setActivity],
  );
  const draft = activeDraft ? (drafts[activeDraft] ?? null) : null;
  const stageImport = (fields: AiFields) =>
    setDraft({
      fields: {
        ...fields,
        project: project === "*" ? "" : project,
        agent,
        sharing: project && project !== "*" ? "project" : "global",
      },
      pendingImport: true,
    });
  useEffect(() => {
    let cancelled = false;
    void readAiDrafts()
      .then((values) => {
        if (cancelled) return;
        const restored = Object.fromEntries(values.map((d) => [d.key!, d]));
        all.current = { ...restored, ...all.current };
        setDrafts(all.current);
        if (values.length) setActiveDraft(values[0].key!);
      })
      .catch((e) => notify(`读取草稿失败：${String(e)}`, true));
    return () => {
      cancelled = true;
    };
  }, [notify]);
  useEffect(
    () =>
      registerPendingWork(async () => {
        await saving.current;
        await pending.current;
        await Promise.all(Object.values(all.current).map(writeAiDraft));
      }),
    [],
  );
  useEffect(() => {
    setPage(0);
    setChecked([]);
  }, [kind, query, project, agent, archived, includeExpired]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const requestId = crypto.randomUUID();
    setLoading(true);
    setLoadError(null);
    setSemanticLoading(false);
    const timer = window.setTimeout(
      () => {
        void (async () => {
          const q = {
            request_id: requestId,
            kind,
            query,
            project: project === "*" ? null : project,
            agent: agent || null,
            include_global: true,
            state: archived ? "archived" : "active",
            include_expired: includeExpired,
            limit: 30,
            offset: page * 30,
          };
          try {
            const [s, result] = await Promise.all([
              aiRequest<AiStats>("stats"),
              panel === "library" ? aiRequest<AiSearch>("search", { ...q, semantic: false }) : Promise.resolve(null),
            ]);
            if (cancelled) return;
            setStats(s);
            if (result) setSearch(result);
            setLoading(false);
            if (panel === "library" && query.trim() && s.semantic.enabled) {
              setSemanticLoading(true);
              const augmented = await aiRequest<AiSearch>("search", { ...q, semantic: true });
              if (!cancelled) setSearch(augmented);
            }
          } catch (e) {
            if (!cancelled) setLoadError(String(e));
          } finally {
            if (!cancelled) {
              setLoading(false);
              setSemanticLoading(false);
            }
          }
        })();
      },
      query ? 180 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      void aiRequest("cancel_search", { request_id: requestId }).catch(() => {});
    };
  }, [active, panel, kind, query, project, agent, archived, includeExpired, page, tick]);
  const ready = stats !== null;
  useEffect(() => {
    if (!active || !ready) return;
    return watchAiChanges(
      () => aiRequest<string>("change_token"),
      refresh,
      (error) => setLoadError(`检查更新失败，已保留当前内容：${String(error)}`),
    );
  }, [active, ready, refresh]);
  const select = useCallback(
    async (id: string) => {
      const seq = ++sequence.current;
      try {
        const r = await aiRequest<AiRecord>("get", { id });
        if (seq !== sequence.current) return;
        setSelected(r);
        setConnections(false);
        setActivity(false);
        setActiveDraft(Object.values(all.current).find((d) => d.id === id)?.key ?? null);
        setConflict(null);
      } catch (e) {
        notify(String(e), true);
      }
    },
    [notify, setConnections, setActivity],
  );
  const selectedId = selected?.id;
  const selectedRevision = selected?.revision;
  useEffect(() => {
    if (!active || panel !== "library" || !selectedId || selectedRevision == null || draft) return;
    let cancelled = false;
    void aiRequest<AiRecord | null>("get_if_changed", { id: selectedId, revision: selectedRevision })
      .then((r) => {
        if (!cancelled && r) setSelected(r);
      })
      .catch((e) => {
        if (!cancelled) notify(`更新内容失败，已保留当前页面：${String(e)}`, true);
      });
    return () => {
      cancelled = true;
    };
  }, [active, panel, selectedId, selectedRevision, draft, tick, notify]);
  const save = useCallback(
    async (manual = true, override?: AiDraft) => {
      flushLiveEditors();
      if (saving.current) {
        await saving.current;
        if (!manual) return;
        // An explicit save must finish the latest draft even if autosave started first.
      }
      const current = override ?? (activeKey.current ? all.current[activeKey.current] : null);
      if (!current) return;
      if (!manual && current.pendingImport) return;
      const run = async () => {
        setBusy(true);
        try {
          const r = await aiRequest<AiRecord>(
            current.merge ? "merge" : "save",
            current.merge
              ? { ...current.merge, title: current.fields.title, body: current.fields.body }
              : {
                  ...current.fields,
                  id: current.id ?? null,
                  expected_revision: current.expected_revision ?? null,
                  reason: "界面编辑",
                },
          );
          const latest = all.current[current.key!];
          if (latest) {
            const changed = latest.fields !== current.fields;
            put({
              ...latest,
              id: r.id,
              expected_revision: r.revision,
              baseBody: r.body,
              dirty: changed,
              pendingImport: false,
              saveError: undefined,
            });
            if (manual && !changed) forget(current.key!);
          }
          if (activeKey.current === current.key) {
            setSelected(r);
          }
          setChecked([]);
          setConflict(null);
          refresh();
          if (manual) notify("已保存到 AI 空间。");
        } catch (e) {
          if (current.id) {
            try {
              const remote = await aiRequest<AiRecord>("get", { id: current.id });
              if (remote.revision !== current.expected_revision) setConflict({ key: current.key!, remote });
            } catch {
              /* The original save error remains visible. */
            }
          }
          const latest = all.current[current.key!];
          if (latest) put({ ...latest, saveError: String(e) });
          notify(String(e), true);
        } finally {
          setBusy(false);
        }
      };
      saving.current = run();
      await saving.current;
      saving.current = null;
    },
    [put, forget, refresh, notify],
  );
  useEffect(() => {
    if (
      !draft?.dirty ||
      draft.pendingImport ||
      draft.saveError ||
      draft.merge ||
      busy ||
      composing ||
      resourceLoading ||
      conflict ||
      !draft.fields.title.trim() ||
      !draft.fields.body.trim() ||
      (draft.fields.kind === "skill" && !draft.fields.summary.trim())
    )
      return;
    const timer = window.setTimeout(() => void save(false), 1200);
    return () => window.clearTimeout(timer);
  }, [draft, busy, composing, resourceLoading, conflict, save]);
  const newEntry = () =>
    setDraft({
      fields: {
        ...emptyAiFields(kind),
        project: project === "*" ? "" : project,
        agent,
        sharing: project && project !== "*" ? "project" : "global",
      },
    });
  const merge = async () => {
    try {
      const records = await Promise.all(checked.map((id) => aiRequest<AiRecord>("get", { id })));
      if (
        records.length < 2 ||
        records.some(
          (r) =>
            r.project !== records[0].project ||
            r.sharing !== records[0].sharing ||
            ((r.sharing ?? "legacy") === "legacy" && r.agent !== records[0].agent),
        )
      )
        throw new Error("请选择同一共享范围内的至少两条记忆。");
      setDraft({
        fields: {
          ...records[0],
          title: "整理后的记忆",
          body: records.map((r) => `## ${r.title}\n\n${r.body}`).join("\n\n"),
          summary: "",
        },
        merge: { ids: records.map((r) => r.id), revisions: records.map((r) => r.revision) },
      });
    } catch (e) {
      notify(String(e), true);
    }
  };
  const resolve = async (body: string, copy = false) => {
    if (!conflict) return;
    const local = all.current[conflict.key];
    if (!local) return;
    const next = {
      ...local,
      id: copy ? undefined : conflict.remote.id,
      expected_revision: copy ? undefined : conflict.remote.revision,
      fields: { ...local.fields, body },
      dirty: true,
      saveError: undefined,
    };
    put(next);
    setConflict(null);
    await save(true, next);
  };
  return {
    stageImport,
    dataVersion: tick,
    kind,
    setKind,
    connections,
    setConnections,
    activity,
    setActivity,
    query,
    setQuery,
    project,
    setProject,
    agent,
    setAgent,
    archived,
    setArchived,
    includeExpired,
    setIncludeExpired,
    page,
    setPage,
    stats,
    search,
    selected,
    setSelected,
    draft,
    setDraft,
    drafts,
    activeDraft,
    setActiveDraft,
    busy,
    loading,
    semanticLoading,
    loadError,
    message,
    setMessage,
    notify,
    refresh,
    select,
    checked,
    setChecked,
    newEntry,
    save,
    merge,
    conflict,
    resolve,
    composing,
    setComposing,
    setResourceLoading,
    discarded,
    restoreDiscarded: () => {
      if (discarded) {
        setDraft(discarded);
        setDiscarded(null);
      }
    },
  };
}
