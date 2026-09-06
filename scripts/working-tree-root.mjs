import { execFileSync } from "node:child_process";
import path from "node:path";

const gitCommand = process.platform === "win32" ? "git.exe" : "git";

export function resolveWorkingTreeRoot(projectRoot) {
  const cwd = path.resolve(projectRoot);
  try {
    const topLevel = execFileSync(gitCommand, ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (topLevel) return path.resolve(topLevel);
  } catch {
    // Fall back to the supplied directory so callers can report a useful failure.
  }
  return cwd;
}
