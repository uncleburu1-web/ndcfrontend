/** /admin/moderation/legal — legal notices with deadlines, and the log form (spec 13 §4.7). System admins only. */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Checkbox, EmptyState, Modal, Select, Skeleton, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { LegalNoticeDetail, LegalNoticeRow } from "../../../moderation/types";
import { untilWords } from "../../../moderation/words";
import { AdminNav } from "../AdminNav";
import { ModerationNav } from "./ModerationNav";
import "../candidates/admin.css";
import "../../../moderation/moderation.css";
import { t } from "../../../i18n";

const EMPTY = {
  kind: "agency", sender_name: "", sender_org: "", sender_contact: "", sender_reference: "", legal_basis: "", received_at: "",
  items: "", work_description: "", signature: "",
};

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AdminLegalPage() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const res = useRequest("legal-notices", (signal) => api<{ count: number; results: LegalNoticeRow[] }>("/admin/moderation/legal/", { signal }));
  const [logging, setLogging] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = t("admin.legal-notices-ndcconnect-admin");
  }, []);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const n = await api<LegalNoticeDetail>("/admin/moderation/legal/", {
        method: "POST",
        body: { ...f, received_at: new Date(f.received_at || nowLocal()).toISOString(), items: f.items.split(/\s+/).filter(Boolean),
          declaration_accepted: declared },
      });
      toast.show({ tone: "success", message: t("admin.logged-as-a-case-was-opened", { reference: n.reference }) });
      navigate(`/admin/moderation/legal/${n.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.couldn-t-log-the-notice"));
    } finally {
      setBusy(false);
    }
  };

  const rows = res.data?.results ?? [];
  return (
    <div className="adm-page">
      <AdminNav current="moderation" />
      <ModerationNav current="legal" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.legal-notices")}</h1>
          <p className="ds-field__hint">
            {t("admin.agency-notices-must-be-acknowledged-and")}</p>
        </div>
        <Button onClick={() => { setF({ ...EMPTY, received_at: nowLocal() }); setDeclared(false); setLogging(true); }}>{t("admin.log-a-notice")}</Button>
      </header>
      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-notices")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("admin.no-legal-notices-yet")} />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>{t("admin.notice")}</th><th>{t("admin.from-2")}</th><th>{t("admin.received")}</th><th>{t("admin.deadline")}</th><th>{t("admin.items")}</th></tr></thead>
            <tbody>
              {rows.map((n) => {
                const due = n.status === "open" ? untilWords(n.due_at) : null;
                return (
                  <tr key={n.id}>
                    <td><Link to={`/admin/moderation/legal/${n.id}`}>{n.reference}</Link><br /><span className="mod-meta">{n.kind_label}</span></td>
                    <td>{n.sender_org || n.sender_name}</td>
                    <td>{formatDate(n.received_at, { withTime: true })}{n.acknowledged_at ? <><br /><span className="mod-meta">{t("admin.acknowledged-2")}</span></> : <><br /><span className="mod-meta">{t("admin.not-acknowledged")}</span></>}</td>
                    <td>{n.status === "closed" ? t("admin.done") : due ? <span className={`mod-due${due.overdue ? " mod-due--overdue" : ""}`}>{due.text}</span> : "—"}</td>
                    <td>{n.pending_items ? t("admin.of-waiting", { pending_items: n.pending_items, items: n.items }) : t("admin.decided", { items: n.items })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={logging} onClose={() => setLogging(false)} title={t("admin.log-a-legal-notice")}
        footer={<><Button variant="secondary" onClick={() => setLogging(false)}>{t("admin.cancel")}</Button>
          <Button type="submit" form="legal-form" loading={busy} loadingLabel={t("admin.logging")}>{t("admin.log-notice")}</Button></>}>
        <form id="legal-form" onSubmit={(e) => void submit(e)} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          <Select label={t("admin.type")} required value={f.kind} onChange={set("kind")} options={[
            { value: "agency", label: t("admin.authorised-government-agency") }, { value: "court_order", label: t("admin.court-order") },
            { value: "copyright", label: t("admin.copyright-notice") },
          ]} />
          <TextField label={f.kind === "court_order" ? t("admin.court") : f.kind === "agency" ? t("admin.agency") : t("admin.organisation-optional")} value={f.sender_org} onChange={set("sender_org")} />
          <TextField label={t("admin.name-of-the-sender-or-officer")} required value={f.sender_name} onChange={set("sender_name")} />
          <TextField label={t("admin.their-contact")} required value={f.sender_contact} onChange={set("sender_contact")} hint={t("admin.email-phone-or-postal-address")} />
          <TextField label={t("admin.their-reference-optional")} value={f.sender_reference} onChange={set("sender_reference")} />
          <TextField label={t("admin.received-at")} required value={f.received_at} onChange={set("received_at")} hint={t("admin.date-and-time-e-g-2026")} />
          <TextField label={f.kind === "agency" ? t("admin.legal-basis-law-and-section") : t("admin.legal-basis-optional")} required={f.kind === "agency"}
            value={f.legal_basis} onChange={set("legal_basis")} hint={t("admin.for-example-nitda-act-2007-s")} />
          <TextArea label={t("admin.ndcconnect-links-or-ids")} required rows={3} value={f.items} onChange={set("items")} hint={t("admin.one-per-line")} />
          {f.kind === "copyright" && (
            <>
              <TextArea label={t("admin.the-work")} required rows={2} value={f.work_description} onChange={set("work_description")} />
              <TextField label={t("admin.signature")} required value={f.signature} onChange={set("signature")} />
              <Checkbox label={t("admin.the-notice-includes-the-s-54")} checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
            </>
          )}
          <p className="ds-field__hint">{t("admin.upload-a-copy-of-the-notice")}</p>
        </form>
      </Modal>
    </div>
  );
}
