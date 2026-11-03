/** /admin/privacy/incidents — the incident and breach register with clocks in words (spec 14 §4.7). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, CANCELLED_REVERIFICATION } from "../../../auth/api";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Checkbox, EmptyState, Modal, Select, Skeleton, TextArea, TextField, useToast } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ClockBadge, IncidentStatusBadge } from "../../../privacy/badges";
import type { Incident, IncidentList } from "../../../privacy/types";
import { AdminNav } from "../AdminNav";
import { PrivacyNav } from "./PrivacyNav";
import "../candidates/admin.css";
import "../../../privacy/privacy.css";

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const EMPTY = { title: "", detected_at: "", aware_at: "", description: "", systems: "", people_affected_estimate: "", processor: "none",
  risk: "none", is_personal_data_breach: false, is_cyber_incident: false, data_categories: [] as string[] };

export default function AdminIncidentsPage() {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "closed" ? "closed" : "open";
  const res = useRequest(`incidents-${tab}`, (signal) => api<IncidentList>(`/admin/privacy/incidents/?tab=${tab}`, { signal }));
  const [logging, setLogging] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = "Incidents | NDCConnect admin";
  }, []);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const inc = await api<Incident>("/admin/privacy/incidents/", {
        method: "POST",
        body: {
          ...f,
          detected_at: new Date(f.detected_at || nowLocal()).toISOString(),
          aware_at: new Date(f.aware_at || nowLocal()).toISOString(),
          people_affected_estimate: f.people_affected_estimate === "" ? null : Number(f.people_affected_estimate),
        },
      });
      toast.show({ tone: "success", message: `Logged as ${inc.reference}.` });
      navigate(`/admin/privacy/incidents/${inc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t log the incident.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await api<Blob>("/admin/privacy/incidents/?format=csv", { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ndcconnect-breach-register-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t export." });
    }
  };

  const rows = res.data?.results ?? [];
  const toggleCat = (key: string) =>
    setF((x) => ({ ...x, data_categories: x.data_categories.includes(key) ? x.data_categories.filter((c) => c !== key) : [...x.data_categories, key] }));
  return (
    <div className="adm-page">
      <AdminNav current="privacy" />
      <PrivacyNav current="incidents" />
      <header className="adm-page__head">
        <div>
          <h1>Incidents and breaches</h1>
          <p className="ds-field__hint">
            Personal data breaches go to the NDPC within 72 hours of becoming aware; cyber incidents to ngCERT within 72 hours of detection.
            Nothing is sent automatically: record what you sent.
          </p>
        </div>
        <div className="privacy-inline-actions">
          <Button variant="secondary" onClick={exportCsv}>Download breach register</Button>
          <Button onClick={() => { setF({ ...EMPTY, detected_at: nowLocal(), aware_at: nowLocal() }); setError(""); setLogging(true); }}>Log an incident</Button>
        </div>
      </header>
      <div className="adm-subnav" role="tablist" aria-label="Incident status">
        {(["open", "closed"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""}
                  onClick={() => setParams(id === "open" ? {} : { tab: id })}>
            {id === "open" ? "Open" : "Closed"}{res.data?.counts?.[id] ? ` (${res.data.counts[id]})` : ""}
          </button>
        ))}
      </div>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load incidents" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "open" ? "No open incidents" : "No closed incidents"} />
      ) : (
        <ul className="privacy-incidents">
          {rows.map((i) => (
            <li key={i.id} className="adm-panel">
              <div className="privacy-row">
                <Link to={`/admin/privacy/incidents/${i.id}`}><strong>{i.reference}</strong>: {i.title}</Link>
                <IncidentStatusBadge status={i.status} />
              </div>
              <p className="privacy-meta">Aware {formatDate(i.aware_at, { withTime: true })} · {i.risk_label}</p>
              {i.clocks.length > 0 && (
                <div className="privacy-clocks">{i.clocks.map((c) => <ClockBadge key={c.key} state={c.state} words={c.words} />)}</div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={logging} onClose={() => setLogging(false)} title="Log an incident"
        footer={<><Button variant="secondary" onClick={() => setLogging(false)}>Cancel</Button>
          <Button type="submit" form="inc-form" loading={busy} loadingLabel="Logging…">Log incident</Button></>}>
        <form id="inc-form" onSubmit={(e) => void submit(e)} noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          <TextField label="Title" required value={f.title} onChange={set("title")} hint="Short and factual, without personal data." />
          <TextField label="Detected at" required value={f.detected_at} onChange={set("detected_at")} hint="e.g. 2026-11-02T09:30" />
          <TextField label="Became aware at" required value={f.aware_at} onChange={set("aware_at")} />
          <TextArea label="What happened (internal)" rows={3} value={f.description} onChange={set("description")}
            hint="Visible to privacy officers and system admins only. Don’t paste personal data." />
          <TextField label="Systems affected" value={f.systems} onChange={set("systems")} />
          <fieldset className="ds-fieldset">
            <legend className="ds-field__label">Data categories</legend>
            {(res.data?.categories ?? []).map((c) => (
              <Checkbox key={c.key} label={c.label} checked={f.data_categories.includes(c.key)} onChange={() => toggleCat(c.key)} />
            ))}
          </fieldset>
          <TextField label="People affected (estimate)" inputMode="numeric" value={f.people_affected_estimate} onChange={set("people_affected_estimate")} />
          <Select label="Processor involved" value={f.processor} onChange={set("processor")}
            options={(res.data?.processors ?? [{ key: "none", label: "None" }]).map((p) => ({ value: p.key, label: p.label }))} />
          <Select label="Initial risk to people" value={f.risk} onChange={set("risk")}
            options={[{ value: "none", label: "None" }, { value: "low", label: "Some risk" }, { value: "high", label: "High risk" }]} />
          <Checkbox label="Personal data breach (NDPC clock)" checked={f.is_personal_data_breach} onChange={(e) => setF((x) => ({ ...x, is_personal_data_breach: e.target.checked }))} />
          <Checkbox label="Cyber incident: attack, intrusion or malware (ngCERT clock)" checked={f.is_cyber_incident} onChange={(e) => setF((x) => ({ ...x, is_cyber_incident: e.target.checked }))} />
        </form>
      </Modal>
    </div>
  );
}
