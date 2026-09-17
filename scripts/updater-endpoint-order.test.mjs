import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
const githubEndpoint =
  "https://github.com/MY-moss/moyang_Reader/releases/latest/download/latest.json";
const mirrorEndpoint = "https://moyang-reader-mirror.pages.dev/latest.json";

test("keeps GitHub Release authoritative before the updater mirror", () => {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const endpoints = config?.plugins?.updater?.endpoints;

  assert.ok(Array.isArray(endpoints), "updater endpoints must be configured");
  assert.equal(
    endpoints[0],
    githubEndpoint,
    "GitHub Release must be the first updater metadata source",
  );
  assert.equal(
    endpoints[1],
    mirrorEndpoint,
    "Cloudflare Pages must remain the secondary mirror",
  );
  assert.equal(
    new Set(endpoints).size,
    endpoints.length,
    "updater endpoints must not contain duplicates",
  );
  assert.ok(
    endpoints.every((endpoint) => /^https:\/\//i.test(endpoint)),
    "all updater endpoints must use HTTPS",
  );
});
