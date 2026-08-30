import { execFileSync } from "node:child_process";
import path from "node:path";

const gitCommand = process.platform === "win32" ? "git.exe" : "git";

export function resolveRepositoryRoot(projectRoot) {
  try {
    const commonDir = execFileSync(gitCommand, ["rev-parse", "--git-common-dir"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (commonDir) {
      const resolvedCommonDir = path.resolve(projectRoot, commonDir);
      if (path.basename(resolvedCommonDir).toLowerCase() === ".git") {
        return path.dirname(resolvedCommonDir);
      }
    }
  } catch {
    // Fall back to the conventional Codex worktree layout when Git is unavailable.
  }

  const parent = path.dirname(projectRoot);
  return path.basename(parent).toLowerCase() === ".codex-worktrees" ? path.dirname(parent) : projectRoot;
}
