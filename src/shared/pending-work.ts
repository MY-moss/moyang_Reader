const tasks = new Set<() => Promise<void>>();
const editors = new Set<() => void>();
export function registerEditorFlush(flush: () => void) {
  editors.add(flush);
  return () => {
    editors.delete(flush);
  };
}
export function flushLiveEditors() {
  for (const flush of editors) flush();
}
export function registerPendingWork(task: () => Promise<void>) {
  tasks.add(task);
  return () => {
    tasks.delete(task);
  };
}
export async function flushPendingWork() {
  flushLiveEditors();
  await Promise.all([...tasks].map((task) => task()));
}
