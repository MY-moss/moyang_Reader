import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { defaultValueCtx, Editor, editorViewCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import {
  insertImageCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  createCodeBlockCommand,
  insertHrCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand, toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm";
import { callCommand, replaceAll } from "@milkdown/kit/utils";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { createEditorSourceSyncTracker } from "../markdown-editor-support";
import { captureEditorViewport, restoreEditorViewport } from "../editor-history-viewport";
import { formatEditorDate } from "../editor-context-actions";
import { filterSlashCommands, matchSlashTrigger, slashCommands, type SlashCommand } from "../slash-command-menu";
import { buildWysiwygEditorPlugins } from "./wysiwyg-editor-setup";
import { ContextMenu } from "./ContextMenu";
import { editorContextMenuGroups, type EditorContextAction } from "../editor-context-menu";
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
  onUndo?: (focusTarget?: Element | null) => void;
  onRedo?: (focusTarget?: Element | null) => void;
  onFindText?: (text: string) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onStatusMessage?: (message: string) => void;
  wikiCandidates?: readonly WikiLinkCandidate[];
};

type EditorViewInstance = {
  focus: () => void;
  coordsAtPos: (pos: number) => { top: number; bottom: number; left: number };
  dispatch: (transaction: unknown) => void;
  state: {
    doc: {
      nodesBetween: (from: number, to: number, callback: (node: EditorNodeLike, pos: number) => void) => void;
      textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
    };
    selection: {
      empty: boolean;
      from: number;
      to: number;
      $from: { pos: number; parentOffset: number; parent: ParentNodeLike };
    };
    tr: {
      insertText: (text: string, from: number, to?: number) => unknown;
      delete: (from: number, to: number) => unknown;
      setNodeMarkup: (pos: number, type?: unknown, attrs?: Record<string, unknown>) => unknown;
    };
  };
};

type EditorNodeLike = {
  type: { name: string };
  attrs: Record<string, unknown>;
};

type DesktopE2eEditorView = {
  state: {
    doc: { content: { size: number }; resolve: (position: number) => unknown };
    selection: { constructor: { near: (resolvedPosition: unknown) => unknown } };
    tr: {
      setSelection: (selection: unknown) => { insertText: (text: string) => unknown };
    };
  };
  dispatch: (transaction: unknown) => void;
};

type SerializerInstance = (doc: unknown) => string;

type ParentNodeLike = {
  type?: { name?: string };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
};

function markCurrentListItemsAsTasks(view: EditorViewInstance): boolean {
  const positions = new Set<number>();
  const { state } = view;
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {
    if (node.type.name === "list_item") positions.add(pos);
  });

  // A collapsed selection does not visit its containing list item, so walk the
  // ancestor chain as well. The GFM preset stores task state on list_item.
  const selectionFrom = state.selection.$from as typeof state.selection.$from & {
    depth?: number;
    node?: (depth: number) => EditorNodeLike;
    before?: (depth: number) => number;
  };
  if (selectionFrom.depth !== undefined && selectionFrom.node && selectionFrom.before) {
    for (let depth = selectionFrom.depth; depth > 0; depth -= 1) {
      const node = selectionFrom.node(depth);
      if (node.type.name === "list_item") positions.add(selectionFrom.before(depth));
    }
  }

  if (positions.size === 0) return false;
  const transaction = state.tr;
  positions.forEach((pos) => {
    const node = state.doc as unknown as { nodeAt?: (position: number) => EditorNodeLike | null };
    const listItem = node.nodeAt?.(pos);
    if (listItem?.type.name === "list_item") {
      transaction.setNodeMarkup(pos, undefined, { ...listItem.attrs, checked: false });
    }
  });
  view.dispatch(transaction);
  return true;
}

type CompletionOverlayKind = "wiki" | "slash";

type EditorCompletionTrigger = {
  kind: CompletionOverlayKind;
  query: string;
  from: number;
  caret: number;
};

type CompletionOverlayState = EditorCompletionTrigger & {
  items: (WikiLinkCandidate | SlashCommand)[];
  activeIndex: number;
  top: number;
  left: number;
};

