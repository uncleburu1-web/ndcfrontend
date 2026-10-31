import type { TextareaHTMLAttributes } from "react";
import { Field, type FieldFrameProps } from "./Field";

type TextAreaProps = FieldFrameProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">;

export function TextArea({ label, hint, error, required, rows = 4, ...rest }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          className="ds-input ds-textarea"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          {...rest}
        />
      )}
    </Field>
  );
}
