/** /admin/donations/:id — full record, history and provider re-check (spec 05 §4.6). No manual "successful". */
import { DemoBadge } from "../../../donations/DemoBadge";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, StatusBadge, useToast } from "../../../components/ui";
import { designationText, formatKobo } from "../../../donations/money";
import type { AdminDonation } from "../../../donations/types";
import { formatDate } from "../../../lib/format";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "./admin-donations.css";

const REASONS: Record<string, string> = {
  amount_or_currency_mismatch: "The provider reported a different amount or currency.",
  over_limit: "This payment takes the donor over the legal limit. Refund the excess in the provider dashboard.",
};

export default function AdminDonationDetailPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const loaded = useRequest(`admin-donation:${id}`, (signal) => api<AdminDonation>(`/admin/donations/${id}/`, { signal }));
  const [d, setD] = useState<AdminDonation | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(loaded.data), [loaded.data]);
  useEffect(() => {
    document.title = "Donation | NDCConnect admin";
  }, []);

  const recheck = async () => {
    setBusy(true);
    try {
      const updated = await api<AdminDonation>(`/admin/donations/${id}/recheck/`, { method: "POST" });
      setD(updated);
      toast.show({ tone: "success", message: `Checked with the provider: ${updated.status_label}.` });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Re-check failed." });
    } finally {
      setBusy(false);
    }
  };

  if (loaded.error?.status === 404) return <div className="page-shell"><EmptyState title="Donation not found" /></div>;
  if (loaded.error) return <div className="page-shell"><Banner tone="error" title="We couldn’t load this donation">{loaded.error.message}</Banner></div>;
  if (!d) return <div className="adm-page" aria-busy="true"><Skeleton width="50%" height={32} /></div>;

  return (
    <div className="adm-page">
      <AdminNav current="donations" />
      <p className="adm-back"><Link to="/admin/donations">All donations</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{formatKobo(d.amount_kobo)} · {d.reference}</h1>
          <div className="adm-status"><StatusBadge set="donation" status={d.status} />{d.is_demo && <DemoBadge />}</div>
        </div>
        {!d.is_demo && <Button variant="secondary" onClick={() => void recheck()} loading={busy} loadingLabel="Checking…">Re-check with provider</Button>}
      </header>
      {d.is_demo && (
        <Banner tone="warning" title="DEMO DATA — not a real donation">
          Simulated for a local preview by seed_demo_donations. No money was paid, and it isn’t counted in any total or export.
        </Banner>
      )}
      {d.status === "review" && <Banner tone="warning" title="Under review">{REASONS[d.review_reason] ?? d.review_reason}</Banner>}
      <p className="ds-field__hint">Only the payment provider’s answer can change a donation’s status. Refunds are made in the provider’s dashboard.</p>

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="pay-title">
          <h2 id="pay-title">Payment</h2>
          <dl className="adm-dl">
            <div><dt>Amount</dt><dd>{formatKobo(d.amount_kobo)}</dd></div>
            {d.refunded_kobo > 0 && <div><dt>Refunded</dt><dd>{formatKobo(d.refunded_kobo)} (net {formatKobo(d.net_kobo)})</dd></div>}
            <div><dt>Given to</dt><dd>{designationText(d)}{d.election_year ? ` · ${d.election_year} election` : ""}</dd></div>
            <div><dt>Channel</dt><dd>{d.channel || "—"}</dd></div>
            <div><dt>Provider</dt><dd>{d.provider} {d.provider_reference && `· ${d.provider_reference}`}</dd></div>
            <div><dt>Started</dt><dd>{formatDate(d.created_at, { withTime: true })}</dd></div>
            <div><dt>Paid</dt><dd>{d.paid_at ? formatDate(d.paid_at, { withTime: true }) : "—"}</dd></div>
          </dl>
        </section>
        <section className="adm-panel" aria-labelledby="donor-title">
          <h2 id="donor-title">Donor (private)</h2>
          <dl className="adm-dl">
            <div><dt>Name</dt><dd>{d.donor_name}</dd></div>
            <div><dt>Email</dt><dd>{d.donor_email}</dd></div>
            <div><dt>Phone</dt><dd>{d.donor_phone}</dd></div>
            <div><dt>Address</dt><dd>{d.donor_address}, {d.donor_state}</dd></div>
            <div><dt>Account</dt><dd>{d.donor_user_email ?? "Guest"}</dd></div>
            <div><dt>Public label</dt><dd>{d.public_label || "(set when successful)"}</dd></div>
          </dl>
          <h3>Declarations</h3>
          <ul className="adm-declarations">
            <li>{d.declarations.own_funds ? "✓" : "✗"} Own money</li>
            <li>{d.declarations.nigerian_source ? "✓" : "✗"} Nigerian citizen/resident; no funds from outside Nigeria</li>
            <li>{d.declarations.voluntary ? "✓" : "✗"} Voluntary</li>
          </ul>
          {d.declarations.accepted_at && <p className="ds-field__hint">Accepted {formatDate(d.declarations.accepted_at, { withTime: true })}</p>}
        </section>
      </div>

      <section className="adm-panel" aria-labelledby="hist-title">
        <h2 id="hist-title">History</h2>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>When</th><th>Source</th><th>Event</th><th>Change</th><th>Reported amount</th><th>Note</th></tr></thead>
          <tbody>
            {(d.events ?? []).map((e, i) => (
              <tr key={i}>
                <td>{formatDate(e.received_at, { withTime: true })}</td>
                <td>{e.source}</td>
                <td>{e.event || "—"}</td>
                <td>{e.status_from || "—"} → {e.status_to}</td>
                <td>{e.amount_kobo !== null ? `${formatKobo(e.amount_kobo)} ${e.currency}` : "—"}</td>
                <td>{e.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
