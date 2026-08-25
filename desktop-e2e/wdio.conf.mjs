import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configuredDocumentPath = process.env.MOYANG_DESKTOP_E2E_DOCUMENT;
const fixtureRoot = configuredDocumentPath
  ? path.dirname(configuredDocumentPath)
  : fs.mkdtempSync(path.join(os.tmpdir(), "moyang-reader-desktop-e2e-"));
const documentPath = configuredDocumentPath ?? path.join(fixtureRoot, "desktop-e2e.md");
const applicationPath = path.join(
  projectRoot,
  "src-tauri",
  "target",
  "debug",
  process.platform === "win32" ? "moyang-reader.exe" : "moyang-reader",
);

if (!configuredDocumentPath) {
  fs.writeFileSync(documentPath, "# Desktop E2E\n\n初始内容。\n", "utf8");
}
process.env.MOYANG_DESKTOP_E2E_DOCUMENT = documentPath;

function cleanupFixture() {
  if (configuredDocumentPath) return;
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

process.once("exit", cleanupFixture);

export const config = {
  runner: "local",
  specs: [path.join(projectRoot, "desktop-e2e", "smoke.e2e.mjs")],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: applicationPath,
        args: [documentPath],
      },
      "wdio:tauriServiceOptions": {
        appBinaryPath: applicationPath,
        appArgs: [documentPath],
        driverProvider: "embedded",
        embeddedPort: 4445,
      },
    },
  ],
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: applicationPath,
        appArgs: [documentPath],
        driverProvider: "embedded",
        embeddedPort: 4445,
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
    timeout: 60_000,
  },
  onComplete: cleanupFixture,
};