/** 把 `/` 菜单命令映射到对应的 Milkdown 块级命令。 */
function slashCommandAction(command: SlashCommand) {
  switch (command.id) {
    case "heading1":
      return callCommand(wrapInHeadingCommand.key, 1);
    case "heading2":
      return callCommand(wrapInHeadingCommand.key, 2);
    case "heading3":
      return callCommand(wrapInHeadingCommand.key, 3);
    case "bulletList":
      return callCommand(wrapInBulletListCommand.key);
    case "orderedList":
      return callCommand(wrapInOrderedListCommand.key);
    case "quote":
      return callCommand(wrapInBlockquoteCommand.key);
    case "codeBlock":
      return callCommand(createCodeBlockCommand.key);
    case "table":
      return callCommand(insertTableCommand.key, { row: 3, col: 3 });
    case "divider":
      return callCommand(insertHrCommand.key);
  }
}

function readCaretWikiTrigger(view: EditorViewInstance): EditorCompletionTrigger | null {
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

  return { kind: "wiki", query: trigger.query, from: bracketStart, caret: $from.pos };
}

function readCaretSlashTrigger(view: EditorViewInstance): EditorCompletionTrigger | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  const parentName = $from.parent.type?.name ?? "";
  if (parentName.includes("code")) return null;

  const parentOffset = $from.parentOffset;
  if (parentOffset <= 0) return null;

  const textBefore = $from.parent.textBetween(0, parentOffset, undefined, "\ufffc");
  const trigger = matchSlashTrigger(textBefore);
  if (!trigger) return null;

  // `/` 位于块首，`from` 即整个 `/查询` 片段的起点。
  return { kind: "slash", query: trigger.query, from: $from.pos - parentOffset, caret: $from.pos };
}

