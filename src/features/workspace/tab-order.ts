export function reorderTabs<T extends { path: string }>(
  tabs: readonly T[],
  sourcePath: string,
  targetPath: string,
): T[] {
  if (sourcePath === targetPath) return [...tabs];

  const sourceIndex = tabs.findIndex((tab) => tab.path === sourcePath);
  const targetIndex = tabs.findIndex((tab) => tab.path === targetPath);
  if (sourceIndex < 0 || targetIndex < 0) return [...tabs];

  const next = [...tabs];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}
