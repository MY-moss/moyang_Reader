import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "desktop-benchmark.yml");

test("uploads the workspace benchmark from the repository workspace", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  const repositoryArtifactPath = String.raw`\$\{\{\s*github\.workspace\s*\}\}/artifacts/workspace-benchmark\.json`;

  assert.match(workflow, new RegExp(`MOYANG_WORKSPACE_BENCHMARK_REPORT:\\s*${repositoryArtifactPath}`));
  assert.match(workflow, new RegExp(`path:\\s*${repositoryArtifactPath}`));
});
