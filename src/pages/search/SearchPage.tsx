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
import { t as tr, lazy } from "../../i18n";

const TABS: [SearchType, string][] = lazy(() => [["all", tr("search.all")], ["candidates", tr("search.candidates")], ["news", tr("search.news")], ["posts", tr("search.candidate-posts")]]);
const SINCE = [{ value: "", get label() { return tr("search.any-time"); } }, { value: "week", get label() { return tr("search.past-week"); } }, { value: "month", get label() { return tr("search.past-month"); } }, { value: "year", get label() { return tr("search.past-year"); } }];

function NoResults({ q, dym, onTry }: { q: string; dym: string | null; onTry: (q: string) => void }) {
  return (
    <EmptyState icon="search" title={tr("search.no-results-for", { q })}
      action={<span className="article-badges"><Button variant="secondary" href="/candidates">{tr("search.browse-candidates")}</Button>
        <Button variant="secondary" href="/news">{tr("search.browse-news")}</Button><Button variant="secondary" href="/states">{tr("search.browse-by-state")}</Button></span>}>
      {dym && <p className="search-dym">{tr.rich("search.did-you-mean", { dym, button: (chunks) => <button type="button" className="home-chip__clear" onClick={() => onTry(dym)}>{chunks}</button> })}</p>}
      <ul className="search-tips">
        <li>{tr("search.check-the-spelling-or-try-part")}</li>
        <li>{tr("search.use-fewer-words")}</li>
        <li>{tr("search.remove-filters")}</li>
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
    document.title = q ? tr("search.search-ndcconnect-2", { q }) : tr("search.search-ndcconnect-3");
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
      <h1>{tr("search.search")}</h1>
      <form className="search-form" role="search" onSubmit={onSubmit}>
        <TextField label={tr("search.search-candidates-news-and-posts")} enterKeyHint="search" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <Button type="submit">{tr("search.search")}</Button>
      </form>
      {q.length > 0 && q.length < Q_MIN && <Banner tone="info">{tr("search.type-at-least-2-characters")}</Banner>}
      <nav className="search-tabs" aria-label={tr("search.result-types")}>
        {TABS.map(([t, label]) => (
          <Link key={t} to={tabHref(t)} aria-current={t === type ? "page" : undefined}>
            {label}{counts && t !== "all" ? ` (${counts[t]})` : ""}
          </Link>
        ))}
      </nav>
      <div className="search-filters">
        <Select label={tr("search.state")} value={state} onChange={(e) => set({ state: e.target.value })} options={[{ value: "", label: tr("search.all-states") }, ...STATES]} />
        {type === "candidates" && (
          <>
            <Select label={tr("search.office")} value={params.get("position") ?? ""} onChange={(e) => set({ position: e.target.value })}
              options={[{ value: "", label: tr("search.all-offices") }, ...POSITIONS.map((p) => ({ value: p.value, label: p.label }))]} />
            <Select label={tr("search.election")} value={params.get("year") ?? ""} onChange={(e) => set({ year: e.target.value })}
              options={[{ value: "", label: current ? tr("search.current", { current }) : tr("search.current-2") },
                ...past.map((y) => ({ value: String(y), label: tr("search.past", { y }) }))]} />
          </>
        )}
        {(type === "news" || type === "posts") && (
          <Select label={tr("search.date")} value={params.get("since") ?? ""} onChange={(e) => set({ since: e.target.value })} options={SINCE} />
        )}
        {type === "news" && (
          <Select label={tr("search.source")} value={params.get("source") ?? ""} onChange={(e) => set({ source: e.target.value })}
            options={[{ value: "", label: tr("search.all-news") }, { value: "official", label: tr("search.official") }, { value: "community", label: tr("search.community") }]} />
        )}
      </div>
      {home.fromHome && <HomeStateChip state={home.home} onClear={home.dismiss} />}

      <div aria-live="polite" className="visually-hidden">{res.data ? tr("search.result", { total, v: total === 1 ? "" : "s" }) : ""}</div>
      {!ready ? (
        <EmptyState icon="search" title={tr("search.search-ndcconnect")}>{tr("search.find-candidates-news-and-candidate-posts")}</EmptyState>
      ) : err ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{tr("search.try-again")}</Button>}>
          {err.code === "search_unavailable" ? tr("search.search-is-busy-try-again-in") : err.message}
        </Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={200} />
      ) : total === 0 ? (
        <NoResults q={q} dym={(all ?? one)?.did_you_mean ?? null} onTry={(v) => set({ q: v })} />
      ) : all ? (
        <>
          {(all.places?.results.length ?? 0) > 0 && (
            <section className="search-section" aria-labelledby="s-pl">
              <h2 id="s-pl">{tr("search.places")}</h2>
              <ul className="geo-list">{all.places!.results.map((p) => <li key={p.url}><Link to={p.url}>{p.title}</Link></li>)}</ul>
            </section>
          )}
          {all.candidates.count > 0 && (
            <section className="search-section" aria-labelledby="s-c">
              <div className="search-section__head"><h2 id="s-c">{tr("search.candidates")}</h2>
                {all.candidates.count > all.candidates.results.length && <Link to={tabHref("candidates")}>{tr("search.see-all", { count: all.candidates.count })}</Link>}</div>
              <CandidateGrid items={all.candidates.results} />
            </section>
          )}
          {all.news.count > 0 && (
            <section className="search-section" aria-labelledby="s-n">
              <div className="search-section__head"><h2 id="s-n">{tr("search.news")}</h2>
                {all.news.count > all.news.results.length && <Link to={tabHref("news")}>{tr("search.see-all", { count: all.news.count })}</Link>}</div>
              <ul className="news-list">{all.news.results.map((a) => <ArticleResult key={a.id} a={a} />)}</ul>
            </section>
          )}
          {all.posts.count > 0 && (
            <section className="search-section" aria-labelledby="s-p">
              <div className="search-section__head"><h2 id="s-p">{tr("search.candidate-posts")}</h2>
                {all.posts.count > all.posts.results.length && <Link to={tabHref("posts")}>{tr("search.see-all", { count: all.posts.count })}</Link>}</div>
              <ul className="news-list">{all.posts.results.map((p) => <PostResult key={p.id} p={p} />)}</ul>
            </section>
          )}
        </>
      ) : one ? (
        <>
          <p className="news-meta">{one.count.toLocaleString()} {one.count === 1 ? tr("search.result-2") : tr("search.results")}</p>
          {type === "candidates" ? <CandidateGrid items={one.results as CandidateSummary[]} />
            : <ul className="news-list">{type === "news"
              ? (one.results as ArticleHit[]).map((a) => <ArticleResult key={a.id} a={a} />)
              : (one.results as PostHit[]).map((p) => <PostResult key={p.id} p={p} />)}</ul>}
          <Pagination page={page} pageCount={Math.ceil(one.count / 20)} label={tr("search.result-pages")} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} />
        </>
      ) : null}
    </div>
  );
}
