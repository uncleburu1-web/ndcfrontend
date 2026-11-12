/**
 * The shared consent dialog (spec 14 §4.2, §8.1). Driven by the API client: any `consent_required` answer opens it;
 * Agree records the consent (current version) and the original request is retried; Not now changes nothing.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { BottomSheet, Button } from "../components/ui";

export interface ConsentAsk {
  purpose: string;
  version: number;
  label: string;
  text: string;
}

interface Props {
  ask: ConsentAsk | null;
  onAgree: () => Promise<void>;
  onDecline: () => void;
}

const ANCHOR: Record<string, string> = { political_following: "follows", membership: "membership", pvc_check: "pvc", verified_badge: "pvc",
  community_membership: "communities", event_registration: "events", volunteering: "volunteering" };

export function ConsentDialog({ ask, onAgree, onDecline }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const agree = async () => {
    setBusy(true);
    setError("");
    try {
      await onAgree();
    } catch {
      setError("We couldn't record that. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open={ask !== null}
      onClose={onDecline}
      title={ask?.label ?? ""}
      footer={
        <div className="consent-dialog__actions">
          <Button onClick={agree} loading={busy}>Agree</Button>
          <Button variant="ghost" onClick={onDecline} disabled={busy}>Not now</Button>
        </div>
      }
    >
      <p className="consent-dialog__text">{ask?.text}</p>
      <p className="consent-dialog__meta">
        Consent version {ask?.version}. You can withdraw it at any time from <Link to="/settings/privacy/data" onClick={onDecline}>Your data</Link>.
        {" "}
        <Link to={`/privacy#${ANCHOR[ask?.purpose ?? ""] ?? ""}`} onClick={onDecline}>How we use this</Link>
      </p>
      {error && <p className="consent-dialog__error" role="alert">{error}</p>}
    </BottomSheet>
  );
}
