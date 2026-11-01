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

const STATUSES: [string, string][] = [["", "All statuses"], ["successful", "Successful"], ["pending", "Pending"], ["review", "Under review"],
  ["failed", "Failed"], ["abandoned", "Abandoned"], ["refunded", "Refunded"], ["initiated", "Started"]];

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
    document.title = "Membership payments | NDCConnect admin";
  }, []);

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <header className="adm-page__head">
        <div>
          <h1>Membership payments</h1>
          <p className="ds-field__hint">Membership fees only. These never appear as donations or on the finance page.</p>
        </div>
      </header>
      <MembershipSubnav />
      <div className="adm-pvc-filter">
        <Select label="Status" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
          options={STATUSES.map(([value, label]) => ({ value, label }))} />
      </div>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load payments" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title="No membership payments">Payments appear here once applicants pay.</EmptyState>
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Date</th><th>Reference</th><th>Member</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {res.data.results.map((p) => (
                <tr key={p.reference}>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{p.reference}{p.review_reason && <><br /><span className="ds-field__hint">{p.review_reason}</span></>}</td>
                  <td><Link to={`/admin/membership/${p.membership_id}`}>{p.member_name || "(no name)"}</Link></td>
                  <td>{formatKobo(p.amount_kobo)}{p.refunded_kobo > 0 && <><br /><span className="ds-field__hint">Refunded {formatKobo(p.refunded_kobo)}</span></>}</td>
                  <td><StatusBadge set="donation" status={p.status as "pending"} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="Payment pages"
            onChange={(n) => setParams({ ...(status ? { status } : {}), ...(n > 1 ? { page: String(n) } : {}) })} />
        </>
      ) : null}
    </div>
  );
}
