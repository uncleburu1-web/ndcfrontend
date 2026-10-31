import type { SelectHTMLAttributes } from "react";
import { Field, type FieldFrameProps } from "./Field";

interface SelectProps extends FieldFrameProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, hint, error, required, options, placeholder, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <div className="ds-select">
          <select
            id={id}
            className="ds-input ds-select__control"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg className="ds-select__chevron" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}
    </Field>
  );
}
