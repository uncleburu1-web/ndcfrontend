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
    document.title = "News review | NDCConnect admin";
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
          <h1>News review</h1>
          <p className="ds-field__hint">Approve or reject; never rewrite. Check the source, results only from INEC, no abuse or incitement, no private information.</p>
        </div>
      </header>
      <nav className="adm-subnav" aria-label="Review queues">
        {TABS.map(([id, label]) => (
          <NavLink key={id} to={tabHref(id)} className={() => (tab === id ? "active" : "")} aria-current={tab === id ? "page" : undefined}>
            {label}
            {id === "pending" && counts ? ` (${counts.pending})` : ""}
            {id === "reported" && counts ? ` (${counts.reported})` : ""}
          </NavLink>
        ))}
      </nav>
      {counts?.paused_until && (
        <Banner tone="warning" title="Approvals are paused">
          Campaign blackout until {formatDate(counts.paused_until, { withTime: true })}. You can still reject, remove and dismiss reports.
        </Banner>
      )}
      {tab === "reported" && counts?.oldest_open_report && (
        <Banner tone="warning">Oldest open report: {formatDate(counts.oldest_open_report, { withTime: true })}. Aim to act within 24 hours.</Banner>
      )}
      <form className="adm-filters__search" onSubmit={onSearch}>
        <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or author email" />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load the queue" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={tab === "pending" ? "Nothing waiting for review" : "Nothing here"} />
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{tab === "pending" ? "Submitted" : "Date"}</th><th>Title</th><th>Source</th><th>Status</th><th>Reports</th></tr></thead>
            <tbody>
              {res.data.results.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.submitted_at ?? a.published_at ?? a.created_at)}</td>
                  <td><Link to={`/admin/news/${a.id}`}>{a.title}</Link><br /><span className="ds-field__hint">{a.source === "official" ? "Official" : a.author_email}{a.is_own ? " · your submission" : ""}</span></td>
                  <td>{a.source === "official" ? "Official" : "Community"}</td>
                  <td><StatusBadge set="news" status={a.status} /></td>
                  <td>{a.open_reports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="Queue pages"
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
