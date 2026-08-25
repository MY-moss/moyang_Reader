import { useEffect, useRef } from "react";
import { defaultValueCtx, Editor, rootCtx } from "@milkdown/kit/core";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { gfm } from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";

type MarkdownWysiwygEditorProps = {
  source: string;
  documentKey: string;
  ariaLabel: string;
  onChange: (markdown: string) => void;
  onInsertLink: () => void;
};

function MilkdownSurface({ source, documentKey, ariaLabel, onChange, onInsertLink }: MarkdownWysiwygEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const { loading } = useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, source);
        })
        .use(gfm)
        .use(listener)
        .config((ctx) => {
          ctx.get(listenerCtx).markdownUpdated((_context, markdown) => onChangeRef.current(markdown));
        }),
    [documentKey],
  );

  useEffect(() => {
    if (loading || !containerRef.current) return;
    const editable = containerRef.current.querySelector<HTMLElement>('[contenteditable="true"]');
    editable?.setAttribute("aria-label", ariaLabel);
    editable?.setAttribute("aria-multiline", "true");
  }, [ariaLabel, loading]);

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
