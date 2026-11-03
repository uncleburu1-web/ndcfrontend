/** /admin/privacy/incidents/:id — clocks, timeline, notifications, security notice and close (spec 14 §4.7). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Modal, RadioGroup, Select, Skeleton, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ClockBadge, IncidentStatusBadge } from "../../../privacy/badges";
import type { Incident } from "../../../privacy/types";
import { AdminNav } from "../AdminNav";
import { PrivacyNav } from "./PrivacyNav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";

const EVENT_WORDS: Record<string, string> = { logged: "Incident logged", closed: "Incident closed", updated: "Incident updated" };

type Dialog = "step" | "notify" | "notice" | "close" | "edit" | null;

export default function AdminIncidentPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`incident-${id}`, (signal) => api<Incident>(`/admin/privacy/incidents/${id}/`, { signal }));
  const [inc, setInc] = useState<Incident | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");
  const [notify, setNotify] = useState({ kind: "ndpc", how: "", reference: "" });
  const [notice, setNotice] = useState({ text: "", audience: "list", lines: "" });
  const [preview, setPreview] = useState<{ count: number; unmatched: string[]; unmatched_count: number } | null>(null);
  const [closing, setClosing] = useState({ root_cause: "", lessons: "" });
  const [edit, setEdit] = useState({ risk: "none", is_personal_data_breach: false, is_cyber_incident: false, status: "open" });
  useEffect(() => {
    if (res.data) setInc(res.data);
  }, [res.data]);
  useEffect(() => {
    document.title = "Incident | NDCConnect admin";
  }, []);

  const openDialog = (d: Dialog) => {
    setError("");
    setPreview(null);
    if (d === "edit" && inc) setEdit({ risk: inc.risk, is_personal_data_breach: inc.is_personal_data_breach, is_cyber_incident: inc.is_cyber_incident,
      status: inc.status === "closed" ? "open" : inc.status });
    setDialog(d);
  };

  const post = async (path: string, body: unknown, done: string, method: "POST" | "PATCH" = "POST") => {
    setBusy(true);
    setError("");
    try {
      const r = await api<Incident & { incident?: Incident; sent?: number; unmatched_count?: number }>(`/admin/privacy/incidents/${id}/${path}`, { method, body });
      setInc(r.incident ?? r);
      toast.show({ tone: "success", message: r.sent != null ? `Sent to ${r.sent} account${r.sent === 1 ? "" : "s"}${r.unmatched_count ? `; ${r.unmatched_count} line${r.unmatched_count === 1 ? "" : "s"} didn’t match` : ""}.` : done });
      setDialog(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : "Couldn’t save that.");
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    try {
      setPreview(await api(`/admin/privacy/incidents/${id}/notice-preview/`, { method: "POST", body: notice }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t count the audience.");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dialog === "step") void post("steps/", { text: step }, "Step added.");
    if (dialog === "notify") void post("notifications/", notify, "Notification recorded.");
    if (dialog === "notice") void post("notice/", notice, "Notice sent.");
    if (dialog === "close") void post("close/", closing, "Incident closed.");
    if (dialog === "edit") void post("", edit, "Incident updated.", "PATCH");
  };

  const open = inc && inc.status !== "closed";
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="incidents" />
      <p><Link to="/admin/privacy/incidents">All incidents</Link></p>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load this incident" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !inc ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <>
          <header className="adm-page__head">
            <div>
              <h1>{inc.reference}: {inc.title}</h1>
              <p className="privacy-meta">Detected {formatDate(inc.detected_at, { withTime: true })} · aware {formatDate(inc.aware_at, { withTime: true })} · {inc.risk_label}</p>
            </div>
            <IncidentStatusBadge status={inc.status} />
          </header>
          <section className="adm-panel" aria-labelledby="clocks-h">
            <h2 id="clocks-h">Deadlines</h2>
            {inc.clocks.length === 0 ? <p className="privacy-meta">No reporting clock applies (not a breach with risk, and not a cyber incident).</p> : (
              <div className="privacy-clocks">{inc.clocks.map((c) => <ClockBadge key={c.key} state={c.state} words={c.words} />)}</div>
            )}
            {open && (
              <div className="privacy-inline-actions">
                <Button size="sm" onClick={() => openDialog("notify")}>Record a notification</Button>
                <Button size="sm" variant="secondary" onClick={() => openDialog("edit")}>Update risk and type</Button>
              </div>
            )}
          </section>
          <section className="adm-panel">
            <h2>Details (internal)</h2>
            <dl className="privacy-dl">
              <dt>What happened</dt><dd>{inc.description || "—"}</dd>
              <dt>Systems</dt><dd>{inc.systems || "—"}</dd>
              <dt>Data categories</dt><dd>{inc.data_categories?.join(", ") || "—"}</dd>
              <dt>People affected (estimate)</dt><dd>{inc.people_affected_estimate ?? "—"}</dd>
              <dt>Processor</dt><dd>{inc.processor || "None"}</dd>
              <dt>NDPC</dt><dd>{inc.ndpc_notified_at ? `Notified ${formatDate(inc.ndpc_notified_at, { withTime: true })}${inc.ndpc_reference ? ` · ref ${inc.ndpc_reference}` : ""}` : "Not notified"}</dd>
              <dt>ngCERT</dt><dd>{inc.ngcert_notified_at ? `Notified ${formatDate(inc.ngcert_notified_at, { withTime: true })}${inc.ngcert_reference ? ` · ref ${inc.ngcert_reference}` : ""}` : "Not notified"}</dd>
              <dt>People affected</dt><dd>{inc.people_notified_at ? `Told ${formatDate(inc.people_notified_at, { withTime: true })}` : "Not told"}</dd>
            </dl>
          </section>
          <section className="adm-panel">
            <h2>Security notice to people</h2>
            {inc.notice_text ? <p className="privacy-note">Last sent {inc.notice_sent_at ? formatDate(inc.notice_sent_at, { withTime: true }) : ""}: {inc.notice_text}</p> : <p className="privacy-meta">None sent.</p>}
            {open && (inc.can_send_notice ? <Button size="sm" onClick={() => openDialog("notice")}>Write a notice</Button>
              : <p className="privacy-meta">A notice was sent for this version. Update the risk or type to send another.</p>)}
          </section>
          <section className="adm-panel">
            <h2>Timeline</h2>
            <ol className="privacy-events">
              {(inc.events ?? []).map((e, i) => (
                <li key={i}><span className="privacy-meta">{formatDate(e.at, { withTime: true })}{e.by ? ` · ${e.by}` : ""}</span><br />{e.note || EVENT_WORDS[e.event] || e.event.replace(/_/g, " ")}</li>
              ))}
            </ol>
            {open && <Button size="sm" variant="secondary" onClick={() => openDialog("step")}>Add a step</Button>}
          </section>
          {inc.status === "closed" ? (
            <section className="adm-panel">
              <h2>Closed {inc.closed_at ? formatDate(inc.closed_at) : ""}</h2>
              <p><strong>Root cause:</strong> {inc.root_cause}</p>
              {inc.lessons && <p><strong>Lessons and follow-up:</strong> {inc.lessons}</p>}
            </section>
          ) : (
            <p><Button variant="secondary" onClick={() => openDialog("close")}>Close the incident</Button></p>
          )}
        </>
      )}
      <Modal open={dialog !== null} onClose={() => setDialog(null)}
        title={{ step: "Add a step", notify: "Record a notification", notice: "Security notice", close: "Close the incident", edit: "Update the incident" }[dialog ?? "step"]}
        footer={<><Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button type="submit" form="inc-action" loading={busy}>{dialog === "notice" ? "Send notice" : dialog === "close" ? "Close incident" : "Save"}</Button></>}>
        <form id="inc-action" onSubmit={submit} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          {dialog === "step" && <TextArea label="What was done" required value={step} onChange={(e) => setStep(e.target.value)} rows={3} />}
          {dialog === "notify" && (
            <>
              <Select label="Who was notified" value={notify.kind} onChange={(e) => setNotify({ ...notify, kind: e.target.value })}
                options={[{ value: "ndpc", label: "NDPC" }, { value: "ngcert", label: "ngCERT" }, { value: "people", label: "People affected" }]} />
              <TextField label="How" required value={notify.how} onChange={(e) => setNotify({ ...notify, how: e.target.value })} hint="e.g. NDPC breach portal, email to ngCERT via the sector CERT" />
              <TextField label="Their reference" value={notify.reference} onChange={(e) => setNotify({ ...notify, reference: e.target.value })} />
            </>
          )}
          {dialog === "notice" && (
            <>
              <TextArea label="Message" required rows={4} value={notice.text} maxLength={1000} onChange={(e) => setNotice({ ...notice, text: e.target.value })}
                hint="Plain text. Only NDCConnect paths like /account/privacy, no other links." />
              <RadioGroup legend="Send to" name="audience" value={notice.audience} onChange={(v) => { setNotice({ ...notice, audience: v }); setPreview(null); }}
                options={[{ value: "list", label: "A list of accounts" }, { value: "everyone", label: "Everyone" }]} />
              {notice.audience === "list" && (
                <TextArea label="Account IDs or emails, one per line" rows={4} value={notice.lines} onChange={(e) => { setNotice({ ...notice, lines: e.target.value }); setPreview(null); }} />
              )}
              <Button size="sm" variant="secondary" onClick={runPreview}>Count recipients</Button>
              {preview && (
                <p className="privacy-meta" role="status">
                  {preview.count} account{preview.count === 1 ? "" : "s"} will get it.
                  {preview.unmatched_count > 0 && ` ${preview.unmatched_count} line${preview.unmatched_count === 1 ? "" : "s"} didn’t match: ${preview.unmatched.slice(0, 5).join(", ")}${preview.unmatched_count > 5 ? "…" : ""}`}
                </p>
              )}
              <p className="ds-field__hint">You’ll be asked to confirm it’s you. One notice per version of the incident.</p>
            </>
          )}
          {dialog === "close" && (
            <>
              <TextArea label="Root cause" required rows={3} value={closing.root_cause} onChange={(e) => setClosing({ ...closing, root_cause: e.target.value })} />
              <TextArea label="Lessons and follow-up work" rows={3} value={closing.lessons} onChange={(e) => setClosing({ ...closing, lessons: e.target.value })} />
              <p className="ds-field__hint">You’ll be asked to confirm it’s you.</p>
            </>
          )}
          {dialog === "edit" && (
            <>
              <Select label="Risk to people" value={edit.risk} onChange={(e) => setEdit({ ...edit, risk: e.target.value })}
                options={[{ value: "none", label: "None" }, { value: "low", label: "Some risk" }, { value: "high", label: "High risk" }]} />
              <Select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                options={[{ value: "open", label: "Open" }, { value: "contained", label: "Contained" }]} />
              <label className="ds-check"><input type="checkbox" className="ds-check__input" checked={edit.is_personal_data_breach} onChange={(e) => setEdit({ ...edit, is_personal_data_breach: e.target.checked })} /> <span className="ds-check__label">Personal data breach</span></label>
              <label className="ds-check"><input type="checkbox" className="ds-check__input" checked={edit.is_cyber_incident} onChange={(e) => setEdit({ ...edit, is_cyber_incident: e.target.checked })} /> <span className="ds-check__label">Cyber incident</span></label>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
