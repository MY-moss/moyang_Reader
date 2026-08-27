export type EditorViewportSnapshot = ReadonlyArray<{
  element: HTMLElement;
  left: number;
  top: number;
}>;

function uniqueElements(elements: Array<HTMLElement | null>): HTMLElement[] {
  return [...new Set(elements.filter((element): element is HTMLElement => element !== null))];
}

export function captureEditorViewport(
  contentArea: HTMLElement | null,
  editorSurface: Element | null,
): EditorViewportSnapshot {
  const nestedScrollers = editorSurface
    ? Array.from(editorSurface.querySelectorAll<HTMLElement>('.cm-scroller, .milkdown, [contenteditable="true"]'))
    : [];

  return uniqueElements([contentArea, ...nestedScrollers]).map((element) => ({
    element,
    left: element.scrollLeft,
    top: element.scrollTop,
  }));
}

export function restoreEditorViewport(snapshot: EditorViewportSnapshot): void {
  snapshot.forEach(({ element, left, top }) => {
    element.scrollLeft = left;
    element.scrollTop = top;
  });
}
