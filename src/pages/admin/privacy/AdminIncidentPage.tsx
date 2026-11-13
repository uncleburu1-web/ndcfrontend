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
import { t } from "../../../i18n";

const EVENT_WORDS: Record<string, string> = { get logged() { return t("admin.incident-logged"); }, get closed() { return t("admin.incident-closed"); }, get updated() { return t("admin.incident-updated"); } };

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
    document.title = t("admin.incident-ndcconnect-admin");
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
      toast.show({ tone: "success", message: r.sent != null ? t("admin.sent-to-account", { sent: r.sent, v: r.sent === 1 ? "" : "s", v2: r.unmatched_count ? t("admin.line-didn-t-match", { unmatched_count: r.unmatched_count, v: r.unmatched_count === 1 ? "" : "s" }) : "" }) : done });
      setDialog(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("admin.couldn-t-save-that"));
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    try {
      setPreview(await api(`/admin/privacy/incidents/${id}/notice-preview/`, { method: "POST", body: notice }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldn-t-count-the-audience"));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dialog === "step") void post("steps/", { text: step }, t("admin.step-added"));
    if (dialog === "notify") void post("notifications/", notify, t("admin.notification-recorded"));
    if (dialog === "notice") void post("notice/", notice, t("admin.notice-sent"));
    if (dialog === "close") void post("close/", closing, t("admin.incident-closed-2"));
    if (dialog === "edit") void post("", edit, t("admin.incident-updated-2"), "PATCH");
  };

  const open = inc && inc.status !== "closed";
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="incidents" />
      <p><Link to="/admin/privacy/incidents">{t("admin.all-incidents")}</Link></p>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-this-incident")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !inc ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <>
          <header className="adm-page__head">
            <div>
              <h1>{inc.reference}: {inc.title}</h1>
              <p className="privacy-meta">{t("admin.detected-aware", { formatDate: formatDate(inc.detected_at, { withTime: true }), formatDate2: formatDate(inc.aware_at, { withTime: true }), risk_label: inc.risk_label })}</p>
            </div>
            <IncidentStatusBadge status={inc.status} />
          </header>
          <section className="adm-panel" aria-labelledby="clocks-h">
            <h2 id="clocks-h">{t("admin.deadlines")}</h2>
            {inc.clocks.length === 0 ? <p className="privacy-meta">{t("admin.no-reporting-clock-applies-not-a")}</p> : (
              <div className="privacy-clocks">{inc.clocks.map((c) => <ClockBadge key={c.key} state={c.state} words={c.words} />)}</div>
            )}
            {open && (
              <div className="privacy-inline-actions">
                <Button size="sm" onClick={() => openDialog("notify")}>{t("admin.record-a-notification")}</Button>
                <Button size="sm" variant="secondary" onClick={() => openDialog("edit")}>{t("admin.update-risk-and-type")}</Button>
              </div>
            )}
          </section>
          <section className="adm-panel">
            <h2>{t("admin.details-internal")}</h2>
            <dl className="privacy-dl">
              <dt>{t("admin.what-happened")}</dt><dd>{inc.description || "—"}</dd>
              <dt>{t("admin.systems")}</dt><dd>{inc.systems || "—"}</dd>
              <dt>{t("admin.data-categories")}</dt><dd>{inc.data_categories?.join(", ") || "—"}</dd>
              <dt>{t("admin.people-affected-estimate")}</dt><dd>{inc.people_affected_estimate ?? "—"}</dd>
              <dt>{t("admin.processor")}</dt><dd>{inc.processor || t("admin.none")}</dd>
              <dt>{t("admin.ndpc")}</dt><dd>{inc.ndpc_notified_at ? t("admin.notified", { formatDate: formatDate(inc.ndpc_notified_at, { withTime: true }), v: inc.ndpc_reference ? t("admin.ref", { ndpc_reference: inc.ndpc_reference }) : "" }) : t("admin.not-notified")}</dd>
              <dt>{t("admin.ngcert")}</dt><dd>{inc.ngcert_notified_at ? t("admin.notified", { formatDate: formatDate(inc.ngcert_notified_at, { withTime: true }), v: inc.ngcert_reference ? t("admin.ref-2", { ngcert_reference: inc.ngcert_reference }) : "" }) : t("admin.not-notified")}</dd>
              <dt>{t("admin.people-affected")}</dt><dd>{inc.people_notified_at ? t("admin.told", { formatDate: formatDate(inc.people_notified_at, { withTime: true }) }) : t("admin.not-told")}</dd>
            </dl>
          </section>
          <section className="adm-panel">
            <h2>{t("admin.security-notice-to-people")}</h2>
            {inc.notice_text ? <p className="privacy-note">{t("admin.last-sent", { v: inc.notice_sent_at ? formatDate(inc.notice_sent_at, { withTime: true }) : "", notice_text: inc.notice_text })}</p> : <p className="privacy-meta">{t("admin.none-sent")}</p>}
            {open && (inc.can_send_notice ? <Button size="sm" onClick={() => openDialog("notice")}>{t("admin.write-a-notice")}</Button>
              : <p className="privacy-meta">{t("admin.a-notice-was-sent-for-this")}</p>)}
          </section>
          <section className="adm-panel">
            <h2>{t("admin.timeline")}</h2>
            <ol className="privacy-events">
              {(inc.events ?? []).map((e, i) => (
                <li key={i}><span className="privacy-meta">{formatDate(e.at, { withTime: true })}{e.by ? ` · ${e.by}` : ""}</span><br />{e.note || EVENT_WORDS[e.event] || e.event.replace(/_/g, " ")}</li>
              ))}
            </ol>
            {open && <Button size="sm" variant="secondary" onClick={() => openDialog("step")}>{t("admin.add-a-step")}</Button>}
          </section>
          {inc.status === "closed" ? (
            <section className="adm-panel">
              <h2>{t("admin.closed-4", { v: inc.closed_at ? formatDate(inc.closed_at) : "" })}</h2>
              <p><strong>{t("admin.root-cause")}</strong> {inc.root_cause}</p>
              {inc.lessons && <p><strong>{t("admin.lessons-and-follow-up")}</strong> {inc.lessons}</p>}
            </section>
          ) : (
            <p><Button variant="secondary" onClick={() => openDialog("close")}>{t("admin.close-the-incident")}</Button></p>
          )}
        </>
      )}
      <Modal open={dialog !== null} onClose={() => setDialog(null)}
        title={{ step: "Add a step", notify: "Record a notification", notice: "Security notice", close: "Close the incident", edit: "Update the incident" }[dialog ?? "step"]}
        footer={<><Button variant="secondary" onClick={() => setDialog(null)}>{t("admin.cancel")}</Button>
          <Button type="submit" form="inc-action" loading={busy}>{dialog === "notice" ? t("admin.send-notice") : dialog === "close" ? t("admin.close-incident") : t("admin.save")}</Button></>}>
        <form id="inc-action" onSubmit={submit} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          {dialog === "step" && <TextArea label={t("admin.what-was-done")} required value={step} onChange={(e) => setStep(e.target.value)} rows={3} />}
          {dialog === "notify" && (
            <>
              <Select label={t("admin.who-was-notified")} value={notify.kind} onChange={(e) => setNotify({ ...notify, kind: e.target.value })}
                options={[{ value: "ndpc", label: "NDPC" }, { value: "ngcert", label: "ngCERT" }, { value: "people", label: t("admin.people-affected") }]} />
              <TextField label={t("admin.how")} required value={notify.how} onChange={(e) => setNotify({ ...notify, how: e.target.value })} hint={t("admin.e-g-ndpc-breach-portal-email")} />
              <TextField label={t("admin.their-reference")} value={notify.reference} onChange={(e) => setNotify({ ...notify, reference: e.target.value })} />
            </>
          )}
          {dialog === "notice" && (
            <>
              <TextArea label={t("admin.message")} required rows={4} value={notice.text} maxLength={1000} onChange={(e) => setNotice({ ...notice, text: e.target.value })}
                hint={t("admin.plain-text-only-ndcconnect-paths-like")} />
              <RadioGroup legend={t("admin.send-to")} name="audience" value={notice.audience} onChange={(v) => { setNotice({ ...notice, audience: v }); setPreview(null); }}
                options={[{ value: "list", label: t("admin.a-list-of-accounts") }, { value: "everyone", label: t("admin.everyone") }]} />
              {notice.audience === "list" && (
                <TextArea label={t("admin.account-ids-or-emails-one-per")} rows={4} value={notice.lines} onChange={(e) => { setNotice({ ...notice, lines: e.target.value }); setPreview(null); }} />
              )}
              <Button size="sm" variant="secondary" onClick={runPreview}>{t("admin.count-recipients")}</Button>
              {preview && (
                <p className="privacy-meta" role="status">
                  {t("admin.account-will-get-it", { count: preview.count, v: preview.count === 1 ? "" : "s", v2: preview.unmatched_count > 0 && t("admin.line-didn-t-match-2", { unmatched_count: preview.unmatched_count, v: preview.unmatched_count === 1 ? "" : "s", join: preview.unmatched.slice(0, 5).join(", "), v2: preview.unmatched_count > 5 ? "…" : "" }) })}
                </p>
              )}
              <p className="ds-field__hint">{t("admin.you-ll-be-asked-to-confirm")}</p>
            </>
          )}
          {dialog === "close" && (
            <>
              <TextArea label={t("admin.root-cause-2")} required rows={3} value={closing.root_cause} onChange={(e) => setClosing({ ...closing, root_cause: e.target.value })} />
              <TextArea label={t("admin.lessons-and-follow-up-work")} rows={3} value={closing.lessons} onChange={(e) => setClosing({ ...closing, lessons: e.target.value })} />
              <p className="ds-field__hint">{t("admin.you-ll-be-asked-to-confirm-2")}</p>
            </>
          )}
          {dialog === "edit" && (
            <>
              <Select label={t("admin.risk-to-people")} value={edit.risk} onChange={(e) => setEdit({ ...edit, risk: e.target.value })}
                options={[{ value: "none", label: t("admin.none") }, { value: "low", label: t("admin.some-risk") }, { value: "high", label: t("admin.high-risk") }]} />
              <Select label={t("admin.status")} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                options={[{ value: "open", label: t("admin.open") }, { value: "contained", label: t("admin.contained") }]} />
              <label className="ds-check"><input type="checkbox" className="ds-check__input" checked={edit.is_personal_data_breach} onChange={(e) => setEdit({ ...edit, is_personal_data_breach: e.target.checked })} /> <span className="ds-check__label">{t("admin.personal-data-breach")}</span></label>
              <label className="ds-check"><input type="checkbox" className="ds-check__input" checked={edit.is_cyber_incident} onChange={(e) => setEdit({ ...edit, is_cyber_incident: e.target.checked })} /> <span className="ds-check__label">{t("admin.cyber-incident")}</span></label>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
