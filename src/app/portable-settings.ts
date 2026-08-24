import type { RecentFile, RecentWorkspace, ThemeMode } from "./types";
import type { WorkspaceSession } from "./storage";
import { defaultReaderPreferences, type ReaderPreferences } from "./preferences";

const PORTABLE_SETTINGS_FORMAT = "moyang-reader-settings";
const PORTABLE_SETTINGS_VERSION = 1;
const MAX_WORKSPACES = 5;
const MAX_TABS = 16;

export type PortableSettingsInput = {
  preferences: ReaderPreferences;
  theme: ThemeMode;
  workspacePath: string | null;
  lastDocumentPath: string | null;
  mountedWorkspaces: readonly RecentWorkspace[];
  workspaceSessions: readonly WorkspaceSession[];
  openTabs: readonly RecentFile[];
};

export type PortableSettingsBundle = PortableSettingsInput & {
  format: typeof PORTABLE_SETTINGS_FORMAT;
  version: typeof PORTABLE_SETTINGS_VERSION;
  exportedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalPath(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parsePreferences(value: unknown): ReaderPreferences {
  if (!isRecord(value)) throw new Error("设置备份缺少有效的阅读偏好。");

  return {
    allowRemoteResources:
      typeof value.allowRemoteResources === "boolean"
        ? value.allowRemoteResources
        : defaultReaderPreferences.allowRemoteResources,
    startupUpdateCheck:
      typeof value.startupUpdateCheck === "boolean"
        ? value.startupUpdateCheck
        : defaultReaderPreferences.startupUpdateCheck,
    readingScale:
      value.readingScale === "small" || value.readingScale === "large" || value.readingScale === "medium"
        ? value.readingScale
        : defaultReaderPreferences.readingScale,
    readingWidth:
      value.readingWidth === "narrow" || value.readingWidth === "wide" || value.readingWidth === "standard"
        ? value.readingWidth
        : defaultReaderPreferences.readingWidth,
    exportPaper:
      value.exportPaper === "letter" || value.exportPaper === "a4"
        ? value.exportPaper
        : defaultReaderPreferences.exportPaper,
    exportOrientation:
      value.exportOrientation === "landscape" || value.exportOrientation === "portrait"
        ? value.exportOrientation
        : defaultReaderPreferences.exportOrientation,
    exportMargin:
      value.exportMargin === "compact" || value.exportMargin === "wide" || value.exportMargin === "standard"
        ? value.exportMargin
        : defaultReaderPreferences.exportMargin,
  };
}

function parseRecentFile(value: unknown): RecentFile | null {
  if (!isRecord(value)) return null;
  const path = optionalPath(value.path);
  const name = optionalPath(value.name);
  if (!path || !name || path.startsWith("browser://")) return null;
  return { path, name };
}

function parseRecentWorkspace(value: unknown): RecentWorkspace | null {
  if (!isRecord(value)) return null;
  const path = optionalPath(value.path);
  const name = optionalPath(value.name);
  return path && name ? { path, name } : null;
}

function parseWorkspaces(value: unknown): RecentWorkspace[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(parseRecentWorkspace)
    .filter((workspace): workspace is RecentWorkspace => workspace !== null)
    .filter((workspace) => {
      const key = workspace.path.replace(/[\\/]+/g, "\\").toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_WORKSPACES);
}

function parseTabs(value: unknown): RecentFile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(parseRecentFile)
    .filter((tab): tab is RecentFile => tab !== null)
    .filter((tab) => {
      const key = tab.path.replace(/[\\/]+/g, "\\").toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_TABS);
}

function parseSessions(value: unknown): WorkspaceSession[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(isRecord)
    .map((session) => {
      const path = optionalPath(session.path);
      if (!path) return null;
      const activeDocumentPath = optionalPath(session.activeDocumentPath);
      return {
        path,
        tabs: parseTabs(session.tabs),
        activeDocumentPath,
      } satisfies WorkspaceSession;
    })
    .filter((session): session is WorkspaceSession => session !== null)
    .filter((session) => {
      const key = session.path.replace(/[\\/]+/g, "\\").toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_WORKSPACES);
}

export function createPortableSettingsBundle(input: PortableSettingsInput): PortableSettingsBundle {
  return {
    format: PORTABLE_SETTINGS_FORMAT,
    version: PORTABLE_SETTINGS_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: input.preferences,
    theme: input.theme,
    workspacePath: input.workspacePath,
    lastDocumentPath: input.lastDocumentPath,
    mountedWorkspaces: parseWorkspaces(input.mountedWorkspaces),
    workspaceSessions: parseSessions(input.workspaceSessions),
    openTabs: parseTabs(input.openTabs),
  };
}

export function serializePortableSettings(bundle: PortableSettingsBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function parsePortableSettings(serialized: string): PortableSettingsBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("设置备份不是有效的 JSON 文件。");
  }

  if (!isRecord(parsed) || parsed.format !== PORTABLE_SETTINGS_FORMAT || parsed.version !== PORTABLE_SETTINGS_VERSION) {
    throw new Error("设置备份版本不受支持。");
  }

  const theme =
    parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "system" ? parsed.theme : "system";
  return {
    format: PORTABLE_SETTINGS_FORMAT,
    version: PORTABLE_SETTINGS_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    preferences: parsePreferences(parsed.preferences),
    theme,
    workspacePath: optionalPath(parsed.workspacePath),
    lastDocumentPath: optionalPath(parsed.lastDocumentPath),
    mountedWorkspaces: parseWorkspaces(parsed.mountedWorkspaces),
    workspaceSessions: parseSessions(parsed.workspaceSessions),
    openTabs: parseTabs(parsed.openTabs),
  };
}
