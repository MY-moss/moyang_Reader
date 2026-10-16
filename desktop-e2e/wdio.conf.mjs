import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryBase = path.join(projectRoot, ".local", "desktop-tests");
fs.mkdirSync(temporaryBase, { recursive: true });
const configuredDocumentPath = process.env.MOYANG_DESKTOP_E2E_DOCUMENT;
const fixtureRoot = configuredDocumentPath
  ? path.dirname(configuredDocumentPath)
  : fs.mkdtempSync(path.join(temporaryBase, "moyang-reader-desktop-e2e-"));
const documentPath = configuredDocumentPath ?? path.join(fixtureRoot, "desktop-e2e.md");
const wikiTargetPath = path.join(fixtureRoot, "wiki-target.md");
const ownsWikiTarget = !fs.existsSync(wikiTargetPath);
const workspacePath = fixtureRoot;
const configuredExportRoot = process.env.MOYANG_DESKTOP_E2E_EXPORT_ROOT;
const exportRoot = configuredExportRoot ?? fs.mkdtempSync(path.join(temporaryBase, "moyang-reader-desktop-e2e-export-"));
const ownsExportRoot = !configuredExportRoot;
const applicationPath = path.join(
  process.env.CARGO_TARGET_DIR || path.join(projectRoot, "src-tauri", "target"),
  "debug",
  process.platform === "win32" ? "moyang-reader.exe" : "moyang-reader",
);

if (!configuredDocumentPath) {
  fs.writeFileSync(documentPath, "# Desktop E2E\n\n初始内容。\n", "utf8");
}
if (ownsWikiTarget) {
  fs.writeFileSync(wikiTargetPath, "# Wiki target\n\n桌面双链候选文档。\n", "utf8");
}
process.env.MOYANG_DESKTOP_E2E_DOCUMENT = documentPath;
process.env.MOYANG_DESKTOP_E2E_EXPORT_ROOT = exportRoot;
process.env.MOYANG_AI_DATA_DIR = path.join(exportRoot, "ai-space");
process.env.MOYANG_DATA_DIR = path.join(exportRoot, "desktop-state");
process.env.WEBVIEW2_USER_DATA_FOLDER = path.join(exportRoot, "webview");

function cleanupFixture() {
  const removeTemporary = (directory, prefix) => {
    const resolved=path.resolve(directory);
    if(path.dirname(resolved)!==temporaryBase || !path.basename(resolved).startsWith(prefix)) throw new Error(`Refusing to clean an unexpected fixture directory: ${resolved}`);
    try { fs.rmSync(resolved,{recursive:true,force:true,maxRetries:6,retryDelay:200}); }
    catch(error) {
      // WebView2 may release its Crashpad files after WDIO's onComplete hook.
      // The exit hook retries; do not turn a busy test cache into a failed assertion.
      if(!["EBUSY","EPERM","ENOTEMPTY"].includes(error.code)) throw error;
      console.warn(`Test cache still in use; retained at ${resolved}`);
    }
  };
  if (ownsExportRoot) removeTemporary(exportRoot, "moyang-reader-desktop-e2e-export-");
  if (ownsWikiTarget) fs.rmSync(wikiTargetPath, { force: true });
  if (configuredDocumentPath) return;
  removeTemporary(fixtureRoot, "moyang-reader-desktop-e2e-");
}

process.once("exit", cleanupFixture);

export const config = {
  runner: "local",
  specs: [[path.join(projectRoot, "desktop-e2e", "smoke.e2e.mjs"), path.join(projectRoot, "desktop-e2e", "bookroom.e2e.mjs"), path.join(projectRoot,"desktop-e2e","extensions.e2e.mjs"), path.join(projectRoot,"desktop-e2e","chat-updates.e2e.mjs"), path.join(projectRoot,"desktop-e2e","memory-health.e2e.mjs"), path.join(projectRoot,"desktop-e2e","source-review.e2e.mjs")]],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: applicationPath,
        args: [workspacePath, documentPath],
      },
      "wdio:tauriServiceOptions": {
        appBinaryPath: applicationPath,
        appArgs: [workspacePath, documentPath],
        driverProvider: "embedded",
        embeddedPort: 4445,
        captureBackendLogs: true,
      },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: applicationPath,
        appArgs: [workspacePath, documentPath],
        driverProvider: "embedded",
        embeddedPort: 4445,
        captureBackendLogs: true,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  logLevel: "warn",
  waitforTimeout: 15_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 3,
  mochaOpts: {
    ...(process.env.MOYANG_DESKTOP_E2E_GREP ? { grep: process.env.MOYANG_DESKTOP_E2E_GREP } : {}),
    timeout: 60_000,
  },
  afterTest: async function (test, _context, result) {
    if (!result.error) return;
    const directory = path.join(projectRoot, "artifacts", "desktop-failures"); fs.mkdirSync(directory, { recursive: true });
    const name = test.title.replace(/[^a-z0-9]+/gi, "-").slice(0,100);
    try {
      const state = await browser.execute(() => ({ title: document.querySelector(".document-title")?.textContent, tabs: [...document.querySelectorAll(".pane-tabs")].map((x) => x.textContent), panes: [...document.querySelectorAll(".reader-pane")].map((x) => ({ label: x.getAttribute("aria-label"), text: x.innerText.slice(0,3000) })), alerts: [...document.querySelectorAll('[role="alert"]')].map((x) => x.textContent), body: document.body.innerText.slice(0,5000) }));
      fs.writeFileSync(path.join(directory, name + ".json"), JSON.stringify(state,null,2));
      await browser.saveScreenshot(path.join(directory, name + ".png"));
    } catch { /* Preserve the original assertion. */ }
  },
  onComplete: cleanupFixture,
};
