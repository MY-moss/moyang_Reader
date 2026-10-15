import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";

/**
 * Plugin list shared by the WYSIWYG editor and its regression tests.
 *
 * The commonmark preset must be registered explicitly: since
 * @milkdown/preset-gfm 7.22.x the gfm preset only ships the GFM extensions
 * (tables, footnotes, strikethrough, task lists). Without commonmark the
 * ProseMirror schema is missing its `doc` top node and editor creation fails
 * with "Schema is missing its top node type ('doc')", leaving the editing
 * surface blank.
 */
export function buildWysiwygEditorPlugins() {
  return [commonmark, gfm].flat();
}
