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
    document.title = "Users | NDCConnect admin";
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
          <h1>Users</h1>
          <p className="ds-field__hint">Account details only. Follows, donations, membership and PVC stay in their own areas.</p>
        </div>
      </header>
      <TeamSubnav />
      <form className="adm-filters__search" onSubmit={onSearch}>
        <TextField label="Name or email" value={text} onChange={(e) => setText(e.target.value)}
          error={tooShort ? "Type at least 3 characters." : undefined} hint="At least 3 characters." />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <div className="adm-filters">
        <Select label="Show" value={status} onChange={(e) => set({ status: e.target.value })}
          options={[{ value: "", label: "All" }, { value: "active", label: "Active" }, { value: "deactivated", label: "Deactivated" }]} />
        <Select label="Filter" value={flt} onChange={(e) => set({ filter: e.target.value })}
          options={[{ value: "", label: "None" }, { value: "ban_failed", label: "Sign-in block failed" }]} />
      </div>
      {!ready ? (
        <EmptyState icon="user" title="Search for an account">Type at least 3 characters of a name or email.</EmptyState>
      ) : res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data.count === 0 ? (
        <EmptyState title="No accounts match" />
      ) : (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Person</th><th>Joined</th><th>Profile</th><th>Status</th><th>Roles</th></tr></thead>
            <tbody>
              {res.data.results.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/admin/users/${u.id}`}>{u.deleted ? "Deleted account" : u.full_name || u.email}</Link><br />
                    <span className="ds-field__hint">{u.email}</span></td>
                  <td>{formatDate(u.joined_at)}</td>
                  <td>{u.profile_complete ? "Profile complete" : "Profile incomplete"}</td>
                  <td><StatusBadge set="account" status={accountStatus(u)} /></td>
                  <td><span className="adm-chips">{u.roles.map((r) => <span key={r.role + r.scope_type} className="adm-chip">{ROLE_LABELS[r.role] ?? r.role}</span>)}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} label="User pages"
            onChange={(p) => { const n = new URLSearchParams(params); if (p > 1) n.set("page", String(p)); else n.delete("page"); setParams(n); }} />
        </>
      )}
    </div>
  );
}