function MilkdownSurface({
  source,
  documentKey,
  ariaLabel,
  onChange,
  onInsertLink,
  onUndo,
  onRedo,
  onFindText,
  canUndo = false,
  canRedo = false,
  onStatusMessage,
  wikiCandidates,
}: MarkdownWysiwygEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const sourceSyncRef = useRef(createEditorSourceSyncTracker(source));
  const viewRef = useRef<EditorViewInstance | null>(null);
  const serializerRef = useRef<SerializerInstance | null>(null);
  // Markdown that the app state has already received. Milkdown debounces
  // markdownUpdated by 200ms, so this tracks what actually landed vs what the
  // editor still owes on flush.
  const lastSyncedMarkdownRef = useRef<string | null>(null);
  const wikiCandidatesRef = useRef<readonly WikiLinkCandidate[]>(wikiCandidates ?? []);
  const completionRef = useRef<CompletionOverlayState | null>(null);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const onFindTextRef = useRef(onFindText);
  const onStatusMessageRef = useRef(onStatusMessage);
  const [completion, setCompletion] = useState<CompletionOverlayState | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        .use(buildWysiwygEditorPlugins())
        .use(listener)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((_context, markdown) => {
            sourceSyncRef.current.markEditorSource(markdown);
            lastSyncedMarkdownRef.current = markdown;
            onChangeRef.current(markdown);
          });
        }),
    [documentKey],
  );

  // `get` is recreated on every render; a captured copy still resolves the
  // current editor, so keep one stable reference for long-lived effects.
  const getRef = useRef(get);
  useEffect(() => {
    getRef.current = get;
  });

  useEffect(() => {
    if (loading) return;
    const editor = getRef.current();
    if (!editor || !sourceSyncRef.current.shouldApplyExternalSource(source)) return;

    // A flush rebuilds the ProseMirror state without emitting a local edit event,
    // so an external watcher refresh cannot mark the document as dirty again.
    const viewport = captureEditorViewport(
      containerRef.current?.closest<HTMLElement>(".content-area") ?? null,
      containerRef.current,
    );
    editor.action(replaceAll(source, true));
    restoreEditorViewport(viewport);
    // markdownUpdated skips replaceAll transactions (no history entry), so keep
    // the flush marker aligned with the externally-applied document.
    const view = editor.ctx.get(editorViewCtx) as unknown as EditorViewInstance;
    const serializer = editor.ctx.get(serializerCtx) as unknown as SerializerInstance;
    lastSyncedMarkdownRef.current = serializer(view.state.doc);
  }, [loading, source]);

  useEffect(() => {
    setCompletion(null);
    completionRef.current = null;
  }, [documentKey]);

  const [mountFailed, setMountFailed] = useState(false);

  useEffect(() => {
    if (loading || !containerRef.current) return;
    const editable = containerRef.current.querySelector<HTMLElement>('[contenteditable="true"]');
    // Surface editor bootstrap failures instead of silently showing a blank area.
    setMountFailed(!editable);
    editable?.setAttribute("aria-label", ariaLabel);
    editable?.setAttribute("aria-multiline", "true");
  }, [ariaLabel, loading]);

  const applyCompletionItem = useCallback((item: WikiLinkCandidate | SlashCommand) => {
    const view = viewRef.current;
    const current = completionRef.current;
    if (!view || !current) return;

    if (current.kind === "slash" && "id" in item) {
      const editor = getRef.current();
      if (!editor) return;

      // 先删除 `/查询` 文本，让块级命令作用于干净的空块。
      view.dispatch(view.state.tr.delete(current.from, current.caret));
      editor.action(slashCommandAction(item));
      view.focus();
      completionRef.current = null;
      setCompletion(null);
      return;
    }

    if ("value" in item) {
      view.dispatch(view.state.tr.insertText(formatWikiLinkInsert(item), current.from, current.caret));
      view.focus();
      completionRef.current = null;
      setCompletion(null);
    }
  }, []);

  const applyContextAction = useCallback(
    (action: EditorContextAction) => {
      const editor = getRef.current();
      const view = viewRef.current;
      if (!editor || !view) return;

      if (action === "undo" || action === "redo") {
        (action === "undo" ? onUndoRef.current : onRedoRef.current)?.(containerRef.current);
        setContextMenu(null);
        return;
      }

      if (action === "copy" || action === "cut") {
        if (!contextMenu?.hasSelection) {
          onStatusMessageRef.current?.("请先选择要复制的文本。");
          setContextMenu(null);
          return;
        }
        view.focus();
        if (!document.execCommand(action)) {
          onStatusMessageRef.current?.("无法访问剪贴板，请使用 Ctrl+C 或检查应用权限。");
        }
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
            view.focus();
            view.dispatch(view.state.tr.insertText(pastedText, view.state.selection.from, view.state.selection.to));
          })
          .catch(() => onStatusMessageRef.current?.("无法读取剪贴板，请使用 Ctrl+V 或检查应用权限。"));
        setContextMenu(null);
        return;
      }

      if (action === "select-all") {
        view.focus();
        document.execCommand("selectAll");
        setContextMenu(null);
        return;
      }

      if (action === "find-selection") {
        const selectedText = view.state.doc
          .textBetween(view.state.selection.from, view.state.selection.to, "\n")
          .trim();
        if (!selectedText) onStatusMessageRef.current?.("请先选择要查找的文本。");
        else onFindTextRef.current?.(selectedText);
        setContextMenu(null);
        return;
      }

      if (action === "clear-format") {
        if (view.state.selection.empty) {
          onStatusMessageRef.current?.("请先选择要清除格式的文本。");
        } else {
          const { from, to } = view.state.selection;
          const plainText = view.state.doc.textBetween(from, to, "\n");
          view.dispatch(view.state.tr.insertText(plainText, from, to));
          view.focus();
        }
        setContextMenu(null);
        return;
      }

      if (action === "insert-date") {
        const { from, to } = view.state.selection;
        view.dispatch(view.state.tr.insertText(formatEditorDate(), from, to));
        view.focus();
        setContextMenu(null);
        return;
      }

      if (action === "task-list") {
        if (!markCurrentListItemsAsTasks(view)) {
          editor.action(callCommand(wrapInBulletListCommand.key));
          markCurrentListItemsAsTasks(view);
        }
        view.focus();
        setContextMenu(null);
        return;
      }

      if (action === "link") {
        onInsertLink();
        setContextMenu(null);
        return;
      }

      if (action === "wikilink") {
        const target = window.prompt("输入双链目标", "");
        if (target?.trim()) {
          view.dispatch(
            view.state.tr.insertText(`[[${target.trim()}]]`, view.state.selection.from, view.state.selection.to),
          );
        }
        view.focus();
        setContextMenu(null);
        return;
      }

      if (action === "image") {
        const target = window.prompt("输入图片路径或 URL", "");
        if (target?.trim()) {
          editor.action(callCommand(insertImageCommand.key, { src: target.trim(), alt: target.trim() }));
        }
        view.focus();
        setContextMenu(null);
        return;
      }

      switch (action) {
        case "bold":
          editor.action(callCommand(toggleStrongCommand.key));
          break;
        case "italic":
          editor.action(callCommand(toggleEmphasisCommand.key));
          break;
        case "strike":
          editor.action(callCommand(toggleStrikethroughCommand.key));
          break;
        case "inline-code":
          editor.action(callCommand(toggleInlineCodeCommand.key));
          break;
        case "paragraph":
          editor.action(callCommand(turnIntoTextCommand.key));
          break;
        case "heading-1":
          editor.action(callCommand(wrapInHeadingCommand.key, 1));
          break;
        case "heading-2":
          editor.action(callCommand(wrapInHeadingCommand.key, 2));
          break;
        case "heading-3":
          editor.action(callCommand(wrapInHeadingCommand.key, 3));
          break;
        case "bullet-list":
          editor.action(callCommand(wrapInBulletListCommand.key));
          break;
        case "ordered-list":
          editor.action(callCommand(wrapInOrderedListCommand.key));
          break;
        case "quote":
          editor.action(callCommand(wrapInBlockquoteCommand.key));
          break;
        case "code-block":
          editor.action(callCommand(createCodeBlockCommand.key));
          break;
        case "table":
          editor.action(callCommand(insertTableCommand.key, { row: 3, col: 3 }));
          break;
        case "horizontal-rule":
          editor.action(callCommand(insertHrCommand.key));
          break;
      }
      view.focus();
      setContextMenu(null);
    },
    [contextMenu, onInsertLink],
  );

  const editorContextGroups = editorContextMenuGroups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({
      id: `wysiwyg-${item.action}`,
      label: item.label,
      shortcut: item.shortcut,
      disabled:
        item.disabled ||
        (item.action === "undo" && !canUndo) ||
        (item.action === "redo" && !canRedo) ||
        ((item.action === "cut" || item.action === "copy") && !contextMenu?.hasSelection) ||
        (item.action === "find-selection" && !contextMenu?.hasSelection) ||
        (item.action === "clear-format" && !contextMenu?.hasSelection),
      onSelect: () => applyContextAction(item.action),
    })),
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (loading || !container) return;

    // The tracker instance is created once per component lifetime, so a local
    // copy inside the effect stays valid for the cleanup below.
    const sourceSync = sourceSyncRef.current;

    const editor = getRef.current();
    // The Milkdown Editor instance does not expose `.view`; the ProseMirror
    // EditorView lives in the ctx. Reading `editor.view` (as this used to do)
    // silently yields undefined, which disabled the whole completion overlay.
    viewRef.current = editor ? (editor.ctx.get(editorViewCtx) as unknown as EditorViewInstance) : null;
    serializerRef.current = editor ? (editor.ctx.get(serializerCtx) as unknown as SerializerInstance) : null;
    if (viewRef.current && serializerRef.current && lastSyncedMarkdownRef.current === null) {
      lastSyncedMarkdownRef.current = serializerRef.current(viewRef.current.state.doc);
    }

    const closeCompletion = () => {
      completionRef.current = null;
      setCompletion(null);
    };

    const updateCompletion = () => {
      const view = viewRef.current;
      if (!view) return;

      const slashTrigger = readCaretSlashTrigger(view);
      const wikiTrigger = slashTrigger ? null : readCaretWikiTrigger(view);
      const trigger = slashTrigger ?? wikiTrigger;

      if (!trigger) {
        closeCompletion();
        return;
      }

      const items =
        trigger.kind === "slash"
          ? filterSlashCommands(slashCommands, trigger.query)
          : filterWikiLinkCandidates(wikiCandidatesRef.current, trigger.query);

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

      const next: CompletionOverlayState = {
        ...trigger,
        items,
        activeIndex: 0,
        top,
        left,
      };
      completionRef.current = next;
      setCompletion(next);
    };

    let desktopE2eInsertText: ((value: string) => void) | null = null;
    if (__MOYANG_DESKTOP_E2E__) {
      desktopE2eInsertText = (value) => {
        const view = viewRef.current as unknown as DesktopE2eEditorView | null;
        if (!view) return;

        const end = view.state.doc.content.size;
        const selection = view.state.selection.constructor.near(view.state.doc.resolve(end));
        view.dispatch(view.state.tr.setSelection(selection).insertText(value));
        updateCompletion();
      };
      window.__moyangDesktopE2e = {
        ...window.__moyangDesktopE2e,
        insertWysiwygText: desktopE2eInsertText,
      };
    }

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

      applyCompletionItem(current.items[current.activeIndex]);
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

      // Milkdown cancels its debounced markdownUpdated on destroy, so edits
      // from the last 200ms would be lost when the editor unmounts (e.g. a
      // quick mode switch). Serialize the live doc and flush what the app
      // state has not received yet. The view state and serializer stay usable
      // even while teardown is already in progress.
      const view = viewRef.current;
      const serializer = serializerRef.current;
      if (view && serializer) {
        const markdown = serializer(view.state.doc);
        if (markdown !== lastSyncedMarkdownRef.current) {
          sourceSync.markEditorSource(markdown);
          lastSyncedMarkdownRef.current = markdown;
          onChangeRef.current(markdown);
        }
      }
      if (desktopE2eInsertText && window.__moyangDesktopE2e?.insertWysiwygText === desktopE2eInsertText) {
        delete window.__moyangDesktopE2e.insertWysiwygText;
      }
      viewRef.current = null;
    };
  }, [applyCompletionItem, loading]);

  return (
    <div
      ref={containerRef}
      className={`wysiwyg-editor${loading ? " is-loading" : ""}`}
      aria-busy={loading}
      onContextMenu={(event: MouseEvent<HTMLDivElement>) => {
        if (loading || mountFailed) return;
        event.preventDefault();
        completionRef.current = null;
        setCompletion(null);
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          hasSelection: Boolean(window.getSelection()?.toString().trim()),
        });
      }}
      onKeyDown={(event) => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
        event.preventDefault();
        onInsertLink();
      }}
    >
      {loading && <div className="wysiwyg-loading">正在准备所见即所得编辑器…</div>}
      {mountFailed && (
        <div className="wysiwyg-error" role="alert">
          所见即所得编辑器初始化失败，内容未被修改。请切换到“源文本”模式继续编辑。
        </div>
      )}
      <Milkdown />
      {completion && (
        <div
          className="completion-overlay"
          role="listbox"
          aria-label={completion.kind === "slash" ? "块级命令候选" : "双链补全候选"}
          style={{ top: completion.top, left: completion.left }}
        >
          {completion.items.map((item, index) => (
            <button
              key={"id" in item ? `slash-${item.id}` : `wiki-${item.value}-${item.detail ?? ""}`}
              type="button"
              role="option"
              aria-selected={index === completion.activeIndex}
              className={index === completion.activeIndex ? "is-active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyCompletionItem(item)}
            >
              <span className="completion-overlay-label">{item.label}</span>
              {item.detail && <span className="completion-overlay-detail">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}
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

export function MarkdownWysiwygEditor(props: MarkdownWysiwygEditorProps) {
  return (
    <MilkdownProvider key={props.documentKey}>
      <MilkdownSurface {...props} />
    </MilkdownProvider>
  );
}
