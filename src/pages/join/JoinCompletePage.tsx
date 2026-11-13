/** /join/complete?reference=… — back from the provider (spec 06 §4.2). Reports what the backend verified. */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { formatKobo } from "../../donations/money";
import "./join.css";
import { t } from "../../i18n";

export const POLL_MS = 3000;
export const POLL_LIMIT_MS = 30000;

interface PayStatus {
  reference: string;
  status: string;
  amount_kobo: number;
  membership_status: string;
}

export default function JoinCompletePage() {
  const api = useApi();
  const reference = useSearchParams()[0].get("reference") ?? "";
  const [d, setD] = useState<PayStatus | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const started = useRef(Date.now());

  useEffect(() => {
    document.title = t("join.membership-payment-ndcconnect");
  }, []);
  useEffect(() => {
    if (!reference) return;
    let live = true;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const r = await api<PayStatus>(`/membership/payments/${encodeURIComponent(reference)}/`, { anonymous: true });
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

  if (!reference || error) {
    return <div className="page-shell"><EmptyState title={t("join.we-couldn-t-find-that-payment")} action={<Button href="/join">{t("join.back-to-join-ndc")}</Button>} /></div>;
  }
  if (!d) return <div className="join-result" aria-busy="true"><Skeleton width="60%" height={32} /></div>;

  if (d.status === "successful" && d.membership_status === "active") {
    return (
      <div className="join-result">
        <h1>{t("join.welcome-to-the-ndc")}</h1>
        <p className="join-result__lead">{t("join.your-membership-fee-is-confirmed-and", { formatKobo: formatKobo(d.amount_kobo) })}</p>
        <Button href="/membership/card">{t("join.see-my-membership-card")}</Button>
      </div>
    );
  }
  if (d.status === "successful") {
    return (
      <div className="join-result">
        <h1>{t("join.payment-received")}</h1>
        <p className="join-result__lead">{t("join.your-application-is-with-the-membership")}</p>
        <Button href="/join">{t("join.go-to-my-membership")}</Button>
      </div>
    );
  }
  if (d.status === "failed" || d.status === "abandoned") {
    return (
      <div className="join-result">
        <h1>{t("join.your-payment-didn-t-go-through")}</h1>
        <p className="join-result__lead">{t("join.no-money-was-taken")}</p>
        <Button href="/join">{t("join.try-again")}</Button>
      </div>
    );
  }
  if (d.status === "review") {
    return (
      <div className="join-result">
        <h1>{t("join.we-re-checking-your-payment")}</h1>
        <p className="join-result__lead">{t("join.the-membership-team-is-confirming-it")}</p>
        <Button variant="secondary" href="/join">{t("join.go-to-my-membership")}</Button>
      </div>
    );
  }
  return (
    <div className="join-result" aria-live="polite">
      <h1>{timedOut ? t("join.this-is-taking-longer-than-usual") : t("join.we-re-confirming-your-payment-with")}</h1>
      <p className="join-result__lead">{timedOut ? t("join.we-ll-update-your-membership-as") : t("join.please-don-t-pay-again")}</p>
      <Button variant="secondary" href="/join">{t("join.go-to-my-membership")}</Button>
    </div>
  );
}
