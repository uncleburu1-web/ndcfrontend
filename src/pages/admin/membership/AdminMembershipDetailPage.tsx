/** /admin/membership/:id — one application (spec 06 §4.4). NIN and photo views are audited. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, MaskedValue, Modal, Skeleton, StatusBadge, TextArea, useToast } from "../../../components/ui";
import { formatKobo } from "../../../donations/money";
import { formatDate } from "../../../lib/format";
import type { AdminMembership, MembershipConfig } from "../../../membership/types";
import { useAuthedImage } from "../../../membership/useAuthedImage";
import { AdminNav } from "../AdminNav";
import { MembershipSubnav } from "./MembershipSubnav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-membership.css";
import { t } from "../../../i18n";

type Action = "approve" | "reject" | "cancel" | "recheck-payment";
const ACTION_COPY: Record<"reject" | "cancel", { title: string; button: string; body: string }> = {
  reject: { get title() { return t("admin.reject-this-application"); }, get button() { return t("admin.reject-application"); }, get body() { return t("admin.the-applicant-sees-your-reason-if"); } },
  cancel: { get title() { return t("admin.cancel-this-membership"); }, get button() { return t("admin.cancel-membership"); }, get body() { return t("admin.for-a-resignation-letter-expulsion-under"); } },
};
const DECLARATION_LABELS: Record<string, string> = {
  get no_other_party() { return t("admin.not-a-member-of-any-other"); },
  get constitution() { return t("admin.abides-by-the-ndc-constitution"); },
  get data_processing() { return t("admin.agreed-to-register-processing"); },
};

function Photo({ id, has }: { id: string; has?: boolean }) {
  const [show, setShow] = useState(false);
  const url = useAuthedImage(show && has ? `/admin/membership/${id}/photo/` : null);
  if (!has) return <p className="ds-field__hint">{t("admin.no-photo-uploaded")}</p>;
  if (!show) return <Button size="sm" variant="secondary" onClick={() => setShow(true)}>{t("admin.show-photo-audited")}</Button>;
  return url ? <img src={url} alt={t("admin.applicant-s-membership-photo")} width={160} height={160} className="adm-member-photo" /> : <Skeleton width={160} height={160} />;
}

export default function AdminMembershipDetailPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`admin-membership:${id}`, (signal) => api<AdminMembership>(`/admin/membership/${id}/`, { signal }));
  const config = useRequest("admin-membership-settings", (signal) => api<MembershipConfig>("/admin/membership/settings/", { signal }));
  const [m, setM] = useState<AdminMembership | null>(null);
  const [modal, setModal] = useState<"reject" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Action | "">("");

  useEffect(() => setM(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.membership-application-ndcconnect-admin");
  }, []);

  const act = async (action: Action) => {
    setBusy(action);
    try {
      const body = action === "reject" || action === "cancel" ? { reason } : undefined;
      setM(await api<AdminMembership>(`/admin/membership/${id}/${action}/`, { method: "POST", body }));
      setModal(null);
      setReason("");
      toast.show({ tone: "success", message: { approve: t("admin.approved-the-member-is-now-active"), reject: t("admin.application-rejected"),
        cancel: t("admin.membership-cancelled"), "recheck-payment": t("admin.payment-re-checked-with-the-provider") }[action] });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-work") });
    } finally {
      setBusy("");
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="membership" /><EmptyState title={t("admin.application-not-found")} action={<Button href="/admin/membership">{t("admin.back-to-applications")}</Button>} /></div>;
  if (!m) return <div className="adm-page"><AdminNav current="membership" /><Skeleton width="100%" height={240} /></div>;

  const latest = m.payments?.[0];
  const canApprove = m.status === "pending_approval" && config.data?.requires_approval !== false && latest?.status === "successful" && m.pvc_status === "successful";
  const canReject = m.status === "pending_approval" || m.status === "payment_pending" || m.status === "draft";
  const canCancel = m.status === "active" || m.status === "pending_approval";
  const canRecheck = latest && ["pending", "initiated", "review"].includes(latest.status);

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <MembershipSubnav />
      <p className="adm-back"><Link to="/admin/membership">{t("admin.applications")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{m.full_name || m.user_email}</h1>
          <div className="adm-status">
            {m.status && <StatusBadge set="membership" status={m.status} />}
            {m.membership_number && <span>{t.rich("admin.no", { membership_number: m.membership_number, strong: (chunks) => <strong>{chunks}</strong> })}</span>}
            <span className="ds-field__hint">{t("admin.private-record")}</span>
          </div>
        </div>
        <div className="adm-actions">
          {canApprove && <Button onClick={() => void act("approve")} loading={busy === "approve"}>{t("admin.approve")}</Button>}
          {canReject && <Button variant="secondary" onClick={() => setModal("reject")}>{t("admin.reject")}</Button>}
          {canCancel && <Button variant="secondary" onClick={() => setModal("cancel")}>{t("admin.cancel-membership")}</Button>}
          {canRecheck && <Button variant="secondary" onClick={() => void act("recheck-payment")} loading={busy === "recheck-payment"}>{t("admin.re-check-payment")}</Button>}
        </div>
      </header>

      {m.refund_due && (
        <Banner tone="warning" title={t("admin.refund-due")}>
          {t("admin.this-application-was-rejected-after-the")}</Banner>
      )}
      {m.status === "pending_approval" && m.pvc_status !== "successful" && (
        <Banner tone="warning">{t("admin.the-pvc-is-no-longer-verified")}</Banner>
      )}

      <div className="adm-donation-grid">
        <section className="adm-panel" aria-labelledby="details-h">
          <h2 id="details-h">{t("admin.register-details")}</h2>
          <dl className="adm-dl">
            <div><dt>{t("admin.full-name")}</dt><dd>{m.full_name || "—"}</dd></div>
            <div><dt>{t("admin.sex")}</dt><dd>{m.sex || "—"}</dd></div>
            <div><dt>{t("admin.date-of-birth")}</dt><dd>{m.date_of_birth ? formatDate(m.date_of_birth) : "—"}</dd></div>
            <div><dt>{t("admin.address")}</dt><dd>{m.address || "—"}</dd></div>
            <div><dt>{t("admin.state")}</dt><dd>{m.state_label || "—"}</dd></div>
            <div><dt>{t("admin.lga-ward")}</dt><dd>{[m.lga, m.ward].filter(Boolean).join(" / ") || "—"}</dd></div>
            <div><dt>{t("admin.polling-unit")}</dt><dd>{m.polling_unit || "—"}</dd></div>
            <div><dt>{t("admin.nin")}</dt><dd>{m.nin_masked ? <MaskedValue masked={m.nin_masked} label="NIN"
              onReveal={async () => (await api<{ nin: string }>(`/admin/membership/${id}/reveal-nin/`, { method: "POST" })).nin} /> : "—"}</dd></div>
            <div><dt>{t("admin.email")}</dt><dd>{m.user_email}</dd></div>
            <div><dt>{t("admin.phone")}</dt><dd>{m.user_phone || "—"}</dd></div>
            {m.activated_at && <div><dt>{t("admin.member-since")}</dt><dd>{formatDate(m.activated_at)}</dd></div>}
            {m.decision_reason && <div><dt>{t("admin.decision-reason")}</dt><dd>{m.decision_reason}</dd></div>}
            {m.cancel_reason && <div><dt>{t("admin.cancel-reason")}</dt><dd>{m.cancel_reason}</dd></div>}
          </dl>
          <h3 className="adm-subhead">{t("admin.declarations")}</h3>
          <ul className="adm-declarations">
            {Object.entries(DECLARATION_LABELS).map(([k, label]) => <li key={k}>{m.declarations?.[k] === true ? "✓" : "✗"} {label}</li>)}
          </ul>
          <h3 className="adm-subhead">{t("admin.photo")}</h3>
          <Photo id={id} has={m.has_photo} />
        </section>

        <section className="adm-panel" aria-labelledby="pvc-h">
          <h2 id="pvc-h">{t("admin.pvc")}</h2>
          <p><StatusBadge set="pvc" status={m.pvc_status as "unverified"} /></p>
          <ol className="adm-history">
            {(m.pvc_history ?? []).map((e, i) => <li key={i}><strong>{e.kind.replace(/_/g, " ")}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>)}
          </ol>
          <h2 id="pay-h">{t("admin.payments")}</h2>
          {!m.payments?.length ? <p className="ds-field__hint">{t("admin.no-payments-yet")}</p> : m.payments.map((p) => (
            <div key={p.reference} className="adm-member-payment">
              <p><strong>{p.reference}</strong> · {formatKobo(p.amount_kobo)} · <StatusBadge set="donation" status={p.status as "pending"} /></p>
              {p.review_reason && <p className="ds-field__hint">{t("admin.review-2", { review_reason: p.review_reason })}</p>}
              <ol className="adm-history">
                {p.events.map((e, i) => <li key={i}>{e.source} · {e.event || `${e.status_from || "—"} → ${e.status_to}`} · {formatDate(e.received_at, { withTime: true })}{e.note ? ` — ${e.note}` : ""}</li>)}
              </ol>
            </div>
          ))}
        </section>
      </div>

      <section className="adm-panel" aria-labelledby="hist-h">
        <h2 id="hist-h">{t("admin.history-and-audit-trail")}</h2>
        <ol className="adm-history">
          {(m.events ?? []).map((e, i) => <li key={`e${i}`}>{e.status_from || t("admin.new")} → <strong>{e.status_to}</strong> · {formatDate(e.created_at, { withTime: true })}{e.actor_email ? ` · ${e.actor_email}` : ""}{e.note ? ` — ${e.note}` : ""}</li>)}
        </ol>
        <ol className="adm-history adm-history--audit">
          {(m.audit ?? []).map((a, i) => <li key={`a${i}`}><code>{a.action}</code> · {formatDate(a.created_at, { withTime: true })}{a.actor_email ? ` · ${a.actor_email}` : ""}</li>)}
        </ol>
      </section>

      <Modal open={Boolean(modal)} onClose={() => setModal(null)} title={modal ? ACTION_COPY[modal].title : ""}
        footer={modal && <><Button variant="secondary" onClick={() => setModal(null)}>{t("admin.go-back")}</Button>
          <Button variant="danger" disabled={!reason.trim()} loading={busy === modal} onClick={() => void act(modal)}>{ACTION_COPY[modal].button}</Button></>}>
        {modal && <p>{ACTION_COPY[modal].body}</p>}
        <TextArea label={t("admin.reason")} required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
