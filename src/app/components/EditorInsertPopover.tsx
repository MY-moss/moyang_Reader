import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  buildMarkdownImage,
  buildMarkdownLink,
  buildMarkdownWikiLink,
  normalizeTableDimension,
  type EditorInsertKind,
  type EditorInsertRequest,
} from "../editor-insertion";
import {
  calculateEditorInsertPosition,
  type EditorInsertAnchor,
  type EditorInsertPosition,
} from "../editor-insert-position";

export type EditorInsertInitialValues = {
  label?: string;
  href?: string;
  title?: string;
  target?: string;
  alias?: string;
  src?: string;
  alt?: string;
  rows?: number;
  columns?: number;
};

type EditorInsertForm = {
  label: string;
  href: string;
  title: string;
  target: string;
  alias: string;
  src: string;
  alt: string;
  rows: string;
  columns: string;
};

type EditorInsertPopoverProps = {
  open: boolean;
  kind: EditorInsertKind;
  initialValues?: EditorInsertInitialValues;
  anchor?: EditorInsertAnchor | null;
  scrollContainerRef?: { readonly current: HTMLElement | null };
  onCancel: () => void;
  onSubmit: (request: EditorInsertRequest) => void;
};

const tabs: readonly { kind: EditorInsertKind; label: string }[] = [
  { kind: "link", label: "链接" },
  { kind: "wikilink", label: "双链" },
  { kind: "image", label: "图片" },
  { kind: "table", label: "表格" },
];

function createForm(initialValues: EditorInsertInitialValues | undefined): EditorInsertForm {
  return {
    label: initialValues?.label ?? "",
    href: initialValues?.href ?? "",
    title: initialValues?.title ?? "",
    target: initialValues?.target ?? "",
    alias: initialValues?.alias ?? "",
    src: initialValues?.src ?? "",
    alt: initialValues?.alt ?? "",
    rows: String(initialValues?.rows ?? 3),
    columns: String(initialValues?.columns ?? 3),
  };
}

function invalidMessage(kind: EditorInsertKind): string {
  switch (kind) {
    case "link":
      return "请填写链接文字和地址。";
    case "wikilink":
      return "请填写要连接的笔记名称。";
    case "image":
      return "请填写图片路径或 URL。";
    case "table":
      return "表格至少需要 2 行和 2 列。";
  }
}

