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
import { CaseLink, RuleSelect } from "../../../moderation/CaseLink";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../news/news.css";
import { t, lazy } from "../../../i18n";

const CHECKLIST = lazy(() => [
  t("admin.the-source-checks-out"),
  t("admin.no-false-or-unsourced-election-results"),
  t("admin.no-abusive-or-inciting-language-electoral"),
  t("admin.no-private-information-about-anyone"),
  t("admin.image-rights-are-plausible"),
  t("admin.it-s-news-not-an-advert"),
]);
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
  const [rule, setRule] = useState("");

  useEffect(() => setA(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.review-article-ndcconnect-admin");
  }, []);

  const act = async (action: "approve" | "reject" | "remove" | "restore", body?: Record<string, string>) => {
    setBusy(action);
    try {
      setA(await api<AdminArticle>(`/admin/news/${id}/${action}/`, { method: "POST", body }));
      setModal(null);
      setReason("");
      toast.show({ tone: "success", message: { approve: t("admin.approved-and-published"), reject: t("admin.rejected-the-author-sees-your-reason"), remove: t("admin.removed-from-ndcconnect"), restore: "Restored." }[action] });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-work") });
      res.retry();
    } finally {
      setBusy("");
    }
  };
  if (res.error) return <div className="adm-page"><AdminNav current="news" /><EmptyState title={t("admin.article-not-found")} action={<Button href="/admin/news">{t("admin.back-to-the-queue")}</Button>} /></div>;
  if (!a) return <div className="adm-page"><AdminNav current="news" /><Skeleton width="100%" height={240} /></div>;

  const finalReason = modal === "reject" ? (preset === "Other" ? reason.trim() : [preset, reason.trim()].filter(Boolean).join(" ")) : reason.trim();
  return (
    <div className="adm-page">
      <AdminNav current="news" />
      <p className="adm-back"><Link to="/admin/news">{t("admin.review-queue")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{a.title}</h1>
          <div className="adm-status">
            <StatusBadge set="news" status={a.status} />
            <span>{a.source === "official" ? t("admin.official-announcement") : t("admin.submitted-by", { v: a.author_name || "—", v2: a.author_email || t("admin.deleted-account-2") })}</span>
          </div>
        </div>
        <div className="adm-actions">
          {a.source === "community" && a.status === "pending" && !a.is_own && (
            <>
              <Button onClick={() => void act("approve")} loading={busy === "approve"}>{t("admin.approve")}</Button>
              <Button variant="secondary" onClick={() => { setModal("reject"); setPreset(REJECT_REASONS[0]); }}>{t("admin.reject")}</Button>
            </>
          )}
          {a.status === "successful" && !a.is_own && <Button variant="secondary" onClick={() => setModal("remove")}>{t("admin.remove-2")}</Button>}
          {a.status === "removed" && <Button variant="secondary" onClick={() => void act("restore")} loading={busy === "restore"}>{t("admin.restore")}</Button>}
        </div>
      </header>
      {a.is_own && <Banner tone="info">{t("admin.this-is-your-own-submission-another")}</Banner>}
      {a.decision_reason && a.status === "rejected" && <Banner tone="error" title={t("admin.rejected")}>{a.decision_reason}</Banner>}
      {a.removed_reason && a.status === "removed" && <Banner tone="warning" title={a.removed_rule ? t("admin.removed-under", { removed_rule: a.removed_rule }) : t("admin.removed")}>{a.removed_reason}</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="preview-h">
          <h2 id="preview-h">{t("admin.as-readers-would-see-it")}</h2>
          <SourceBadges a={{ ...a, pinned: false }} />
          <p className="news-meta">
            {a.source === "community" && <>{t("admin.by-4", { v: a.show_author_name ? a.author_name : t("admin.a-member") })}</>}
            {a.state_label || t("admin.all-of-nigeria")}
          </p>
          {a.image && <ArticleImage image={a.image} />}
          <ArticleBody body={a.body} />
          {a.source_url && (
            <p className="article-source">{t.rich("admin.source-2", { v: a.source_name && `${a.source_name} — `, source_url: a.source_url, a: (chunks) => <a href={a.source_url} target="_blank" rel="noopener noreferrer nofollow ugc">{chunks}</a> })}</p>
          )}
        </section>
        <section className="adm-panel" aria-labelledby="check-h">
          {a.source === "community" && a.status === "pending" && (
            <>
              <h2 id="check-h">{t("admin.before-you-decide")}</h2>
              <ul className="adm-declarations">{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}
          <h2>{t("admin.reports-2")}</h2>
          <CaseLink c={a.case} />
          <h2>{t("admin.history")}</h2>
          <ol className="adm-history">
            {(a.events ?? []).map((e, i) => (
              <li key={i}><strong>{e.event.replace(/_/g, " ")}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>
            ))}
          </ol>
        </section>
      </div>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal === "reject" ? t("admin.reject-this-article") : t("admin.remove-this-article")}
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button variant="danger" disabled={!finalReason || (modal === "remove" && !rule)} loading={busy === modal}
            onClick={() => modal && void act(modal, modal === "remove" ? { reason: finalReason, rule, note_to_author: finalReason } : { reason: finalReason })}>
            {modal === "reject" ? t("admin.reject-article") : t("admin.remove-article")}
          </Button></>}>
        <p>{modal === "reject" ? t("admin.the-author-sees-this-reason-and") : t("admin.it-disappears-from-ndcconnect-and-its")}</p>
        {modal === "remove" && <RuleSelect value={rule} onChange={setRule} />}
        {modal === "reject" && <Select label={t("admin.reason")} value={preset} onChange={(e) => setPreset(e.target.value)} options={REJECT_REASONS.map((r) => ({ value: r, label: r }))} />}
        <TextArea label={modal === "reject" && preset !== "Other" ? t("admin.more-detail-optional") : t("admin.reason")} required={modal !== "reject" || preset === "Other"}
          rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
