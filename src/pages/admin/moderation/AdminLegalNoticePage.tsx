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
    document.title = "Legal notice | NDCConnect admin";
  }, []);

  const run = async (key: string, fn: () => Promise<LegalNoticeDetail>, done: string) => {
    setBusy(key);
    try {
      setN(await fn());
      toast.show({ tone: "success", message: done });
      setAck(false);
      setItem(null);
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work." });
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
      "Copy of the notice saved privately.");
  };
  const download = async () => {
    try {
      const blob = await api<Blob>(`/admin/moderation/legal/${id}/attachment/`, { responseType: "blob" });
      const ext = blob.type === "application/pdf" ? ".pdf" : blob.type === "image/png" ? ".png" : ".jpg";
      saveBlob(blob, `${n?.reference ?? "notice"}${ext}`);
      toast.show({ tone: "success", message: "Downloaded. Opening attachments is recorded in the audit log." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t download it." });
    }
  };

  if (res.error) return <div className="adm-page"><AdminNav current="moderation" /><EmptyState title="Notice not found" action={<Button href="/admin/moderation/legal">Back to notices</Button>} /></div>;
  if (!n) return <div className="adm-page"><AdminNav current="moderation" /><Skeleton width="100%" height={240} /></div>;

  const due = n.status === "open" ? untilWords(n.due_at) : null;
  const allHeld = n.items_detail.length > 0 && n.items_detail.every((i) => i.case.legal_hold);
  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <ModerationNav current="legal" />
      <p className="adm-back"><Link to="/admin/moderation/legal">← Legal notices</Link></p>
      <header className="adm-page__head">
        <div>
          <h1>{n.reference}: {n.kind_label}</h1>
          <div className="adm-status">
            <span>{n.status === "open" ? "Open" : "Closed"}</span>
            {due && <span className={`mod-due${due.overdue ? " mod-due--overdue" : ""}`}>{due.text}</span>}
            <span>{n.acknowledged_at ? `Acknowledged ${formatDate(n.acknowledged_at, { withTime: true })} (${n.acknowledged_how})` : "Not acknowledged yet"}</span>
          </div>
        </div>
        <div className="adm-actions">
          {!n.acknowledged_at && <Button onClick={() => { setHow(""); setAck(true); }}>Mark acknowledged</Button>}
          <Button variant="secondary" loading={busy === "hold"}
            onClick={() => void run("hold", () => api(`/admin/moderation/legal/${id}/hold/`, { method: "POST", body: { on: !allHeld } }),
              allHeld ? "Legal hold lifted." : "Legal hold on: these items and their records won’t be pruned.")}>
            {allHeld ? "Lift legal hold" : "Put on legal hold"}
          </Button>
        </div>
      </header>
      {due?.overdue && <Banner tone="error" title="Deadline passed">Decide each item now. Nothing is removed automatically.</Banner>}

      <div className="adm-donation-grid">
        <section className="adm-panel">
          <h2>Sender</h2>
          <dl className="adm-dl">
            <dt>From</dt><dd>{n.sender_name}{n.sender_org ? `, ${n.sender_org}` : ""}</dd>
            <dt>Contact</dt><dd>{n.sender_contact}</dd>
            {n.sender_reference && <><dt>Their reference</dt><dd>{n.sender_reference}</dd></>}
            <dt>Received</dt><dd>{formatDate(n.received_at, { withTime: true })}</dd>
            {n.legal_basis && <><dt>Legal basis</dt><dd>{n.legal_basis}</dd></>}
            {n.work_description && <><dt>The work</dt><dd>{n.work_description}</dd></>}
            {n.signature && <><dt>Signed</dt><dd>{n.signature}{n.declaration_accepted ? " (declarations ticked)" : ""}</dd></>}
          </dl>
          <h2>Copy of the notice</h2>
          {n.has_attachment ? <Button size="sm" variant="secondary" onClick={() => void download()}>Download (audited)</Button> : <p className="ds-field__hint">None uploaded.</p>}
          <p>
            <label className="ds-field__label" htmlFor="legal-file">Upload a PDF, JPEG or PNG (up to 10 MB)</label><br />
            <input id="legal-file" className="mod-file" ref={file} type="file" accept="application/pdf,image/jpeg,image/png" />{" "}
            <Button size="sm" variant="secondary" onClick={() => void upload()} loading={busy === "upload"}>Upload</Button>
          </p>
        </section>
        <section className="adm-panel">
          <h2>Items</h2>
          <ul className="adm-history">
            {n.items_detail.map((i) => (
              <li key={i.id}>
                <strong>{KIND_LABEL[i.case.target_kind]}:</strong> <Link to={`/admin/moderation/${i.case.id}`}>{i.case.title || "(untitled)"}</Link>
                <br /><span className="mod-meta">{i.outcome_label}{i.outcome_reason ? ` — ${i.outcome_reason}` : ""}
                  {i.case.legal_hold ? " · Legal hold" : ""}{i.case.restorable ? " · Can be restored" : ""}</span>
                <br /><Button size="sm" variant="ghost" onClick={() => { setItem(i); setOutcome(""); setReason(""); }}>Record outcome</Button>
              </li>
            ))}
          </ul>
          {n.kind === "copyright" && (
            <>
              <h2>Counter-notice</h2>
              {n.counter_notice_at ? (
                <>
                  <p className="mod-meta">Received {formatDate(n.counter_notice_at, { withTime: true })}</p>
                  <p className="mod-body">{n.counter_notice_text}</p>
                  {n.owner_notified_at ? (
                    <p>Rights owner sent a copy on {formatDate(n.owner_notified_at)}. If they don’t answer within {n.counter_notice_days} days, the item shows “Can be restored”.</p>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy === "owner"}
                      onClick={() => void run("owner", () => api(`/admin/moderation/legal/${id}/owner-notified/`, { method: "POST" }), "Recorded.")}>
                      I’ve emailed the rights owner a copy
                    </Button>
                  )}
                </>
              ) : <p className="ds-field__hint">None yet.</p>}
            </>
          )}
        </section>
      </div>

      <Modal open={ack} onClose={() => setAck(false)} title="Mark acknowledged"
        footer={<><Button variant="secondary" onClick={() => setAck(false)}>Go back</Button>
          <Button disabled={!how.trim()} loading={busy === "ack"}
            onClick={() => void run("ack", () => api(`/admin/moderation/legal/${id}/acknowledge/`, { method: "POST", body: { how } }), "Acknowledgement recorded.")}>Save</Button></>}>
        <p>NDCConnect doesn’t send the acknowledgement; record how you sent it.</p>
        <TextField label="How it was acknowledged" required value={how} onChange={(e) => setHow(e.target.value)} hint="For example “Email to the officer, 10:05”." />
      </Modal>

      <Modal open={Boolean(item)} onClose={() => setItem(null)} title="Record the outcome"
        footer={<><Button variant="secondary" onClick={() => setItem(null)}>Go back</Button>
          <Button disabled={!outcome || (outcome === "not_removed" && !reason.trim())} loading={busy === "item"}
            onClick={() => item && void run("item", () => api(`/admin/moderation/legal/${id}/items/${item.id}/`, { method: "PATCH", body: { outcome, reason } }), "Outcome recorded.")}>
            Save
          </Button></>}>
        {item && <p><StatusBadge set="case" status={item.case.decision || item.case.status} /> {item.case.title}</p>}
        <RadioGroup legend="Outcome" name="legal-outcome" required value={outcome} onChange={setOutcome} options={[
          { value: "removed", label: "Removed with notice" },
          { value: "not_removed", label: "Not removed (give the reason)" },
          { value: "restored", label: "Restored" },
        ]} />
        <TextArea label={outcome === "not_removed" ? "Reason" : "Note (optional)"} required={outcome === "not_removed"} rows={3} value={reason}
          onChange={(e) => setReason(e.target.value)} hint="For example “The notice doesn’t state a legal basis”." />
      </Modal>
    </div>
  );
}
