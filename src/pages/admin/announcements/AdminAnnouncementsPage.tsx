/** /admin/announcements — official announcements, system admins only (spec 07 §4.7). */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, StatusBadge } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { AdminArticle } from "../../../news/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";

export default function AdminAnnouncementsPage() {
  const api = useApi();
  const res = useRequest("admin-announcements", (signal) =>
    api<{ count: number; results: AdminArticle[]; paused_until: string | null; pinned_count: number }>("/admin/announcements/", { signal }));
  useEffect(() => {
    document.title = "Announcements | NDCConnect admin";
  }, []);
  return (
    <div className="adm-page">
      <AdminNav current="announcements" />
      <header className="adm-page__head">
        <div>
          <h1>Official announcements</h1>
          <p className="ds-field__hint">Published straight away under the “Official” label.</p>
        </div>
        <Button href="/admin/announcements/new">New announcement</Button>
      </header>
      {res.data?.paused_until && (
        <Banner tone="warning" title="Campaign Announcements are paused">
          Campaign blackout until {formatDate(res.data.paused_until, { withTime: true })}. Other categories can still be published.
        </Banner>
      )}
      {res.error ? <Banner tone="error">{res.error.message}</Banner> : !res.data ? <Skeleton width="100%" height={160} /> : res.data.count === 0 ? (
        <EmptyState title="No announcements yet" action={<Button href="/admin/announcements/new">New announcement</Button>} />
      ) : (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>Published</th><th>Title</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>
            {res.data.results.map((a) => (
              <tr key={a.id}>
                <td>{a.published_at ? formatDate(a.published_at) : "—"}</td>
                <td>
                  <Link to={`/admin/announcements/${a.id}`}>{a.title}</Link>
                  <br /><span className="ds-field__hint">{[a.pinned && "Pinned", a.important && "Notified everyone", a.edited_at && "Updated"].filter(Boolean).join(" · ")}</span>
                </td>
                <td>{a.category_label}</td>
                <td><StatusBadge set="news" status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
