/**
 * /candidates — public list of published NDC candidates, grouped by office (spec 03 §8.1).
 * Filters live in the URL so a filtered list can be shared. No account or PVC needed.
 */
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import type { CandidateSummary, Paginated, PositionsResponse } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, CandidateCard, CandidateCardSkeleton, EmptyState, Pagination, Select, TextField } from "../../components/ui";
import { POSITIONS, STATES } from "../../lib/nigeria";
import "./candidates.css";

const PAGE_SIZE = 20;

function groupByPosition(items: CandidateSummary[]) {
  const groups: { position: string; label: string; items: CandidateSummary[] }[] = [];
  for (const c of items) {
    const last = groups[groups.length - 1];
    if (last && last.position === c.position) last.items.push(c);
    else groups.push({ position: c.position, label: c.position_label, items: [c] });
  }
  return groups;
}

export default function CandidatesPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const position = params.get("position") ?? "";
  const state = params.get("state") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [search, setSearch] = useState(q);

  useEffect(() => setSearch(q), [q]);
  useEffect(() => {
    document.title = "Candidates | NDCConnect";
  }, []);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const query = new URLSearchParams();
  if (position) query.set("position", position);
  if (state) query.set("state", state);
  if (q) query.set("q", q);
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();

  const list = useRequest(`list?${qs}`, (signal) =>
    api<Paginated<CandidateSummary>>(`/candidates/${qs ? `?${qs}` : ""}`, { anonymous: true, signal })
  );
  const positions = useRequest(`positions?${state}`, (signal) =>
    api<PositionsResponse>(`/candidates/positions/${state ? `?state=${state}` : ""}`, { anonymous: true, signal })
  );

  const counts = new Map(positions.data?.positions.map((p) => [p.position, p.count]) ?? []);
  const filtered = Boolean(position || state || q);
  const year = list.data?.election_year ?? positions.data?.election_year;

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    update({ q: search.trim() });
  };

  return (
    <div className="cand-page">
      <header className="cand-page__head">
        <h1>Candidates</h1>
        <p className="cand-page__lead">
          NDC candidates by elective office{year ? ` for the ${year} elections` : ""}. Every profile here has been checked by
          NDCConnect before publishing.
        </p>
      </header>

      <form className="cand-filters" onSubmit={onSearch} role="search" aria-label="Filter candidates">
        <Select
          label="Office"
          value={position}
          onChange={(e) => update({ position: e.target.value })}
          options={[
            { value: "", label: "All offices" },
            ...POSITIONS.map((p) => ({ value: p.value, label: counts.has(p.value) ? `${p.label} (${counts.get(p.value)})` : p.label })),
          ]}
        />
        <Select
          label="State"
          value={state}
          onChange={(e) => update({ state: e.target.value })}
          options={[{ value: "", label: "All states" }, ...STATES]}
        />
        <div className="cand-filters__search">
          <TextField label="Search" name="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or area" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
      </form>

      {list.error ? (
        <Banner tone="error" title="We couldn’t load candidates" action={<Button variant="secondary" size="sm" onClick={list.retry}>Try again</Button>}>
          {list.error.message}
        </Banner>
      ) : list.loading && !list.data ? (
        <div className="cand-grid" aria-busy="true">
          <span className="visually-hidden">Loading candidates</span>
          {Array.from({ length: 6 }, (_, i) => (
            <CandidateCardSkeleton key={i} />
          ))}
        </div>
      ) : list.data && list.data.results.length === 0 ? (
        <EmptyState
          title={filtered ? "No published candidates match these filters" : "No candidates have been published yet"}
          action={filtered ? <Button variant="secondary" onClick={() => setParams(new URLSearchParams())}>Clear filters</Button> : undefined}
        >
          {filtered ? "Try another office or state, or clear the search." : "Check back soon."}
        </EmptyState>
      ) : list.data ? (
        <div aria-busy={list.loading || undefined}>
          {groupByPosition(list.data.results).map((g, i) => (
            <section key={`${g.position}-${i}`} className="cand-group" aria-labelledby={`grp-${g.position}-${i}`}>
              <h2 id={`grp-${g.position}-${i}`} className="cand-group__title">
                {g.label}
                {counts.get(g.position) ? <span className="cand-group__count"> · {counts.get(g.position)}</span> : null}
              </h2>
              <div className="cand-grid">
                {g.items.map((c) => (
                  <CandidateCard
                    key={c.slug}
                    name={c.full_name}
                    position={c.position_label}
                    area={c.area_display}
                    party={c.party}
                    photoSrc={c.photo?.url_200}
                    verified={c.verified}
                    href={`/candidates/${c.slug}`}
                    /* Vote (Follow) slot — spec 04 */
                  />
                ))}
              </div>
            </section>
          ))}
          <Pagination page={page} pageCount={Math.ceil(list.data.count / PAGE_SIZE)} onChange={(p) => update({ page: p > 1 ? String(p) : "" })} label="Candidate pages" />
        </div>
      ) : null}
    </div>
  );
}
