import { matchSlashTrigger, type SlashTrigger } from "./slash-command-menu";
import { matchWikiLinkTrigger, type WikiLinkTrigger } from "./wiki-link-completion";

type CompletionParent = {
  type?: { name?: string };
  textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
};

export type CompletionEditorView = {
  state: {
    selection: {
      empty: boolean;
      $from: {
        pos: number;
        parentOffset: number;
        parent: CompletionParent;
      };
    };
  };
};

export type CompletionOverlayKind = "wiki" | "slash";

export type EditorCompletionTrigger = {
  kind: CompletionOverlayKind;
  query: string;
  from: number;
  caret: number;
};

/**
 * Read a WikiLink trigger from the current text block without touching editor
 * state. Keeping this boundary pure makes code blocks, selections and the
 * 128-character look-behind limit easy to regression-test.
 */
export function readCaretWikiTrigger(view: CompletionEditorView): EditorCompletionTrigger | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  const parentName = $from.parent.type?.name ?? "";
  if (parentName.includes("code")) return null;

  const parentOffset = $from.parentOffset;
  if (parentOffset <= 0) return null;

  const start = Math.max(0, parentOffset - 128);
  const textBefore = $from.parent.textBetween(start, parentOffset, undefined, "\ufffc");
  const trigger: WikiLinkTrigger | null = matchWikiLinkTrigger(textBefore);
  if (!trigger) return null;

  const absoluteStart = $from.pos - parentOffset + start;
  const bracketStart = absoluteStart + textBefore.length - trigger.query.length - 2;
  if (bracketStart < $from.pos - parentOffset) return null;

  return { kind: "wiki", query: trigger.query, from: bracketStart, caret: $from.pos };
}

/** Read a block-start `/query` trigger without changing the editor document. */
export function readCaretSlashTrigger(view: CompletionEditorView): EditorCompletionTrigger | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  const parentName = $from.parent.type?.name ?? "";
  if (parentName.includes("code")) return null;

  const parentOffset = $from.parentOffset;
  if (parentOffset <= 0) return null;

  const textBefore = $from.parent.textBetween(0, parentOffset, undefined, "\ufffc");
  const trigger: SlashTrigger | null = matchSlashTrigger(textBefore);
  if (!trigger) return null;

  return { kind: "slash", query: trigger.query, from: $from.pos - parentOffset, caret: $from.pos };
}

/**
 * Flush a serialized editor value exactly once when an editor is torn down.
 * Milkdown cancels its delayed listener callback during destroy, so callers
 * use the returned marker to keep the app-level source baseline aligned.
 */
export function flushEditorMarkdownChange(
  markdown: string,
  lastSyncedMarkdown: string | null,
  markEditorSource: (source: string) => void,
  onChange: (source: string) => void,
): string {
  if (markdown === lastSyncedMarkdown) return lastSyncedMarkdown ?? markdown;

  markEditorSource(markdown);
  onChange(markdown);
  return markdown;
}
