/** /admin/membership/payments — membership fees, kept apart from donations (spec 06 §4.4, §15.7). */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, StatusBadge } from "../../../components/ui";
import { formatKobo } from "../../../donations/money";
import { formatDate } from "../../../lib/format";
import type { AdminMembershipPaymentRow } from "../../../membership/types";
import { AdminNav } from "../AdminNav";
import { MembershipSubnav } from "./MembershipSubnav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-membership.css";
import { t, lazy } from "../../../i18n";

const STATUSES: [string, string][] = lazy(() => [["", t("admin.all-statuses")], ["successful", t("admin.successful")], ["pending", t("admin.pending")], ["review", t("admin.under-review")],
  ["failed", t("admin.failed")], ["abandoned", t("admin.abandoned")], ["refunded", t("admin.refunded")], ["initiated", t("admin.started")]]);

export default function AdminMembershipPaymentsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-membership-payments:${qs}`, (signal) =>
    api<{ count: number; results: AdminMembershipPaymentRow[] }>(`/admin/membership/payments/${qs.toString() ? `?${qs}` : ""}`, { signal }));
  useEffect(() => {
    document.title = t("admin.membership-payments-ndcconnect-admin");
  }, []);

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.membership-payments")}</h1>
          <p className="ds-field__hint">{t("admin.membership-fees-only-these-never-appear")}</p>
        </div>
      </header>
      <MembershipSubnav />
      <div className="adm-pvc-filter">
        <Select label={t("admin.status")} value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          options={STATUSES.map(([value, label]) => ({ value, label }))} />
      </div>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-payments")} action={<Button variant="secondary" size="sm" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={t("admin.no-membership-payments")}>{t("admin.payments-appear-here-once-applicants-pay")}</EmptyState>
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{t("admin.date")}</th><th>{t("admin.reference")}</th><th>{t("admin.member")}</th><th>{t("admin.amount")}</th><th>{t("admin.status")}</th></tr></thead>
            <tbody>
              {res.data.results.map((p) => (
                <tr key={p.reference}>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{p.reference}{p.review_reason && <><br /><span className="ds-field__hint">{p.review_reason}</span></>}</td>
                  <td><Link to={`/admin/membership/${p.membership_id}`}>{p.member_name || t("admin.no-name")}</Link></td>
                  <td>{formatKobo(p.amount_kobo)}{p.refunded_kobo > 0 && <><br /><span className="ds-field__hint">{t("admin.refunded-2", { formatKobo: formatKobo(p.refunded_kobo) })}</span></>}</td>
                  <td><StatusBadge set="donation" status={p.status as "pending"} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={t("admin.payment-pages")}
            onChange={(n) => setParams({ ...(status ? { status } : {}), ...(n > 1 ? { page: String(n) } : {}) })} />
        </>
      ) : null}
    </div>
  );
}
