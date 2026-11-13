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
import { t } from "../../i18n";

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
    document.title = t("donate.donation-ndcconnect");
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
        <EmptyState title={t("donate.we-couldn-t-find-that-donation")} action={<Button href="/donate">{t("donate.go-to-donate")}</Button>}>
          {t("donate.check-the-link-from-your-payment")}</EmptyState>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page-shell">
        <Banner tone="error" title={t("donate.we-couldn-t-check-your-donation")}>{error.message}</Banner>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="donate-result" aria-busy="true">
        <span className="visually-hidden">{t("donate.checking-your-payment")}</span>
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
        <h1>{t("donate.thank-you", { first })}</h1>
        <p className="donate-result__lead">
          {t("donate.to", { formatKobo: formatKobo(d.amount_kobo), designationText: designationText(d) })}</p>
        <div className="donate-result__actions">
          <Button href={receipt}>{t("donate.view-receipt")}</Button>
          {d.candidate?.is_public && (
            <Button variant="secondary" href={`/candidates/${d.candidate.slug}`}>
              {t("donate.back-to", { full_name: d.candidate.full_name })}
            </Button>
          )}
        </div>
      </div>
    );
  }
  if (d.status === "failed" || d.status === "abandoned") {
    return (
      <div className="donate-result">
        <h1>{t("donate.your-payment-didn-t-go-through")}</h1>
        <p className="donate-result__lead">{t("donate.no-money-was-taken")}</p>
        <Button href={retry}>{t("donate.try-again")}</Button>
      </div>
    );
  }
  if (d.status === "review") {
    return (
      <div className="donate-result">
        <h1>{t("donate.we-re-checking-your-payment")}</h1>
        <p className="donate-result__lead">{t("donate.our-finance-team-is-confirming-it")}</p>
        <Button variant="secondary" href={receipt}>{t("donate.view-receipt")}</Button>
      </div>
    );
  }
  return (
    <div className="donate-result" aria-live="polite">
      <h1>{timedOut ? t("donate.this-is-taking-longer-than-usual") : t("donate.we-re-confirming-your-payment-with")}</h1>
      <p className="donate-result__lead">
        {timedOut ? t("donate.we-ll-update-your-donation-as") : t("donate.this-usually-takes-a-few-seconds")}
      </p>
      <Button variant="secondary" href={receipt}>{t("donate.view-receipt")}</Button>
    </div>
  );
}
