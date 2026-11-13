/** /admin/users — find an account (spec 11 §4.4). At least 3 characters: there's no "list everyone". */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, StatusBadge, TextField } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { ROLE_LABELS, type UserSummary } from "../../../admin/types";
import { AdminNav } from "../AdminNav";
import { TeamSubnav } from "../team/TeamSubnav";
import "../candidates/admin.css";
import "../../../admin/admin-home.css";
import { t as tr } from "../../../i18n";

export function accountStatus(u: { deleted: boolean; is_active: boolean; deactivation_kind?: string }) {
  return u.deleted ? "deleted" : u.is_active ? "active" : u.deactivation_kind === "self" ? "paused" : "deactivated";
}

export default function AdminUsersPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const flt = params.get("filter") ?? "";
  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [text, setText] = useState(q);
  const [tooShort, setTooShort] = useState(false);
  const ready = q.length >= 3 || flt === "ban_failed";
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (flt) qs.set("filter", flt);
  if (status) qs.set("status", status);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-users:${qs}:${ready}`, (signal) =>
    ready ? api<{ count: number; results: UserSummary[] }>(`/admin/users/?${qs}`, { signal }) : Promise.resolve(null));
  useEffect(() => {
    document.title = tr("admin.users-ndcconnect-admin");
  }, []);
  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    n.delete("page");
    setParams(n);
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    setTooShort(t.length > 0 && t.length < 3);
    if (t.length === 0 || t.length >= 3) set({ q: t });
  };

  return (
    <div className="adm-page">
      <AdminNav current="team" />
      <header className="adm-page__head">
        <div>
          <h1>{tr("admin.users")}</h1>
          <p className="ds-field__hint">{tr("admin.account-details-only-follows-donations-membership")}</p>
        </div>
      </header>
      <TeamSubnav />
      <form className="adm-filters__search" onSubmit={onSearch}>
        <TextField label={tr("admin.name-or-email")} value={text} onChange={(e) => setText(e.target.value)}
          error={tooShort ? tr("admin.type-at-least-3-characters") : undefined} hint={tr("admin.at-least-3-characters")} />
        <Button type="submit" variant="secondary">{tr("admin.search")}</Button>
      </form>
      <div className="adm-filters">
        <Select label={tr("admin.show")} value={status} onChange={(e) => set({ status: e.target.value })}
          options={[{ value: "", label: tr("admin.all") }, { value: "active", label: tr("admin.active") }, { value: "deactivated", label: tr("admin.deactivated") }]} />
        <Select label={tr("admin.filter")} value={flt} onChange={(e) => set({ filter: e.target.value })}
          options={[{ value: "", label: tr("admin.none") }, { value: "ban_failed", label: tr("admin.sign-in-block-failed") }]} />
      </div>
      {!ready ? (
        <EmptyState icon="user" title={tr("admin.search-for-an-account")}>{tr("admin.type-at-least-3-characters-of")}</EmptyState>
      ) : res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{tr("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data.count === 0 ? (
        <EmptyState title={tr("admin.no-accounts-match")} />
      ) : (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{tr("admin.person")}</th><th>{tr("admin.joined")}</th><th>{tr("admin.profile")}</th><th>{tr("admin.status")}</th><th>{tr("admin.roles")}</th></tr></thead>
            <tbody>
              {res.data.results.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/admin/users/${u.id}`}>{u.deleted ? tr("admin.deleted-account") : u.full_name || u.email}</Link><br />
                    <span className="ds-field__hint">{u.email}</span></td>
                  <td>{formatDate(u.joined_at)}</td>
                  <td>{u.profile_complete ? tr("admin.profile-complete") : tr("admin.profile-incomplete")}</td>
                  <td><StatusBadge set="account" status={accountStatus(u)} /></td>
                  <td><span className="adm-chips">{u.roles.map((r) => <span key={r.role + r.scope_type} className="adm-chip">{ROLE_LABELS[r.role] ?? r.role}</span>)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label={tr("admin.user-pages")}
            onChange={(p) => { const n = new URLSearchParams(params); if (p > 1) n.set("page", String(p)); else n.delete("page"); setParams(n); }} />
        </>
      )}
    </div>
  );
}
