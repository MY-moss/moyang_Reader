/** Serializes deltas so an unrelated newer event cannot discard an older scope. */
export function createRefreshQueue(run: (paths: string[]) => Promise<void>) {
  const pending = new Set<string>();
  let running: Promise<void> | null = null;
  const drain = async () => {
    while (pending.size) {
      const batch = [...pending];
      pending.clear();
      await run(batch);
    }
  };
  return (paths: string[]) => {
    for (const path of paths) pending.add(path);
    if (!running)
      running = drain().finally(() => {
        running = null;
      });
    return running;
  };
}
