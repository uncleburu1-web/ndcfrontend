/** /admin/news/:id — review one article (spec 07 §4.5). */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, Select, Skeleton, StatusBadge, TextArea, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ArticleBody } from "../../../news/ArticleBody";
import { ArticleImage } from "../../../news/ArticleImage";
import { SourceBadges } from "../../../news/SourceBadges";
import { REJECT_REASONS, type AdminArticle } from "../../../news/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../news/news.css";

const CHECKLIST = [
  "The source checks out.",
  "No false or unsourced election results (only INEC).",
  "No abusive or inciting language (Electoral Act 2026 s. 96).",
  "No private information about anyone.",
  "Image rights are plausible.",
  "It’s news, not an advert or a personal attack.",
];
type Modal = "reject" | "remove" | null;

export default function AdminNewsDetailPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`admin-news:${id}`, (signal) => api<AdminArticle>(`/admin/news/${id}/`, { signal }));
  const [a, setA] = useState<AdminArticle | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [preset, setPreset] = useState(REJECT_REASONS[0]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => setA(res.data), [res.data]);
  useEffect(() => {
    document.title = "Review article | NDCConnect admin";
  }, []);

  const act = async (action: "approve" | "reject" | "remove" | "restore", body?: Record<string, string>) => {
    setBusy(action);
    try {
      setA(await api<AdminArticle>(`/admin/news/${id}/${action}/`, { method: "POST", body }));
      setModal(null);
      setReason("");
      toast.show({ tone: "success", message: { approve: "Approved and published.", reject: "Rejected. The author sees your reason.", remove: "Removed from NDCConnect.", restore: "Restored." }[action] });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work." });
      res.retry();
    } finally {
      setBusy("");
    }
  };
  const dismiss = async () => {
    if (!dismissing) return;
    try {
      setA(await api<AdminArticle>(`/admin/news/reports/${dismissing}/dismiss/`, { method: "POST", body: { note } }));
      toast.show({ tone: "success", message: "Report dismissed." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t dismiss." });
    } finally {
      setDismissing(null);
      setNote("");
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="news" /><EmptyState title="Article not found" action={<Button href="/admin/news">Back to the queue</Button>} /></div>;
  if (!a) return <div className="adm-page"><AdminNav current="news" /><Skeleton width="100%" height={240} /></div>;

  const finalReason = modal === "reject" ? (preset === "Other" ? reason.trim() : [preset, reason.trim()].filter(Boolean).join(" ")) : reason.trim();
  const openReports = (a.reports ?? []).filter((r) => r.status === "open");
  return (
    <div className="adm-page">
      <AdminNav current="news" />
      <p className="adm-back"><Link to="/admin/news">← Review queue</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{a.title}</h1>
          <div className="adm-status">
            <StatusBadge set="news" status={a.status} />
            <span>{a.source === "official" ? "Official announcement" : `Submitted by ${a.author_name || "—"} (${a.author_email || "deleted account"})`}</span>
          </div>
        </div>
        <div className="adm-actions">
          {a.source === "community" && a.status === "pending" && !a.is_own && (
            <>
              <Button onClick={() => void act("approve")} loading={busy === "approve"}>Approve</Button>
              <Button variant="secondary" onClick={() => { setModal("reject"); setPreset(REJECT_REASONS[0]); }}>Reject</Button>
            </>
          )}
          {a.status === "successful" && !a.is_own && <Button variant="secondary" onClick={() => setModal("remove")}>Remove</Button>}
          {a.status === "removed" && <Button variant="secondary" onClick={() => void act("restore")} loading={busy === "restore"}>Restore</Button>}
        </div>
      </header>
      {a.is_own && <Banner tone="info">This is your own submission. Another reviewer has to decide it.</Banner>}
      {a.decision_reason && a.status === "rejected" && <Banner tone="error" title="Rejected">{a.decision_reason}</Banner>}
      {a.removed_reason && a.status === "removed" && <Banner tone="warning" title="Removed">{a.removed_reason}</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="preview-h">
          <h2 id="preview-h">As readers would see it</h2>
          <SourceBadges a={{ ...a, pinned: false }} />
          <p className="news-meta">
            {a.source === "community" && <>by {a.show_author_name ? a.author_name : "a member"} · </>}
            {a.state_label || "All of Nigeria"}
          </p>
          {a.image && <ArticleImage image={a.image} />}
          <ArticleBody body={a.body} />
          {a.source_url && (
            <p className="article-source">Source: {a.source_name && `${a.source_name} — `}
              <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow ugc">{a.source_url}</a></p>
          )}
        </section>
        <section className="adm-panel" aria-labelledby="check-h">
          {a.source === "community" && a.status === "pending" && (
            <>
              <h2 id="check-h">Before you decide</h2>
              <ul className="adm-declarations">{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
          <h2>Reports{openReports.length ? ` (${openReports.length} open)` : ""}</h2>
          {!(a.reports ?? []).length ? <p className="ds-field__hint">No reports.</p> : (
            <ul className="adm-history">
              {(a.reports ?? []).map((r) => (
                <li key={r.id}>
                  <strong>{r.reason_label}</strong> · {formatDate(r.created_at, { withTime: true })} · {r.status}
                  {r.details && <> — {r.details}</>}
                  {(r.reporter_email || r.contact_email) && <> · {r.reporter_email ?? r.contact_email}</>}
                  {r.resolution_note && <> · note: {r.resolution_note}</>}
                  {r.status === "open" && !a.is_own && <> <Button size="sm" variant="ghost" onClick={() => setDismissing(r.id)}>Dismiss</Button></>}
                </li>
              ))}
            </ul>
          )}
          <h2>History</h2>
          <ol className="adm-history">
            {(a.events ?? []).map((e, i) => (
              <li key={i}><strong>{e.event.replace(/_/g, " ")}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
        </section>
      </div>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === "reject" ? "Reject this article?" : "Remove this article?"}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Go back</Button>
          <Button variant="danger" disabled={!finalReason} loading={busy === modal} onClick={() => modal && void act(modal, { reason: finalReason })}>
            {modal === "reject" ? "Reject article" : "Remove article"}
          </Button></>}>
        <p>{modal === "reject" ? "The author sees this reason and can edit and resubmit." : "It disappears from NDCConnect. Open reports are marked as actioned."}</p>
        {modal === "reject" && <Select label="Reason" value={preset} onChange={(e) => setPreset(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />}
        <TextArea label={modal === "reject" && preset !== "Other" ? "More detail (optional)" : "Reason"} required={modal !== "reject" || preset === "Other"}
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
      <Modal open={Boolean(dismissing)} onClose={() => setDismissing(null)} title="Dismiss this report?"
        footer={<><Button variant="secondary" onClick={() => setDismissing(null)}>Go back</Button><Button onClick={() => void dismiss()}>Dismiss report</Button></>}>
        <p>The article stays up.</p>
        <TextArea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Modal>
    </div>
  );
}
