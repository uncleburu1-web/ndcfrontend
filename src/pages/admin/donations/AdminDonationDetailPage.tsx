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
import { t } from "../../../i18n";

const REASONS: Record<string, string> = {
  get amount_or_currency_mismatch() { return t("admin.the-provider-reported-a-different-amount"); },
  get over_limit() { return t("admin.this-payment-takes-the-donor-over"); },
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
    document.title = t("admin.donation-ndcconnect-admin");
  }, []);

  const recheck = async () => {
    setBusy(true);
    try {
      const updated = await api<AdminDonation>(`/admin/donations/${id}/recheck/`, { method: "POST" });
      setD(updated);
      toast.show({ tone: "success", message: t("admin.checked-with-the-provider", { status_label: updated.status_label }) });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.re-check-failed") });
    } finally {
      setBusy(false);
    }
  };

  if (loaded.error?.status === 404) return <div className="page-shell"><EmptyState title={t("admin.donation-not-found")} /></div>;
  if (loaded.error) return <div className="page-shell"><Banner tone="error" title={t("admin.we-couldn-t-load-this-donation")}>{loaded.error.message}</Banner></div>;
  if (!d) return <div className="adm-page" aria-busy="true"><Skeleton width="50%" height={32} /></div>;

  return (
    <div className="adm-page">
      <AdminNav current="donations" />
      <p className="adm-back"><Link to="/admin/donations">{t("admin.all-donations")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{formatKobo(d.amount_kobo)} · {d.reference}</h1>
          <div className="adm-status"><StatusBadge set="donation" status={d.status} />{d.is_demo && <DemoBadge />}</div>
        </div>
        {!d.is_demo && <Button variant="secondary" onClick={() => void recheck()} loading={busy} loadingLabel={t("admin.checking")}>{t("admin.re-check-with-provider")}</Button>}
      </header>
      {d.is_demo && (
        <Banner tone="warning" title={t("admin.demo-data-not-a-real-donation")}>
          {t("admin.simulated-for-a-local-preview-by")}</Banner>
      )}
      {d.status === "review" && <Banner tone="warning" title={t("admin.under-review")}>{REASONS[d.review_reason] ?? d.review_reason}</Banner>}
      <p className="ds-field__hint">{t("admin.only-the-payment-provider-s-answer")}</p>

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="pay-title">
          <h2 id="pay-title">{t("admin.payment")}</h2>
          <dl className="adm-dl">
            <div><dt>{t("admin.amount")}</dt><dd>{formatKobo(d.amount_kobo)}</dd></div>
            {d.refunded_kobo > 0 && <div><dt>{t("admin.refunded")}</dt><dd>{t("admin.net", { formatKobo: formatKobo(d.refunded_kobo), formatKobo2: formatKobo(d.net_kobo) })}</dd></div>}
            <div><dt>{t("admin.given-to")}</dt><dd>{designationText(d)}{d.election_year ? t("admin.election", { election_year: d.election_year }) : ""}</dd></div>
            <div><dt>{t("admin.channel")}</dt><dd>{d.channel || "—"}</dd></div>
            <div><dt>{t("admin.provider")}</dt><dd>{d.provider} {d.provider_reference && `· ${d.provider_reference}`}</dd></div>
            <div><dt>{t("admin.started")}</dt><dd>{formatDate(d.created_at, { withTime: true })}</dd></div>
            <div><dt>{t("admin.paid")}</dt><dd>{d.paid_at ? formatDate(d.paid_at, { withTime: true }) : "—"}</dd></div>
          </dl>
        </section>
        <section className="adm-panel" aria-labelledby="donor-title">
          <h2 id="donor-title">{t("admin.donor-private")}</h2>
          <dl className="adm-dl">
            <div><dt>{t("admin.name")}</dt><dd>{d.donor_name}</dd></div>
            <div><dt>{t("admin.email")}</dt><dd>{d.donor_email}</dd></div>
            <div><dt>{t("admin.phone")}</dt><dd>{d.donor_phone}</dd></div>
            <div><dt>{t("admin.address")}</dt><dd>{d.donor_address}, {d.donor_state}</dd></div>
            <div><dt>{t("admin.account")}</dt><dd>{d.donor_user_email ?? t("admin.guest")}</dd></div>
            <div><dt>{t("admin.public-label")}</dt><dd>{d.public_label || t("admin.set-when-successful")}</dd></div>
          </dl>
          <h3>{t("admin.declarations")}</h3>
          <ul className="adm-declarations">
            <li>{t("admin.own-money", { v: d.declarations.own_funds ? "✓" : "✗" })}</li>
            <li>{t("admin.nigerian-citizen-resident-no-funds-from", { v: d.declarations.nigerian_source ? "✓" : "✗" })}</li>
            <li>{t("admin.voluntary", { v: d.declarations.voluntary ? "✓" : "✗" })}</li>
          </ul>
          {d.declarations.accepted_at && <p className="ds-field__hint">{t("admin.accepted", { formatDate: formatDate(d.declarations.accepted_at, { withTime: true }) })}</p>}
        </section>
      </div>

      <section className="adm-panel" aria-labelledby="hist-title">
        <h2 id="hist-title">{t("admin.history")}</h2>
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>{t("admin.when")}</th><th>{t("admin.source")}</th><th>{t("admin.event")}</th><th>{t("admin.change")}</th><th>{t("admin.reported-amount")}</th><th>{t("admin.note")}</th></tr></thead>
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
