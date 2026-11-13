import { useId, type ReactNode } from "react";
import { FieldError } from "./Field";
import "./fields.css";
import { t } from "../../../i18n";

interface RadioGroupProps {
  legend: ReactNode;
  name: string;
  options: { value: string; label: ReactNode; hint?: ReactNode; disabled?: boolean }[];
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
}

export function RadioGroup({ legend, name, options, value, onChange, hint, error, required }: RadioGroupProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      className={`ds-fieldset${error ? " ds-field--invalid" : ""}`}
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="ds-field__label">
        {legend}
        {required && <span className="ds-field__required"> {t("ui.required")}</span>}
      </legend>
      {hint && (
        <p id={hintId} className="ds-field__hint">
          {hint}
        </p>
      )}
      {options.map((o) => {
        const optionId = `${id}-${o.value}`;
        return (
          <div key={o.value} className="ds-check">
            <input
              id={optionId}
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              disabled={o.disabled}
              className="ds-check__input ds-check__input--radio"
              required={required}
            />
            <div>
              <label htmlFor={optionId} className="ds-check__label">
                {o.label}
              </label>
              {o.hint && <p className="ds-field__hint">{o.hint}</p>}
            </div>
          </div>
        );
      })}
      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </fieldset>
  );
}
