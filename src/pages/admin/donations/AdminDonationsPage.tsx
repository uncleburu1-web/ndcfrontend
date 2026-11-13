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
import { t, lazy } from "../../../i18n";

const STATUSES: [string, string][] = lazy(() => [["", t("admin.all-statuses")], ["successful", t("admin.successful")], ["pending", t("admin.pending")], ["review", t("admin.under-review")],
  ["failed", t("admin.failed")], ["abandoned", t("admin.abandoned")], ["refunded", t("admin.refunded")], ["initiated", t("admin.started")]]);
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
    document.title = t("admin.donations-ndcconnect-admin");
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
      toast.show({ tone: "success", message: t("admin.export-downloaded-exports-are-recorded-in") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof Error ? err.message : t("admin.export-failed") });
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
          <h1>{t("admin.donations")}</h1>
          <p className="ds-field__hint">{t("admin.full-records-for-party-returns-donor")}</p>
        </div>
        <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting} loadingLabel={t("admin.exporting")}>{t("admin.export-csv")}</Button>
      </header>

      {res.data && res.data.totals.review > 0 && params.get("status") !== "review" && (
        <Banner tone="warning" title={t("admin.donation-need-review", { review: res.data.totals.review, v: res.data.totals.review === 1 ? "" : "s" })}
          action={<Button size="sm" variant="secondary" onClick={() => set({ status: "review" })}>{t("admin.show-them")}</Button>}>
          {t("admin.amount-mismatches-or-limit-breaches-resolve")}</Banner>
      )}

      <form className="adm-donation-filters" onSubmit={onSearch}>
        <Select label={t("admin.status")} value={params.get("status") ?? ""} onChange={(e) => set({ status: e.target.value })}
          options={STATUSES.map(([value, label]) => ({ value, label }))} />
        <Select label={t("admin.given-to")} value={params.get("designation") ?? ""} onChange={(e) => set({ designation: e.target.value })}
          options={[{ value: "", label: t("admin.everything") }, { value: "party", label: t("admin.ndc-general-fund") }, { value: "candidate", label: t("admin.candidates") }]} />
        <label className="adm-date">{t.rich("admin.from", { input: <input type="date" className="ds-input" value={params.get("date_from") ?? ""} onChange={(e) => set({ date_from: e.target.value })} /> })}</label>
        <label className="adm-date">{t.rich("admin.to", { input: <input type="date" className="ds-input" value={params.get("date_to") ?? ""} onChange={(e) => set({ date_to: e.target.value })} /> })}</label>
        <div className="adm-donation-filters__search">
          <TextField label={t("admin.search")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.reference-name-or-email")} />
          <Button type="submit" variant="secondary">{t("admin.search")}</Button>
        </div>
      </form>

      {res.error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-donations")} action={<Button variant="secondary" size="sm" onClick={res.retry}>{t("admin.try-again-2")}</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={160} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title={t("admin.no-donations-match")}>{t("admin.try-other-filters")}</EmptyState>
      ) : res.data ? (
        <>
          <p className="adm-donation-totals">
            {t.rich("admin.successful-in-this-view-from-donations", { formatKobo: formatKobo(res.data.totals.successful.total_kobo), strong: (chunks) => <strong>{chunks}</strong>, count: res.data.totals.successful.count, x4: res.data.totals.demo?.count > 0 && (
              <> {t.rich("admin.plus-demo-donations-not-counted-and", { demobadge: <DemoBadge />, count: res.data.totals.demo.count.toLocaleString("en-NG"), formatKobo: formatKobo(res.data.totals.demo.total_kobo) })}</>
            ) })}
          </p>
          <div className="adm-table-wrap"><table className="adm-table">
            <thead><tr><th>{t("admin.date")}</th><th>{t("admin.reference")}</th><th>{t("admin.donor")}</th><th>{t("admin.amount")}</th><th>{t("admin.given-to")}</th><th>{t("admin.status")}</th></tr></thead>
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
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label={t("admin.donation-pages")} />
        </>
      ) : null}
    </div>
  );
}
