import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from "react";
import type { Completion, CompletionSource } from "@codemirror/autocomplete";
import { filterSlashCommands, matchSlashTrigger, slashCaretOffset, slashCommands } from "../slash-command-menu";
import {
  filterWikiLinkCandidates,
  formatWikiLinkInsert,
  matchWikiLinkTrigger,
  type WikiLinkCandidate,
} from "../wiki-link-completion";
import { captureEditorViewport, restoreEditorViewport } from "../editor-history-viewport";
import type { EditorInsertAnchor } from "../editor-insert-position";
import { applySourceEditorAction } from "../editor-context-actions";
import { editorContextMenuGroups, type EditorContextAction } from "../editor-context-menu";
import { applyEditorInsert, type EditorInsertKind, type EditorInsertRequest } from "../editor-insertion";
import { insertTextAtSelection } from "../clipboard-image";
import { clipboardPayloadHasContent, dispatchClipboardPaste, readClipboardPayload } from "../clipboard-paste";
import { ContextMenu } from "./ContextMenu";
import { EditorInsertPopover, type EditorInsertInitialValues } from "./EditorInsertPopover";
import { EditorToolbar } from "./EditorToolbar";

type SourceEditorProps = {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onPaste?: (context: SourceEditorPasteContext) => boolean;
  requestedInsertKind?: EditorInsertKind | null;
  onInsertRequestHandled?: () => void;
  onUndo?: (focusTarget?: Element | null) => void;
  onRedo?: (focusTarget?: Element | null) => void;
  onFindText?: (text: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onStatusMessage?: (message: string) => void;
  wikiCompletions?: readonly WikiLinkCandidate[];
};

type EditorViewInstance = import("@codemirror/view").EditorView;

export function shouldSyncSourceEditorValue(hasView: boolean, lastKnownValue: string, nextValue: string): boolean {
  return hasView && lastKnownValue !== nextValue;
}

export type SourceEditorPasteContext = {
  clipboardData: DataTransfer;
  selectionStart: number;
  selectionEnd: number;
  value: string;
  preventDefault: () => void;
};

function isContextMenuKey(event: KeyboardEvent): boolean {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

function focusWithoutScroll(element: HTMLElement | null): void {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function SourceEditor({
  value,
  ariaLabel,
  onChange,
  onPaste,
  requestedInsertKind,
  onInsertRequestHandled,
  onUndo,
  onRedo,
  onFindText,
  canUndo = false,
  canRedo = false,
  onStatusMessage,
  wikiCompletions,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackShellRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<EditorViewInstance | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onPasteRef = useRef(onPaste);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onFindTextRef = useRef(onFindText);
  const onStatusMessageRef = useRef(onStatusMessage);
  const wikiCompletionsRef = useRef<readonly WikiLinkCandidate[]>(wikiCompletions ?? []);
  const pendingInsertRef = useRef<{ selectionStart: number; selectionEnd: number; value: string } | null>(null);
  const lastRequestedInsertRef = useRef<EditorInsertKind | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertKind, setInsertKind] = useState<EditorInsertKind>("link");
  const [insertInitialValues, setInsertInitialValues] = useState<EditorInsertInitialValues>({});
  const [insertAnchor, setInsertAnchor] = useState<EditorInsertAnchor | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    selectionStart: number;
    selectionEnd: number;
    value: string;
    restoreFocusTarget: HTMLElement | null;
    fallbackFocusTarget: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    wikiCompletionsRef.current = wikiCompletions ?? [];
  }, [wikiCompletions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      valueRef.current = value;
      return;
    }
    if (!shouldSyncSourceEditorValue(Boolean(view), valueRef.current, value)) return;

    valueRef.current = value;

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

  const focusSourceEditorPreservingViewport = useCallback(() => {
    const surface = containerRef.current ?? fallbackShellRef.current;
    const viewport = surface ? captureEditorViewport(surface.closest<HTMLElement>(".content-area"), surface) : [];
    const view = viewRef.current;
    if (view) view.focus();
    else focusWithoutScroll(fallbackRef.current);
    restoreEditorViewport(viewport);
    window.requestAnimationFrame(() => restoreEditorViewport(viewport));
  }, []);

  const replaceSourceValue = useCallback(
    (nextValue: string, selectionStart: number, selectionEnd: number) => {
      valueRef.current = nextValue;
      const view = viewRef.current;
      if (view) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: nextValue },
          selection: { anchor: selectionStart, head: selectionEnd },
        });
        focusSourceEditorPreservingViewport();
        return;
      }

      onChangeRef.current(nextValue);
      window.requestAnimationFrame(() => {
        const textarea = fallbackRef.current;
        if (!textarea) return;
        focusWithoutScroll(textarea);
        textarea.setSelectionRange(selectionStart, selectionEnd);
        const surface = fallbackShellRef.current;
        if (surface) {
          const viewport = captureEditorViewport(surface.closest<HTMLElement>(".content-area"), surface);
          restoreEditorViewport(viewport);
        }
      });
    },
    [focusSourceEditorPreservingViewport],
  );

  const pasteFromClipboard = useCallback(
    async (plainOnly: boolean, selectionStart: number, selectionEnd: number, initialValue: string) => {
      try {
        const payload = await readClipboardPayload();
        if (!clipboardPayloadHasContent(payload)) {
          onStatusMessageRef.current?.("剪贴板中没有可粘贴的内容。");
          return;
        }

        // Source mode always stores Markdown text. For a normal paste, still
        // dispatch image data through the native paste path so the app can
        // save it as a workspace asset just like Ctrl+V.
        if (!plainOnly && payload.files.length) {
          const target = viewRef.current?.contentDOM ?? fallbackRef.current;
          if (target && dispatchClipboardPaste(target, payload)) return;
        }

        if (!payload.text) {
          onStatusMessageRef.current?.(
            plainOnly
              ? "剪贴板中没有可粘贴的文本；如需插入图片，请使用“粘贴”。"
              : "剪贴板中没有可粘贴的文本；图片请使用 Ctrl+V 或切换到桌面版。",
          );
          return;
        }

        if (valueRef.current !== initialValue) {
          onStatusMessageRef.current?.("正文内容已经变化，请重新执行粘贴，避免覆盖最新修改。");
          return;
        }

        const safeStart = Math.max(0, Math.min(selectionStart, initialValue.length));
        const safeEnd = Math.max(safeStart, Math.min(selectionEnd, initialValue.length));
        const nextValue = insertTextAtSelection(initialValue, safeStart, safeEnd, payload.text);
        const caret = safeStart + payload.text.length;
        replaceSourceValue(nextValue, caret, caret);
      } catch {
        onStatusMessageRef.current?.("无法读取剪贴板，请检查应用权限后重试。");
      }
    },
    [replaceSourceValue],
  );

  const readCurrentSelection = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      const selection = view.state.selection.main;
      return {
        selectionStart: selection.from,
        selectionEnd: selection.to,
        value: view.state.doc.toString(),
      };
    }

    const textarea = fallbackRef.current;
    return {
      selectionStart: textarea?.selectionStart ?? 0,
      selectionEnd: textarea?.selectionEnd ?? 0,
      value: textarea?.value ?? valueRef.current,
    };
  }, []);

  const openInsert = useCallback(
    (kind: EditorInsertKind) => {
      const view = viewRef.current;
      const textarea = fallbackRef.current;
      if (!view && !textarea) {
        onStatusMessageRef.current?.("编辑器还在准备，请稍后再试。");
        return;
      }
      const selection = readCurrentSelection();
      let anchor: EditorInsertAnchor | null = null;
      if (view) {
        try {
          const coords = view.coordsAtPos(selection.selectionEnd);
          if (coords) anchor = { left: coords.left, top: coords.top, bottom: coords.bottom };
        } catch {
          // A detached or not-yet-painted CodeMirror view has no usable caret rect.
        }
      }
      if (!anchor) {
        const bounds = (textarea ?? containerRef.current)?.getBoundingClientRect();
        if (bounds) anchor = { left: bounds.left + 24, top: bounds.top + 24, bottom: bounds.top + 48 };
      }

      pendingInsertRef.current = selection;
      setInsertKind(kind);
      setInsertInitialValues({
        label: selection.value.slice(selection.selectionStart, selection.selectionEnd).trim() || "链接文字",
        alt: "",
        rows: 3,
        columns: 3,
      });
      setInsertAnchor(anchor);
      setInsertOpen(true);
      setContextMenu(null);
    },
    [readCurrentSelection],
  );

  const restorePendingInsertSelection = useCallback(() => {
    const pending = pendingInsertRef.current;
    if (!pending) return;

    const view = viewRef.current;
    if (view) {
      const max = view.state.doc.length;
      const selectionStart = Math.max(0, Math.min(pending.selectionStart, max));
      const selectionEnd = Math.max(selectionStart, Math.min(pending.selectionEnd, max));
      view.dispatch({ selection: { anchor: selectionStart, head: selectionEnd } });
      focusSourceEditorPreservingViewport();
      return;
    }

    const textarea = fallbackRef.current;
    if (!textarea) return;
    const selectionStart = Math.max(0, Math.min(pending.selectionStart, textarea.value.length));
    const selectionEnd = Math.max(selectionStart, Math.min(pending.selectionEnd, textarea.value.length));
    focusWithoutScroll(textarea);
    textarea.setSelectionRange(selectionStart, selectionEnd);
    focusSourceEditorPreservingViewport();
  }, [focusSourceEditorPreservingViewport]);

  const closeInsert = useCallback(
    (restoreSelection = true) => {
      if (restoreSelection) restorePendingInsertSelection();
      pendingInsertRef.current = null;
      setInsertAnchor(null);
      setInsertOpen(false);
    },
    [restorePendingInsertSelection],
  );

  const handleInsertRequest = useCallback(
    (request: EditorInsertRequest) => {
      const pending = pendingInsertRef.current;
      if (!pending) return;

      const current = readCurrentSelection();
      if (current.value !== pending.value) {
        onStatusMessageRef.current?.("正文内容已经变化，请重新打开插入面板，避免覆盖最新修改。");
        closeInsert();
        return;
      }

      const result = applyEditorInsert(pending.value, pending.selectionStart, pending.selectionEnd, request);
      if (!result) {
        onStatusMessageRef.current?.("插入内容无效，请检查输入后重试。");
        return;
      }

      replaceSourceValue(result.value, result.selectionStart, result.selectionEnd);
      closeInsert(false);
    },
    [closeInsert, readCurrentSelection, replaceSourceValue],
  );

  useEffect(() => {
    if (!requestedInsertKind) {
      lastRequestedInsertRef.current = null;
      return;
    }
    if (lastRequestedInsertRef.current === requestedInsertKind) return;
    lastRequestedInsertRef.current = requestedInsertKind;
    openInsert(requestedInsertKind);
    onInsertRequestHandled?.();
  }, [onInsertRequestHandled, openInsert, requestedInsertKind]);

  const applyContextAction = (action: EditorContextAction) => {
    const target = contextMenu;

    const view = viewRef.current;
    const currentValue = view?.state.doc.toString() ?? valueRef.current;
    const selection = view?.state.selection.main;
    const fallback = fallbackRef.current;
    const selectionStart = selection?.from ?? target?.selectionStart ?? fallback?.selectionStart ?? 0;
    const selectionEnd = selection?.to ?? target?.selectionEnd ?? fallback?.selectionEnd ?? selectionStart;

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

    if (action === "paste" || action === "paste-plain") {
      void pasteFromClipboard(action === "paste-plain", selectionStart, selectionEnd, currentValue);
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
      openInsert("link");
      return;
    }

    if (action === "wikilink" || action === "image" || action === "table") {
      openInsert(action);
      return;
    }

    const result = applySourceEditorAction(currentValue, selectionStart, selectionEnd, action);
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
                keydown: (event, _editorView) => {
                  if (isContextMenuKey(event)) {
                    event.preventDefault();
                    const selection = _editorView.state.selection.main;
                    const activeElement = document.activeElement;
                    setContextMenu({
                      x: _editorView.contentDOM.getBoundingClientRect().left,
                      y: _editorView.contentDOM.getBoundingClientRect().bottom,
                      selectionStart: selection.from,
                      selectionEnd: selection.to,
                      value: _editorView.state.doc.toString(),
                      restoreFocusTarget:
                        activeElement instanceof HTMLElement && parent.contains(activeElement)
                          ? activeElement
                          : _editorView.contentDOM,
                      fallbackFocusTarget: parent,
                    });
                    return true;
                  }
                  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return false;
                  event.preventDefault();
                  openInsert("link");
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
                    restoreFocusTarget:
                      document.activeElement instanceof HTMLElement && parent.contains(document.activeElement)
                        ? document.activeElement
                        : editorView.contentDOM,
                    fallbackFocusTarget: parent,
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
                if (!update.docChanged) return;
                const nextValue = update.state.doc.toString();
                valueRef.current = nextValue;
                onChangeRef.current(nextValue);
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
  }, [ariaLabel, openInsert]);

  if (loadFailed) {
    return (
      <div ref={fallbackShellRef} className="editor-surface source-editor-fallback-shell" tabIndex={-1}>
        <EditorToolbar canUndo={canUndo} canRedo={canRedo} onAction={applyContextAction} onInsert={openInsert} />
        <EditorInsertPopover
          open={insertOpen}
          kind={insertKind}
          initialValues={insertInitialValues}
          anchor={insertAnchor}
          scrollContainerRef={fallbackShellRef}
          onCancel={closeInsert}
          onSubmit={handleInsertRequest}
        />
        <textarea
          ref={fallbackRef}
          className="source-editor"
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => {
            valueRef.current = event.target.value;
            onChangeRef.current(event.target.value);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              selectionStart: event.currentTarget.selectionStart,
              selectionEnd: event.currentTarget.selectionEnd,
              value: event.currentTarget.value,
              restoreFocusTarget: event.currentTarget,
              fallbackFocusTarget: event.currentTarget.parentElement,
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
            restoreFocusTarget={contextMenu.restoreFocusTarget}
            fallbackFocusTarget={contextMenu.fallbackFocusTarget}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="source-editor code-mirror-editor" aria-busy={!ready} tabIndex={-1}>
      <EditorToolbar canUndo={canUndo} canRedo={canRedo} onAction={applyContextAction} onInsert={openInsert} />
      <EditorInsertPopover
        open={insertOpen}
        kind={insertKind}
        initialValues={insertInitialValues}
        anchor={insertAnchor}
        scrollContainerRef={containerRef}
        onCancel={closeInsert}
        onSubmit={handleInsertRequest}
      />
      {!ready && <span className="source-editor-loading">正在加载编辑器…</span>}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title="编辑操作"
          ariaLabel="正文编辑菜单"
          groups={editorContextGroups}
          restoreFocusTarget={contextMenu.restoreFocusTarget}
          fallbackFocusTarget={contextMenu.fallbackFocusTarget}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
