import { useEffect, useRef, type RefObject } from "react";

type ModalBehaviorOptions = {
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  backgroundRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (
      element.getAttribute("aria-hidden") === "true" ||
      element.hasAttribute("disabled") ||
      element.closest("[hidden], [inert]")
    )
      return false;
    const collapsed = element.closest("details:not([open])");
    return !collapsed || collapsed.querySelector(":scope > summary") === element;
  });
}

/**
 * Keeps every application modal consistent: initial focus, Escape close,
 * keyboard focus containment, and focus restoration after unmount.
 */
export function useModalBehavior({
  containerRef,
  initialFocusRef,
  backgroundRef,
  restoreFocusRef,
  enabled = true,
  onClose,
}: ModalBehaviorOptions): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modalContainer = containerRef.current;
    const background = backgroundRef?.current;
    const wasInert = background?.hasAttribute("inert") ?? false;
    const initialFocus = initialFocusRef?.current ?? modalContainer;
    initialFocus?.focus();
    background?.setAttribute("inert", "");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const activeElement = document.activeElement;
      const activeIndex = focusableElements.indexOf(activeElement as HTMLElement);
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? focusableElements.at(-1) : focusableElements[0])?.focus();
        return;
      }

      if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        focusableElements.at(-1)?.focus();
      } else if (!event.shiftKey && activeIndex === focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      background?.toggleAttribute("inert", wasInert);
      const target =
        previousFocus?.isConnected && previousFocus !== document.body ? previousFocus : restoreFocusRef?.current;
      if (target?.isConnected && !modalContainer?.contains(target)) {
        target.focus();
      }
    };
  }, [containerRef, initialFocusRef, backgroundRef, restoreFocusRef, enabled]);
}
