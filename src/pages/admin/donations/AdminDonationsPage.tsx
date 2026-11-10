/** /admin/donations — system admins and finance officers (spec 05 §4.6). */
import { DemoBadge } from "../../../donations/DemoBadge";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, StatusBadge, TextField, useToast } from "../../../components/ui";
import { designationText, formatKobo } from "../../../donations/money";
import type { AdminDonationPage } from "../../../donations/types";
import { formatDate } from "../../../lib/format";
import { AdminNav } from "../AdminNav";
import "../candidates/admin.css";
import "./admin-donations.css";

const STATUSES: [string, string][] = [["", "All statuses"], ["successful", "Successful"], ["pending", "Pending"], ["review", "Under review"],
  ["failed", "Failed"], ["abandoned", "Abandoned"], ["refunded", "Refunded"], ["initiated", "Started"]];
const FILTERS = ["status", "designation", "date_from", "date_to", "q"] as const;

export default function AdminDonationsPage() {
  const api = useApi();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [exporting, setExporting] = useState(false);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const filter = new URLSearchParams();
  for (const k of FILTERS) if (params.get(k)) filter.set(k, params.get(k)!);
  const filterQs = filter.toString();
  const qs = new URLSearchParams(filter);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`admin-donations:${qs}`, (signal) => api<AdminDonationPage>(`/admin/donations/${qs.toString() ? `?${qs}` : ""}`, { signal }));

  useEffect(() => {
    document.title = "Donations | NDCConnect admin";
  }, []);

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api<Blob>(`/admin/donations/export.csv${filterQs ? `?${filterQs}` : ""}`, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ndc-donations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.show({ tone: "success", message: "Export downloaded. Exports are recorded in the audit log." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof Error ? err.message : "Export failed." });
    } finally {
      setExporting(false);
    }
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    set({ q: search.trim() });
  };

  return (
    <div className="adm-page">
      <AdminNav current="donations" />
      <header className="adm-page__head">
        <div>
          <h1>Donations</h1>
          <p className="ds-field__hint">Full records for party returns. Donor details are private; viewing and exporting them is audited.</p>
        </div>
        <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting} loadingLabel="Exporting…">Export CSV</Button>
      </header>

      {res.data && res.data.totals.review > 0 && params.get("status") !== "review" && (
        <Banner tone="warning" title={`${res.data.totals.review} donation${res.data.totals.review === 1 ? "" : "s"} need review`}
          action={<Button size="sm" variant="secondary" onClick={() => set({ status: "review" })}>Show them</Button>}>
          Amount mismatches or limit breaches. Resolve them in the payment provider’s dashboard, then re-check.
        </Banner>
      )}

      <form className="adm-donation-filters" onSubmit={onSearch}>
        <Select label="Status" value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}
          options={STATUSES.map(([value, label]) => ({ value, label }))} />
        <Select label="Given to" value={params.get("designation") ?? ""} onChange={(e) => set({ designation: e.target.value })}
          options={[{ value: "", label: "Everything" }, { value: "party", label: "NDC general fund" }, { value: "candidate", label: "Candidates" }]} />
        <label className="adm-date">From<input type="date" className="ds-input" value={params.get("date_from") ?? ""} onChange={(e) => set({ date_from: e.target.value })} /></label>
        <label className="adm-date">To<input type="date" className="ds-input" value={params.get("date_to") ?? ""} onChange={(e) => set({ date_to: e.target.value })} /></label>
        <div className="adm-donation-filters__search">
          <TextField label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, name or email" />
          <Button type="submit" variant="secondary">Search</Button>
        </div>
      </form>

      {res.error ? (
        <Banner tone="error" title="We couldn’t load donations" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title="No donations match">Try other filters.</EmptyState>
      ) : res.data ? (
        <>
          <p className="adm-donation-totals">
            Successful in this view: <strong>{formatKobo(res.data.totals.successful.total_kobo)}</strong> from {res.data.totals.successful.count} donations
            {res.data.totals.demo?.count > 0 && (
              <> · <DemoBadge /> plus {res.data.totals.demo.count.toLocaleString("en-NG")} demo donations ({formatKobo(res.data.totals.demo.total_kobo)}), not counted and never exported</>
            )}
          </p>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>Date</th><th>Reference</th><th>Donor</th><th>Amount</th><th>Given to</th><th>Status</th></tr></thead>
            <tbody>
              {res.data.results.map((d) => (
                <tr key={d.id}>
                  <td>{formatDate(d.created_at)}</td>
                  <td><Link to={`/admin/donations/${d.id}`}>{d.reference}</Link>{d.is_demo && <> <DemoBadge /></>}</td>
                  <td>{d.donor_name}<br /><span className="ds-field__hint">{d.donor_email}</span></td>
                  <td>{formatKobo(d.amount_kobo)}</td>
                  <td>{designationText(d)}</td>
                  <td><StatusBadge set="donation" status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label="Donation pages" />
        </>
      ) : null}
    </div>
  );
}
