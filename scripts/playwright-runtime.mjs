import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { URL } from "node:url";

export const PLAYWRIGHT_APP_ID = "moyang-reader";
const PORT_BASE = 20_000;
const PORT_SPAN = 20_000;

function normalizeRoot(projectRoot) {
  return path.resolve(projectRoot).replaceAll("\\", "/").toLowerCase();
}

function parsePortOverride(value) {
  if (value === undefined || value === "") return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`MOYANG_E2E_PORT must be an integer between 1024 and 65535; received ${JSON.stringify(value)}.`);
  }
  return port;
}

export function derivePlaywrightPort(projectRoot, environment = process.env) {
  const override = parsePortOverride(environment.MOYANG_E2E_PORT);
  if (override !== null) return override;

  const digest = createHash("sha256").update(normalizeRoot(projectRoot)).digest();
  return PORT_BASE + (digest.readUInt32BE(0) % PORT_SPAN);
}

export function resolveGitCommit(projectRoot, environment = process.env) {
  const environmentCommit = environment.GITHUB_SHA?.trim();
  const commit =
    environmentCommit ||
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

  if (!/^[0-9a-f]{40,64}$/i.test(commit)) {
    throw new Error(`Unable to establish a full Git commit SHA for Playwright: ${JSON.stringify(commit)}.`);
  }
  return commit.toLowerCase();
}

export function createPlaywrightRuntime(projectRoot, environment = process.env) {
  const root = path.resolve(projectRoot);
  const port = derivePlaywrightPort(root, environment);
  const commit = resolveGitCommit(root, environment);
  const baseURL = `http://127.0.0.1:${port}`;
  const healthPath = `/__moyang_e2e_health?app=${encodeURIComponent(PLAYWRIGHT_APP_ID)}&commit=${commit}`;

  return {
    appId: PLAYWRIGHT_APP_ID,
    baseURL,
    commit,
    healthPath,
    healthURL: `${baseURL}${healthPath}`,
    port,
    root,
  };
}

export function isExpectedHealthRequest(requestUrl, runtime) {
  const url = new URL(requestUrl, runtime.baseURL);
  return (
    url.pathname === "/__moyang_e2e_health" &&
    url.searchParams.get("app") === runtime.appId &&
    url.searchParams.get("commit") === runtime.commit
  );
}
