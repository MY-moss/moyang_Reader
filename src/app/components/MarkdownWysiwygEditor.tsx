import { useCallback, useEffect, useRef, useState } from "react";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { gfm } from "@milkdown/kit/preset/gfm";
import { replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { createEditorSourceSyncTracker } from "../markdown-editor-support";
import {
  filterWikiLinkCandidates,
  formatWikiLinkInsert,
  matchWikiLinkTrigger,
  nextWikiCompletionIndex,
  wikiCompletionKeyAction,
  type WikiLinkCandidate,
} from "../wiki-link-completion";

type MarkdownWysiwygEditorProps = {
  source: string;
  documentKey: string;
  ariaLabel: string;
  onChange: (markdown: string) => void;
  onInsertLink: () => void;
  wikiCandidates?: readonly WikiLinkCandidate[];
};

type EditorViewInstance = {
  focus: () => void;
  coordsAtPos: (pos: number) => { top: number; bottom: number; left: number };
  dispatch: (transaction: unknown) => void;
  state: {
    selection: { empty: boolean; $from: { pos: number; parentOffset: number; parent: ParentNodeLike } };
    tr: {
      insertText: (text: string, from: number, to?: number) => unknown;
    };
  };
};

type ParentNodeLike = {
  type?: { name?: string };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
};

type WikiCompletionState = {
  query: string;
  items: WikiLinkCandidate[];
  activeIndex: number;
  top: number;
  left: number;
  from: number;
  caret: number;
};

function readCaretWikiTrigger(
  view: EditorViewInstance,
): Omit<WikiCompletionState, "items" | "activeIndex" | "top" | "left"> | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  const parentName = $from.parent.type?.name ?? "";
  if (parentName.includes("code")) return null;

  const parentOffset = $from.parentOffset;
  if (parentOffset <= 0) return null;

  const start = Math.max(0, parentOffset - 128);
  const textBefore = $from.parent.textBetween(start, parentOffset, undefined, "\ufffc");
  const trigger = matchWikiLinkTrigger(textBefore);
  if (!trigger) return null;

  const absoluteStart = $from.pos - parentOffset + start;
  const bracketStart = absoluteStart + textBefore.length - trigger.query.length - 2;
  if (bracketStart < $from.pos - parentOffset) return null;

  return { query: trigger.query, from: bracketStart, caret: $from.pos };
}

