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
    document.title = "Legal notices | NDCConnect admin";
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
      toast.show({ tone: "success", message: `Logged as ${n.reference}. A case was opened for each item.` });
      navigate(`/admin/moderation/legal/${n.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t log the notice.");
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
          <h1>Legal notices</h1>
          <p className="ds-field__hint">
            Agency notices must be acknowledged and acted on within 48 hours (NITDA Code). Nothing is removed automatically: decide each item.
          </p>
        </div>
        <Button onClick={() => { setF({ ...EMPTY, received_at: nowLocal() }); setDeclared(false); setLogging(true); }}>Log a notice</Button>
      </header>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load notices" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : rows.length === 0 ? (
        <EmptyState title="No legal notices yet" />
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Notice</th><th>From</th><th>Received</th><th>Deadline</th><th>Items</th></tr></thead>
            <tbody>
              {rows.map((n) => {
                const due = n.status === "open" ? untilWords(n.due_at) : null;
                return (
                  <tr key={n.id}>
                    <td><Link to={`/admin/moderation/legal/${n.id}`}>{n.reference}</Link><br /><span className="mod-meta">{n.kind_label}</span></td>
                    <td>{n.sender_org || n.sender_name}</td>
                    <td>{formatDate(n.received_at, { withTime: true })}{n.acknowledged_at ? <><br /><span className="mod-meta">Acknowledged</span></> : <><br /><span className="mod-meta">Not acknowledged</span></>}</td>
                    <td>{n.status === "closed" ? "Done" : due ? <span className={`mod-due${due.overdue ? " mod-due--overdue" : ""}`}>{due.text}</span> : "—"}</td>
                    <td>{n.pending_items ? `${n.pending_items} of ${n.items} waiting` : `${n.items} decided`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={logging} onClose={() => setLogging(false)} title="Log a legal notice"
        footer={<><Button variant="secondary" onClick={() => setLogging(false)}>Cancel</Button>
          <Button type="submit" form="legal-form" loading={busy} loadingLabel="Logging…">Log notice</Button></>}>
        <form id="legal-form" onSubmit={(e) => void submit(e)} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          <Select label="Type" required value={f.kind} onChange={set("kind")} options={[
            { value: "agency", label: "Authorised Government Agency" }, { value: "court_order", label: "Court order" },
            { value: "copyright", label: "Copyright notice" },
          ]} />
          <TextField label={f.kind === "court_order" ? "Court" : f.kind === "agency" ? "Agency" : "Organisation (optional)"} value={f.sender_org} onChange={set("sender_org")} />
          <TextField label="Name of the sender or officer" required value={f.sender_name} onChange={set("sender_name")} />
          <TextField label="Their contact" required value={f.sender_contact} onChange={set("sender_contact")} hint="Email, phone or postal address." />
          <TextField label="Their reference (optional)" value={f.sender_reference} onChange={set("sender_reference")} />
          <TextField label="Received at" required value={f.received_at} onChange={set("received_at")} hint="Date and time, e.g. 2026-11-02T09:30" />
          <TextField label={f.kind === "agency" ? "Legal basis (law and section)" : "Legal basis (optional)"} required={f.kind === "agency"}
            value={f.legal_basis} onChange={set("legal_basis")} hint="For example “NITDA Act 2007 s. 6”." />
          <TextArea label="NDCConnect links or IDs" required rows={3} value={f.items} onChange={set("items")} hint="One per line." />
          {f.kind === "copyright" && (
            <>
              <TextArea label="The work" required rows={2} value={f.work_description} onChange={set("work_description")} />
              <TextField label="Signature" required value={f.signature} onChange={set("signature")} />
              <Checkbox label="The notice includes the s. 54(2) declarations" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
            </>
          )}
          <p className="ds-field__hint">Upload a copy of the notice on the next page.</p>
        </form>
      </Modal>
    </div>
  );
}
