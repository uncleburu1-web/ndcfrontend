/** /admin/membership — applications list (spec 06 §4.4). Membership officers and system admins. */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, StatusBadge, TextField } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { STATES } from "../../../lib/nigeria";
import type { AdminMembershipPage, MembershipStatus } from "../../../membership/types";
import { AdminNav } from "../AdminNav";
import { MembershipSubnav } from "./MembershipSubnav";
import "../candidates/admin.css";
import "../donations/admin-donations.css";
import "./admin-membership.css";

export const STATUS_LABELS: [MembershipStatus, string][] = [["draft", "Details in progress"], ["payment_pending", "Payment pending"],
  ["pending_approval", "Pending approval"], ["active", "Active"], ["rejected", "Rejected"], ["cancelled", "Cancelled"], ["refunded", "Refunded"]];
const FILTERS = ["status", "state", "date_from", "date_to", "q"] as const;

export default function AdminMembershipPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = new URLSearchParams();
  for (const k of FILTERS) if (params.get(k)) qs.set(k, params.get(k)!);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-membership:${qs}`, (signal) => api<AdminMembershipPage>(`/admin/membership/${qs.toString() ? `?${qs}` : ""}`, { signal }));

  useEffect(() => {
    document.title = "Membership | NDCConnect admin";
  }, []);
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: search.trim() });
  };
  const totals = res.data?.totals ?? {};

  return (
    <div className="adm-page">
      <AdminNav current="membership" />
      <header className="adm-page__head">
        <div>
          <h1>Membership</h1>
          <p className="ds-field__hint">Private. Membership is political-opinion data; open records only when you need to.</p>
        </div>
      </header>
      <MembershipSubnav />

      {(totals.pending_approval ?? 0) > 0 && params.get("status") !== "pending_approval" && (
        <Banner tone="warning" title={`${totals.pending_approval} application${totals.pending_approval === 1 ? "" : "s"} waiting for approval`}
          action={<Button size="sm" variant="secondary" onClick={() => set({ status: "pending_approval" })}>Show them</Button>}>
          Payment is confirmed; check each one and approve or reject.
        </Banner>
      )}
      <ul className="adm-totals" aria-label="Totals">
        {STATUS_LABELS.map(([s, label]) => <li key={s}><span>{label}</span><strong>{totals[s] ?? 0}</strong></li>)}
      </ul>

      <form className="adm-donation-filters" onSubmit={onSearch}>
        <Select label="Status" value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}
          options={[{ value: "", label: "All statuses" }, ...STATUS_LABELS.map(([value, label]) => ({ value, label }))]} />
        <Select label="State" value={params.get("state") ?? ""} onChange={(e) => set({ state: e.target.value })}
          options={[{ value: "", label: "All states" }, ...STATES]} />
        <label className="adm-date">From<input type="date" className="ds-input" value={params.get("date_from") ?? ""} onChange={(e) => set({ date_from: e.target.value })} /></label>
        <label className="adm-date">To<input type="date" className="ds-input" value={params.get("date_to") ?? ""} onChange={(e) => set({ date_to: e.target.value })} /></label>
        <div className="adm-donation-filters__search">
          <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or membership number" />
          <Button type="submit" variant="secondary">Search</Button>
        </div>
      </form>

      {res.error ? (
        <Banner tone="error" title="We couldn’t load applications" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title="No applications match">Try other filters.</EmptyState>
      ) : res.data ? (
        <>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Started</th><th>Name</th><th>State / LGA</th><th>Number</th><th>PVC</th><th>Status</th></tr></thead>
            <tbody>
              {res.data.results.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.created_at)}</td>
                  <td><Link to={`/admin/membership/${m.id}`}>{m.full_name || "(no name yet)"}</Link><br /><span className="ds-field__hint">{m.user_email}</span></td>
                  <td>{m.state_label || "—"}{m.lga ? `, ${m.lga}` : ""}</td>
                  <td>{m.membership_number || "—"}</td>
                  <td><StatusBadge set="pvc" status={m.pvc_status as "unverified"} /></td>
                  <td>{m.status ? <StatusBadge set="membership" status={m.status} /> : null}{m.refund_due && <span className="adm-flag">Refund due</span>}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label="Application pages" />
        </>
      ) : null}
    </div>
  );
}
