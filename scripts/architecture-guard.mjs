import fs from "node:fs";
import { Buffer } from "node:buffer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkingTreeRoot } from "./working-tree-root.mjs";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const architectureBudgetRelativePath = "scripts/architecture-budget.json";

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(fullPath));
    else if (sourceExtensions.has(path.extname(entry.name))) result.push(fullPath);
  }
  return result;
}

function relative(root, file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function isTestSource(relativePath) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relativePath);
}

function normalizedMetrics(text) {
  const normalized = text.replaceAll("\r\n", "\n");
  return {
    bytes: Buffer.byteLength(normalized, "utf8"),
    lines: (normalized.match(/\n/g)?.length ?? 0) + 1,
  };
}

function readArchitectureBudget(root) {
  const budgetPath = path.join(root, architectureBudgetRelativePath);
  if (!fs.existsSync(budgetPath)) return { targets: {}, errors: [] };

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
  } catch (cause) {
    return {
      targets: {},
      errors: [
        `${architectureBudgetRelativePath}: invalid JSON (${cause instanceof Error ? cause.message : String(cause)})`,
      ],
    };
  }

  const errors = [];
  if (parsed?.version !== 1) {
    errors.push(`${architectureBudgetRelativePath}: version must be 1`);
  }
  if (!parsed?.targets || typeof parsed.targets !== "object" || Array.isArray(parsed.targets)) {
    errors.push(`${architectureBudgetRelativePath}: targets must be an object`);
    return { targets: {}, errors };
  }

  const targets = {};
  for (const [relativePath, rule] of Object.entries(parsed.targets)) {
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes("..")) {
      errors.push(`${architectureBudgetRelativePath}: target path must stay inside the repository: ${relativePath}`);
      continue;
    }

    const numericFields = ["baselineBytes", "baselineLines", "maxGrowthBytes", "maxGrowthLines"];
    if (
      !rule ||
      typeof rule !== "object" ||
      numericFields.some((field) => !Number.isInteger(rule[field]) || rule[field] < 0)
    ) {
      errors.push(`${architectureBudgetRelativePath}: invalid numeric budget for ${relativePath}`);
      continue;
    }

    targets[relativePath] = rule;
  }

  return { targets, errors };
}

export function scanArchitectureBudgetAtRoot(root) {
  const { targets, errors } = readArchitectureBudget(root);
  const violations = [...errors];

  for (const [relativePath, rule] of Object.entries(targets)) {
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) {
      violations.push(`${relativePath}: architecture budget target is missing`);
      continue;
    }

    const metrics = normalizedMetrics(fs.readFileSync(filePath, "utf8"));
    const allowedBytes = rule.baselineBytes + rule.maxGrowthBytes;
    const allowedLines = rule.baselineLines + rule.maxGrowthLines;
    if (metrics.bytes > allowedBytes || metrics.lines > allowedLines) {
      violations.push(
        `${relativePath}: architecture budget exceeded (bytes ${metrics.bytes}/${allowedBytes}, lines ${metrics.lines}/${allowedLines}); extract a stable responsibility or update the budget only in an architecture-scoped task`,
      );
    }
  }

  return violations;
}

export function scanArchitectureAtRoot(root) {
  const violations = [];
  const srcRoot = path.join(root, "src");
  const allSource = walkFiles(srcRoot);

  for (const file of allSource) {
    const rel = relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    if (isTestSource(rel)) continue;

    if (text.includes("@tauri-apps/api/core") && rel !== "src/app/ipc-contract.ts") {
      violations.push(`${rel}: raw @tauri-apps/api/core is only allowed in src/app/ipc-contract.ts`);
    }

    if (/\beval\s*\(/.test(text) || /\bnew\s+Function\s*\(/.test(text)) {
      violations.push(`${rel}: eval/new Function is forbidden in application source`);
    }
  }

  const componentRoot = path.join(root, "src", "app", "components");
  for (const file of walkFiles(componentRoot)) {
    const rel = relative(root, file);
    if (isTestSource(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["']@tauri-apps\//.test(text)) {
      violations.push(`${rel}: presentation components must not import Tauri APIs directly`);
    }
    if (/from\s+["']\.\.\/(?:bridge|ipc-contract)["']/.test(text)) {
      violations.push(`${rel}: presentation components must not call the IPC boundary directly`);
    }
  }

  const libRoot = path.join(root, "src", "lib");
  for (const file of walkFiles(libRoot)) {
    const rel = relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    if (/from\s+["'](?:react|react-dom)(?:\/[^"']*)?["']/.test(text)) {
      violations.push(`${rel}: neutral lib/domain modules must not depend on React`);
    }
    if (/from\s+["'][^"']*app\/components(?:\/[^"']*)?["']/.test(text)) {
      violations.push(`${rel}: neutral lib/domain modules must not depend on app/components`);
    }
  }

  violations.push(...scanArchitectureBudgetAtRoot(root));

  return violations;
}

export function scanArchitecture(projectRoot = process.cwd()) {
  return scanArchitectureAtRoot(resolveWorkingTreeRoot(path.resolve(projectRoot)));
}

function main() {
  const violations = scanArchitecture(process.cwd());
  if (violations.length === 0) {
    console.log("Architecture guard passed.");
    return;
  }

  console.error("Architecture guard failed:\n");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();
