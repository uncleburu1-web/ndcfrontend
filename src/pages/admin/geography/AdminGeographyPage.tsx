/**
 * /admin/geography — spec 19 §15.1. System admins: files (upload → preview → apply, with the 95% rule's second
 * admin), what each file changed, the review queue and aliases. PVC and membership officers: the review queue only.
 * Person-level detail stays on each record's own page; the queue shows typed text and places, never names.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../../auth/api";
import { useApi, useMe } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, Pagination, Select, Skeleton, Tabs, TextArea, TextField, useToast } from "../../../components/ui";
import { GeoPicker } from "../../../geo/GeoPicker";
import { EMPTY_GEO, geoBody, type AliasItem, type ChangePage, type DatasetAdmin, type DatasetDetail, type GeoValue, type ReviewItem,
  type ReviewPage } from "../../../geo/types";
import { formatDate } from "../../../lib/format";
import { STATES, stateLabel } from "../../../lib/nigeria";
import { AdminNav } from "../AdminNav";
import "../../../geo/geo.css";

const KIND_LABEL: Record<string, string> = {
  polling_units: "Polling units", senatorial_districts: "Senatorial districts", federal_constituencies: "Federal constituencies",
  state_constituencies: "State constituencies",
};
const WHY: Record<string, string> = {
  unlinked: "Typed, not linked", not_listed: "“Not listed”", retired: "Unit retired by INEC", person_choice: "Person’s choice waiting",
};

const fmtCounts = (d: Record<string, number> | undefined) =>
  d && Object.keys(d).length ? Object.entries(d).map(([k, v]) => `${v.toLocaleString()} ${k.replace("_", " ")}`).join(", ") : "none";

function Preview({ d }: { d: DatasetDetail }) {
  const p = (d.preview ?? {}) as {
    rows?: number; errors?: string[]; error_count?: number; counts?: Record<string, Record<string, number> | number>;
    per_state?: Record<string, number>; affected?: { memberships: number; pvc_records: number }; renamed?: Record<string, { code: string; old: string; new: string }[]>;
    retired?: Record<string, { code: string; name: string }[]>; moved?: { from: string; to: string; name: string }[];
    active_units?: number; current_units?: number;
  };
  const c = p.counts ?? {};
  return (
    <div className="geo-card">
      <h3>{KIND_LABEL[d.kind]} · {d.source}</h3>
      <p className="news-meta">{(p.rows ?? 0).toLocaleString()} rows · checksum {d.checksum.slice(0, 12)}{d.notes ? ` · ${d.notes}` : ""}</p>
      {(p.error_count ?? 0) > 0 && (
        <Banner tone="error" title={`${p.error_count} problem${p.error_count === 1 ? "" : "s"}: this file can’t be applied`}>
          <ul className="geo-errors">{(p.errors ?? []).map((e) => <li key={e}>{e}</li>)}</ul>
        </Banner>
      )}
      <dl>
        <dt>Added</dt><dd>{fmtCounts(c.added as Record<string, number>)}</dd>
        <dt>Renamed</dt><dd>{fmtCounts(c.renamed as Record<string, number>)}</dd>
        <dt>Back in the list</dt><dd>{fmtCounts(c.restored as Record<string, number>)}</dd>
        <dt>Retired</dt><dd>{fmtCounts(c.retired as Record<string, number>)}</dd>
        <dt>Moved</dt><dd>{String(c.moved ?? 0)}</dd>
        {d.kind === "polling_units" && <><dt>People affected</dt><dd>{p.affected?.memberships ?? 0} memberships and {p.affected?.pvc_records ?? 0} PVC
          checks point at retired or moved units</dd></>}
        {d.kind === "polling_units" && <><dt>Active units</dt><dd>{(p.active_units ?? 0).toLocaleString()} in the file, {(p.current_units ?? 0).toLocaleString()} now</dd></>}
      </dl>
      {p.per_state && Object.keys(p.per_state).length > 0 && (
        <details className="geo-details"><summary>Per state</summary>
          <p className="news-meta">{Object.entries(p.per_state).map(([s, n]) => `${stateLabel(s) || s}: ${n.toLocaleString()}`).join(" · ")}</p>
        </details>
      )}
      {p.renamed && Object.values(p.renamed).some((v) => v.length) && (
        <details className="geo-details"><summary>Renamed (first 500 of each)</summary>
          <ul>{Object.entries(p.renamed).flatMap(([lvl, v]) => v.map((x) => <li key={`${lvl}${x.code}`}>{x.code}: {x.old} → {x.new}</li>))}</ul>
        </details>
      )}
      {p.retired && Object.values(p.retired).some((v) => v.length) && (
        <details className="geo-details"><summary>Retired (first 500 of each)</summary>
          <ul>{Object.entries(p.retired).flatMap(([lvl, v]) => v.map((x) => <li key={`${lvl}${x.code}`}>{x.code}: {x.name}</li>))}</ul>
        </details>
      )}
      {p.moved && p.moved.length > 0 && (
        <details className="geo-details"><summary>Moved</summary>
          <ul>{p.moved.map((m) => <li key={m.from}>{m.name}: {m.from} → {m.to}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function Datasets() {
  const api = useApi();
  const toast = useToast();
  const { me } = useMe();
  const [nonce, setNonce] = useState(0);
  const list = useRequest(`geo-ds:${nonce}`, (signal) => api<{ results: DatasetAdmin[] }>("/admin/geography/datasets/", { signal }));
  const [open, setOpen] = useState<DatasetDetail | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("polling_units");
  const [source, setSource] = useState("");
  const [publishedOn, setPublishedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState<ChangePage | null>(null);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (source) fd.append("source", source);
    if (publishedOn) fd.append("published_on", publishedOn);
    if (notes) fd.append("notes", notes);
    setBusy(true);
    try {
      const d = await api<DatasetDetail>("/admin/geography/datasets/", { method: "POST", body: fd });
      setOpen(d);
      setChanges(null);
      setNonce((n) => n + 1);
      toast.show({ tone: "success", message: "Previewed. Nothing has changed yet." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  };
  const view = async (id: number) => {
    setChanges(null);
    setOpen(await api<DatasetDetail>(`/admin/geography/datasets/${id}/`));
  };
  const apply = async (second: boolean) => {
    if (!open) return;
    setBusy(true);
    try {
      const d = await api<DatasetDetail>(`/admin/geography/datasets/${open.id}/apply/`, { method: "POST", body: second ? { confirm_second: true } : {} });
      setOpen(d);
      setNonce((n) => n + 1);
      toast.show({ tone: "success", message: "Applied. Communities, search and notices update in the background." });
    } catch (err) {
      if (err instanceof ApiError && err.code === "geo_second_admin_required") {
        await view(open.id);
        toast.show({ tone: "info", message: err.message });
      } else toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t apply." });
    } finally {
      setBusy(false);
    }
  };
  const loadChanges = async (page: number) => {
    if (open) setChanges(await api<ChangePage>(`/admin/geography/datasets/${open.id}/changes/?page=${page}`));
  };
  const waitingForMe = open && open.status === "previewed" && open.first_approval_by && open.first_approval_by !== me?.email;

  return (
    <div className="geo-stack">
      <form className="geo-card" onSubmit={(e) => void upload(e)}>
        <h2>Upload a file</h2>
        <p className="news-meta">CSV from INEC (UTF-8, up to 50 MB). It’s checked and previewed first; nothing changes until you apply it.</p>
        <label className="ds-field__label" htmlFor="geo-file">File</label>
        <input id="geo-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Select label="What’s in it" value={kind} onChange={(e) => setKind(e.target.value)}
          options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
        <TextField label="Source" value={source} maxLength={300} onChange={(e) => setSource(e.target.value)} hint="INEC’s page or how the file was obtained" />
        <TextField label="INEC’s publication date" value={publishedOn} placeholder="YYYY-MM-DD" maxLength={10} onChange={(e) => setPublishedOn(e.target.value)} />
        <TextArea label="Notes" value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} hint="Who checked the file, and how" />
        <div className="geo-actions"><Button type="submit" loading={busy} disabled={!file}>Preview</Button></div>
      </form>

      {open && (
        <section aria-label="Selected file">
          <Preview d={open} />
          <div className="geo-actions">
            {open.status === "previewed" && open.error_count === 0 && (waitingForMe
              ? <Button loading={busy} onClick={() => void apply(true)}>Apply as the second admin</Button>
              : <Button loading={busy} onClick={() => void apply(false)}>Apply</Button>)}
            {open.status === "applied" && <Button variant="secondary" onClick={() => void loadChanges(1)}>What changed</Button>}
          </div>
          {open.needs_second_admin && (
            <Banner tone="warning">This file has fewer than 95% of the active polling units.
              {open.first_approval_by ? ` ${open.first_approval_by} approved it; a different system admin must apply it too.` : " Two system admins must apply it."}</Banner>
          )}
          {changes && (
            <div className="geo-scroll">
              <table className="geo-table">
                <caption className="visually-hidden">Changes</caption>
                <thead><tr><th scope="col">Level</th><th scope="col">Change</th><th scope="col">Code</th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
                <tbody>{changes.results.map((c, i) => (
                  <tr key={`${c.code}${i}`}><td>{c.level.replace("_", " ")}</td><td>{c.action}</td><td>{c.code}</td><td>{c.old_value}</td><td>{c.new_value}</td></tr>
                ))}</tbody>
              </table>
              <p className="news-meta">{changes.count.toLocaleString()} changes</p>
              {changes.next && <Button variant="secondary" size="sm" onClick={() => void loadChanges(changes.next!)}>Next page</Button>}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="geo-files">
        <h2 id="geo-files">Files</h2>
        {list.error ? <Banner tone="error">{list.error.message}</Banner> : !list.data ? <Skeleton width="100%" height={120} /> : list.data.results.length === 0
          ? <p className="news-meta">No files yet. Load INEC’s list with <code>load_geography</code> or upload it here.</p> : (
            <div className="geo-scroll">
              <table className="geo-table">
                <caption className="visually-hidden">Geography files</caption>
                <thead><tr><th scope="col">File</th><th scope="col">Status</th><th scope="col">Counts</th><th scope="col"><span className="visually-hidden">Open</span></th></tr></thead>
                <tbody>{list.data.results.map((d) => (
                  <tr key={d.id}>
                    <td>{KIND_LABEL[d.kind]}<br /><span className="news-meta">{d.source} · {formatDate(d.loaded_at)}</span></td>
                    <td>{d.status === "applied" ? `Applied ${d.applied_at ? formatDate(d.applied_at) : ""}` : d.error_count ? `${d.error_count} problems` : "Previewed"}</td>
                    <td>{d.status === "applied" ? (d.kind === "polling_units" ? `${d.polling_units.toLocaleString()} units` : `${d.constituencies} constituencies`) : `${d.changes} changes`}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => void view(d.id)}>Open</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

function ReviewRow({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const api = useApi();
  const toast = useToast();
  const s = item.suggestion;
  const [value, setValue] = useState<GeoValue>({ ...EMPTY_GEO, lga_id: s.lga?.id ?? null, ward_id: s.ward?.id ?? null, polling_unit_id: s.polling_unit?.id ?? null });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (action: "link" | "accept" | "ask") => {
    setBusy(true);
    try {
      await api(`/admin/geography/review/${item.kind}/${item.id}/`, { method: "POST", body: { action, ...(action === "link" ? geoBody(value, false) : {}) } });
      toast.show({ tone: "success", message: action === "ask" ? "Asked. They’ll get a notice." : "Saved." });
      onDone();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t save." });
    } finally {
      setBusy(false);
    }
  };
  const fmt = (p: ReviewItem["current"] | null | undefined) =>
    p?.lga ? [p.lga.name, p.ward?.name, p.polling_unit ? `${p.polling_unit.name} (${p.polling_unit.code})` : ""].filter(Boolean).join(" · ") : "—";
  return (
    <li className="geo-card">
      <p><strong>{item.kind === "pvc" ? "PVC check" : "Membership"}</strong> · {stateLabel(item.state)} · {WHY[item.why]}</p>
      <p className="news-meta">Typed: {[item.typed.lga, item.typed.ward, item.typed.polling_unit].filter(Boolean).join(" · ") || "—"}</p>
      <p className="news-meta">Linked: {fmt(item.current)}{item.pending ? ` · Their choice: ${fmt(item.pending)}` : ""}</p>
      {s.lga && <p className="news-meta">Suggestion: {[s.lga.name, s.ward?.name, s.polling_unit?.name].filter(Boolean).join(" · ")} ({Math.round(s.lga.score * 100)}%)</p>}
      <div className="geo-actions">
        {item.pending && <Button size="sm" loading={busy} onClick={() => void act("accept")}>Accept their choice</Button>}
        <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Link</Button>
        <Button size="sm" variant="ghost" loading={busy} onClick={() => void act("ask")}>Ask them</Button>
        <Link to={item.record_url}>Open the record</Link>
      </div>
      {open && (
        <div className="geo-card">
          <GeoPicker state={item.state} value={value} onChange={setValue} allowNotListed={false} required={item.kind === "pvc" ? ["lga", "ward", "polling_unit"] : ["lga"]} />
          <div className="geo-actions"><Button size="sm" loading={busy} onClick={() => void act("link")}>Save link</Button></div>
        </div>
      )}
    </li>
  );
}

function Review() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const kind = params.get("kind") ?? "";
  const state = params.get("state") ?? "";
  const why = params.get("why") ?? "";
  const page = Number(params.get("page")) || 1;
  const [nonce, setNonce] = useState(0);
  const q = new URLSearchParams({ ...(kind && { kind }), ...(state && { state }), ...(why && { why }), page: String(page) }).toString();
  const res = useRequest(`geo-review:${q}:${nonce}`, (signal) => api<ReviewPage>(`/admin/geography/review/?${q}`, { signal }));
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  const d = res.data;
  return (
    <div className="geo-stack">
      <div className="geo-actions">
        {d && d.kinds.length > 1 && <Select label="Records" value={kind} onChange={(e) => set("kind", e.target.value)}
          options={[{ value: "", label: "All" }, { value: "membership", label: "Memberships" }, { value: "pvc", label: "PVC checks" }]} />}
        <Select label="State" value={state} onChange={(e) => set("state", e.target.value)} options={[{ value: "", label: "All states" }, ...STATES]} />
        <Select label="Why" value={why} onChange={(e) => set("why", e.target.value)}
          options={[{ value: "", label: "Any reason" }, ...Object.entries(WHY).map(([value, label]) => ({ value, label }))]} />
      </div>
      {res.error ? <Banner tone="error">{res.error.message}</Banner> : !d ? <Skeleton width="100%" height={160} /> : (
        <>
          <p className="news-meta">{d.count} waiting{d.groups.length ? ` · ${d.groups.slice(0, 8).map((g) => `${stateLabel(g.state) || "—"}${g.lga ? `/${g.lga}` : ""}: ${g.count}`).join(" · ")}` : ""}</p>
          {d.results.length === 0 ? <p className="news-meta">Nothing to review.</p>
            : <ul className="geo-stack" aria-label="Records to review">{d.results.map((i) => <ReviewRow key={`${i.kind}${i.id}`} item={i} onDone={() => setNonce((n) => n + 1)} />)}</ul>}
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(d.count / 20))} onChange={(p) => set("page", String(p))} />
        </>
      )}
    </div>
  );
}

function Aliases() {
  const api = useApi();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [nonce, setNonce] = useState(0);
  const res = useRequest(`geo-alias:${q}:${nonce}`, (signal) => api<{ results: AliasItem[] }>(`/admin/geography/aliases/?q=${encodeURIComponent(q)}`, { signal }));
  const [state, setState] = useState("");
  const [value, setValue] = useState<GeoValue>(EMPTY_GEO);
  const [name, setName] = useState("");
  const level = value.polling_unit_id ? "polling_unit" : value.ward_id ? "ward" : "lga";
  const target = value.polling_unit_id ?? value.ward_id ?? value.lga_id;
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api("/admin/geography/aliases/", { method: "POST", body: { level, target_id: target, name } });
      setName("");
      setNonce((n) => n + 1);
      toast.show({ tone: "success", message: "Added." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t save." });
    }
  };
  const remove = async (id: number) => {
    await api(`/admin/geography/aliases/${id}/`, { method: "DELETE" });
    setNonce((n) => n + 1);
  };
  return (
    <div className="geo-stack">
      <form className="geo-card" onSubmit={(e) => void add(e)}>
        <h2>Add another name</h2>
        <p className="news-meta">Old or local names help people find a place. They’re used for type-ahead and suggestions only, never to link records.</p>
        <Select label="State" value={state} placeholder="Choose a state" options={STATES} onChange={(e) => { setState(e.target.value); setValue(EMPTY_GEO); }} />
        {state && <GeoPicker state={state} value={value} onChange={setValue} allowNotListed={false} hint="Stop at the level the name belongs to." />}
        <TextField label="Other name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        <div className="geo-actions"><Button type="submit" disabled={!target || !name.trim()}>Add</Button></div>
      </form>
      <TextField label="Search names" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.data && (res.data.results.length === 0 ? <p className="news-meta">No other names yet.</p> : (
        <div className="geo-scroll">
          <table className="geo-table">
            <caption className="visually-hidden">Other names</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">For</th><th scope="col">Source</th><th scope="col"><span className="visually-hidden">Remove</span></th></tr></thead>
            <tbody>{res.data.results.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.target_name} ({a.target_code})</td><td>{a.source === "rename" ? "INEC rename" : "Admin"}</td>
                <td><Button size="sm" variant="ghost" onClick={() => void remove(a.id)}>Remove</Button></td></tr>
            ))}</tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function AdminGeographyPage() {
  const { me } = useMe();
  const sa = !!me?.is_system_admin;
  const [params, setParams] = useSearchParams();
  const tab = sa ? params.get("tab") ?? (params.get("why") || params.get("kind") ? "review" : "files") : "review";
  const tabs = sa
    ? [{ id: "files", label: "Files", content: <Datasets /> }, { id: "review", label: "Review", content: <Review /> }, { id: "aliases", label: "Other names", content: <Aliases /> }]
    : [{ id: "review", label: "Review", content: <Review /> }];
  return (
    <div className="adm-page">
      <AdminNav current="geography" />
      <header className="adm-page__head"><div><h1>Geography</h1>
        <p className="news-meta">INEC’s states, LGAs, wards, polling units and constituencies, and the records waiting for a location.</p></div></header>
      <Tabs label="Geography" tabs={tabs} value={tab} onChange={(id) => setParams(new URLSearchParams({ tab: id }), { replace: true })} />
    </div>
  );
}
