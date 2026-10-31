/**
 * Shared field frame — spec §6.8: visible label, optional hint, inline error tied
 * with aria-describedby, and a required marker written in text (not just "*").
 */
import { useId, type ReactNode } from "react";
import "./fields.css";

export interface FieldFrameProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

interface FieldRenderArgs {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: FieldFrameProps & { children: (args: FieldRenderArgs) => ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`ds-field${error ? " ds-field--invalid" : ""}`}>
      <label className="ds-field__label" htmlFor={id}>
        {label}
        {required && <span className="ds-field__required"> (required)</span>}
      </label>
      {hint && (
        <p id={hintId} className="ds-field__hint">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="ds-field__error">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5M12 16h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
