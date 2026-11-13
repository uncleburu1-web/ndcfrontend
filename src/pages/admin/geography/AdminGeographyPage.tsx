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
import { t } from "../../../i18n";

const KIND_LABEL: Record<string, string> = {
  get polling_units() { return t("admin.polling-units"); }, get senatorial_districts() { return t("admin.senatorial-districts"); }, get federal_constituencies() { return t("admin.federal-constituencies"); },
  get state_constituencies() { return t("admin.state-constituencies"); },
};
const WHY: Record<string, string> = {
  get unlinked() { return t("admin.typed-not-linked"); }, get not_listed() { return t("admin.not-listed"); }, get retired() { return t("admin.unit-retired-by-inec"); }, get person_choice() { return t("admin.person-s-choice-waiting"); },
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
      <p className="news-meta">{t("admin.rows-checksum", { v: (p.rows ?? 0).toLocaleString(), slice: d.checksum.slice(0, 12), v2: d.notes ? ` · ${d.notes}` : "" })}</p>
      {(p.error_count ?? 0) > 0 && (
        <Banner tone="error" title={t("admin.problem-this-file-can-t-be", { error_count: p.error_count, v: p.error_count === 1 ? "" : "s" })}>
          <ul className="geo-errors">{(p.errors ?? []).map((e) => <li key={e}>{e}</li>)}</ul>
        </Banner>
      )}
      <dl>
        <dt>{t("admin.added")}</dt><dd>{fmtCounts(c.added as Record<string, number>)}</dd>
        <dt>{t("admin.renamed")}</dt><dd>{fmtCounts(c.renamed as Record<string, number>)}</dd>
        <dt>{t("admin.back-in-the-list")}</dt><dd>{fmtCounts(c.restored as Record<string, number>)}</dd>
        <dt>{t("admin.retired")}</dt><dd>{fmtCounts(c.retired as Record<string, number>)}</dd>
        <dt>{t("admin.moved")}</dt><dd>{String(c.moved ?? 0)}</dd>
        {d.kind === "polling_units" && <><dt>{t("admin.people-affected")}</dt><dd>{t("admin.memberships-and-pvc-checks-point-at", { v: p.affected?.memberships ?? 0, v2: p.affected?.pvc_records ?? 0 })}</dd></>}
        {d.kind === "polling_units" && <><dt>{t("admin.active-units")}</dt><dd>{t("admin.in-the-file-now", { v: (p.active_units ?? 0).toLocaleString(), v2: (p.current_units ?? 0).toLocaleString() })}</dd></>}
      </dl>
      {p.per_state && Object.keys(p.per_state).length > 0 && (
        <details className="geo-details"><summary>{t("admin.per-state")}</summary>
          <p className="news-meta">{Object.entries(p.per_state).map(([s, n]) => `${stateLabel(s) || s}: ${n.toLocaleString()}`).join(" · ")}</p>
        </details>
      )}
      {p.renamed && Object.values(p.renamed).some((v) => v.length) && (
        <details className="geo-details"><summary>{t("admin.renamed-first-500-of-each")}</summary>
          <ul>{Object.entries(p.renamed).flatMap(([lvl, v]) => v.map((x) => <li key={`${lvl}${x.code}`}>{x.code}: {x.old} → {x.new}</li>))}</ul>
        </details>
      )}
      {p.retired && Object.values(p.retired).some((v) => v.length) && (
        <details className="geo-details"><summary>{t("admin.retired-first-500-of-each")}</summary>
          <ul>{Object.entries(p.retired).flatMap(([lvl, v]) => v.map((x) => <li key={`${lvl}${x.code}`}>{x.code}: {x.name}</li>))}</ul>
        </details>
      )}
      {p.moved && p.moved.length > 0 && (
        <details className="geo-details"><summary>{t("admin.moved")}</summary>
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
      toast.show({ tone: "success", message: t("admin.previewed-nothing-has-changed-yet") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.upload-failed") });
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
      toast.show({ tone: "success", message: t("admin.applied-communities-search-and-notices-update") });
    } catch (err) {
      if (err instanceof ApiError && err.code === "geo_second_admin_required") {
        await view(open.id);
        toast.show({ tone: "info", message: err.message });
      } else toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-apply") });
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
        <h2>{t("admin.upload-a-file")}</h2>
        <p className="news-meta">{t("admin.csv-from-inec-utf-8-up")}</p>
        <label className="ds-field__label" htmlFor="geo-file">{t("admin.file")}</label>
        <input id="geo-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Select label={t("admin.what-s-in-it")} value={kind} onChange={(e) => setKind(e.target.value)}
          options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
        <TextField label={t("admin.source")} value={source} maxLength={300} onChange={(e) => setSource(e.target.value)} hint={t("admin.inec-s-page-or-how-the")} />
        <TextField label={t("admin.inec-s-publication-date")} value={publishedOn} placeholder="YYYY-MM-DD" maxLength={10} onChange={(e) => setPublishedOn(e.target.value)} />
        <TextArea label={t("admin.notes")} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} hint={t("admin.who-checked-the-file-and-how")} />
        <div className="geo-actions"><Button type="submit" loading={busy} disabled={!file}>{t("admin.preview")}</Button></div>
      </form>

      {open && (
        <section aria-label={t("admin.selected-file")}>
          <Preview d={open} />
          <div className="geo-actions">
            {open.status === "previewed" && open.error_count === 0 && (waitingForMe
              ? <Button loading={busy} onClick={() => void apply(true)}>{t("admin.apply-as-the-second-admin")}</Button>
              : <Button loading={busy} onClick={() => void apply(false)}>{t("admin.apply")}</Button>)}
            {open.status === "applied" && <Button variant="secondary" onClick={() => void loadChanges(1)}>{t("admin.what-changed")}</Button>}
          </div>
          {open.needs_second_admin && (
            <Banner tone="warning">{t("admin.this-file-has-fewer-than-95", { v: open.first_approval_by ? t("admin.approved-it-a-different-system-admin", { first_approval_by: open.first_approval_by }) : t("admin.two-system-admins-must-apply-it") })}</Banner>
          )}
          {changes && (
            <div className="geo-scroll">
              <table className="geo-table">
                <caption className="visually-hidden">{t("admin.changes")}</caption>
                <thead><tr><th scope="col">{t("admin.level")}</th><th scope="col">{t("admin.change")}</th><th scope="col">{t("admin.code")}</th><th scope="col">{t("admin.before")}</th><th scope="col">{t("admin.after")}</th></tr></thead>
                <tbody>{changes.results.map((c, i) => (
                  <tr key={`${c.code}${i}`}><td>{c.level.replace("_", " ")}</td><td>{c.action}</td><td>{c.code}</td><td>{c.old_value}</td><td>{c.new_value}</td></tr>
                ))}</tbody>
              </table>
              <p className="news-meta">{t("admin.changes-2", { count: changes.count.toLocaleString() })}</p>
              {changes.next && <Button variant="secondary" size="sm" onClick={() => void loadChanges(changes.next!)}>{t("admin.next-page")}</Button>}
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="geo-files">
        <h2 id="geo-files">{t("admin.files")}</h2>
        {list.error ? <Banner tone="error">{list.error.message}</Banner> : !list.data ? <Skeleton width="100%" height={120} /> : list.data.results.length === 0
          ? <p className="news-meta">{t.rich("admin.no-files-yet-load-inec-s", { code: (chunks) => <code>{chunks}</code> })}</p> : (
            <div className="geo-scroll">
              <table className="geo-table">
                <caption className="visually-hidden">{t("admin.geography-files")}</caption>
                <thead><tr><th scope="col">{t("admin.file")}</th><th scope="col">{t("admin.status")}</th><th scope="col">{t("admin.counts")}</th><th scope="col"><span className="visually-hidden">{t("admin.open")}</span></th></tr></thead>
                <tbody>{list.data.results.map((d) => (
                  <tr key={d.id}>
                    <td>{KIND_LABEL[d.kind]}<br /><span className="news-meta">{d.source} · {formatDate(d.loaded_at)}</span></td>
                    <td>{d.status === "applied" ? t("admin.applied", { v: d.applied_at ? formatDate(d.applied_at) : "" }) : d.error_count ? t("admin.problems", { error_count: d.error_count }) : t("admin.previewed")}</td>
                    <td>{d.status === "applied" ? (d.kind === "polling_units" ? t("admin.units", { polling_units: d.polling_units.toLocaleString() }) : t("admin.constituencies", { constituencies: d.constituencies })) : t("admin.changes-3", { changes: d.changes })}</td>
                    <td><Button size="sm" variant="ghost" onClick={() => void view(d.id)}>{t("admin.open")}</Button></td>
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
      toast.show({ tone: "success", message: action === "ask" ? t("admin.asked-they-ll-get-a-notice") : t("admin.saved") });
      onDone();
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-save") });
    } finally {
      setBusy(false);
    }
  };
  const fmt = (p: ReviewItem["current"] | null | undefined) =>
    p?.lga ? [p.lga.name, p.ward?.name, p.polling_unit ? `${p.polling_unit.name} (${p.polling_unit.code})` : ""].filter(Boolean).join(" · ") : "—";
  return (
    <li className="geo-card">
      <p><strong>{item.kind === "pvc" ? t("admin.pvc-check") : t("admin.membership")}</strong> · {stateLabel(item.state)} · {WHY[item.why]}</p>
      <p className="news-meta">{t("admin.typed", { v: [item.typed.lga, item.typed.ward, item.typed.polling_unit].filter(Boolean).join(" · ") || "—" })}</p>
      <p className="news-meta">{t("admin.linked-2", { fmt: fmt(item.current), v: item.pending ? t("admin.their-choice", { fmt: fmt(item.pending) }) : "" })}</p>
      {s.lga && <p className="news-meta">{t("admin.suggestion", { join: [s.lga.name, s.ward?.name, s.polling_unit?.name].filter(Boolean).join(" · "), round: Math.round(s.lga.score * 100) })}</p>}
      <div className="geo-actions">
        {item.pending && <Button size="sm" loading={busy} onClick={() => void act("accept")}>{t("admin.accept-their-choice")}</Button>}
        <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{t("admin.link-2")}</Button>
        <Button size="sm" variant="ghost" loading={busy} onClick={() => void act("ask")}>{t("admin.ask-them")}</Button>
        <Link to={item.record_url}>{t("admin.open-the-record")}</Link>
      </div>
      {open && (
        <div className="geo-card">
          <GeoPicker state={item.state} value={value} onChange={setValue} allowNotListed={false} required={item.kind === "pvc" ? ["lga", "ward", "polling_unit"] : ["lga"]} />
          <div className="geo-actions"><Button size="sm" loading={busy} onClick={() => void act("link")}>{t("admin.save-link")}</Button></div>
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
        {d && d.kinds.length > 1 && <Select label={t("admin.records")} value={kind} onChange={(e) => set("kind", e.target.value)}
          options={[{ value: "", label: t("admin.all") }, { value: "membership", label: t("admin.memberships") }, { value: "pvc", label: t("admin.pvc-checks") }]} />}
        <Select label={t("admin.state")} value={state} onChange={(e) => set("state", e.target.value)} options={[{ value: "", label: t("admin.all-states") }, ...STATES]} />
        <Select label={t("admin.why")} value={why} onChange={(e) => set("why", e.target.value)}
          options={[{ value: "", label: t("admin.any-reason") }, ...Object.entries(WHY).map(([value, label]) => ({ value, label }))]} />
      </div>
      {res.error ? <Banner tone="error">{res.error.message}</Banner> : !d ? <Skeleton width="100%" height={160} /> : (
        <>
          <p className="news-meta">{t("admin.waiting", { count: d.count, v: d.groups.length ? ` · ${d.groups.slice(0, 8).map((g) => `${stateLabel(g.state) || "—"}${g.lga ? `/${g.lga}` : ""}: ${g.count}`).join(" · ")}` : "" })}</p>
          {d.results.length === 0 ? <p className="news-meta">{t("admin.nothing-to-review")}</p>
            : <ul className="geo-stack" aria-label={t("admin.records-to-review")}>{d.results.map((i) => <ReviewRow key={`${i.kind}${i.id}`} item={i} onDone={() => setNonce((n) => n + 1)} />)}</ul>}
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
      toast.show({ tone: "success", message: t("admin.added-2") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("admin.that-didn-t-save") });
    }
  };
  const remove = async (id: number) => {
    await api(`/admin/geography/aliases/${id}/`, { method: "DELETE" });
    setNonce((n) => n + 1);
  };
  return (
    <div className="geo-stack">
      <form className="geo-card" onSubmit={(e) => void add(e)}>
        <h2>{t("admin.add-another-name")}</h2>
        <p className="news-meta">{t("admin.old-or-local-names-help-people")}</p>
        <Select label={t("admin.state")} value={state} placeholder={t("admin.choose-a-state")} options={STATES} onChange={(e) => { setState(e.target.value); setValue(EMPTY_GEO); }} />
        {state && <GeoPicker state={state} value={value} onChange={setValue} allowNotListed={false} hint={t("admin.stop-at-the-level-the-name")} />}
        <TextField label={t("admin.other-name")} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        <div className="geo-actions"><Button type="submit" disabled={!target || !name.trim()}>{t("admin.add")}</Button></div>
      </form>
      <TextField label={t("admin.search-names")} value={q} onChange={(e) => setQ(e.target.value)} />
      {res.data && (res.data.results.length === 0 ? <p className="news-meta">{t("admin.no-other-names-yet")}</p> : (
        <div className="geo-scroll">
          <table className="geo-table">
            <caption className="visually-hidden">{t("admin.other-names")}</caption>
            <thead><tr><th scope="col">{t("admin.name")}</th><th scope="col">{t("admin.for")}</th><th scope="col">{t("admin.source")}</th><th scope="col"><span className="visually-hidden">{t("admin.remove-2")}</span></th></tr></thead>
            <tbody>{res.data.results.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td>{a.target_name} ({a.target_code})</td><td>{a.source === "rename" ? t("admin.inec-rename") : t("admin.admin")}</td>
                <td><Button size="sm" variant="ghost" onClick={() => void remove(a.id)}>{t("admin.remove-2")}</Button></td></tr>
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
    ? [{ id: "files", label: t("admin.files"), content: <Datasets /> }, { id: "review", label: t("admin.review"), content: <Review /> }, { id: "aliases", label: t("admin.other-names"), content: <Aliases /> }]
    : [{ id: "review", label: t("admin.review"), content: <Review /> }];
  return (
    <div className="adm-page">
      <AdminNav current="geography" />
      <header className="adm-page__head"><div><h1>{t("admin.geography")}</h1>
        <p className="news-meta">{t("admin.inec-s-states-lgas-wards-polling")}</p></div></header>
      <Tabs label={t("admin.geography")} tabs={tabs} value={tab} onChange={(id) => setParams(new URLSearchParams({ tab: id }), { replace: true })} />
    </div>
  );
}
