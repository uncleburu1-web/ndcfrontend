/**
 * "Reference: 9f2c1a7e" with a Copy button (spec 15 §15.4). Shown on server, timeout and network errors so support can
 * find the request's log line. `splitReference` lets the Banner turn any error message ending in a reference into this.
 */
import { useState } from "react";

const REF = /\s*Reference: ([0-9A-Za-z_-]{6,64})\.?\s*$/;

export function splitReference(text: string): [string, string] | null {
  const m = REF.exec(text);
  return m ? [text.slice(0, m.index), m[1]] : null;
}

export function ErrorReference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the reference is on screen to copy by hand */
    }
  };
  return (
    <span className="ds-ref">
      Reference: <code className="ds-ref__code">{reference}</code>{" "}
      <button type="button" className="ds-ref__copy" onClick={() => void copy()} aria-label={`Copy reference ${reference}`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
