import packageJson from "../../package.json";
import { ERROR_CODES, normalizeAppError, type KnownErrorCode } from "./error-contract";
import type { DocumentKind } from "./types";

export const DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
export const MAX_DIAGNOSTIC_ERRORS = 20;

const sessionStartedAt = Date.now();
const bundledVersion = typeof packageJson.version === "string" ? packageJson.version : "unknown";

export type DiagnosticRuntime = "tauri" | "browser-preview";

export type DiagnosticErrorRecord = {
  code: string;
  at: string;
  operation?: string;
};

export type DiagnosticSnapshot = {
  appVersion?: string | null;
  runtime: DiagnosticRuntime;
  locale: string;
  theme: string;
  mode: string;
  focusMode: boolean;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  capabilities: {
    annotations: boolean;
    remoteResources: boolean;
    startupUpdateCheck: boolean;
    updater: boolean;
    workspaceSearch: boolean;
  };
  workspace: {
    open: boolean;
    fileCount: number;
    folderCount: number;
    indexEntryCount: number;
    scannedTotal: number;
    truncated: boolean;
  };
  document: {
    open: boolean;
    kind: DocumentKind | null;
    bytes: number | null;
    modified: boolean;
    externallyModified: boolean;
  };
};

export type DiagnosticReport = {
  schemaVersion: typeof DIAGNOSTIC_SCHEMA_VERSION;
  generatedAt: string;
  app: {
    name: "Moyang Reader";
    version: string;
    runtime: DiagnosticRuntime;
  };
  environment: {
    os: "windows" | "macos" | "linux" | "android" | "ios" | "unknown";
    browserEngine: "webview2" | "chromium" | "firefox" | "safari" | "unknown";
    locale: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    online: boolean | null;
  };
  capabilities: DiagnosticSnapshot["capabilities"];
  session: {
    locale: string;
    theme: string;
    mode: string;
    focusMode: boolean;
    sidebarCollapsed: boolean;
    rightPanelOpen: boolean;
    workspace: DiagnosticSnapshot["workspace"];
    document: DiagnosticSnapshot["document"];
  };
  errors: DiagnosticErrorRecord[];
  performance: {
    sessionUptimeMs: number;
    navigation: {
      domContentLoadedMs: number | null;
      loadEventMs: number | null;
    } | null;
    memory: {
      usedJsHeapBytes: number | null;
      totalJsHeapBytes: number | null;
      jsHeapLimitBytes: number | null;
    } | null;
  };
  privacy: {
    documentContentIncluded: false;
    fullPathsIncluded: false;
    secretsIncluded: false;
    telemetrySent: false;
  };
};

let recentErrors: DiagnosticErrorRecord[] = [];

function safeCode(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, 96);
  return normalized || ERROR_CODES.UNKNOWN_ERROR;
}

function safeOperation(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_.:-]/g, "_")
    .slice(0, 96);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function finitePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function safeLocale(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 32);
  return normalized || "unknown";
}

function detectOs(platform: string, userAgent: string): DiagnosticReport["environment"]["os"] {
  const value = `${platform} ${userAgent}`.toLowerCase();
  if (value.includes("windows") || value.includes("win")) return "windows";
  if (value.includes("android")) return "android";
  if (value.includes("iphone") || value.includes("ipad") || value.includes("ios")) return "ios";
  if (value.includes("mac")) return "macos";
  if (value.includes("linux")) return "linux";
  return "unknown";
}

function detectBrowserEngine(userAgent: string): DiagnosticReport["environment"]["browserEngine"] {
  const value = userAgent.toLowerCase();
  if (value.includes("edg/") || value.includes("webview2")) return "webview2";
  if (value.includes("firefox/")) return "firefox";
  if (value.includes("safari/") && !value.includes("chrome/") && !value.includes("chromium/")) return "safari";
  if (value.includes("chrome/") || value.includes("chromium/")) return "chromium";
  return "unknown";
}

