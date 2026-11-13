/** /admin/audit — search the append-only audit log (spec 11 §4.5). Every search is itself recorded. */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, TextField } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import type { AuditEntry } from "../../../admin/types";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "../membership/admin-membership.css";
import "../../../admin/admin-home.css";
import { t } from "../../../i18n";

interface Areas { areas: { area: string; label: string; actions: { action: string; label: string }[] }[] }
const KEYS = ["area", "action", "actor", "target", "from", "to"] as const;

export default function AdminAuditPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [draft, setDraft] = useState(() => Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof KEYS)[number], string>);
  const qs = new URLSearchParams();
  for (const k of KEYS) if (params.get(k)) qs.set(k, params.get(k)!);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-audit:${qs}`, (signal) => api<{ count: number; results: AuditEntry[] }>(`/admin/audit/?${qs}`, { signal }));
  const areas = useRequest("admin-audit-areas", (signal) => api<Areas>("/admin/audit/actions/", { signal }));
  useEffect(() => {
    document.title = t("admin.audit-log-ndcconnect-admin");
  }, []);
  useEffect(() => {
    setDraft(Object.fromEntries(KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof KEYS)[number], string>);
  }, [params]);

  const apply = (e?: FormEvent) => {
    e?.preventDefault();
    const n = new URLSearchParams();
    for (const k of KEYS) if (draft[k].trim()) n.set(k, draft[k].trim());
    setParams(n);
  };
  const actions = areas.data?.areas.find((a) => a.area === draft.area)?.actions
    ?? areas.data?.areas.flatMap((a) => a.actions) ?? [];

  return (
    <div className="adm-page">
      <AdminNav current="audit" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.audit-log")}</h1>
          <p className="ds-field__hint">{t("admin.every-sensitive-admin-action-newest-first")}</p>
        </div>
      </header>
      <form className="adm-audit-filters" onSubmit={apply}>
        <Select label={t("admin.area")} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value, action: "" })}
          options={[{ value: "", label: t("admin.all") }, ...(areas.data?.areas ?? []).map((a) => ({ value: a.area, label: a.label }))]} />
        <Select label={t("admin.action")} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          options={[{ value: "", label: t("admin.any") }, ...actions.map((a) => ({ value: a.action, label: a.label }))]} />
        <TextField label={t("admin.who")} value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} hint={t("admin.an-email-or-system")} />
        <TextField label={t("admin.record-id")} value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
        <label className="adm-date">{t.rich("admin.from", { input: <input type="date" className="ds-input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /> })}</label>
        <label className="adm-date">{t.rich("admin.to", { input: <input type="date" className="ds-input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /> })}</label>
        <div className="adm-actions">
          <Button type="submit">{t("admin.search")}</Button>
          <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>{t("admin.clear")}</Button>
        </div>
      </form>
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : res.data.count === 0 ? (
        <EmptyState title={t("admin.no-entries-match")} />
      ) : (
        <>
          <p className="adm-muted">{res.data.count.toLocaleString()} {res.data.count === 1 ? t("admin.entry") : t("admin.entries")}</p>
          <ul className="adm-audit-list">
            {res.data.results.map((e) => (
              <li key={e.id}>
                <details>
                  <summary>
                    <span className="adm-muted">{formatDate(e.created_at, { withTime: true })}</span> · <strong>{e.actor}</strong> {e.action_label}
                    {e.target_label && <> · {e.target_label}</>}
                    {e.summary && <span className="adm-muted"> · {e.summary}</span>}
                  </summary>
                  {e.link && <p><Link to={e.link}>{t("admin.open-the", { toLowerCase: (e.target_label || "record").toLowerCase() })}</Link></p>}
                  <pre>{JSON.stringify({ action: e.action, record: e.target_id || undefined, details: e.metadata, ip: e.ip_address || undefined,
                    browser: e.user_agent || undefined }, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 50)} label={t("admin.audit-pages")}
            onChange={(p) => { const n = new URLSearchParams(params); if (p > 1) n.set("page", String(p)); else n.delete("page"); setParams(n); }} />
        </>
      )}
    </div>
  );
}
