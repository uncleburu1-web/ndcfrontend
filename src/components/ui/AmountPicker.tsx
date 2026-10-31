/**
 * Amount picker — spec §6.9.
 * Preset chips (values supplied by the donation spec — none are hardcoded here) plus a
 * custom amount input with live ₦ grouping. Min/max messages come from the backend's
 * compliance limits and are passed in via `error`; this component never invents limits.
 */
import { useId, useState } from "react";
import { formatNaira, groupDigits, parseNaira } from "../../lib/format";
import { FieldError } from "./fields/Field";
import "./AmountPicker.css";
import "./fields/fields.css";

interface AmountPickerProps {
  label?: string;
  presets: number[];
  value: number | null;
  onChange: (amount: number | null) => void;
  /** Message from the backend (e.g. compliance min/max). */
  error?: string;
  hint?: string;
}

export function AmountPicker({ label = "Amount", presets, value, onChange, error, hint }: AmountPickerProps) {
  const id = useId();
  const customId = `${id}-custom`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const isPreset = value !== null && presets.includes(value);
  const [custom, setCustom] = useState(() => (value !== null && !isPreset ? groupDigits(String(value)) : ""));

  const pickPreset = (amount: number) => {
    setCustom("");
    onChange(amount);
  };

  const typeCustom = (raw: string) => {
    const grouped = groupDigits(raw);
    setCustom(grouped);
    onChange(parseNaira(grouped));
  };

  return (
    <fieldset className={`ds-fieldset ds-amount${error ? " ds-field--invalid" : ""}`} aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}>
      <legend className="ds-field__label">{label}</legend>
      {hint && (
        <p id={hintId} className="ds-field__hint">
          {hint}
        </p>
      )}

      <div className="ds-amount__chips" role="group" aria-label="Suggested amounts">
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            className="ds-amount__chip"
            aria-pressed={value === amount && custom === ""}
            onClick={() => pickPreset(amount)}
          >
            {formatNaira(amount)}
          </button>
        ))}
      </div>

      <label className="ds-field__label ds-amount__custom-label" htmlFor={customId}>
        Or enter another amount
      </label>
      <div className="ds-input-group">
        <span className="ds-input-group__prefix" aria-hidden="true">
          ₦
        </span>
        <input
          id={customId}
          className="ds-input ds-input--prefixed"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={custom}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          onChange={(e) => typeCustom(e.target.value)}
        />
      </div>

      {error && <FieldError id={errorId!}>{error}</FieldError>}
    </fieldset>
  );
}
