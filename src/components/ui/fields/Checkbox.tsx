import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { FieldError } from "./Field";
import "./fields.css";
import { t } from "../../../i18n";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export function Checkbox({ label, hint, error, required, ...rest }: CheckboxProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={`ds-check${error ? " ds-field--invalid" : ""}`}>
      <input
        id={id}
        type="checkbox"
        className="ds-check__input"
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        required={required}
        {...rest}
      />
      <div>
        <label htmlFor={id} className="ds-check__label">
          {label}
          {required && <span className="ds-field__required"> {t("ui.required")}</span>}
        </label>
        {hint && (
          <p id={hintId} className="ds-field__hint">
            {hint}
          </p>
        )}
        {error && <FieldError id={errorId!}>{error}</FieldError>}
      </div>
    </div>
  );
}
