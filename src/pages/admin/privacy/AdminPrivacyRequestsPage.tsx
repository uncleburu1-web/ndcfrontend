/** /admin/privacy — privacy requests by due date (spec 14 §4.5). Privacy officers (and system admins). */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { RequestStatusBadge } from "../../../privacy/badges";
import type { PrivacyRequest } from "../../../privacy/types";
import { AdminNav } from "../AdminNav";
import { PrivacyNav } from "./PrivacyNav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";

type Tab = "open" | "waiting" | "closed";
const TABS: [Tab, string][] = [["open", "Open"], ["waiting", "Waiting for the person"], ["closed", "Closed"]];

export default function AdminPrivacyRequestsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "open";
  const res = useRequest(`privacy-requests-${tab}`, (signal) =>
    api<{ count: number; counts: Record<Tab, number>; results: PrivacyRequest[] }>(`/admin/privacy/requests/?tab=${tab}`, { signal }));
  useEffect(() => {
    document.title = "Privacy requests | NDCConnect admin";
  }, []);
  const rows = res.data?.results ?? [];
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="requests" />
      <header className="adm-page__head">
        <div>
          <h1>Privacy requests</h1>
          <p className="ds-field__hint">Answer within 30 days (NDPA, GAID 2025). Asking the person for more information pauses the clock.</p>
        </div>
      </header>
      <div className="adm-subnav" role="tablist" aria-label="Request status">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""}
                  onClick={() => setParams(id === "open" ? {} : { tab: id })}>
            {label}{res.data?.counts?.[id] ? ` (${res.data.counts[id]})` : ""}
          </button>
        ))}
      </div>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load requests" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "closed" ? "No closed requests" : "No requests waiting"} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Request</th><th>Person</th><th>Received</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/privacy/requests/${r.id}`}>{r.reference}</Link><br /><span className="privacy-meta">{r.kind_label}</span></td>
                  <td>{r.person_name}</td>
                  <td>{formatDate(r.received_at)}</td>
                  <td><span className={`mod-due${r.overdue ? " mod-due--overdue" : ""}`}>{r.due_words}</span></td>
                  <td><RequestStatusBadge status={r.status} officer /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
