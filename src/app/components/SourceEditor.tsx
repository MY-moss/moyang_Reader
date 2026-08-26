import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import { filterSlashCommands, matchSlashTrigger, slashCaretOffset, slashCommands } from "../slash-command-menu";
import {
  filterWikiLinkCandidates,
  formatWikiLinkInsert,
  matchWikiLinkTrigger,
  type WikiLinkCandidate,
} from "../wiki-link-completion";

type SourceEditorProps = {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onPaste?: (context: SourceEditorPasteContext) => boolean;
  onInsertLink?: (context: SourceEditorLinkContext) => void;
  wikiCompletions?: readonly WikiLinkCandidate[];
};

type EditorViewInstance = import("@codemirror/view").EditorView;

export type SourceEditorPasteContext = {
  clipboardData: DataTransfer;
  selectionStart: number;
  selectionEnd: number;
  value: string;
  preventDefault: () => void;
};

export type SourceEditorLinkContext = {
  selectionStart: number;
  selectionEnd: number;
  value: string;
  replace: (value: string) => void;
};

export function SourceEditor({
  value,
  ariaLabel,
  onChange,
  onPaste,
  onInsertLink,
  wikiCompletions,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorViewInstance | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onPasteRef = useRef(onPaste);
  const onInsertLinkRef = useRef(onInsertLink);
  const wikiCompletionsRef = useRef<readonly WikiLinkCandidate[]>(wikiCompletions ?? []);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    wikiCompletionsRef.current = wikiCompletions ?? [];
  }, [wikiCompletions]);

  useEffect(() => {
    valueRef.current = value;
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onPasteRef.current = onPaste;
  }, [onPaste]);

  useEffect(() => {
    onInsertLinkRef.current = onInsertLink;
  }, [onInsertLink]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    setLoadFailed(false);
    setReady(false);
    let disposed = false;
    let createdView: EditorViewInstance | null = null;
    let desktopE2eInsertText: ((value: string) => void) | null = null;
    let desktopE2eAcceptCompletion: (() => void) | null = null;

    void Promise.all([
      import("codemirror"),
      import("@codemirror/state"),
      import("@codemirror/view"),
      import("@codemirror/lang-markdown"),
      import("@codemirror/search"),
      import("@codemirror/autocomplete"),
    ])
      .then(([codemirror, state, view, markdownLanguage, search, autocomplete]) => {
        if (disposed) return;

        const wikiCompletionSource: CompletionSource = (context) => {
          const candidates = wikiCompletionsRef.current;
          if (!candidates.length) return null;

          const line = context.state.doc.lineAt(context.pos);
          const trigger = matchWikiLinkTrigger(line.text.slice(0, context.pos - line.from));
          if (!trigger) return null;

          const items = filterWikiLinkCandidates(candidates, trigger.query);
          if (!items.length) return null;

          return {
            from: context.pos - trigger.query.length,
            options: items.map((item) => ({
              label: item.label,
              detail: item.detail,
              type: "text",
              apply: (editorView: EditorViewInstance, _completion: Completion, from: number, to: number) => {
                editorView.dispatch({
                  changes: { from: from - 2, to, insert: formatWikiLinkInsert(item) },
                  selection: { anchor: from - 2 + item.value.length + 4 },
                });
              },
            })),
            // Candidates are pre-filtered above; CodeMirror's own fuzzy label
            // matching would drop Chinese labels for ASCII queries.
            filter: false,
          };
        };

        const slashCommandSource: CompletionSource = (context) => {
          const line = context.state.doc.lineAt(context.pos);
          const trigger = matchSlashTrigger(line.text.slice(0, context.pos - line.from));
          if (!trigger) return null;

          const items = filterSlashCommands(slashCommands, trigger.query);
          if (!items.length) return null;

          return {
            // `from` points at the query start; the leading `/` sits one char before it.
            from: context.pos - trigger.query.length,
            options: items.map((item) => ({
              label: item.label,
              detail: item.detail,
              type: "text",
              apply: (editorView: EditorViewInstance, _completion: Completion, from: number, to: number) => {
                editorView.dispatch({
                  changes: { from: from - 1, to, insert: item.sourceInsert },
                  selection: { anchor: from - 1 + slashCaretOffset(item) },
                });
              },
            })),
            // Re-run the source on every keystroke (no `validFor`) so our own
            // query filtering applies, and never fuzzy-match Chinese labels.
            filter: false,
          };
        };

        createdView = new view.EditorView({
          state: state.EditorState.create({
            doc: valueRef.current,
            extensions: [
              codemirror.basicSetup,
              markdownLanguage.markdown(),
              view.keymap.of(search.searchKeymap),
              autocomplete.autocompletion({
                override: [wikiCompletionSource, slashCommandSource],
                activateOnTyping: true,
                icons: false,
                // CodeMirror refuses to accept Enter/arrow keys within 75ms of
                // a menu update (guards against accidental picks while typing).
                // Our sources only surface for explicit `[[` / `/` prefixes, so
                // a menu press right after typing is intentional — keep it at 0
                // or fast typists see Enter silently fall through to newline.
                interactionDelay: 0,
              }),
              view.EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
              view.EditorView.domEventHandlers({
                keydown: (event, editorView) => {
                  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return false;
                  const handler = onInsertLinkRef.current;
                  if (!handler) return false;

                  event.preventDefault();
                  const selection = editorView.state.selection.main;
                  const currentValue = editorView.state.doc.toString();
                  handler({
                    selectionStart: selection.from,
                    selectionEnd: selection.to,
                    value: currentValue,
                    replace: (nextValue) => {
                      editorView.dispatch({
                        changes: { from: selection.from, to: selection.to, insert: nextValue },
                        selection: { anchor: selection.from + nextValue.length },
                      });
                    },
                  });
                  return true;
                },
                paste: (event, editorView) => {
                  const handler = onPasteRef.current;
                  if (!handler || !event.clipboardData) return false;

                  const selection = editorView.state.selection.main;
                  return handler({
                    clipboardData: event.clipboardData,
                    selectionStart: selection.from,
                    selectionEnd: selection.to,
                    value: editorView.state.doc.toString(),
                    preventDefault: () => event.preventDefault(),
                  });
                },
              }),
              view.EditorView.updateListener.of((update) => {
                if (update.docChanged) onChangeRef.current(update.state.doc.toString());
              }),
            ],
          }),
          parent,
        });
        viewRef.current = createdView;
        if (__MOYANG_DESKTOP_E2E__) {
          desktopE2eInsertText = (text) => {
            const current = viewRef.current;
            if (!current) return;

            const end = current.state.doc.length;
            current.dispatch({
              changes: { from: end, insert: text },
              selection: { anchor: end + text.length },
            });
            autocomplete.startCompletion(current);
          };
          desktopE2eAcceptCompletion = () => {
            const current = viewRef.current;
            if (current) autocomplete.acceptCompletion(current);
          };
          window.__moyangDesktopE2e = {
            ...window.__moyangDesktopE2e,
            acceptSourceCompletion: desktopE2eAcceptCompletion,
            insertSourceText: desktopE2eInsertText,
          };
        }
        setReady(true);
      })
      .catch(() => {
        if (!disposed) setLoadFailed(true);
      });

    return () => {
      disposed = true;
      if (desktopE2eInsertText && window.__moyangDesktopE2e?.insertSourceText === desktopE2eInsertText) {
        delete window.__moyangDesktopE2e.insertSourceText;
      }
      if (
        desktopE2eAcceptCompletion &&
        window.__moyangDesktopE2e?.acceptSourceCompletion === desktopE2eAcceptCompletion
      ) {
        delete window.__moyangDesktopE2e.acceptSourceCompletion;
      }
      createdView?.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel]);

  if (loadFailed) {
    return (
      <textarea
        className="source-editor"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
          const handler = onPasteRef.current;
          if (!handler) return;

          const handled = handler({
            clipboardData: event.clipboardData,
            selectionStart: event.currentTarget.selectionStart,
            selectionEnd: event.currentTarget.selectionEnd,
            value: event.currentTarget.value,
            preventDefault: () => event.preventDefault(),
          });
          if (handled) event.preventDefault();
        }}
        spellCheck={false}
      />
    );
  }

  return (
    <div ref={containerRef} className="source-editor code-mirror-editor" aria-busy={!ready}>
      {!ready && <span className="source-editor-loading">正在加载编辑器…</span>}
    </div>
  );
}
