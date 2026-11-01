/**
 * Masked identifier (VIN, NIN) — spec 06 §8.1. Shows "•••• 4821". With onReveal, a Reveal button
 * fetches the full value through an audited endpoint and hides it again after 30 seconds.
 */
import { useEffect, useState } from "react";
import { Button } from "./Button";
import "./Badge.css";

export const REVEAL_MS = 30_000;

interface Props {
  masked: string;
  label: string;
  onReveal?: () => Promise<string>;
}

export function MaskedValue({ masked, label, onReveal }: Props) {
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (value === null) return;
    const t = window.setTimeout(() => setValue(null), REVEAL_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <span className="ds-masked">
      <span className="ds-masked__value" aria-label={value ? `${label}: ${value}` : `${label}, hidden, ending ${masked.slice(-4)}`}>
        {value ?? (masked || "—")}
      </span>
      {onReveal && masked && (
        value === null ? (
          <Button variant="ghost" size="sm" loading={busy} loadingLabel="Revealing…" onClick={async () => {
            setBusy(true);
            setError("");
            try {
              setValue(await onReveal());
            } catch {
              setError("Couldn't reveal it.");
            } finally {
              setBusy(false);
            }
          }}>
            Reveal {label}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setValue(null)}>Hide</Button>
        )
      )}
      {value && <span className="ds-masked__note">Viewing is recorded. Hides in 30 seconds.</span>}
      {error && <span className="ds-masked__note">{error}</span>}
    </span>
  );
}
