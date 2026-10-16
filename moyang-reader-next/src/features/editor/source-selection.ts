export type SourceSelection = { text: string; from: number; to: number };
export function sourceSelectionLocation(selection: SourceSelection) {
  const { text } = selection;
  const from =
    selection.from === selection.to && selection.from > 0
      ? text.lastIndexOf("\n", selection.from - 1) + 1
      : selection.from;
  const lineEnd = text.indexOf("\n", selection.to);
  const to = selection.from === selection.to ? (lineEnd < 0 ? text.length : lineEnd) : selection.to;
  return { offset: from, endOffset: to, quote: text.slice(from, to), source: true as const };
}
type Provider = { read: () => SourceSelection; reveal: (from: number, to: number) => void };
const providers = new Map<HTMLElement, Provider>();
const listeners = new Set<() => void>();
export function registerSourceSelection(element: HTMLElement, provider: Provider) {
  providers.set(element, provider);
  listeners.forEach((listener) => listener());
  return () => {
    providers.delete(element);
  };
}
export function subscribeSourceSelection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function providerIn(root: ParentNode) {
  return [...providers].find(([element]) => root === element || root.contains(element))?.[1];
}
export function readSourceSelection(root: ParentNode) {
  return providerIn(root)?.read();
}
export function revealSourceSelection(root: ParentNode, from: number, to: number) {
  const provider = providerIn(root);
  if (!provider) return false;
  provider.reveal(from, to);
  return true;
}
