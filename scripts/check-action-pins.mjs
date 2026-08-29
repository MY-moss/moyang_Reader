import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const WORKFLOW_EXTENSIONS = new Set([".yml", ".yaml"]);

function listWorkflowFiles(root) {
  const workflowDir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && WORKFLOW_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(workflowDir, entry.name))
    .sort();
}

function parseActionReference(reference) {
  const separator = reference.lastIndexOf("@");
  if (separator <= 0 || separator === reference.length - 1) {
    return null;
  }

  return {
    repository: reference.slice(0, separator),
    ref: reference.slice(separator + 1),
  };
}

export function validateActionPins(root) {
  const workflowFiles = listWorkflowFiles(root);
  const errors = [];

  if (workflowFiles.length === 0) {
    return [".github/workflows 中没有可检查的 YAML 工作流文件。"];
  }

  for (const filePath of workflowFiles) {
    const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      const match = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(line);
      if (!match) {
        return;
      }

      const rawReference = match[1];
      const location = `${relativePath}:${index + 1}`;
      if (rawReference.startsWith("./")) {
        return;
      }

      const reference = parseActionReference(rawReference);
      if (!reference) {
        errors.push(`${location} 第三方 Action 引用格式无效：${rawReference}`);
        return;
      }

      if (!SHA_PATTERN.test(reference.ref)) {
        errors.push(`${location} ${reference.repository} 必须固定到 40 位提交 SHA，而不是 ${reference.ref}`);
        return;
      }

      const commentIndex = line.indexOf("#");
      const comment = commentIndex >= 0 ? line.slice(commentIndex + 1).trim() : "";
      if (!comment) {
        errors.push(`${location} ${reference.repository}@${reference.ref} 缺少版本/来源注释`);
      }
    });
  }

  return errors;
}

export function runActionPinCheck(root = process.cwd()) {
  const errors = validateActionPins(root);
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    return false;
  }

  console.log("All third-party GitHub Actions are pinned to reviewed commit SHAs.");
  return true;
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedFile) {
  process.exitCode = runActionPinCheck(process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()) ? 0 : 1;
}

export const scriptPath = fileURLToPath(import.meta.url);
