/**
 * Switch — spec §6.8. A real <button role="switch"> with a visible label.
 */
import { useId, type ReactNode } from "react";
import "./fields.css";

interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

export function Switch({ label, checked, onChange, hint, disabled, icon }: SwitchProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="ds-switch">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hintId}
        disabled={disabled}
        className="ds-switch__control"
        onClick={() => onChange(!checked)}
      >
        <span className="ds-switch__track" aria-hidden="true">
          <span className="ds-switch__thumb" />
        </span>
        {icon && <span className="ds-switch__icon">{icon}</span>}
        <span className="ds-switch__label">{label}</span>
      </button>
      {hint && (
        <p id={hintId} className="ds-field__hint ds-switch__hint">
          {hint}
        </p>
      )}
    </div>
  );
}
