import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiRequest } from "../../platform/ai-bridge";
import { loadExtensions, saveExtensions, fetchExtensionJson, configureExtensionMcp } from "../../platform/extensions";
import { isTauriRuntime } from "../../platform/bridge";
import {
  emptyExtensionState,
  type ExtensionPackage,
  type ExtensionState,
  type InstalledExtension,
} from "../../shared/extension-types";
import type { AiRecord } from "../../shared/ai-types";
import { registerPendingWork } from "../../shared/pending-work";
import { parseCatalog, validatePackage, compareVersions, themeTokens, validateMcp, compatiblePackage } from "./package";
import { builtInCatalog, curatedCatalogUrl } from "./catalog";

export function useExtensions() {
  const [state, setState] = useState<ExtensionState>(emptyExtensionState);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setErrorText] = useState("");
  const [failedCatalog, setFailedCatalog] = useState<{ url: string; name?: string } | null>(null);
  const setError = useCallback((message: string) => {
    setFailedCatalog(null);
    setErrorText(message);
  }, []);
  const latest = useRef(state),
    loading = useRef(false),
    pending = useRef<Promise<unknown>>(Promise.resolve());
  const reload = useCallback(async () => {
    try {
      const next = await loadExtensions();
      latest.current = next;
      setState(next);
      setReady(true);
      setError("");
    } catch (cause) {
      setError(String(cause));
    }
  }, [setError]);
  useEffect(() => {
    void reload();
    return registerPendingWork(async () => {
      await pending.current;
    });
  }, [reload]);
  const change = useCallback(
    (operation: (state: ExtensionState) => Promise<ExtensionState>, catalog?: { url: string; name?: string }) => {
      if (!ready || loading.current) return Promise.resolve(false);
      loading.current = true;
      setBusy(true);
      setError("");
      const task = (async () => {
        try {
          const updated = await operation(structuredClone(latest.current));
          const saved = await saveExtensions(updated);
          latest.current = saved;
          setState(saved);
          return true;
        } catch (cause) {
          setError(String(cause));
          setFailedCatalog(catalog ?? null);
          return false;
        } finally {
          loading.current = false;
          setBusy(false);
        }
      })();
      pending.current = task;
      return task;
    },
    [ready, setError],
  );
  const install = (candidate: ExtensionPackage, source: string, copySkill = false, rollback = false) =>
    change(async (current) => {
      const pkg = validatePackage(candidate);
      if (!compatiblePackage(pkg)) throw new Error(`此扩展需要 Moyang ${pkg.minAppVersion} 或更新版本。`);
      const old = current.installed.find((i) => i.package.id === pkg.id);
      if (old && old.package.kind !== pkg.kind) throw new Error("同一扩展 ID 不能改变类型。");
      if (old && !copySkill && JSON.stringify(pkg) === JSON.stringify(old.package)) return current;
      if (old && !rollback && compareVersions(pkg.version, old.package.version) < 0)
        throw new Error("此包比已安装版本旧，请使用“回退上一版”或卸载后重新安装。");
      if (
        old &&
        !rollback &&
        pkg.version === old.package.version &&
        JSON.stringify(pkg) !== JSON.stringify(old.package)
      )
        throw new Error("同一版本的内容发生变化，请让作者更新版本号后再安装。");
      let skillId = old?.skillId,
        skillRevision = old?.skillRevision;
      if (pkg.kind === "skill" && pkg.skill) {
        const { parseSkill } = await import("../ai/transfers");
        const parsed = parseSkill(pkg.skill.body);
        const fields = {
          ...parsed,
          assets: pkg.skill.assets,
          source: pkg.homepage || source,
          skill_meta: { ...parsed.skill_meta, extension_id: pkg.id, extension_version: pkg.version },
        };
        if (skillId && !copySkill) {
          const existing = await aiRequest<AiRecord>("get", { id: skillId });
          if (existing.revision !== skillRevision)
            throw new Error("技能已经在本地或被 Agent 改进。请选择“保留原技能，安装副本”，或先在技能库比较版本。");
        }
        const saved = await aiRequest<AiRecord>("save", {
          ...fields,
          ...(skillId && !copySkill ? { id: skillId, expected_revision: skillRevision } : {}),
          reason: `扩展市场：${pkg.name} ${pkg.version}`,
        });
        skillId = saved.id;
        skillRevision = saved.revision;
      }
      const installed: InstalledExtension = {
        package: pkg,
        enabled: old?.enabled ?? true,
        installedAt: Date.now(),
        source,
        skillId,
        skillRevision,
        mcpOverride: old?.mcpOverride,
        previous: old && pkg.version !== old.package.version ? old.package : old?.previous,
      };
      current.installed = [
        ...current.installed
          .filter((i) => i.package.id !== pkg.id)
          .map((i) =>
            pkg.kind === "theme" && installed.enabled && i.package.kind === "theme" ? { ...i, enabled: false } : i,
          ),
        installed,
      ];
      return current;
    });
  const toggle = (id: string) =>
    change(async (current) => {
      const target = current.installed.find((i) => i.package.id === id);
      if (!target || !["theme", "reader", "assistant"].includes(target.package.kind))
        throw new Error("请通过技能库或 MCP 连接页管理此内容。");
      const enabled = !target.enabled;
      current.installed = current.installed.map((i) =>
        i.package.id === id
          ? { ...i, enabled }
          : target.package.kind === "theme" && enabled && i.package.kind === "theme"
            ? { ...i, enabled: false }
            : i,
      );
      return current;
    });
  const uninstall = (id: string) =>
    change(async (current) => {
      const target = current.installed.find((i) => i.package.id === id);
      if (target?.package.mcp && isTauriRuntime()) {
        for (const client of ["codex", "claude"] as const) {
          const connection = await configureExtensionMcp(
            id,
            client,
            "preview",
            target.mcpOverride ?? target.package.mcp,
          );
          if (connection.installed)
            throw new Error(
              `请先在连接设置中移除 ${client === "codex" ? "Codex" : "Claude Code"} 的此项连接，再卸载扩展。`,
            );
        }
      }
      return { ...current, installed: current.installed.filter((i) => i.package.id !== id) };
    });
  const updateMcp = (id: string, config: unknown) =>
    change(async (current) => ({
      ...current,
      installed: current.installed.map((i) => (i.package.id === id ? { ...i, mcpOverride: validateMcp(config) } : i)),
    }));
  const refreshCatalog = (url: string, name?: string) =>
    change(
      async (current) => {
        const packages = parseCatalog(await fetchExtensionJson(url));
        const old = current.catalogs.find((c) => c.url === url);
        current.catalogs = [
          ...current.catalogs.filter((c) => c.url !== url),
          { url, name: name?.trim() || old?.name || new URL(url).hostname, packages, checkedAt: Date.now() },
        ];
        return current;
      },
      { url, name },
    );
  const removeCatalog = (url: string) =>
    change(async (current) => ({ ...current, catalogs: current.catalogs.filter((c) => c.url !== url) }));
  const entries = useMemo(() => {
    const candidates = [
      ...builtInCatalog.map((pkg) => ({ package: pkg, source: "内置精选" })),
      ...state.catalogs.flatMap((c) =>
        c.packages.map((pkg) => ({ package: pkg, source: c.url === curatedCatalogUrl ? "内置精选" : c.url })),
      ),
    ];
    const unique = new Map<string, (typeof candidates)[number]>();
    for (const entry of candidates) {
      const key = `${entry.source}:${entry.package.id}`,
        old = unique.get(key);
      if (!old || compareVersions(entry.package.version, old.package.version) > 0) unique.set(key, entry);
    }
    return [...unique.values()];
  }, [state.catalogs]);
  const theme = state.installed.find((i) => i.enabled && i.package.kind === "theme")?.package.theme;
  useEffect(() => {
    const root = document.documentElement,
      media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = root.dataset.theme === "dark" || (!root.dataset.theme && media.matches);
      for (const token of themeTokens) {
        const color = theme?.[dark ? "dark" : "light"][token];
        if (color) root.style.setProperty(token, color);
        else root.style.removeProperty(token);
      }
    };
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    media.addEventListener("change", apply);
    apply();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", apply);
      for (const token of themeTokens) root.style.removeProperty(token);
    };
  }, [theme]);
  return {
    state,
    ready,
    busy,
    error,
    failedCatalog,
    setError,
    reload,
    install,
    toggle,
    uninstall,
    refreshCatalog,
    removeCatalog,
    updateMcp,
    entries,
  };
}
export type ExtensionManager = ReturnType<typeof useExtensions>;
