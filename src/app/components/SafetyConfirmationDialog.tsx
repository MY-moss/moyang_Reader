import { useRef } from "react";
import type { Locale } from "../i18n";
import { safetyText } from "./safety-dialog-copy";
import { useModalBehavior } from "./useModalBehavior";

type SafetyFact = { label: string; value: string };
type SafetyAction = { label: string; onClick: () => void; testId: string };

type SafetyConfirmationDialogProps = {
  locale: Locale;
  id: string;
  title: string;
  description: string;
  note: string;
  facts?: SafetyFact[];
  confirm: SafetyAction;
  secondary?: SafetyAction;
  onCancel: () => void;
  fallbackFocusTarget?: HTMLElement | null;
};

export function SafetyConfirmationDialog({
  locale,
  id,
  title,
  description,
  note,
  facts = [],
  confirm,
  secondary,
  onCancel,
  fallbackFocusTarget,
}: SafetyConfirmationDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useModalBehavior({
    containerRef: dialogRef,
    initialFocusRef: cancelButtonRef,
    fallbackFocusTarget,
    onClose: onCancel,
  });

  return (
    <div className="quick-open-backdrop close-confirm-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="quick-open-dialog close-confirm-dialog safety-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description ${id}-note`}
        tabIndex={-1}
      >
        <header className="quick-open-header safety-confirm-header">
          <h2 id={`${id}-title`}>{title}</h2>
        </header>
        <div className="close-confirm-body safety-confirm-body">
          <p id={`${id}-description`}>{description}</p>
          {facts.length > 0 && (
            <dl className="safety-confirm-facts">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd title={fact.value}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <p id={`${id}-note`} className="safety-confirm-note">
            {note}
          </p>
        </div>
        <footer className="quick-open-footer close-confirm-actions safety-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="quiet-button"
            data-testid={`${id}-cancel`}
            onClick={onCancel}
          >
            {safetyText(locale, "cancel")}
          </button>
          {secondary && (
            <button
              type="button"
              className="quiet-button safety-confirm-secondary"
              data-testid={secondary.testId}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          )}
          <button
            type="button"
            className="toolbar-button primary"
            data-testid={confirm.testId}
            onClick={confirm.onClick}
          >
            {confirm.label}
          </button>
        </footer>
      </section>
    </div>
  );
}
