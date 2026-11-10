/**
 * /search (spec 12 §4.2). Public and anonymous: the same answer for everyone. Filters live in the URL;
 * a home state only pre-fills the State filter, with a chip that says so.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import type { CandidateSummary } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, TextField } from "../../components/ui";
import { POSITIONS, STATES } from "../../lib/nigeria";
import { CandidateGrid } from "../../search/CandidateGrid";
import { HomeStateChip } from "../../search/HomeStateChip";
import { ArticleResult, PostResult } from "../../search/ResultItem";
import { Q_MIN, type AllResults, type ArticleHit, type PostHit, type SearchType, type TypeResults } from "../../search/types";
import { useHomeState } from "../../search/useHomeState";
import "../../news/news.css";
import "../../search/search.css";
import "../../geo/geo.css";

const TABS: [SearchType, string][] = [["all", "All"], ["candidates", "Candidates"], ["news", "News"], ["posts", "Candidate posts"]];
const SINCE = [{ value: "", label: "Any time" }, { value: "week", label: "Past week" }, { value: "month", label: "Past month" }, { value: "year", label: "Past year" }];

function NoResults({ q, dym, onTry }: { q: string; dym: string | null; onTry: (q: string) => void }) {
  return (
    <EmptyState icon="search" title={`No results for “${q}”`}
      action={<span className="article-badges"><Button variant="secondary" href="/candidates">Browse candidates</Button>
        <Button variant="secondary" href="/news">Browse news</Button><Button variant="secondary" href="/states">Browse by state</Button></span>}>
      {dym && <p className="search-dym">Did you mean <button type="button" className="home-chip__clear" onClick={() => onTry(dym)}>{dym}</button>?</p>}
      <ul className="search-tips">
        <li>Check the spelling, or try part of the name.</li>
        <li>Use fewer words.</li>
        <li>Remove filters.</li>
      </ul>
    </EmptyState>
  );
}

export default function SearchPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const type = (TABS.some(([t]) => t === params.get("type")) ? params.get("type") : "all") as SearchType;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const home = useHomeState(params.get("state") ?? "");
  const state = home.state;
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    document.title = q ? `“${q}” — Search | NDCConnect` : "Search | NDCConnect";
  }, [q]);

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (type !== "all") qs.set("type", type);
  if (state) qs.set("state", state);
  for (const k of ["position", "year", "since", "source"]) if (params.get(k)) qs.set(k, params.get(k)!);
  if (page > 1) qs.set("page", String(page));
  const ready = q.length >= Q_MIN;
  const res = useRequest<AllResults | TypeResults<unknown> | null>(`search:${qs}:${ready}`, (signal) =>
    ready ? api(`/search/?${qs}`, { anonymous: true, signal }) : Promise.resolve(null));

  const set = (patch: Record<string, string>) => {
    if ("state" in patch && !patch.state && home.fromHome) home.dismiss();
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    if (!("page" in patch)) n.delete("page");
    setParams(n);
  };
  const tabHref = (t: SearchType) => {
    const n = new URLSearchParams(params);
    if (t === "all") n.delete("type");
    else n.set("type", t);
    n.delete("page");
    return `/search?${n}`;
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim() });
  };

  const all = type === "all" ? (res.data as AllResults | null) : null;
  const one = type !== "all" ? (res.data as TypeResults<CandidateSummary | ArticleHit | PostHit> | null) : null;
  const counts = all ? { candidates: all.candidates.count, news: all.news.count, posts: all.posts.count } : null;
  const total = all ? all.candidates.count + all.news.count + all.posts.count + (all.places?.count ?? 0) : one?.count ?? 0;
  const err = res.error as ApiError | null;
  const years = useRequest<{ election_years: number[] } | null>(`search-years:${type}`, (signal) =>
    type === "candidates" ? api("/candidates/positions/", { anonymous: true, signal }) : Promise.resolve(null));
  const current = one?.election_year ?? years.data?.election_years?.[0];
  const past = (years.data?.election_years ?? []).filter((y) => y !== current);

  return (
    <div className="search-page">
      <h1>Search</h1>
      <form className="search-form" role="search" onSubmit={onSubmit}>
        <TextField label="Search candidates, news and posts" enterKeyHint="search" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <Button type="submit">Search</Button>
      </form>
      {q.length > 0 && q.length < Q_MIN && <Banner tone="info">Type at least 2 characters.</Banner>}
      <nav className="search-tabs" aria-label="Result types">
        {TABS.map(([t, label]) => (
          <Link key={t} to={tabHref(t)} aria-current={t === type ? "page" : undefined}>
            {label}{counts && t !== "all" ? ` (${counts[t]})` : ""}
          </Link>
        ))}
      </nav>
      <div className="search-filters">
        <Select label="State" value={state} onChange={(e) => set({ state: e.target.value })} options={[{ value: "", label: "All states" }, ...STATES]} />
        {type === "candidates" && (
          <>
            <Select label="Office" value={params.get("position") ?? ""} onChange={(e) => set({ position: e.target.value })}
              options={[{ value: "", label: "All offices" }, ...POSITIONS.map((p) => ({ value: p.value, label: p.label }))]} />
            <Select label="Election" value={params.get("year") ?? ""} onChange={(e) => set({ year: e.target.value })}
              options={[{ value: "", label: current ? `Current (${current})` : "Current" },
                ...past.map((y) => ({ value: String(y), label: `Past: ${y}` }))]} />
          </>
        )}
        {(type === "news" || type === "posts") && (
          <Select label="Date" value={params.get("since") ?? ""} onChange={(e) => set({ since: e.target.value })} options={SINCE} />
        )}
        {type === "news" && (
          <Select label="Source" value={params.get("source") ?? ""} onChange={(e) => set({ source: e.target.value })}
            options={[{ value: "", label: "All news" }, { value: "official", label: "Official" }, { value: "community", label: "Community" }]} />
        )}
      </div>
      {home.fromHome && <HomeStateChip state={home.home} onClear={home.dismiss} />}

      <div aria-live="polite" className="visually-hidden">{res.data ? `${total} result${total === 1 ? "" : "s"}` : ""}</div>
      {!ready ? (
        <EmptyState icon="search" title="Search NDCConnect">Find candidates, news and candidate posts. Try a name, a place or an office like “governor Kano”.</EmptyState>
      ) : err ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>
          {err.code === "search_unavailable" ? "Search is busy. Try again in a moment." : err.message}
        </Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : total === 0 ? (
        <NoResults q={q} dym={(all ?? one)?.did_you_mean ?? null} onTry={(v) => set({ q: v })} />
      ) : all ? (
        <>
          {(all.places?.results.length ?? 0) > 0 && (
            <section className="search-section" aria-labelledby="s-pl">
              <h2 id="s-pl">Places</h2>
              <ul className="geo-list">{all.places!.results.map((p) => <li key={p.url}><Link to={p.url}>{p.title}</Link></li>)}</ul>
            </section>
          )}
          {all.candidates.count > 0 && (
            <section className="search-section" aria-labelledby="s-c">
              <div className="search-section__head"><h2 id="s-c">Candidates</h2>
                {all.candidates.count > all.candidates.results.length && <Link to={tabHref("candidates")}>See all {all.candidates.count}</Link>}</div>
              <CandidateGrid items={all.candidates.results} />
            </section>
          )}
          {all.news.count > 0 && (
            <section className="search-section" aria-labelledby="s-n">
              <div className="search-section__head"><h2 id="s-n">News</h2>
                {all.news.count > all.news.results.length && <Link to={tabHref("news")}>See all {all.news.count}</Link>}</div>
              <ul className="news-list">{all.news.results.map((a) => <ArticleResult key={a.id} a={a} />)}</ul>
            </section>
          )}
          {all.posts.count > 0 && (
            <section className="search-section" aria-labelledby="s-p">
              <div className="search-section__head"><h2 id="s-p">Candidate posts</h2>
                {all.posts.count > all.posts.results.length && <Link to={tabHref("posts")}>See all {all.posts.count}</Link>}</div>
              <ul className="news-list">{all.posts.results.map((p) => <PostResult key={p.id} p={p} />)}</ul>
            </section>
          )}
        </>
      ) : one ? (
        <>
          <p className="news-meta">{one.count.toLocaleString()} {one.count === 1 ? "result" : "results"}</p>
          {type === "candidates" ? <CandidateGrid items={one.results as CandidateSummary[]} />
            : <ul className="news-list">{type === "news"
              ? (one.results as ArticleHit[]).map((a) => <ArticleResult key={a.id} a={a} />)
              : (one.results as PostHit[]).map((p) => <PostResult key={p.id} p={p} />)}</ul>}
          <Pagination page={page} pageCount={Math.ceil(one.count / 20)} label="Result pages" onChange={(p) => set({ page: p > 1 ? String(p) : "" })} />
        </>
      ) : null}
    </div>
  );
}
