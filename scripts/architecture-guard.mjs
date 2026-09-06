import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveWorkingTreeRoot } from "./working-tree-root.mjs";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

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

export function scanArchitecture(projectRoot = process.cwd()) {
  const root = resolveWorkingTreeRoot(path.resolve(projectRoot));
  const violations = [];
  const srcRoot = path.join(root, "src");
  const allSource = walkFiles(srcRoot);

  for (const file of allSource) {
    const rel = relative(root, file);
    const text = fs.readFileSync(file, "utf8");

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

  return violations;
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
