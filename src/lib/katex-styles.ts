let katexStylesPromise: Promise<void> | null = null;

export function ensureKatexStyles(): Promise<void> {
  katexStylesPromise ??= import("katex/dist/katex.min.css")
    .then(() => undefined)
    .catch((cause) => {
      katexStylesPromise = null;
      throw cause;
    });
  return katexStylesPromise;
}