function focusWithoutScroll(element: HTMLElement | null): void {
  if (!element) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function EditorInsertPopover({
  open,
  kind,
  initialValues,
  anchor,
  scrollContainerRef,
  onCancel,
  onSubmit,
}: EditorInsertPopoverProps) {
  const popoverRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [activeKind, setActiveKind] = useState<EditorInsertKind>(kind);
  const [form, setForm] = useState<EditorInsertForm>(() => createForm(initialValues));
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<EditorInsertPosition>({ left: 12, top: 12 });
  const anchorLeft = anchor?.left;
  const anchorTop = anchor?.top;
  const anchorBottom = anchor?.bottom;
  const initialLabel = initialValues?.label ?? "";
  const initialHref = initialValues?.href ?? "";
  const initialTitle = initialValues?.title ?? "";
  const initialTarget = initialValues?.target ?? "";
  const initialAlias = initialValues?.alias ?? "";
  const initialSrc = initialValues?.src ?? "";
  const initialAlt = initialValues?.alt ?? "";
  const initialRows = initialValues?.rows ?? 3;
  const initialColumns = initialValues?.columns ?? 3;

  useEffect(() => {
    if (!open) return;
    setActiveKind(kind);
    setForm(
      createForm({
        label: initialLabel,
        href: initialHref,
        title: initialTitle,
        target: initialTarget,
        alias: initialAlias,
        src: initialSrc,
        alt: initialAlt,
        rows: initialRows,
        columns: initialColumns,
      }),
    );
    setError(null);
  }, [
    open,
    kind,
    initialAlias,
    initialAlt,
    initialColumns,
    initialHref,
    initialLabel,
    initialRows,
    initialSrc,
    initialTarget,
    initialTitle,
  ]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => focusWithoutScroll(firstInputRef.current), 0);
    return () => window.clearTimeout(timer);
  }, [activeKind, open]);

  const reposition = useCallback(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const rect = popover.getBoundingClientRect();
    setPosition(
      calculateEditorInsertPosition(
        anchorLeft === undefined || anchorTop === undefined || anchorBottom === undefined
          ? null
          : { left: anchorLeft, top: anchorTop, bottom: anchorBottom },
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      ),
    );
  }, [anchorBottom, anchorLeft, anchorTop]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [activeKind, open, reposition]);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => reposition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const owner = scrollContainerRef?.current;
    const target: Document | HTMLElement = owner?.closest<HTMLElement>(".content-area") ?? owner ?? document;
    const handleScroll = () => onCancel();
    const options: AddEventListenerOptions = { capture: target === document, passive: true };
    target.addEventListener("scroll", handleScroll, options);
    return () => target.removeEventListener("scroll", handleScroll, options);
  }, [onCancel, open, scrollContainerRef]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target)) onCancel();
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [onCancel, open]);

  if (!open) return null;

  const update = (field: keyof EditorInsertForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let request: EditorInsertRequest | null = null;
    switch (activeKind) {
      case "link":
        if (buildMarkdownLink(form.label, form.href, form.title)) {
          request = { kind: "link", label: form.label, href: form.href, title: form.title || undefined };
        }
        break;
      case "wikilink":
        if (buildMarkdownWikiLink(form.target, form.alias)) {
          request = { kind: "wikilink", target: form.target, alias: form.alias || undefined };
        }
        break;
      case "image":
        if (buildMarkdownImage(form.src, form.alt, form.title)) {
          request = { kind: "image", src: form.src, alt: form.alt, title: form.title || undefined };
        }
        break;
      case "table":
        request = {
          kind: "table",
          rows: normalizeTableDimension(form.rows),
          columns: normalizeTableDimension(form.columns),
        };
        break;
    }

    if (!request) {
      setError(invalidMessage(activeKind));
      firstInputRef.current?.focus();
      return;
    }

    onSubmit(request);
  };

  const popover = (
    <section
      ref={popoverRef}
      className="editor-insert-popover is-floating"
      style={{ left: position.left, top: position.top }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="editor-insert-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="editor-insert-header">
        <div>
          <span className="editor-insert-eyebrow">INSERT</span>
          <h2 id="editor-insert-title">插入内容</h2>
        </div>
        <button type="button" className="editor-insert-close" aria-label="关闭插入面板" onClick={onCancel}>
          ×
        </button>
      </div>

      <div className="editor-insert-tabs" role="tablist" aria-label="插入类型">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={activeKind === tab.kind}
            className={activeKind === tab.kind ? "is-active" : undefined}
            onClick={() => {
              setActiveKind(tab.kind);
              setError(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {activeKind === "link" && (
          <div className="editor-insert-fields">
            <label className="editor-insert-field">
              <span>链接文字</span>
              <input ref={firstInputRef} value={form.label} onChange={update("label")} placeholder="例如：项目主页" />
            </label>
            <label className="editor-insert-field">
              <span>地址</span>
              <input value={form.href} onChange={update("href")} placeholder="https://example.com 或相对路径" />
            </label>
            <label className="editor-insert-field">
              <span>
                提示文字 <em>可选</em>
              </span>
              <input value={form.title} onChange={update("title")} placeholder="悬停时显示的说明" />
            </label>
          </div>
        )}

        {activeKind === "wikilink" && (
          <div className="editor-insert-fields">
            <label className="editor-insert-field">
              <span>目标笔记</span>
              <input ref={firstInputRef} value={form.target} onChange={update("target")} placeholder="例如：项目计划" />
            </label>
            <label className="editor-insert-field">
              <span>
                显示别名 <em>可选</em>
              </span>
              <input value={form.alias} onChange={update("alias")} placeholder="留空则显示笔记名称" />
            </label>
            <p className="editor-insert-hint">将生成 Obsidian 兼容的双链，例如：[[项目计划|查看计划]]</p>
          </div>
        )}

        {activeKind === "image" && (
          <div className="editor-insert-fields">
            <label className="editor-insert-field">
              <span>图片路径或 URL</span>
              <input
                ref={firstInputRef}
                value={form.src}
                onChange={update("src")}
                placeholder="相对路径、绝对路径或 https://…"
              />
            </label>
            <label className="editor-insert-field">
              <span>
                替代文字 <em>可选</em>
              </span>
              <input value={form.alt} onChange={update("alt")} placeholder="帮助读者理解图片内容" />
            </label>
            <label className="editor-insert-field">
              <span>
                提示文字 <em>可选</em>
              </span>
              <input value={form.title} onChange={update("title")} placeholder="悬停时显示的说明" />
            </label>
          </div>
        )}

        {activeKind === "table" && (
          <div className="editor-insert-fields editor-insert-table-fields">
            <div className="editor-insert-number-row">
              <label className="editor-insert-field">
                <span>行数</span>
                <input ref={firstInputRef} type="number" min={2} max={8} value={form.rows} onChange={update("rows")} />
              </label>
              <label className="editor-insert-field">
                <span>列数</span>
                <input type="number" min={2} max={8} value={form.columns} onChange={update("columns")} />
              </label>
            </div>
            <p className="editor-insert-hint">首行为表头，插入后可直接按 Tab 在单元格之间移动。</p>
          </div>
        )}

        {error && (
          <p className="editor-insert-error" role="alert">
            {error}
          </p>
        )}

        <div className="editor-insert-actions">
          <button type="button" className="editor-insert-cancel" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="editor-insert-submit">
            插入到正文
          </button>
        </div>
      </form>
    </section>
  );

  if (typeof document !== "undefined" && document.body) return createPortal(popover, document.body);
  return popover;
}
