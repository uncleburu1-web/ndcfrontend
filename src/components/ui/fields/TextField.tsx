/**
 * Text, email and phone inputs — spec §6.8. Phone shows a "+234" hint by default.
 */
import type { InputHTMLAttributes } from "react";
import { Field, type FieldFrameProps } from "./Field";
import { t } from "../../../i18n";

type InputType = "text" | "email" | "tel" | "number" | "datetime-local";  // number, datetime-local: spec 18 event editor

interface TextFieldProps extends FieldFrameProps, Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  type?: InputType;
}

const DEFAULTS: Record<InputType, Partial<InputHTMLAttributes<HTMLInputElement>>> = {
  text: {},
  email: { autoComplete: "email", inputMode: "email" },
  tel: { autoComplete: "tel", inputMode: "tel", placeholder: "0803 123 4567" },
  number: { inputMode: "numeric" },
  "datetime-local": {},
};

export function TextField({ label, hint, error, required, type = "text", ...input }: TextFieldProps) {
  const finalHint = hint ?? (type === "tel" ? t("ui.nigerian-number-234-is-added-for") : undefined);
  return (
    <Field label={label} hint={finalHint} error={error} required={required}>
      {({ id, describedBy, invalid }) =>
        type === "tel" ? (
          <div className="ds-input-group">
            <span className="ds-input-group__prefix" aria-hidden="true">
              +234
            </span>
            <input
              id={id}
              type="tel"
              className="ds-input ds-input--prefixed"
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              required={required}
              {...DEFAULTS.tel}
              {...input}
            />
          </div>
        ) : (
          <input
            id={id}
            type={type}
            className="ds-input"
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            required={required}
            {...DEFAULTS[type]}
            {...input}
          />
        )
      }
    </Field>
  );
}
