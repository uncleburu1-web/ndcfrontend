/** /news — official announcements and reviewed community news (spec 07 §4.1). Public. */
import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { STATES } from "../../lib/nigeria";
import { HomeStateChip } from "../../search/HomeStateChip";
import { useHomeState } from "../../search/useHomeState";
import { ArticleImage } from "../../news/ArticleImage";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import { CandidatePostItem } from "../../posts/CandidatePostItem";
import type { FeedPost } from "../../posts/types";
import { SourceBadges } from "../../news/SourceBadges";
import { articlePath, type ArticleSummary, type NewsPage as Page } from "../../news/types";
import "../../news/news.css";
import { t, lazy } from "../../i18n";
import { LanguageFilter } from "../../i18n/ContentLanguage";

const TABS = lazy(() => [["", t("news.tab.all")], ["official", t("news.tab.official")], ["community", t("news.tab.community")], ["candidate", t("news.tab.candidate")]] as const);

function Item({ a }: { a: ArticleSummary }) {
  return (
    <li className={`news-item${a.pinned ? " news-item--pinned" : ""}`}>
      <div className="news-item__body">
        <SourceBadges a={a} />
        <h2><Link to={articlePath(a)}>{a.title}</Link></h2>
        <p className="news-meta">
          {a.published_at ? formatDate(a.published_at) : ""}
          {a.state_label ? ` · ${a.state_label}` : ""}
          {a.source === "community" ? t("news.by-2", { v: a.byline ?? t("news.a-member") }) : ""}
          {a.byline_verified && <> <VerifiedVoterBadge size="sm" /></>}
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
  const paramState = params.get("state") ?? "";
  const home = useHomeState(paramState); // spec 12 §4.5: home state only pre-fills, with a chip
  const state = home.state;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const language = params.get("language") ?? ""; // spec 21 §9: written in one language
  const qs = new URLSearchParams();
  if (source) qs.set("source", source);
  if (state) qs.set("state", state);
  if (language) qs.set("language", language);
  if (page > 1) qs.set("page", String(page));
  const res = useRequest(`news:${qs}`, (signal) => api<Page>(`/news/${qs.toString() ? `?${qs}` : ""}`, { anonymous: true, signal }));

  useEffect(() => {
    document.title = t("news.news-ndcconnect");
  }, []);
  const set = (changes: Record<string, string>) => {
    if ("state" in changes && !changes.state && home.fromHome) home.dismiss();
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const tabHref = (s: string) => {
    const next = new URLSearchParams();
    if (s) next.set("source", s);
    if (paramState) next.set("state", paramState);
    return `/news${next.toString() ? `?${next}` : ""}`;
  };
  const submitHref = isSignedIn ? "/news/submit" : "/sign-in?redirect_url=%2Fnews%2Fsubmit";
  const stateLabel = STATES.find((s) => s.value === state)?.label;
  const where = stateLabel ?? "none";
  const empty = source === "candidate" ? t("news.empty.candidate", { where }) : source === "community" ? t("news.empty.community", { where })
    : source === "official" ? t("news.empty.official") : t("news.empty.all", { where });

  return (
    <div className="news-page">
      <header className="news-page__head">
        <h1>{t("news.news-2")}</h1>
        <Button href={submitHref} variant="secondary">{t("news.submit-news")}</Button>
      </header>
      <div className="news-filters">
        <nav aria-label={t("news.news-source")}>
          <ul className="news-tabs">
            {TABS.map(([id, label]) => (
              <li key={id}><Link to={tabHref(id)} aria-current={source === id ? "page" : undefined}>{t(`news.tab.${id || "all"}`) || label}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="news-state">
          <Select label={t("news.state")} value={state} onChange={(e) => set({ state: e.target.value })}
            options={[{ value: "", label: t("news.all-of-nigeria") }, ...STATES]} />
        </div>
        <LanguageFilter value={language} onChange={(v) => set({ language: v })} />
      </div>
      {home.fromHome && <HomeStateChip state={home.home} onClear={home.dismiss} />}

      {res.error ? (
        <Banner tone="error" title={t("news.we-couldn-t-load-the-news")} action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("news.try-again")}</Button>}>
          {res.error.message}
        </Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={180} />
      ) : res.data && res.data.count === 0 && res.data.pinned.length === 0 ? (
        <EmptyState title={empty} action={<Button href={submitHref}>{t("news.submit-news")}</Button>}>
          {t("news.members-can-submit-local-news-our")}</EmptyState>
      ) : res.data ? (
        <>
          <ul className="news-list">
            {res.data.pinned.map((a) => <Item key={a.id} a={a} />)}
            {res.data.results.map((a) => (a.source === "candidate"
              ? <CandidatePostItem key={a.id} post={a as FeedPost} candidate={(a as FeedPost).candidate} />
              : <Item key={a.id} a={a as ArticleSummary} />))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => set({ page: p > 1 ? String(p) : "" })} label={t("news.news-pages")} />
        </>
      ) : null}
    </div>
  );
}
