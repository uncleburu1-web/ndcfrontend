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
import { t } from "../../../i18n";

type Tab = "open" | "waiting" | "closed";
const TABS: [Tab, string][] = [["open", "Open"], ["waiting", "Waiting for the person"], ["closed", "Closed"]];

export default function AdminPrivacyRequestsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "open";
  const res = useRequest(`privacy-requests-${tab}`, (signal) =>
    api<{ count: number; counts: Record<Tab, number>; results: PrivacyRequest[] }>(`/admin/privacy/requests/?tab=${tab}`, { signal }));
  useEffect(() => {
    document.title = t("admin.privacy-requests-ndcconnect-admin");
  }, []);
  const rows = res.data?.results ?? [];
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="requests" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.privacy-requests")}</h1>
          <p className="ds-field__hint">{t("admin.answer-within-30-days-ndpa-gaid")}</p>
        </div>
      </header>
      <div className="adm-subnav" role="tablist" aria-label={t("admin.request-status")}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""}
                  onClick={() => setParams(id === "open" ? {} : { tab: id })}>
            {label}{res.data?.counts?.[id] ? ` (${res.data.counts[id]})` : ""}
          </button>
        ))}
      </div>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-requests")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "closed" ? t("admin.no-closed-requests") : t("admin.no-requests-waiting")} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>{t("admin.request")}</th><th>{t("admin.person")}</th><th>{t("admin.received")}</th><th>{t("admin.due-2")}</th><th>{t("admin.status")}</th></tr></thead>
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
