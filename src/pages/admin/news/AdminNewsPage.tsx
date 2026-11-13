/** /admin/news — review queue for news reviewers and system admins (spec 07 §4.5). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, NavLink, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Skeleton, StatusBadge, TextField } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { AdminNewsPage as Page } from "../../../news/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../membership/admin-membership.css";
import { t as tr } from "../../../i18n";

const TABS = [["pending", "Pending"], ["reported", "Reported"], ["successful", "Published"], ["rejected", "Rejected"], ["removed", "Removed"]] as const;

function AdminNewsQueue() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "pending";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const qs = new URLSearchParams();
  if (tab === "reported") qs.set("reported", "1");
  else qs.set("status", tab);
  if (params.get("q")) qs.set("q", params.get("q")!);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-news:${qs}`, (signal) => api<Page>(`/admin/news/?${qs}`, { signal }));

  useEffect(() => {
    document.title = tr("admin.news-review-ndcconnect-admin");
  }, []);
  const counts = res.data?.counts;
  const tabHref = (t: string) => `/admin/news${t === "pending" ? "" : `?tab=${t}`}`;
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    next.delete("page");
    setParams(next);
  };

  return (
    <div className="adm-page">
      <AdminNav current="news" />
      <header className="adm-page__head">
        <div>
          <h1>{tr("admin.news-review")}</h1>
          <p className="ds-field__hint">{tr("admin.approve-or-reject-never-rewrite-check")}</p>
        </div>
      </header>
      <nav className="adm-subnav" aria-label={tr("admin.review-queues")}>
        {TABS.map(([id, label]) => (
          <NavLink key={id} to={tabHref(id)} className={() => (tab === id ? "active" : "")} aria-current={tab === id ? "page" : undefined}>
            {label}
            {id === "pending" && counts ? ` (${counts.pending})` : ""}
            {id === "reported" && counts ? ` (${counts.reported})` : ""}
          </NavLink>
        ))}
      </nav>
      {counts?.paused_until && (
        <Banner tone="warning" title={tr("admin.approvals-are-paused")}>
          {tr("admin.campaign-blackout-until-you-can-still", { formatDate: formatDate(counts.paused_until, { withTime: true }) })}</Banner>
      )}
      {tab === "reported" && counts?.oldest_open_report && (
        <Banner tone="warning">{tr("admin.oldest-open-report-aim-to-act", { formatDate: formatDate(counts.oldest_open_report, { withTime: true }) })}</Banner>
      )}
      <form className="adm-filters__search" onSubmit={onSearch}>
        <TextField label={tr("admin.search")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("admin.title-or-author-email")} />
        <Button type="submit" variant="secondary">{tr("admin.search")}</Button>
      </form>
      {res.error ? (
        <Banner tone="error" title={tr("admin.we-couldn-t-load-the-queue")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{tr("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={tab === "pending" ? tr("admin.nothing-waiting-for-review") : tr("admin.nothing-here")} />
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{tab === "pending" ? tr("admin.submitted") : tr("admin.date")}</th><th>{tr("admin.title")}</th><th>{tr("admin.source")}</th><th>{tr("admin.status")}</th><th>{tr("admin.reports-2")}</th></tr></thead>
            <tbody>
              {res.data.results.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.submitted_at ?? a.published_at ?? a.created_at)}</td>
                  <td><Link to={`/admin/news/${a.id}`}>{a.title}</Link><br /><span className="ds-field__hint">{a.source === "official" ? tr("admin.official") : a.author_email}{a.is_own ? tr("admin.your-submission") : ""}</span></td>
                  <td>{a.source === "official" ? tr("admin.official") : tr("admin.community")}</td>
                  <td><StatusBadge set="news" status={a.status} /></td>
                  <td>{a.open_reports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={tr("admin.queue-pages")}
            onChange={(p) => { const n = new URLSearchParams(params); if (p > 1) n.set("page", String(p)); else n.delete("page"); setParams(n); }} />
        </>
      ) : null}
    </div>
  );
}

/** Spec 13 §8.2: reported items live in the moderation queue now. */
export default function AdminNewsPage() {
  const [params] = useSearchParams();
  if (params.get("tab") === "reported") return <Navigate to="/admin/moderation?type=news" replace />;
  return <AdminNewsQueue />;
}
