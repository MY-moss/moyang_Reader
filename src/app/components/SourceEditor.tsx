import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import { filterSlashCommands, matchSlashTrigger, slashCaretOffset, slashCommands } from "../slash-command-menu";
import {
  filterWikiLinkCandidates,
  formatWikiLinkInsert,
  matchWikiLinkTrigger,
  type WikiLinkCandidate,
} from "../wiki-link-completion";
import { captureEditorViewport, restoreEditorViewport } from "../editor-history-viewport";
import { applySourceEditorAction } from "../editor-context-actions";
import { editorContextMenuGroups, type EditorContextAction } from "../editor-context-menu";
import { ContextMenu } from "./ContextMenu";

type SourceEditorProps = {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onPaste?: (context: SourceEditorPasteContext) => boolean;
  onInsertLink?: (context: SourceEditorLinkContext) => void;
  onUndo?: (focusTarget?: Element | null) => void;
  onRedo?: (focusTarget?: Element | null) => void;
  onFindText?: (text: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onStatusMessage?: (message: string) => void;
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
  onUndo,
  onRedo,
  onFindText,
  canUndo = false,
  canRedo = false,
  onStatusMessage,
  wikiCompletions,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<EditorViewInstance | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onPasteRef = useRef(onPaste);
  const onInsertLinkRef = useRef(onInsertLink);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onFindTextRef = useRef(onFindText);
  const onStatusMessageRef = useRef(onStatusMessage);
  const wikiCompletionsRef = useRef<readonly WikiLinkCandidate[]>(wikiCompletions ?? []);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectionStart: number;
    selectionEnd: number;
    value: string;
  } | null>(null);

  useEffect(() => {
    wikiCompletionsRef.current = wikiCompletions ?? [];
  }, [wikiCompletions]);

  useEffect(() => {
    valueRef.current = value;
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;

    const viewport = captureEditorViewport(
      containerRef.current?.closest<HTMLElement>(".content-area") ?? null,
      containerRef.current,
    );
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    restoreEditorViewport(viewport);
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
    onUndoRef.current = onUndo;
  }, [onUndo]);

  useEffect(() => {
    onRedoRef.current = onRedo;
  }, [onRedo]);

  useEffect(() => {
    onFindTextRef.current = onFindText;
  }, [onFindText]);

  useEffect(() => {
    onStatusMessageRef.current = onStatusMessage;
  }, [onStatusMessage]);

  const replaceSourceValue = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    valueRef.current = nextValue;
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: nextValue },
        selection: { anchor: selectionStart, head: selectionEnd },
      });
      view.focus();
      return;
    }

    onChangeRef.current(nextValue);
    window.requestAnimationFrame(() => {
      const textarea = fallbackRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const applyContextAction = (action: EditorContextAction) => {
    const target = contextMenu;
    if (!target) return;

    const view = viewRef.current;
    const currentValue = view?.state.doc.toString() ?? valueRef.current;
    const selection = view?.state.selection.main;
    const selectionStart = selection?.from ?? target.selectionStart;
    const selectionEnd = selection?.to ?? target.selectionEnd;

    if (action === "undo" || action === "redo") {
      (action === "undo" ? onUndoRef.current : onRedoRef.current)?.(containerRef.current);
      setContextMenu(null);
      return;
    }

    if (action === "copy" || action === "cut") {
      if (selectionStart === selectionEnd) {
        onStatusMessageRef.current?.("请先选择要复制的文本。");
        setContextMenu(null);
        return;
      }

      const selectedText = currentValue.slice(selectionStart, selectionEnd);
      const clipboard = navigator.clipboard;
      if (!clipboard?.writeText) {
        onStatusMessageRef.current?.("当前环境不支持访问剪贴板。");
        setContextMenu(null);
        return;
      }
      void clipboard
        .writeText(selectedText)
        .then(() => {
          if (action === "cut") {
            replaceSourceValue(
              `${currentValue.slice(0, selectionStart)}${currentValue.slice(selectionEnd)}`,
              selectionStart,
              selectionStart,
            );
          }
        })
        .catch(() => onStatusMessageRef.current?.("无法访问剪贴板，请检查应用权限后重试。"));
      setContextMenu(null);
      return;
    }

    if (action === "paste") {
      const clipboard = navigator.clipboard;
      if (!clipboard?.readText) {
        onStatusMessageRef.current?.("当前环境不支持访问剪贴板。");
        setContextMenu(null);
        return;
      }
      void clipboard
        .readText()
        .then((pastedText) => {
          if (!pastedText) return;
          replaceSourceValue(
            `${currentValue.slice(0, selectionStart)}${pastedText}${currentValue.slice(selectionEnd)}`,
            selectionStart + pastedText.length,
            selectionStart + pastedText.length,
          );
        })
        .catch(() => onStatusMessageRef.current?.("无法读取剪贴板，请使用 Ctrl+V 或检查应用权限。"));
      setContextMenu(null);
      return;
    }

    if (action === "select-all") {
      if (view) {
        view.dispatch({ selection: { anchor: 0, head: currentValue.length } });
        view.focus();
      } else {
        const textarea = fallbackRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(0, currentValue.length);
      }
      setContextMenu(null);
      return;
    }

    if (action === "find-selection") {
      const selectedText = currentValue.slice(selectionStart, selectionEnd).trim();
      if (!selectedText) onStatusMessageRef.current?.("请先选择要查找的文本。");
      else onFindTextRef.current?.(selectedText);
      setContextMenu(null);
      return;
    }

    if (action === "link") {
      onInsertLinkRef.current?.({
        selectionStart,
        selectionEnd,
        value: currentValue,
        replace: (replacement) => {
          replaceSourceValue(
            `${currentValue.slice(0, selectionStart)}${replacement}${currentValue.slice(selectionEnd)}`,
            selectionStart + replacement.length,
            selectionStart + replacement.length,
          );
        },
      });
      setContextMenu(null);
      return;
    }

    let insertionText: string | undefined;
    if (action === "wikilink") {
      insertionText = window.prompt("输入双链目标", "")?.trim();
      if (!insertionText) {
        setContextMenu(null);
        return;
      }
    }
    if (action === "image") {
      insertionText = window.prompt("输入图片路径或 URL", "")?.trim();
      if (!insertionText) {
        setContextMenu(null);
        return;
      }
    }

    const result = applySourceEditorAction(currentValue, selectionStart, selectionEnd, action, insertionText);
    if (result) replaceSourceValue(result.value, result.selectionStart, result.selectionEnd);
    setContextMenu(null);
  };

  const editorContextGroups = editorContextMenuGroups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => {
      const hasSelection = Boolean(contextMenu && contextMenu.selectionStart !== contextMenu.selectionEnd);
      return {
        id: `source-${item.action}`,
        label: item.label,
        shortcut: item.shortcut,
        disabled:
          item.disabled ||
          (item.action === "undo" && !canUndo) ||
          (item.action === "redo" && !canRedo) ||
          ((item.action === "cut" || item.action === "copy") && !hasSelection) ||
          (item.action === "find-selection" && !hasSelection) ||
          (item.action === "clear-format" && !hasSelection),
        onSelect: () => applyContextAction(item.action),
      };
    }),
  }));

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
                contextmenu: (event, editorView) => {
                  event.preventDefault();
                  const selection = editorView.state.selection.main;
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    selectionStart: selection.from,
                    selectionEnd: selection.to,
                    value: editorView.state.doc.toString(),
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
      <>
        <textarea
          ref={fallbackRef}
          className="source-editor"
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => onChangeRef.current(event.target.value)}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              selectionStart: event.currentTarget.selectionStart,
              selectionEnd: event.currentTarget.selectionEnd,
              value: event.currentTarget.value,
            });
          }}
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
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            title="编辑操作"
            ariaLabel="正文编辑菜单"
            groups={editorContextGroups}
            onClose={() => setContextMenu(null)}
          />
        )}
      </>
    );
  }

  return (
    <div ref={containerRef} className="source-editor code-mirror-editor" aria-busy={!ready}>
      {!ready && <span className="source-editor-loading">正在加载编辑器…</span>}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title="编辑操作"
          ariaLabel="正文编辑菜单"
          groups={editorContextGroups}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
