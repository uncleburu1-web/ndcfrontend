/**
 * /donate/complete?reference=… — back from the provider (spec 05 §4.2).
 * The backend re-verifies with the provider; this page only reports what it says.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Banner, Button, EmptyState, Skeleton } from "../../components/ui";
import { designationText, formatKobo } from "../../donations/money";
import type { DonationReceipt } from "../../donations/types";
import "./donate.css";

export const POLL_MS = 3000;
export const POLL_LIMIT_MS = 30000;

export default function DonateCompletePage() {
  const api = useApi();
  const reference = useSearchParams()[0].get("reference") ?? "";
  const [d, setD] = useState<DonationReceipt | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    document.title = "Donation | NDCConnect";
  }, []);

  useEffect(() => {
    if (!reference) return;
    let live = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const r = await api<DonationReceipt>(`/donations/${encodeURIComponent(reference)}/`, { anonymous: true });
        if (!live) return;
        setD(r);
        if (r.status === "pending" || r.status === "initiated") {
          if (Date.now() - started.current >= POLL_LIMIT_MS) setTimedOut(true);
          else timer = window.setTimeout(tick, POLL_MS);
        }
      } catch (err) {
        if (live) setError(err instanceof ApiError ? err : new ApiError({}));
      }
    };
    void tick();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [api, reference]);

  if (!reference || error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title="We couldn’t find that donation" action={<Button href="/donate">Go to Donate</Button>}>
          Check the link from your payment, or start again.
        </EmptyState>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-shell">
        <Banner tone="error" title="We couldn’t check your donation">{error.message}</Banner>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="donate-result" aria-busy="true">
        <span className="visually-hidden">Checking your payment</span>
        <Skeleton width="60%" height={32} />
      </div>
    );
  }

  const receipt = `/donate/receipt/${d.reference}`;
  const first = d.donor_name.split(" ")[0];
  const retry = `/donate?${new URLSearchParams({ ...(d.candidate ? { candidate: d.candidate.slug } : {}), amount: String(d.amount_kobo / 100) })}`;

  if (d.status === "successful" || d.status === "refunded") {
    return (
      <div className="donate-result">
        <h1>Thank you, {first}.</h1>
        <p className="donate-result__lead">
          {formatKobo(d.amount_kobo)} to {designationText(d)}.
        </p>
        <div className="donate-result__actions">
          <Button href={receipt}>View receipt</Button>
          {d.candidate?.is_public && (
            <Button variant="secondary" href={`/candidates/${d.candidate.slug}`}>
              Back to {d.candidate.full_name}
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (d.status === "failed" || d.status === "abandoned") {
    return (
      <div className="donate-result">
        <h1>Your payment didn’t go through.</h1>
        <p className="donate-result__lead">No money was taken.</p>
        <Button href={retry}>Try again</Button>
      </div>
    );
  }
  if (d.status === "review") {
    return (
      <div className="donate-result">
        <h1>We’re checking your payment.</h1>
        <p className="donate-result__lead">Our finance team is confirming it with the bank. Your receipt will update once it’s confirmed.</p>
        <Button variant="secondary" href={receipt}>View receipt</Button>
      </div>
    );
  }
  return (
    <div className="donate-result" aria-live="polite">
      <h1>{timedOut ? "This is taking longer than usual." : "We’re confirming your payment with the bank…"}</h1>
      <p className="donate-result__lead">
        {timedOut
          ? "We’ll update your donation as soon as the bank confirms. You can close this page."
          : "This usually takes a few seconds. Please don’t pay again."}
      </p>
      <Button variant="secondary" href={receipt}>View receipt</Button>
    </div>
  );
}
