import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import type { Locale } from "../i18n";
import { editorText } from "../editor-i18n";
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
  locale?: Locale;
  open: boolean;
  kind: EditorInsertKind;
  initialValues?: EditorInsertInitialValues;
  anchor?: EditorInsertAnchor | null;
  scrollContainerRef?: { readonly current: HTMLElement | null };
  onCancel: () => void;
  onSubmit: (request: EditorInsertRequest) => void;
  onPickImage?: () => Promise<string | null>;
};

const tabs: readonly { kind: EditorInsertKind; labelKey: Parameters<typeof editorText>[1] }[] = [
  { kind: "link", labelKey: "link" },
  { kind: "wikilink", labelKey: "wikilink" },
  { kind: "image", labelKey: "image" },
  { kind: "table", labelKey: "table" },
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

function invalidMessage(locale: Locale, kind: EditorInsertKind): string {
  switch (kind) {
    case "link":
      return editorText(locale, "invalidLink");
    case "wikilink":
      return editorText(locale, "invalidWiki");
    case "image":
      return editorText(locale, "invalidImage");
    case "table":
      return editorText(locale, "invalidTable");
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
  locale = "zh-CN",
  open,
  kind,
  initialValues,
  anchor,
  scrollContainerRef,
  onCancel,
  onSubmit,
  onPickImage,
}: EditorInsertPopoverProps) {
  const t = (key: Parameters<typeof editorText>[1]) => editorText(locale, key);
  const popoverRef = useRef<HTMLElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const skipInputFocusRef = useRef(false);
  const [activeKind, setActiveKind] = useState<EditorInsertKind>(kind);
  const [form, setForm] = useState<EditorInsertForm>(() => createForm(initialValues));
  const [error, setError] = useState<string | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [position, setPosition] = useState<EditorInsertPosition>({ left: 12, top: 12 });
  const popoverId = useId().replace(/:/g, "-");
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
    if (!open) {
      skipInputFocusRef.current = false;
      return;
    }
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
    if (skipInputFocusRef.current) {
      skipInputFocusRef.current = false;
      return;
    }
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
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target)) {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
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
      setError(invalidMessage(locale, activeKind));
      firstInputRef.current?.focus();
      return;
    }

    onSubmit(request);
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.kind === activeKind);
    if (currentIndex < 0) return;

    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextKind = tabs[nextIndex]?.kind;
    if (!nextKind) return;
    event.preventDefault();
    skipInputFocusRef.current = true;
    setActiveKind(nextKind);
    setError(null);
    focusWithoutScroll(document.getElementById(`${popoverId}-tab-${nextKind}`));
  };

  const handlePickImage = async () => {
    if (!onPickImage || isPickingImage) return;
    setIsPickingImage(true);
    setError(null);
    try {
      const source = await onPickImage();
      if (!source) return;
      setForm((current) => ({ ...current, src: source }));
      window.setTimeout(() => focusWithoutScroll(firstInputRef.current), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("pickError"));
    } finally {
      setIsPickingImage(false);
    }
  };

  const popover = (
    <section
      ref={popoverRef}
      className="editor-insert-popover is-floating"
      style={{ left: position.left, top: position.top }}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${popoverId}-title`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="editor-insert-header">
        <div>
          <h2 id={`${popoverId}-title`}>{t("insertContent")}</h2>
        </div>
        <button type="button" className="editor-insert-close" aria-label={t("closeInsert")} onClick={onCancel}>
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="editor-insert-tabs" role="tablist" aria-label={t("insertType")} aria-orientation="horizontal">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            id={`${popoverId}-tab-${tab.kind}`}
            type="button"
            role="tab"
            aria-selected={activeKind === tab.kind}
            aria-controls={`${popoverId}-panel`}
            tabIndex={activeKind === tab.kind ? 0 : -1}
            className={activeKind === tab.kind ? "is-active" : undefined}
            onClick={() => {
              skipInputFocusRef.current = false;
              setActiveKind(tab.kind);
              setError(null);
            }}
            onKeyDown={handleTabKeyDown}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div
          id={`${popoverId}-panel`}
          className="editor-insert-tabpanel"
          role="tabpanel"
          aria-labelledby={`${popoverId}-tab-${activeKind}`}
          tabIndex={0}
        >
          {activeKind === "link" && (
            <div className="editor-insert-fields">
              <label className="editor-insert-field">
                <span>{t("linkLabel")}</span>
                <input
                  ref={firstInputRef}
                  value={form.label}
                  onChange={update("label")}
                  placeholder={t("linkLabelPlaceholder")}
                />
              </label>
              <label className="editor-insert-field">
                <span>{t("address")}</span>
                <input value={form.href} onChange={update("href")} placeholder={t("addressPlaceholder")} />
              </label>
              <label className="editor-insert-field">
                <span>
                  {t("title")} <em>{t("optional")}</em>
                </span>
                <input value={form.title} onChange={update("title")} placeholder={t("titlePlaceholder")} />
              </label>
            </div>
          )}

          {activeKind === "wikilink" && (
            <div className="editor-insert-fields">
              <label className="editor-insert-field">
                <span>{t("targetNote")}</span>
                <input
                  ref={firstInputRef}
                  value={form.target}
                  onChange={update("target")}
                  placeholder={t("targetPlaceholder")}
                />
              </label>
              <label className="editor-insert-field">
                <span>
                  {t("alias")} <em>{t("optional")}</em>
                </span>
                <input value={form.alias} onChange={update("alias")} placeholder={t("aliasPlaceholder")} />
              </label>
              <p className="editor-insert-hint">{t("wikiHint")}</p>
            </div>
          )}

          {activeKind === "image" && (
            <div className="editor-insert-fields">
              <div className="editor-insert-image-source-row">
                <label className="editor-insert-field">
                  <span>{t("imageSource")}</span>
                  <input
                    ref={firstInputRef}
                    value={form.src}
                    onChange={update("src")}
                    placeholder={t("imageSourcePlaceholder")}
                  />
                </label>
                <button
                  type="button"
                  className="editor-insert-browse"
                  aria-label={t("browseImage")}
                  title={onPickImage ? t("browseAvailable") : t("browseUnavailable")}
                  disabled={!onPickImage || isPickingImage}
                  onClick={() => void handlePickImage()}
                >
                  {isPickingImage ? t("picking") : t("browse")}
                </button>
              </div>
              <label className="editor-insert-field">
                <span>
                  {t("alt")} <em>{t("optional")}</em>
                </span>
                <input value={form.alt} onChange={update("alt")} placeholder={t("altPlaceholder")} />
              </label>
              <label className="editor-insert-field">
                <span>
                  {t("title")} <em>{t("optional")}</em>
                </span>
                <input value={form.title} onChange={update("title")} placeholder={t("titlePlaceholder")} />
              </label>
              <p className="editor-insert-hint">{t("imageHint")}</p>
            </div>
          )}

          {activeKind === "table" && (
            <div className="editor-insert-fields editor-insert-table-fields">
              <div className="editor-insert-number-row">
                <label className="editor-insert-field">
                  <span>{t("rows")}</span>
                  <input
                    ref={firstInputRef}
                    type="number"
                    min={2}
                    max={8}
                    value={form.rows}
                    onChange={update("rows")}
                  />
                </label>
                <label className="editor-insert-field">
                  <span>{t("columns")}</span>
                  <input type="number" min={2} max={8} value={form.columns} onChange={update("columns")} />
                </label>
              </div>
              <p className="editor-insert-hint">{t("tableHint")}</p>
            </div>
          )}
        </div>

        {error && (
          <p className="editor-insert-error" role="alert">
            {error}
          </p>
        )}

        <div className="editor-insert-actions">
          <button type="button" className="editor-insert-cancel" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button type="submit" className="editor-insert-submit" disabled={isPickingImage}>
            {t("submit")}
          </button>
        </div>
      </form>
    </section>
  );

  if (typeof document !== "undefined" && document.body) return createPortal(popover, document.body);
  return popover;
}
