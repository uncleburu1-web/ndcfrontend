/** /admin/posts — system admins oversee candidate posts after publication (spec 09 §4.4). */
import { useEffect } from "react";
import { Link, Navigate, NavLink, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Skeleton, StatusBadge } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { AdminPost } from "../../../posts/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../membership/admin-membership.css";

interface Page { count: number; results: AdminPost[]; counts: { reported: number; oldest_open_report: string | null } }
const TABS = [["published", "Published"], ["reported", "Reported"], ["removed", "Removed"], ["deleted", "Deleted"]] as const;

function AdminPostsList() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "published";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = new URLSearchParams();
  if (tab === "reported") qs.set("reported", "1");
  else qs.set("status", tab);
  if (params.get("candidate")) qs.set("candidate", params.get("candidate")!);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-posts:${qs}`, (signal) => api<Page>(`/admin/posts/?${qs}`, { signal }));
  useEffect(() => {
    document.title = "Candidate posts | NDCConnect admin";
  }, []);
  const counts = res.data?.counts;
  const tabHref = (t: string) => `/admin/posts${t === "published" ? "" : `?tab=${t}`}`;

  return (
    <div className="adm-page">
      <AdminNav current="posts" />
      <header className="adm-page__head">
        <div>
          <h1>Candidate posts</h1>
          <p className="ds-field__hint">Candidate posts go live without review. Act on reports within 24 hours: remove anything abusive, inciting or with unsourced results.</p>
        </div>
      </header>
      <nav className="adm-subnav" aria-label="Post filters">
        {TABS.map(([id, label]) => (
          <NavLink key={id} to={tabHref(id)} className={() => (tab === id ? "active" : "")} aria-current={tab === id ? "page" : undefined}>
            {label}{id === "reported" && counts ? ` (${counts.reported})` : ""}
          </NavLink>
        ))}
      </nav>
      {counts?.oldest_open_report && (
        <Banner tone="warning">Oldest open report: {formatDate(counts.oldest_open_report, { withTime: true })}. Aim to act within 24 hours.</Banner>
      )}
      {params.get("candidate") && <p className="ds-field__hint">Showing one candidate. <Link to={tabHref(tab)}>Show all</Link></p>}
      {res.error ? (
        <Banner tone="error" title="We couldn’t load posts" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={tab === "reported" ? "No open reports" : "Nothing here"} />
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Published</th><th>Title</th><th>Candidate</th><th>Status</th><th>Reports</th></tr></thead>
            <tbody>
              {res.data.results.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.published_at)}</td>
                  <td><Link to={`/admin/posts/${p.id}`}>{p.title}</Link><br /><span className="ds-field__hint">{p.kind_label} · {p.author_email || "deleted account"}</span></td>
                  <td><Link to={`/admin/posts?candidate=${p.candidate.id}`}>{p.candidate.full_name}</Link></td>
                  <td><StatusBadge set="post" status={p.status} /></td>
                  <td>{p.open_reports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="Post pages"
            onChange={(n) => { const q = new URLSearchParams(params); if (n > 1) q.set("page", String(n)); else q.delete("page"); setParams(q); }} />
        </>
      ) : null}
    </div>
  );
}

/** Spec 13 §8.2: reported items live in the moderation queue now. */
export default function AdminPostsPage() {
  const [params] = useSearchParams();
  if (params.get("tab") === "reported") return <Navigate to="/admin/moderation?type=posts" replace />;
  return <AdminPostsList />;
}
