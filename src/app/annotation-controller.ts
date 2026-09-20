import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { workspaceRelativePath, type TextAnnotation } from "./annotations";
import {
  createAnnotationHighlightController,
  type AnnotationHighlightController,
  type AnnotationLocation,
} from "./annotation-highlighter";
import { normalizePathKey } from "./path-key";
import type { ReaderMode } from "./types";

export type AnnotationControllerOptions = {
  readerBodyRef: RefObject<HTMLElement | null>;
  documentPath: string | null | undefined;
  workspacePath: string | null | undefined;
  mode: ReaderMode;
  progressiveReaderReady: boolean;
  annotationEnabled: boolean;
  renderedHtml: string;
  annotations: readonly TextAnnotation[];
};

export type AnnotationController = {
  annotationLocations: AnnotationLocation[];
  queueAnnotationFocus: (id: string) => void;
  scrollAnnotation: (id: string) => boolean;
  clearAnnotationFocus: (id?: string) => void;
};

type AnnotationHighlightSession = {
  root: HTMLElement;
  contentKey: string;
  controller: AnnotationHighlightController;
};

function annotationPathForDocument(documentPath: string | null | undefined, workspacePath: string | null | undefined) {
  if (!documentPath) return null;
  if (documentPath.startsWith("browser://")) return documentPath;
  return workspacePath ? workspaceRelativePath(workspacePath, documentPath) : null;
}

export function useAnnotationController({
  readerBodyRef,
  documentPath,
  workspacePath,
  mode,
  progressiveReaderReady,
  annotationEnabled,
  renderedHtml,
  annotations,
}: AnnotationControllerOptions): AnnotationController {
  const [annotationLocations, setAnnotationLocations] = useState<AnnotationLocation[]>([]);
  const annotationHighlightRef = useRef<AnnotationHighlightSession | null>(null);
  const pendingAnnotationIdRef = useRef<string | null>(null);

  const disposeHighlight = useCallback(() => {
    annotationHighlightRef.current?.controller.dispose();
    annotationHighlightRef.current = null;
  }, []);

  const queueAnnotationFocus = useCallback((id: string) => {
    pendingAnnotationIdRef.current = id;
  }, []);

  const clearAnnotationFocus = useCallback((id?: string) => {
    if (!id || pendingAnnotationIdRef.current === id) pendingAnnotationIdRef.current = null;
  }, []);

  const scrollAnnotation = useCallback((id: string) => {
    const didScroll = annotationHighlightRef.current?.controller.scrollTo(id) ?? false;
    if (didScroll && pendingAnnotationIdRef.current === id) pendingAnnotationIdRef.current = null;
    return didScroll;
  }, []);

  useEffect(() => {
    const root = readerBodyRef.current;
    const currentAnnotationPath = annotationPathForDocument(documentPath, workspacePath);
    if (!root || mode !== "rendered" || !progressiveReaderReady || !currentAnnotationPath || !annotationEnabled) {
      disposeHighlight();
      setAnnotationLocations([]);
      return;
    }

    if (
      !annotationHighlightRef.current ||
      annotationHighlightRef.current.root !== root ||
      annotationHighlightRef.current.contentKey !== renderedHtml
    ) {
      disposeHighlight();
      annotationHighlightRef.current = {
        root,
        contentKey: renderedHtml,
        controller: createAnnotationHighlightController(root),
      };
    }

    const current = annotations.filter(
      (annotation) => normalizePathKey(annotation.path) === normalizePathKey(currentAnnotationPath),
    );
    const locations = annotationHighlightRef.current.controller.update(current);
    setAnnotationLocations(locations);
    const pending = pendingAnnotationIdRef.current;
    if (pending && annotationHighlightRef.current.controller.scrollTo(pending)) {
      pendingAnnotationIdRef.current = null;
    }
  }, [
    annotationEnabled,
    annotations,
    disposeHighlight,
    documentPath,
    mode,
    progressiveReaderReady,
    renderedHtml,
    readerBodyRef,
    workspacePath,
  ]);

  useEffect(() => disposeHighlight, [disposeHighlight]);

  return {
    annotationLocations,
    queueAnnotationFocus,
    scrollAnnotation,
    clearAnnotationFocus,
  };
}
