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

const CHANNELS: Record<string, string> = { card: "Card", bank: "Bank", ussd: "USSD", bank_transfer: "Bank transfer" };

export default function ReceiptPage() {
  const { reference = "" } = useParams();
  const api = useApi();
  const { data: d, error, loading } = useRequest(`receipt:${reference}`, (signal) =>
    api<DonationReceipt>(`/donations/${encodeURIComponent(reference)}/`, { anonymous: true, signal })
  );
  useEffect(() => {
    document.title = "Donation receipt | NDCConnect";
  }, []);

  if (error?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title="Receipt not found">Check the link and try again.</EmptyState>
      </div>
    );
  }
  if (error) return <div className="page-shell"><Banner tone="error" title="We couldn’t load this receipt">{error.message}</Banner></div>;
  if (loading || !d) {
    return (
      <div className="receipt" aria-busy="true">
        <span className="visually-hidden">Loading receipt</span>
        <Skeleton width="50%" height={28} />
      </div>
    );
  }

  const confirmed = d.status === "successful" || d.status === "refunded";
  return (
    <article className="receipt">
      <header className="receipt__head">
        <p className="receipt__brand">NDCConnect · Nigeria Democratic Congress</p>
        <h1>{confirmed ? "Donation receipt" : "Donation (awaiting confirmation)"}</h1>
        <StatusBadge set="donation" status={d.status} />
      </header>
      {!confirmed && (
        <Banner tone={d.status === "failed" || d.status === "abandoned" ? "error" : "warning"}>
          {d.status === "failed" || d.status === "abandoned"
            ? "This payment didn’t go through, so this isn’t a receipt. No money was taken."
            : "This isn’t a receipt yet. It becomes one when the bank confirms the payment."}
        </Banner>
      )}
      <dl className="receipt__rows">
        <div><dt>Receipt number</dt><dd>{d.reference}</dd></div>
        <div><dt>Date</dt><dd>{formatDate(d.paid_at ?? d.created_at, { withTime: true, showZone: true })}</dd></div>
        <div><dt>Donor</dt><dd>{d.donor_name}</dd></div>
        <div><dt>Amount</dt><dd>{formatKobo(d.amount_kobo)}</dd></div>
        {d.refunded_kobo > 0 && <div><dt>Refunded</dt><dd>{formatKobo(d.refunded_kobo)}</dd></div>}
        <div><dt>Given to</dt><dd>{designationText(d)}</dd></div>
        {d.channel && <div><dt>Paid by</dt><dd>{CHANNELS[d.channel] ?? d.channel}</dd></div>}
        {confirmed && <div><dt>On the public Finance page as</dt><dd>{d.public_label}</dd></div>}
      </dl>
      <p className="receipt__private">Keep this link private; it shows your name.</p>
      <div className="receipt__actions">
        <Button variant="secondary" onClick={() => window.print()}>Print</Button>
      </div>
    </article>
  );
}
