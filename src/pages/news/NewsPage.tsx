/** /news — official announcements and reviewed community news (spec 07 §4.1). Public. */
import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { STATES } from "../../lib/nigeria";
import { ArticleImage } from "../../news/ArticleImage";
import { SourceBadges } from "../../news/SourceBadges";
import { articlePath, type ArticleSummary, type NewsPage as Page } from "../../news/types";
import "../../news/news.css";

const TABS = [["", "All"], ["official", "Official"], ["community", "Community"]] as const;

function Item({ a }: { a: ArticleSummary }) {
  return (
    <li className={`news-item${a.pinned ? " news-item--pinned" : ""}`}>
      <div className="news-item__body">
        <SourceBadges a={a} />
        <h2><Link to={articlePath(a)}>{a.title}</Link></h2>
        <p className="news-meta">
          {a.published_at ? formatDate(a.published_at) : ""}
          {a.state_label ? ` · ${a.state_label}` : ""}
          {a.source === "community" ? ` · by ${a.byline ?? "a member"}` : ""}
        </p>
        <p>{a.excerpt}</p>
      </div>
      {a.image && <ArticleImage image={a.image} thumb />}
    </li>
  );
}

export default function NewsPage() {
  const api = useApi();
  const { isSignedIn } = useAuth();
  const [params, setParams] = useSearchParams();
  const source = params.get("source") ?? "";
  const state = params.get("state") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = new URLSearchParams();
  if (source) qs.set("source", source);
  if (state) qs.set("state", state);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`news:${qs}`, (signal) => api<Page>(`/news/${qs.toString() ? `?${qs}` : ""}`, { anonymous: true, signal }));

  useEffect(() => {
    document.title = "News | NDCConnect";
  }, []);
  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const tabHref = (s: string) => {
    const next = new URLSearchParams();
    if (s) next.set("source", s);
    if (state) next.set("state", state);
    return `/news${next.toString() ? `?${next}` : ""}`;
  };
  const submitHref = isSignedIn ? "/news/submit" : "/sign-in?redirect_url=%2Fnews%2Fsubmit";
  const stateLabel = STATES.find((s) => s.value === state)?.label;
  const empty = source === "community" ? `No community news${stateLabel ? ` for ${stateLabel}` : ""} yet`
    : source === "official" ? "No official announcements yet" : `No news${stateLabel ? ` for ${stateLabel}` : ""} yet`;

  return (
    <div className="news-page">
      <header className="news-page__head">
        <h1>News</h1>
        <Button href={submitHref} variant="secondary">Submit news</Button>
      </header>
      <div className="news-filters">
        <nav aria-label="News source">
          <ul className="news-tabs">
            {TABS.map(([id, label]) => (
              <li key={id}><Link to={tabHref(id)} aria-current={source === id ? "page" : undefined}>{label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="news-state">
          <Select label="State" value={state} onChange={(e) => set({ state: e.target.value })}
            options={[{ value: "", label: "All of Nigeria" }, ...STATES]} />
        </div>
      </div>

      {res.error ? (
        <Banner tone="error" title="We couldn’t load the news" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>
          {res.error.message}
        </Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={180} />
      ) : res.data && res.data.count === 0 && res.data.pinned.length === 0 ? (
        <EmptyState title={empty} action={<Button href={submitHref}>Submit news</Button>}>
          Members can submit local news. Our reviewers check it before it appears.
        </EmptyState>
      ) : res.data ? (
        <>
          <ul className="news-list">
            {res.data.pinned.map((a) => <Item key={a.id} a={a} />)}
            {res.data.results.map((a) => <Item key={a.id} a={a} />)}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label="News pages" />
        </>
      ) : null}
    </div>
  );
}
