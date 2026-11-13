/** /admin/moderation/legal/:id — one legal notice: acknowledgement, outcomes per item, hold, attachment, counter-notice (spec 13 §4.7). */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Modal, RadioGroup, Skeleton, StatusBadge, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { LegalNoticeDetail } from "../../../moderation/types";
import { KIND_LABEL, untilWords } from "../../../moderation/words";
import { saveBlob } from "../membership/download";
import { AdminNav } from "../AdminNav";
import { ModerationNav } from "./ModerationNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../moderation/moderation.css";
import { t } from "../../../i18n";

type Item = LegalNoticeDetail["items_detail"][number];

export default function AdminLegalNoticePage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`legal:${id}`, (signal) => api<LegalNoticeDetail>(`/admin/moderation/legal/${id}/`, { signal }));
  const [n, setN] = useState<LegalNoticeDetail | null>(null);
  const [ack, setAck] = useState(false);
  const [how, setHow] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => setN(res.data), [res.data]);
  useEffect(() => {
    document.title = t("admin.legal-notice-ndcconnect-admin");
  }, []);

  const run = async (key: string, fn: () => Promise<LegalNoticeDetail>, done: string) => {
    setBusy(key);
    try {
      setN(await fn());
      toast.show({ tone: "success", message: done });
      setAck(false);
      setItem(null);
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-work") });
    } finally {
      setBusy("");
    }
  };
  const upload = async () => {
    const f = file.current?.files?.[0];
    if (!f) return;
    const body = new FormData();
    body.append("file", f);
    await run("upload", () => api<LegalNoticeDetail>(`/admin/moderation/legal/${id}/attachment/`, { method: "POST", body }),
      t("admin.copy-of-the-notice-saved-privately"));
  };
  const download = async () => {
    try {
      const blob = await api<Blob>(`/admin/moderation/legal/${id}/attachment/`, { responseType: "blob" });
      const ext = blob.type === "application/pdf" ? ".pdf" : blob.type === "image/png" ? ".png" : ".jpg";
      saveBlob(blob, `${n?.reference ?? "notice"}${ext}`);
      toast.show({ tone: "success", message: t("admin.downloaded-opening-attachments-is-recorded-in") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-download-it") });
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="moderation" /><EmptyState title={t("admin.notice-not-found")} action={<Button href="/admin/moderation/legal">{t("admin.back-to-notices")}</Button>} /></div>;
  if (!n) return <div className="adm-page"><AdminNav current="moderation" /><Skeleton width="100%" height={240} /></div>;

  const due = n.status === "open" ? untilWords(n.due_at) : null;
  const allHeld = n.items_detail.length > 0 && n.items_detail.every((i) => i.case.legal_hold);
  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <ModerationNav current="legal" />
      <p className="adm-back"><Link to="/admin/moderation/legal">{t("admin.legal-notices-2")}</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{n.reference}: {n.kind_label}</h1>
          <div className="adm-status">
            <span>{n.status === "open" ? t("admin.open") : t("admin.closed-3")}</span>
            {due && <span className={`mod-due${due.overdue ? " mod-due--overdue" : ""}`}>{due.text}</span>}
            <span>{n.acknowledged_at ? t("admin.acknowledged", { formatDate: formatDate(n.acknowledged_at, { withTime: true }), acknowledged_how: n.acknowledged_how }) : t("admin.not-acknowledged-yet")}</span>
          </div>
        </div>
        <div className="adm-actions">
          {!n.acknowledged_at && <Button onClick={() => { setHow(""); setAck(true); }}>{t("admin.mark-acknowledged")}</Button>}
          <Button variant="secondary" loading={busy === "hold"}
            onClick={() => void run("hold", () => api(`/admin/moderation/legal/${id}/hold/`, { method: "POST", body: { on: !allHeld } }),
              allHeld ? t("admin.legal-hold-lifted") : t("admin.legal-hold-on-these-items-and"))}>
            {allHeld ? t("admin.lift-legal-hold") : t("admin.put-on-legal-hold")}
          </Button>
        </div>
      </header>
      {due?.overdue && <Banner tone="error" title={t("admin.deadline-passed")}>{t("admin.decide-each-item-now-nothing-is")}</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel">
          <h2>{t("admin.sender")}</h2>
          <dl className="adm-dl">
            <dt>{t("admin.from-2")}</dt><dd>{n.sender_name}{n.sender_org ? `, ${n.sender_org}` : ""}</dd>
            <dt>{t("admin.contact")}</dt><dd>{n.sender_contact}</dd>
            {n.sender_reference && <><dt>{t("admin.their-reference")}</dt><dd>{n.sender_reference}</dd></>}
            <dt>{t("admin.received")}</dt><dd>{formatDate(n.received_at, { withTime: true })}</dd>
            {n.legal_basis && <><dt>{t("admin.legal-basis")}</dt><dd>{n.legal_basis}</dd></>}
            {n.work_description && <><dt>{t("admin.the-work")}</dt><dd>{n.work_description}</dd></>}
            {n.signature && <><dt>{t("admin.signed")}</dt><dd>{n.signature}{n.declaration_accepted ? t("admin.declarations-ticked") : ""}</dd></>}
          </dl>
          <h2>{t("admin.copy-of-the-notice")}</h2>
          {n.has_attachment ? <Button size="sm" variant="secondary" onClick={() => void download()}>{t("admin.download-audited")}</Button> : <p className="ds-field__hint">{t("admin.none-uploaded")}</p>}
          <p>
            <label className="ds-field__label" htmlFor="legal-file">{t("admin.upload-a-pdf-jpeg-or-png")}</label><br />
            <input id="legal-file" className="mod-file" ref={file} type="file" accept="application/pdf,image/jpeg,image/png" />{" "}
            <Button size="sm" variant="secondary" onClick={() => void upload()} loading={busy === "upload"}>{t("admin.upload")}</Button>
          </p>
        </section>
        <section className="adm-panel">
          <h2>{t("admin.items")}</h2>
          <ul className="adm-history">
            {n.items_detail.map((i) => (
              <li key={i.id}>
                <strong>{KIND_LABEL[i.case.target_kind]}:</strong> <Link to={`/admin/moderation/${i.case.id}`}>{i.case.title || t("admin.untitled")}</Link>
                <br /><span className="mod-meta">{i.outcome_label}{i.outcome_reason ? ` — ${i.outcome_reason}` : ""}
                  {i.case.legal_hold ? t("admin.legal-hold-2") : ""}{i.case.restorable ? t("admin.can-be-restored-2") : ""}</span>
                <br /><Button size="sm" variant="ghost" onClick={() => { setItem(i); setOutcome(""); setReason(""); }}>{t("admin.record-outcome")}</Button>
              </li>
            ))}
          </ul>
          {n.kind === "copyright" && (
            <>
              <h2>{t("admin.counter-notice")}</h2>
              {n.counter_notice_at ? (
                <>
                  <p className="mod-meta">{t("admin.received-2", { formatDate: formatDate(n.counter_notice_at, { withTime: true }) })}</p>
                  <p className="mod-body">{n.counter_notice_text}</p>
                  {n.owner_notified_at ? (
                    <p>{t("admin.rights-owner-sent-a-copy-on", { formatDate: formatDate(n.owner_notified_at), counter_notice_days: n.counter_notice_days })}</p>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === "owner"}
                      onClick={() => void run("owner", () => api(`/admin/moderation/legal/${id}/owner-notified/`, { method: "POST" }), t("admin.recorded"))}>
                      {t("admin.i-ve-emailed-the-rights-owner")}</Button>
                  )}
                </>
              ) : <p className="ds-field__hint">{t("admin.none-yet")}</p>}
            </>
          )}
        </section>
      </div>

      <Modal open={ack} onClose={() => setAck(false)} title={t("admin.mark-acknowledged")}
        footer={<><Button variant="secondary" onClick={() => setAck(false)}>{t("admin.go-back")}</Button>
          <Button disabled={!how.trim()} loading={busy === "ack"}
            onClick={() => void run("ack", () => api(`/admin/moderation/legal/${id}/acknowledge/`, { method: "POST", body: { how } }), t("admin.acknowledgement-recorded"))}>{t("admin.save")}</Button></>}>
        <p>{t("admin.ndcconnect-doesn-t-send-the-acknowledgement")}</p>
        <TextField label={t("admin.how-it-was-acknowledged")} required value={how} onChange={(e) => setHow(e.target.value)} hint={t("admin.for-example-email-to-the-officer")} />
      </Modal>

      <Modal open={Boolean(item)} onClose={() => setItem(null)} title={t("admin.record-the-outcome")}
        footer={<><Button variant="secondary" onClick={() => setItem(null)}>{t("admin.go-back")}</Button>
          <Button disabled={!outcome || (outcome === "not_removed" && !reason.trim())} loading={busy === "item"}
            onClick={() => item && void run("item", () => api(`/admin/moderation/legal/${id}/items/${item.id}/`, { method: "PATCH", body: { outcome, reason } }), t("admin.outcome-recorded"))}>
            {t("admin.save")}</Button></>}>
        {item && <p><StatusBadge set="case" status={item.case.decision || item.case.status} /> {item.case.title}</p>}
        <RadioGroup legend={t("admin.outcome")} name="legal-outcome" required value={outcome} onChange={setOutcome} options={[
          { value: "removed", label: t("admin.removed-with-notice") },
          { value: "not_removed", label: t("admin.not-removed-give-the-reason") },
          { value: "restored", label: t("admin.restored") },
        ]} />
        <TextArea label={outcome === "not_removed" ? t("admin.reason") : t("admin.note-optional")} required={outcome === "not_removed"} rows={3} value={reason}
          onChange={(e) => setReason(e.target.value)} hint={t("admin.for-example-the-notice-doesn-t")} />
      </Modal>
    </div>
  );
}
