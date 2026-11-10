/**
 * /finance — public transparency (spec 05 §4.5). Successful donations only, with the
 * required donor labels. Never contact, address or payment details.
 */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import type { Paginated } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton } from "../../components/ui";
import { DemoBadge } from "../../donations/DemoBadge";
import { useDonationConfig } from "../../donations/DonationConfigProvider";
import { formatKobo } from "../../donations/money";
import type { FinanceSummary, PublicDonation } from "../../donations/types";
import { formatDate } from "../../lib/format";
import "./finance.css";

function Recipient({ d }: { d: PublicDonation }) {
  if (d.designation !== "candidate" || !d.candidate) return <>NDC general fund</>;
  if (!d.candidate.is_public) return <>Former candidate: {d.candidate.full_name}</>;
  return <Link to={`/candidates/${d.candidate.slug}`}>{d.candidate.full_name}</Link>;
}

export default function FinancePage() {
  const api = useApi();
  const { config, loading: configLoading } = useDonationConfig();
  const [params, setParams] = useSearchParams();
  const designation = params.get("designation") ?? "";
  const candidate = params.get("candidate") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const q = new URLSearchParams();
  if (designation) q.set("designation", designation);
  if (candidate) q.set("candidate", candidate);
  const filterQs = q.toString();
  if (page > 1) q.set("page", String(page));
  const qs = q.toString();

  const list = useRequest(`finance:${qs}`, (signal) => api<Paginated<PublicDonation>>(`/finance/donations/${qs ? `?${qs}` : ""}`, { anonymous: true, signal }));
  const summary = useRequest(`finance-summary:${filterQs}`, (signal) => api<FinanceSummary>(`/finance/summary/${filterQs ? `?${filterQs}` : ""}`, { anonymous: true, signal }));
  const demo = summary.data?.demo ?? null;
  const candidateName = [...(summary.data?.candidates ?? []), ...(demo?.candidates ?? [])].find((c) => c.slug === candidate)?.full_name;

  useEffect(() => {
    document.title = "Finance | NDCConnect";
  }, []);

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  return (
    <div className="finance-page">
      <header className="finance-page__head">
        <h1>Finance</h1>
        <p className="finance-page__lead">
          Every successful donation to the NDC and its candidates on NDCConnect. Only successful payments are listed; pending, failed and
          refunded payments aren’t shown. Donor contact details are never published.
        </p>
      </header>

      {!configLoading && !config.open && <Banner tone="info">Donations aren’t open yet.</Banner>}
      {demo && demo.overall.count > 0 && (
        <Banner tone="warning" title="DEMO DATA — not real donations">
          This page includes {demo.overall.count.toLocaleString("en-NG")} simulated donations ({formatKobo(demo.overall.total_kobo)}) for a
          preview. They are marked DEMO, were never paid, and are not counted in Total raised.
        </Banner>
      )}

      <section className="finance-totals" aria-label="Totals">
        <div className="finance-total">
          <p className="finance-total__label">Total raised</p>
          <p className="finance-total__value">{summary.data ? formatKobo(summary.data.overall.total_kobo) : "…"}</p>
          <p className="finance-total__sub">{summary.data ? `${summary.data.overall.count.toLocaleString("en-NG")} donations` : ""}</p>
        </div>
        {demo && demo.overall.count > 0 && (
          <div className="finance-total finance-total--demo">
            <p className="finance-total__label"><DemoBadge /> Demo donations (not real)</p>
            <p className="finance-total__value">{formatKobo((designation || candidate ? demo.filtered : demo.overall).total_kobo)}</p>
            <p className="finance-total__sub">{(designation || candidate ? demo.filtered : demo.overall).count.toLocaleString("en-NG")} simulated donations{designation || candidate ? " in this view" : ""}</p>
          </div>
        )}
        {(designation || candidate) && summary.data && (
          <div className="finance-total">
            <p className="finance-total__label">{candidateName ?? (designation === "party" ? "NDC general fund" : designation === "candidate" ? "All candidates" : "Filtered")}</p>
            <p className="finance-total__value">{formatKobo(summary.data.filtered.total_kobo)}</p>
            <p className="finance-total__sub">{summary.data.filtered.count.toLocaleString("en-NG")} donations</p>
          </div>
        )}
      </section>

      <div className="finance-filters">
        <Select label="Show" value={candidate ? "candidate" : designation} onChange={(e) => set({ designation: e.target.value, candidate: "" })}
          options={[{ value: "", label: "All donations" }, { value: "party", label: "NDC general fund" }, { value: "candidate", label: "Candidates" }]} />
        {candidate && (
          <p className="finance-filters__chip">
            Showing donations to <strong>{candidateName ?? candidate}</strong>{" "}
            <Button variant="ghost" size="sm" onClick={() => set({ candidate: "" })}>Clear</Button>
          </p>
        )}
      </div>

      {list.error ? (
        <Banner tone="error" title="We couldn’t load donations" action={<Button variant="secondary" size="sm" onClick={list.retry}>Try again</Button>}>{list.error.message}</Banner>
      ) : list.loading && !list.data ? (
        <Skeleton width="100%" height={120} />
      ) : list.data && list.data.count === 0 ? (
        <EmptyState title="No donations to show yet">Successful donations appear here.</EmptyState>
      ) : list.data ? (
        <>
          <table className="finance-table">
            <caption className="visually-hidden">Successful donations, newest first</caption>
            <thead>
              <tr><th scope="col">Donor</th><th scope="col">Amount</th><th scope="col">Given to</th><th scope="col">Date</th></tr>
            </thead>
            <tbody>
              {list.data.results.map((d, i) => (
                <tr key={`${page}-${i}`} className={d.is_demo ? "finance-table__demo" : undefined}>
                  <td data-label="Donor">{d.is_demo && <><DemoBadge />{" "}</>}{d.public_label}</td>
                  <td data-label="Amount" className="finance-table__amount">{formatKobo(d.amount_kobo)}</td>
                  <td data-label="Given to"><Recipient d={d} /></td>
                  <td data-label="Date">{formatDate(d.paid_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageCount={Math.ceil(list.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label="Donation pages" />
        </>
      ) : null}
    </div>
  );
}
