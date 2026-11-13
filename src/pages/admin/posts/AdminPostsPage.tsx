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
import { t as tr, lazy } from "../../../i18n";

interface Page { count: number; results: AdminPost[]; counts: { reported: number; oldest_open_report: string | null } }
const TABS = lazy(() => [["published", tr("admin.published")], ["reported", tr("admin.reported")], ["removed", tr("admin.removed")], ["deleted", tr("admin.deleted")]] as const);

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
    document.title = tr("admin.candidate-posts-ndcconnect-admin");
  }, []);
  const counts = res.data?.counts;
  const tabHref = (t: string) => `/admin/posts${t === "published" ? "" : `?tab=${t}`}`;

  return (
    <div className="adm-page">
      <AdminNav current="posts" />
      <header className="adm-page__head">
        <div>
          <h1>{tr("admin.candidate-posts")}</h1>
          <p className="ds-field__hint">{tr("admin.candidate-posts-go-live-without-review")}</p>
        </div>
      </header>
      <nav className="adm-subnav" aria-label={tr("admin.post-filters")}>
        {TABS.map(([id, label]) => (
          <NavLink key={id} to={tabHref(id)} className={() => (tab === id ? "active" : "")} aria-current={tab === id ? "page" : undefined}>
            {label}{id === "reported" && counts ? ` (${counts.reported})` : ""}
          </NavLink>
        ))}
      </nav>
      {counts?.oldest_open_report && (
        <Banner tone="warning">{tr("admin.oldest-open-report-aim-to-act", { formatDate: formatDate(counts.oldest_open_report, { withTime: true }) })}</Banner>
      )}
      {params.get("candidate") && <p className="ds-field__hint">{tr.rich("admin.showing-one-candidate-show-all", { link: (chunks) => <Link to={tabHref(tab)}>{chunks}</Link> })}</p>}
      {res.error ? (
        <Banner tone="error" title={tr("admin.we-couldn-t-load-posts")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{tr("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={tab === "reported" ? tr("admin.no-open-reports") : tr("admin.nothing-here")} />
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{tr("admin.published")}</th><th>{tr("admin.title")}</th><th>{tr("admin.candidate")}</th><th>{tr("admin.status")}</th><th>{tr("admin.reports-2")}</th></tr></thead>
            <tbody>
              {res.data.results.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.published_at)}</td>
                  <td><Link to={`/admin/posts/${p.id}`}>{p.title}</Link><br /><span className="ds-field__hint">{p.kind_label} · {p.author_email || tr("admin.deleted-account-2")}</span></td>
                  <td><Link to={`/admin/posts?candidate=${p.candidate.id}`}>{p.candidate.full_name}</Link></td>
                  <td><StatusBadge set="post" status={p.status} /></td>
                  <td>{p.open_reports || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={tr("admin.post-pages")}
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
