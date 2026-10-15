import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";

export async function unusedLocalPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

export function startTestProcess(command, args, options) {
  const child = spawn(command, args, { windowsHide: true, stdio: "ignore", ...options });
  child.once("error", (error) => {
    child.startError = error;
  });
  return child;
}

export async function waitForTestService(child, url, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (child.startError) throw child.startError;
    if (child.exitCode !== null) throw new Error(`Test process exited (${child.exitCode}) before ${url}`);
    const ready = await globalThis
      .fetch(url, { signal: globalThis.AbortSignal.timeout(800) })
      .then((r) => r.ok)
      .catch(() => false);
    if (ready) {
      // Do not accept an old service if the process we launched failed to bind.
      await pause(150);
      if (child.startError) throw child.startError;
      if (child.exitCode !== null) throw new Error(`Test process exited (${child.exitCode}) at ${url}`);
      return;
    }
    await pause(100);
  }
  throw new Error(`Test service did not become ready: ${url}`);
}
