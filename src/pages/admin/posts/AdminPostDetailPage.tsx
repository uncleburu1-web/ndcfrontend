/** /admin/posts/:id — one candidate post: remove (citing a rule) or restore (spec 09 §4.4, spec 13). Admins never edit a candidate's words. */
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
import { CaseLink, RuleSelect } from "../../../moderation/CaseLink";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../news/news.css";
import { t } from "../../../i18n";

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
  const [rule, setRule] = useState("");

  useEffect(() => setP(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.candidate-post-ndcconnect-admin");
  }, []);

  const act = async (action: "remove" | "restore", body?: Record<string, string>) => {
    setBusy(action);
    try {
      setP(await api<AdminPost>(`/admin/posts/${id}/${action}/`, { method: "POST", body }));
      setRemoving(false);
      setReason("");
      toast.show({ tone: "success", message: action === "remove" ? t("admin.removed-the-campaign-sees-your-reason") : t("admin.restored-2") });
    } catch (err) {
      toast.show({ tone: "error", message: moderationError(err) });
    } finally {
      setBusy("");
    }
  };
  if (res.error) return <div className="adm-page"><AdminNav current="posts" /><EmptyState title={t("admin.post-not-found")} action={<Button href="/admin/posts">{t("admin.back-to-posts")}</Button>} /></div>;
  if (!p) return <div className="adm-page"><AdminNav current="posts" /><Skeleton width="100%" height={240} /></div>;

  const finalReason = preset === "Other" ? reason.trim() : [preset, reason.trim()].filter(Boolean).join(" ");
  return (
    <div className="adm-page">
      <AdminNav current="posts" />
      <p className="adm-back"><Link to="/admin/posts">{t("admin.candidate-posts-2")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{p.title}</h1>
          <div className="adm-status">
            <StatusBadge set="post" status={p.status} />
            <span>{t("admin.posted-by", { full_name: p.candidate.full_name, v: p.author_email || t("admin.deleted-account-2") })}</span>
          </div>
        </div>
        <div className="adm-actions">
          {p.status === "published" && (
            <>
              <Button variant="secondary" href={postPath(p.candidate.slug, p.id)}>{t("admin.view-public-post")}</Button>
              <Button variant="secondary" onClick={() => { setRemoving(true); setPreset(REMOVE_REASONS[0]); }}>{t("admin.remove-2")}</Button>
            </>
          )}
          {p.status === "removed" && <Button variant="secondary" onClick={() => void act("restore")} loading={busy === "restore"}>{t("admin.restore")}</Button>}
        </div>
      </header>
      {p.status === "removed" && <Banner tone="warning" title={p.removed_rule ? t("admin.removed-under", { removed_rule: p.removed_rule }) : t("admin.removed")}>{p.removed_reason}</Banner>}
      {p.status === "deleted" && <Banner tone="info">{t("admin.the-campaign-deleted-this-post-it")}</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="preview-h">
          <h2 id="preview-h">{t("admin.as-readers-see-it")}</h2>
          <KindBadge kind={p.kind} label={p.kind_label} />
          <p className="news-meta">{formatDate(p.published_at, { withTime: true })}{p.edited_at ? t("admin.edited", { formatDate: formatDate(p.edited_at, { withTime: true }) }) : ""}</p>
          {p.image && <ArticleImage image={p.image} />}
          <ArticleBody body={p.body} />
        </section>
        <section className="adm-panel">
          <h2>{t("admin.reports-2")}</h2>
          <CaseLink c={p.case} />
          <h2>{t("admin.history")}</h2>
          <ol className="adm-history">
            {(p.events ?? []).map((e, i) => (
              <li key={i}><strong>{e.event.replace(/_/g, " ")}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
        </section>
      </div>

      <Modal open={removing} onClose={() => setRemoving(false)} title={t("admin.remove-this-post")}
        footer={<><Button variant="secondary" onClick={() => setRemoving(false)}>{t("admin.go-back")}</Button>
          <Button variant="danger" disabled={!finalReason || !rule} loading={busy === "remove"}
            onClick={() => void act("remove", { reason: finalReason, rule, note_to_author: finalReason })}>{t("admin.remove-post")}</Button></>}>
        <p>{t("admin.it-disappears-from-the-profile-news")}</p>
        <RuleSelect value={rule} onChange={setRule} />
        <Select label={t("admin.reason")} value={preset} onChange={(e) => setPreset(e.target.value)} options={REMOVE_REASONS.map((r) => ({ value: r, label: r }))} />
        <TextArea label={preset !== "Other" ? t("admin.more-detail-optional") : t("admin.reason")} required={preset === "Other"} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