function MilkdownSurface({
  source,
  documentKey,
  ariaLabel,
  onChange,
  onInsertLink,
  wikiCandidates,
}: MarkdownWysiwygEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const sourceSyncRef = useRef(createEditorSourceSyncTracker(source));
  const viewRef = useRef<EditorViewInstance | null>(null);
  const wikiCandidatesRef = useRef<readonly WikiLinkCandidate[]>(wikiCandidates ?? []);
  const completionRef = useRef<WikiCompletionState | null>(null);
  const [completion, setCompletion] = useState<WikiCompletionState | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    wikiCandidatesRef.current = wikiCandidates ?? [];
  }, [wikiCandidates]);

  useEffect(() => {
    completionRef.current = completion;
  }, [completion]);

  const { loading, get } = useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, source);
        })
        .use(gfm)
        .use(listener)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((_context, markdown) => {
            sourceSyncRef.current.markEditorSource(markdown);
            onChangeRef.current(markdown);
          });
        }),
    [documentKey],
  );

  useEffect(() => {
    if (loading) return;
    const editor = get();
    if (!editor || !sourceSyncRef.current.shouldApplyExternalSource(source)) return;

    // A flush rebuilds the ProseMirror state without emitting a local edit event,
    // so an external watcher refresh cannot mark the document as dirty again.
    editor.action(replaceAll(source, true));
  }, [get, loading, source]);

  useEffect(() => {
    setCompletion(null);
    completionRef.current = null;
  }, [documentKey]);

  useEffect(() => {
    if (loading || !containerRef.current) return;
    const editable = containerRef.current.querySelector<HTMLElement>('[contenteditable="true"]');
    editable?.setAttribute("aria-label", ariaLabel);
    editable?.setAttribute("aria-multiline", "true");
  }, [ariaLabel, loading]);

  const acceptCandidate = useCallback((candidate: WikiLinkCandidate) => {
    const view = viewRef.current;
    const current = completionRef.current;
    if (!view || !current) return;

    view.dispatch(view.state.tr.insertText(formatWikiLinkInsert(candidate), current.from, current.caret));
    view.focus();
    completionRef.current = null;
    setCompletion(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (loading || !container) return;

    const editor = get();
    viewRef.current = editor ? (editor as unknown as { view: EditorViewInstance }).view : null;

    const closeCompletion = () => {
      completionRef.current = null;
      setCompletion(null);
    };

    const updateCompletion = () => {
      const view = viewRef.current;
      if (!view) return;

      const trigger = readCaretWikiTrigger(view);
      const candidates = wikiCandidatesRef.current;
      if (!trigger || !candidates.length) {
        closeCompletion();
        return;
      }

      const items = filterWikiLinkCandidates(candidates, trigger.query);
      if (!items.length) {
        closeCompletion();
        return;
      }

      let top = 0;
      let left = 0;
      try {
        const coords = view.coordsAtPos(trigger.caret);
        const bounds = container.getBoundingClientRect();
        top = coords.bottom - bounds.top + 4;
        left = Math.max(0, coords.left - bounds.left);
      } catch {
        // Fall back to the top-left of the editor area when caret coords are unavailable.
      }

      const next: WikiCompletionState = {
        ...trigger,
        items,
        activeIndex: 0,
        top,
        left,
      };
      completionRef.current = next;
      setCompletion(next);
    };

    const handleInput = () => updateCompletion();

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      const current = completionRef.current;
      if (!current) return;
      if (event.isComposing) return;

      const action = wikiCompletionKeyAction(event.key);
      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      if (action === "dismiss") {
        closeCompletion();
        return;
      }

      if (action === "next" || action === "previous") {
        const activeIndex = nextWikiCompletionIndex(current.activeIndex, current.items.length, action);
        const next = { ...current, activeIndex };
        completionRef.current = next;
        setCompletion(next);
        return;
      }

      acceptCandidate(current.items[current.activeIndex]);
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget && container.contains(event.relatedTarget as Node)) return;
      closeCompletion();
    };

    container.addEventListener("input", handleInput);
    container.addEventListener("keydown", handleKeyDownCapture, true);
    container.addEventListener("focusout", handleFocusOut);

    return () => {
      container.removeEventListener("input", handleInput);
      container.removeEventListener("keydown", handleKeyDownCapture, true);
      container.removeEventListener("focusout", handleFocusOut);
      viewRef.current = null;
    };
  }, [acceptCandidate, get, loading]);

  return (
    <div
      ref={containerRef}
      className={`wysiwyg-editor${loading ? " is-loading" : ""}`}
      aria-busy={loading}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
        event.preventDefault();
        onInsertLink();
      }}
    >
      {loading && <div className="wysiwyg-loading">正在准备所见即所得编辑器…</div>}
      <Milkdown />
      {completion && (
        <div
          className="wiki-completion"
          role="listbox"
          aria-label="双链补全候选"
          style={{ top: completion.top, left: completion.left }}
        >
          {completion.items.map((item, index) => (
            <button
              key={`${item.value}-${item.detail ?? ""}`}
              type="button"
              role="option"
              aria-selected={index === completion.activeIndex}
              className={index === completion.activeIndex ? "is-active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => acceptCandidate(item)}
            >
              <span className="wiki-completion-label">{item.label}</span>
              {item.detail && <span className="wiki-completion-detail">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarkdownWysiwygEditor(props: MarkdownWysiwygEditorProps) {
  return (
    <MilkdownProvider key={props.documentKey}>
      <MilkdownSurface {...props} />
    </MilkdownProvider>
  );
}
