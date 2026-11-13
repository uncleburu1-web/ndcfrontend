/** /donate/receipt/:reference — printable receipt (spec 05 §4.3, FR-043). Shows the real status. */
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, StatusBadge } from "../../components/ui";
import { designationText, formatKobo } from "../../donations/money";
import type { DonationReceipt } from "../../donations/types";
import { formatDate } from "../../lib/format";
import "./donate.css";
import { t } from "../../i18n";

const CHANNELS: Record<string, string> = { card: "Card", bank: "Bank", ussd: "USSD", bank_transfer: "Bank transfer" };

export default function ReceiptPage() {
  const { reference = "" } = useParams();
  const api = useApi();
  const { data: d, error, loading } = useRequest(`receipt:${reference}`, (signal) =>
    api<DonationReceipt>(`/donations/${encodeURIComponent(reference)}/`, { anonymous: true, signal })
  );
  useEffect(() => {
    document.title = t("donate.donation-receipt-ndcconnect");
  }, []);

  if (error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title={t("donate.receipt-not-found")}>{t("donate.check-the-link-and-try-again")}</EmptyState>
      </div>
    );
  }
  if (error) return <div className="page-shell"><Banner tone="error" title={t("donate.we-couldn-t-load-this-receipt")}>{error.message}</Banner></div>;
  if (loading || !d) {
    return (
      <div className="receipt" aria-busy="true">
        <span className="visually-hidden">{t("donate.loading-receipt")}</span>
        <Skeleton width="50%" height={28} />
      </div>
    );
  }

  const confirmed = d.status === "successful" || d.status === "refunded";
  return (
    <article className="receipt">
      <header className="receipt__head">
        <p className="receipt__brand">{t("donate.ndcconnect-nigeria-democratic-congress")}</p>
        <h1>{confirmed ? t("donate.donation-receipt") : t("donate.donation-awaiting-confirmation")}</h1>
        <StatusBadge set="donation" status={d.status} />
      </header>
      {d.is_demo && (
        <Banner tone="warning" title={t("donate.demo-data-not-a-receipt")}>{t("donate.this-is-a-simulated-donation-for")}</Banner>
      )}
      {!confirmed && (
        <Banner tone={d.status === "failed" || d.status === "abandoned" ? "error" : "warning"}>
          {d.status === "failed" || d.status === "abandoned" ? t("donate.this-payment-didn-t-go-through") : t("donate.this-isn-t-a-receipt-yet")}
        </Banner>
      )}
      <dl className="receipt__rows">
        <div><dt>{t("donate.receipt-number")}</dt><dd>{d.reference}</dd></div>
        <div><dt>{t("donate.date")}</dt><dd>{formatDate(d.paid_at ?? d.created_at, { withTime: true, showZone: true })}</dd></div>
        <div><dt>{t("donate.donor")}</dt><dd>{d.donor_name}</dd></div>
        <div><dt>{t("donate.amount")}</dt><dd>{formatKobo(d.amount_kobo)}</dd></div>
        {d.refunded_kobo > 0 && <div><dt>{t("donate.refunded")}</dt><dd>{formatKobo(d.refunded_kobo)}</dd></div>}
        <div><dt>{t("donate.given-to")}</dt><dd>{designationText(d)}</dd></div>
        {d.channel && <div><dt>{t("donate.paid-by")}</dt><dd>{CHANNELS[d.channel] ?? d.channel}</dd></div>}
        {confirmed && <div><dt>{t("donate.on-the-public-finance-page-as")}</dt><dd>{d.public_label}</dd></div>}
      </dl>
      <p className="receipt__private">{t("donate.keep-this-link-private-it-shows")}</p>
      <div className="receipt__actions">
        <Button variant="secondary" onClick={() => window.print()}>{t("donate.print")}</Button>
      </div>
    </article>
  );
}
