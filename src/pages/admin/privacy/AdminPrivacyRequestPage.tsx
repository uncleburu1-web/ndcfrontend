/** /admin/privacy/requests/:id — one privacy request (spec 14 §4.5). Opening it is audited once a day. */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Modal, RadioGroup, Skeleton, TextArea, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { RequestStatusBadge } from "../../../privacy/badges";
import type { PrivacyRequest } from "../../../privacy/types";
import { AdminNav } from "../AdminNav";
import { PrivacyNav } from "./PrivacyNav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";
import { t } from "../../../i18n";

type Action = "reply" | "ask-info" | "resume" | "close";
const LINKED_BUTTON: Record<string, string> = {
  restrict_notifications: "Turn off follow notifications", hide_bylines: "Hide their name on news", erase_follows: "Remove all follows",
  erase_pvc: "Erase PVC record", erase_membership: "Erase membership register data",
};
const LABEL: Record<Action, string> = { get reply() { return t("admin.reply"); }, get "ask-info"() { return t("admin.ask-for-more-information"); }, get resume() { return t("admin.resume"); }, get close() { return t("admin.close-the-request"); } };

export default function AdminPrivacyRequestPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const res = useRequest(`privacy-request-${id}`, (signal) => api<PrivacyRequest>(`/admin/privacy/requests/${id}/`, { signal }));
  const [req, setReq] = useState<PrivacyRequest | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState("done");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linked, setLinked] = useState<{ key: string; label: string } | null>(null);
  useEffect(() => {
    if (res.data) setReq(res.data);
  }, [res.data]);
  useEffect(() => {
    document.title = t("admin.privacy-request-ndcconnect-admin");
  }, []);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      const body = action === "close" ? { outcome, text } : { text };
      setReq(await api<PrivacyRequest>(`/admin/privacy/requests/${id}/${action}/`, { method: "POST", body }));
      toast.show({ tone: "success", message: action === "close" ? t("admin.request-closed-the-person-was-told") : t("admin.saved-the-person-was-told") });
      setAction(null);
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldn-t-save-that"));
    } finally {
      setBusy(false);
    }
  };

  const doLinked = async () => {
    if (!linked) return;
    setBusy(true);
    try {
      const r = await api<{ label: string; count: number }>(`/admin/privacy/requests/${id}/actions/`, { method: "POST", body: { action: linked.key } });
      toast.show({ tone: "success", message: `${r.label} (${r.count}).` });
      setLinked(null);
      res.retry();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-do-that") });
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    try {
      const blob = await api<Blob>(`/admin/privacy/requests/${id}/export/`, { method: "POST", responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ndcconnect-data-${req?.reference ?? id}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show({ tone: "success", message: t("admin.export-downloaded-it-was-recorded-with") });
      res.retry();
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.couldn-t-export") });
    }
  };

  const open = req && (req.status === "open" || req.status === "waiting");
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="requests" />
      <p><Link to="/admin/privacy">{t("admin.all-requests")}</Link></p>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-this-request")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !req ? (
        <Skeleton width="100%" height={200} />
      ) : (
        <>
          <header className="adm-page__head">
            <div>
              <h1>{req.reference}: {req.kind_label}</h1>
              <p className="privacy-meta">
                {t.rich("admin.received-3", { formatDate: formatDate(req.received_at, { withTime: true }), due_words: req.due_words, span: (chunks) => <span className={`mod-due${req.overdue ? " mod-due--overdue" : ""}`}>{chunks}</span>, x4: req.status !== "waiting" && req.status === "open" && <> {t("admin.due", { formatDate: formatDate(req.due_at) })}</> })}
              </p>
            </div>
            <RequestStatusBadge status={req.status} officer />
          </header>
          <section className="adm-panel">
            <h2>{t("admin.the-person")}</h2>
            {req.person ? (
              req.person.deleted ? <p>{t("admin.deleted-account")}</p> : (
                <p><Link to={`/admin/users/${req.person.id}`}>{req.person.name || req.person.email}</Link> · {req.person.email}</p>
              )
            ) : <p>{t("admin.deleted-account")}</p>}
            <h2>{t("admin.what-they-asked")}</h2>
            <p className="privacy-note">{req.details || t("admin.no-details-given")}</p>
          </section>
          {open && (
            <section className="adm-panel">
              <h2>{t("admin.actions")}</h2>
              <div className="privacy-inline-actions">
                <Button size="sm" onClick={() => { setAction("reply"); setError(""); }}>{t("admin.reply")}</Button>
                {req.status === "open" && <Button size="sm" variant="secondary" onClick={() => { setAction("ask-info"); setError(""); }}>{t("admin.ask-for-more-information")}</Button>}
                {req.status === "waiting" && <Button size="sm" variant="secondary" onClick={() => { setAction("resume"); setError(""); }}>{t("admin.resume")}</Button>}
                <Button size="sm" variant="secondary" onClick={() => { setAction("close"); setError(""); }}>{t("admin.close-2")}</Button>
              </div>
              <h3>{t("admin.linked-actions")}</h3>
              <p className="ds-field__hint">{t("admin.each-uses-the-owning-area-s")}</p>
              <div className="privacy-inline-actions">
                <Button size="sm" variant="secondary" onClick={exportData}>{t("admin.export-their-data")}</Button>
                {(req.linked_actions ?? []).map((a) => (
                  <Button key={a.key} size="sm" variant="ghost" onClick={() => setLinked(a)}>{LINKED_BUTTON[a.key] ?? a.label}…</Button>
                ))}
              </div>
            </section>
          )}
          {req.outcome && (
            <section className="adm-panel">
              <h2>{t("admin.outcome")}</h2>
              <p>{req.outcome}</p>
            </section>
          )}
          <section className="adm-panel">
            <h2>{t("admin.history")}</h2>
            <ol className="privacy-events">
              {req.events.map((e, i) => (
                <li key={i}>
                  <span className="privacy-meta">{formatDate(e.at, { withTime: true })}{e.by ? ` · ${e.by}` : ""}{e.shown_to_person ? t("admin.shown-to-the-person") : t("admin.internal")}</span>
                  <br />{e.event.replace(/_/g, " ")}
                  {e.note && <p className="privacy-note">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      <Modal open={action !== null} onClose={() => setAction(null)} title={action ? LABEL[action] : ""}
        footer={<><Button variant="secondary" onClick={() => setAction(null)}>{t("admin.cancel")}</Button>
          <Button type="submit" form="req-action" loading={busy}>{action === "close" ? t("admin.close-request") : t("admin.send")}</Button></>}>
        <form id="req-action" onSubmit={(e) => void run(e)} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          {action === "close" && (
            <RadioGroup legend={t("admin.outcome")} name="outcome" value={outcome} onChange={setOutcome}
              options={[{ value: "done", label: t("admin.done") }, { value: "refused", label: t("admin.refused-give-the-legal-reason") }]} />
          )}
          <TextArea label={action === "close" ? t("admin.what-was-done-or-why-it") : action === "ask-info" ? t("admin.what-you-need-from-them-shown") : t("admin.message-shown-to-the-person")}
            required={action !== "resume"} value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          {action === "ask-info" && <p className="ds-field__hint">{t("admin.the-30-day-clock-pauses-until")}</p>}
        </form>
      </Modal>
      <Modal open={linked !== null} onClose={() => setLinked(null)} title={t("admin.confirm")}
        footer={<><Button variant="secondary" onClick={() => setLinked(null)}>{t("admin.cancel")}</Button>
          <Button variant="danger" onClick={doLinked} loading={busy}>{t("admin.do-it")}</Button></>}>
        <p>{t("admin.this-takes-effect-at-once-and", { label: linked?.label })}</p>
      </Modal>
    </div>
  );
}