function readEnvironment(): DiagnosticReport["environment"] {
  const browserNavigator = typeof navigator === "undefined" ? null : navigator;
  const platform = browserNavigator?.platform ?? "";
  const userAgent = browserNavigator?.userAgent ?? "";
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;

  return {
    os: detectOs(platform, userAgent),
    browserEngine: detectBrowserEngine(userAgent),
    locale: safeLocale(browserNavigator?.language ?? ""),
    viewport: {
      width: finitePositiveInteger(viewportWidth, 0),
      height: finitePositiveInteger(viewportHeight, 0),
      devicePixelRatio: finiteNonNegative(devicePixelRatio) ?? 1,
    },
    online: typeof browserNavigator?.onLine === "boolean" ? browserNavigator.onLine : null,
  };
}

function readPerformance(): DiagnosticReport["performance"] {
  const performanceApi = typeof performance === "undefined" ? null : performance;
  const navigation = performanceApi?.getEntriesByType?.("navigation")[0] as
    | (PerformanceEntry & {
        domContentLoadedEventEnd?: number;
        loadEventEnd?: number;
      })
    | undefined;
  const memory = (
    performanceApi as
      | (Performance & {
          memory?: {
            usedJSHeapSize?: number;
            totalJSHeapSize?: number;
            jsHeapSizeLimit?: number;
          };
        })
      | null
  )?.memory;

  return {
    sessionUptimeMs: Math.max(0, Date.now() - sessionStartedAt),
    navigation: navigation
      ? {
          domContentLoadedMs: finiteNonNegative(navigation.domContentLoadedEventEnd),
          loadEventMs: finiteNonNegative(navigation.loadEventEnd),
        }
      : null,
    memory: memory
      ? {
          usedJsHeapBytes: finiteNonNegative(memory.usedJSHeapSize),
          totalJsHeapBytes: finiteNonNegative(memory.totalJSHeapSize),
          jsHeapLimitBytes: finiteNonNegative(memory.jsHeapSizeLimit),
        }
      : null,
  };
}

export function getBundledAppVersion(): string {
  return bundledVersion;
}

export function recordDiagnosticError(
  cause: unknown,
  fallbackCode: KnownErrorCode = ERROR_CODES.UNKNOWN_ERROR,
  operation?: string,
): DiagnosticErrorRecord {
  const error = normalizeAppError(cause, fallbackCode);
  const record: DiagnosticErrorRecord = {
    code: safeCode(error.code),
    at: new Date().toISOString(),
  };
  const normalizedOperation = operation ? safeOperation(operation) : "";
  if (normalizedOperation) record.operation = normalizedOperation;

  recentErrors = [...recentErrors, record].slice(-MAX_DIAGNOSTIC_ERRORS);
  return { ...record };
}

export function getRecentDiagnosticErrors(): DiagnosticErrorRecord[] {
  return recentErrors.map((record) => ({ ...record }));
}

/** Test-only reset kept in this module so error history never persists to disk. */
export function clearDiagnosticErrors(): void {
  recentErrors = [];
}

export function buildDiagnosticReport(snapshot: DiagnosticSnapshot): DiagnosticReport {
  const environment = readEnvironment();
  return {
    schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    app: {
      name: "Moyang Reader",
      version: snapshot.appVersion?.trim() || bundledVersion,
      runtime: snapshot.runtime,
    },
    environment,
    capabilities: { ...snapshot.capabilities },
    session: {
      locale: safeLocale(snapshot.locale),
      theme: snapshot.theme,
      mode: snapshot.mode,
      focusMode: snapshot.focusMode,
      sidebarCollapsed: snapshot.sidebarCollapsed,
      rightPanelOpen: snapshot.rightPanelOpen,
      workspace: { ...snapshot.workspace },
      document: { ...snapshot.document },
    },
    errors: getRecentDiagnosticErrors(),
    performance: readPerformance(),
    privacy: {
      documentContentIncluded: false,
      fullPathsIncluded: false,
      secretsIncluded: false,
      telemetrySent: false,
    },
  };
}

export function serializeDiagnosticReport(report: DiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
