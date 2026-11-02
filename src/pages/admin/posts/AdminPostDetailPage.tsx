/** /admin/posts/:id — one candidate post: remove, restore, dismiss reports (spec 09 §4.4). Admins never edit a candidate's words. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, Select, Skeleton, StatusBadge, TextArea, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ArticleBody } from "../../../news/ArticleBody";
import { ArticleImage } from "../../../news/ArticleImage";
import { KindBadge } from "../../../posts/KindBadge";
import { moderationError } from "../../../posts/moderation";
import { REMOVE_REASONS, postPath, type AdminPost } from "../../../posts/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../news/news.css";

export default function AdminPostDetailPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`admin-post:${id}`, (signal) => api<AdminPost>(`/admin/posts/${id}/`, { signal }));
  const [p, setP] = useState<AdminPost | null>(null);
  const [removing, setRemoving] = useState(false);
  const [preset, setPreset] = useState(REMOVE_REASONS[0]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => setP(res.data), [res.data]);
  useEffect(() => {
    document.title = "Candidate post | NDCConnect admin";
  }, []);

  const act = async (action: "remove" | "restore", body?: Record<string, string>) => {
    setBusy(action);
    try {
      setP(await api<AdminPost>(`/admin/posts/${id}/${action}/`, { method: "POST", body }));
      setRemoving(false);
      setReason("");
      toast.show({ tone: "success", message: action === "remove" ? "Removed. The campaign sees your reason." : "Restored." });
    } catch (err) {
      toast.show({ tone: "error", message: moderationError(err) });
    } finally {
      setBusy("");
    }
  };
  const dismiss = async () => {
    if (!dismissing) return;
    try {
      setP(await api<AdminPost>(`/admin/posts/reports/${dismissing}/dismiss/`, { method: "POST", body: { note } }));
      toast.show({ tone: "success", message: "Report dismissed." });
    } catch (err) {
      toast.show({ tone: "error", message: moderationError(err) });
    } finally {
      setDismissing(null);
      setNote("");
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="posts" /><EmptyState title="Post not found" action={<Button href="/admin/posts">Back to posts</Button>} /></div>;
  if (!p) return <div className="adm-page"><AdminNav current="posts" /><Skeleton width="100%" height={240} /></div>;

  const finalReason = preset === "Other" ? reason.trim() : [preset, reason.trim()].filter(Boolean).join(" ");
  const openReports = (p.reports ?? []).filter((r) => r.status === "open");
  return (
    <div className="adm-page">
      <AdminNav current="posts" />
      <p className="adm-back"><Link to="/admin/posts">← Candidate posts</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{p.title}</h1>
          <div className="adm-status">
            <StatusBadge set="post" status={p.status} />
            <span>{p.candidate.full_name} · posted by {p.author_email || "deleted account"}</span>
          </div>
        </div>
        <div className="adm-actions">
          {p.status === "published" && (
            <>
              <Button variant="secondary" href={postPath(p.candidate.slug, p.id)}>View public post</Button>
              <Button variant="secondary" onClick={() => { setRemoving(true); setPreset(REMOVE_REASONS[0]); }}>Remove</Button>
            </>
          )}
          {p.status === "removed" && <Button variant="secondary" onClick={() => void act("restore")} loading={busy === "restore"}>Restore</Button>}
        </div>
      </header>
      {p.status === "removed" && <Banner tone="warning" title="Removed">{p.removed_reason}</Banner>}
      {p.status === "deleted" && <Banner tone="info">The campaign deleted this post. It’s kept for 30 days for complaints, then erased.</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="preview-h">
          <h2 id="preview-h">As readers see it</h2>
          <KindBadge kind={p.kind} label={p.kind_label} />
          <p className="news-meta">{formatDate(p.published_at, { withTime: true })}{p.edited_at ? ` · Edited ${formatDate(p.edited_at, { withTime: true })}` : ""}</p>
          {p.image && <ArticleImage image={p.image} />}
          <ArticleBody body={p.body} />
        </section>
        <section className="adm-panel">
          <h2>Reports{openReports.length ? ` (${openReports.length} open)` : ""}</h2>
          {!(p.reports ?? []).length ? <p className="ds-field__hint">No reports.</p> : (
            <ul className="adm-history">
              {(p.reports ?? []).map((r) => (
                <li key={r.id}>
                  <strong>{r.reason_label}</strong> · {formatDate(r.created_at, { withTime: true })} · {r.status}
                  {r.details && <> — {r.details}</>}
                  {(r.reporter_email || r.contact_email) && <> · {r.reporter_email ?? r.contact_email}</>}
                  {r.resolution_note && <> · note: {r.resolution_note}</>}
                  {r.status === "open" && <> <Button size="sm" variant="ghost" onClick={() => setDismissing(r.id)}>Dismiss</Button></>}
                </li>
              ))}
            </ul>
          )}
          <h2>History</h2>
          <ol className="adm-history">
            {(p.events ?? []).map((e, i) => (
              <li key={i}><strong>{e.event.replace(/_/g, " ")}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
        </section>
      </div>

      <Modal open={removing} onClose={() => setRemoving(false)} title="Remove this post?"
        footer={<><Button variant="secondary" onClick={() => setRemoving(false)}>Go back</Button>
          <Button variant="danger" disabled={!finalReason} loading={busy === "remove"} onClick={() => void act("remove", { reason: finalReason })}>Remove post</Button></>}>
        <p>It disappears from the profile, News and notifications. The campaign sees this reason. Open reports are marked as actioned.</p>
        <Select label="Reason" value={preset} onChange={(e) => setPreset(e.target.value)} options={REMOVE_REASONS.map((r) => ({ value: r, label: r }))} />
        <TextArea label={preset !== "Other" ? "More detail (optional)" : "Reason"} required={preset === "Other"} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal open={Boolean(dismissing)} onClose={() => setDismissing(null)} title="Dismiss this report?"
        footer={<><Button variant="secondary" onClick={() => setDismissing(null)}>Go back</Button><Button onClick={() => void dismiss()}>Dismiss report</Button></>}>
        <p>The post stays up.</p>
        <TextArea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
