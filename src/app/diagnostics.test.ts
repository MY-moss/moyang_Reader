import { afterEach, describe, expect, it } from "vitest";
import {
  buildDiagnosticReport,
  clearDiagnosticErrors,
  getRecentDiagnosticErrors,
  getBundledAppVersion,
  MAX_DIAGNOSTIC_ERRORS,
  recordDiagnosticError,
  serializeDiagnosticReport,
} from "./diagnostics";

function snapshot() {
  return {
    appVersion: null,
    runtime: "browser-preview" as const,
    locale: "zh-CN",
    theme: "system",
    mode: "rendered",
    focusMode: false,
    sidebarCollapsed: false,
    rightPanelOpen: true,
    capabilities: {
      annotations: true,
      remoteResources: false,
      startupUpdateCheck: false,
      updater: false,
      workspaceSearch: false,
    },
    workspace: {
      open: false,
      fileCount: 0,
      folderCount: 0,
      indexEntryCount: 0,
      scannedTotal: 0,
      truncated: false,
    },
    document: {
      open: false,
      kind: null,
      bytes: null,
      modified: false,
      externallyModified: false,
    },
  };
}

afterEach(() => {
  clearDiagnosticErrors();
});

describe("diagnostics", () => {
  it("keeps only bounded error codes and safe operation labels", () => {
    recordDiagnosticError(
      { code: "WORKSPACE_ACCESS_DENIED", message: "C:\\Users\\private\\secret.md", details: "private" },
      "UNKNOWN_ERROR",
      "ipc:list_workspace_entries",
    );

    for (let index = 0; index < MAX_DIAGNOSTIC_ERRORS + 2; index += 1) {
      recordDiagnosticError({ code: `E_${index}` }, "UNKNOWN_ERROR", "window:error");
    }

    const errors = getRecentDiagnosticErrors();
    expect(errors).toHaveLength(MAX_DIAGNOSTIC_ERRORS);
    expect(errors[0]?.code).toBe("E_2");
    expect(errors.at(-1)).toMatchObject({ code: "E_21", operation: "window:error" });
    expect(JSON.stringify(errors)).not.toContain("private");
    expect(JSON.stringify(errors)).not.toContain("secret.md");
  });

  it("exports capability, session, workspace, and performance metadata without content or paths", () => {
    recordDiagnosticError({ code: "FILE_READ_FAILED", message: "C:\\Users\\private\\note.md" }, "UNKNOWN_ERROR");
    const report = buildDiagnosticReport({
      ...snapshot(),
      appVersion: "0.11.0",
      capabilities: { ...snapshot().capabilities, workspaceSearch: true },
      workspace: {
        open: true,
        fileCount: 3,
        folderCount: 1,
        indexEntryCount: 3,
        scannedTotal: 4,
        truncated: false,
      },
      document: {
        open: true,
        kind: "markdown",
        bytes: 1024,
        modified: true,
        externallyModified: false,
      },
    });

    const serialized = serializeDiagnosticReport(report);
    expect(report.schemaVersion).toBe(1);
    expect(report.app).toMatchObject({ name: "Moyang Reader", version: "0.11.0", runtime: "browser-preview" });
    expect(report.capabilities.workspaceSearch).toBe(true);
    expect(report.session.workspace.fileCount).toBe(3);
    expect(report.session.document).toMatchObject({ kind: "markdown", bytes: 1024, modified: true });
    expect(report.privacy).toEqual({
      documentContentIncluded: false,
      fullPathsIncluded: false,
      secretsIncluded: false,
      telemetrySent: false,
    });
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("note.md");
    expect(JSON.parse(serialized)).toEqual(report);
  });

  it("uses the bundled version when the native version is unavailable", () => {
    const report = buildDiagnosticReport(snapshot());

    expect(report.app.version).toBe(getBundledAppVersion());
  });
});
