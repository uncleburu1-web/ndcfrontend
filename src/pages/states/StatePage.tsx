/** /states/:state — everything public about one state (spec 12 §4.4). */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, useToast } from "../../components/ui";
import { CandidatePostItem } from "../../posts/CandidatePostItem";
import { UpcomingStrip } from "../../events/UpcomingStrip";
import { SourceBadges } from "../../news/SourceBadges";
import { articlePath } from "../../news/types";
import { formatDate } from "../../lib/format";
import { CandidateGrid } from "../../search/CandidateGrid";
import type { StateDetail } from "../../search/types";
import { AboutData, LgaList } from "../../geo/GeoSections";
import "../../news/news.css";
import "../../search/search.css";
import { t } from "../../i18n";

function NotFound() {
  return (
    <div className="page-shell">
      <EmptyState title={t("states.page-not-found")} action={<Button href="/states">{t("states.all-states")}</Button>}>{t("states.that-state-doesn-t-exist")}</EmptyState>
    </div>
  );
}

export default function StatePage() {
  const { state = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const { me, setMe } = useMe();
  const res = useRequest(`state:${state}`, (signal) => api<StateDetail>(`/states/${encodeURIComponent(state)}/`, { anonymous: true, signal }));
  const [saving, setSaving] = useState(false);
  const d = res.data;
  useEffect(() => {
    document.title = d ? t("states.ndcconnect", { label: d.label }) : t("states.state-ndcconnect");
  }, [d]);

  if ((res.error as ApiError | null)?.status === 404) return <NotFound />;
  if (res.error) return <div className="states-page"><Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("states.try-again")}</Button>}>{res.error.message}</Banner></div>;
  if (!d) return <div className="states-page"><Skeleton width="100%" height={300} /></div>;

  const makeMine = async () => {
    setSaving(true);
    try {
      const updated = await api<typeof me>("/me/", { method: "PATCH", body: { home_state: d.state } });
      if (updated) setMe(updated);
      toast.show({ tone: "success", message: t("states.is-now-your-state-only-you", { label: d.label }) });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("states.couldn-t-save") });
    } finally {
      setSaving(false);
    }
  };
  const isMine = me?.home_state === d.state;
  const filter = (p: string) => (p === "president" ? "/candidates?position=president" : `/candidates?state=${d.state}&position=${p}`);
  return (
    <div className="states-page">
      <p className="article-back"><Link to="/states">{t("states.all-states-2")}</Link></p>
      <header className="state-head">
        <div>
          <h1>{t("states.on-ndcconnect", { label: d.label })}</h1>
          {d.capital && <p className="news-meta">{t("states.capital", { capital: d.capital })}</p>}
        </div>
        <span className="article-badges">
          <Button variant="secondary" href={`/search?state=${d.state}`}>{t("states.search-this-state")}</Button>
          <Button variant="secondary" href={`/communities/${d.state.replace(/_/g, "-")}`}>
            {t("states.community", { v: d.state === "fct" ? t("states.federal-capital-territory") : t("states.state", { label: d.label }) })}</Button>
          {me ? (isMine ? <span className="news-meta">{t("states.your-state")}</span>
            : <Button variant="secondary" loading={saving} onClick={() => void makeMine()}>{t("states.make-this-my-state")}</Button>)
            : <Button variant="ghost" href={`/sign-in?redirect_url=${encodeURIComponent(`/states/${d.state}`)}`}>{t("states.sign-in-to-make-this-your")}</Button>}
        </span>
      </header>

      <section className="search-section" aria-labelledby="st-c">
        <h2 id="st-c">{t("states.candidates", { v: d.election_year ? t("states.for", { election_year: d.election_year }) : "" })}</h2>
        {d.groups.length === 0 ? <p className="news-meta">{t("states.no-published-candidates-for-yet", { label: d.label })}</p> : d.groups.map((g) => (
          <div key={g.position} className="state-group">
            <div className="search-section__head">
              <h3>{g.label}</h3>
              {g.total > g.results.length && <Link to={filter(g.position)}>{t("states.see-all", { total: g.total })}</Link>}
            </div>
            <CandidateGrid items={g.results} />
          </div>
        ))}
      </section>

      {d.lgas && <LgaList state={d.state} label={d.label} lgas={d.lgas} areaCouncils={!!d.area_councils} constituencies={d.constituencies ?? []} />}

      <UpcomingStrip query={`state=${d.state}`} title={t("states.upcoming-events-in", { label: d.label })} limit={5} more={`/events?state=${d.state}`} />
      <section className="search-section" aria-labelledby="st-n">
        <div className="search-section__head"><h2 id="st-n">{t("states.latest-news")}</h2><Link to={`/news?state=${d.state}`}>{t("states.all-news-for", { label: d.label })}</Link></div>
        {d.news.length === 0 ? <p className="news-meta">{t("states.no-news-yet")}</p> : (
          <ul className="news-list">
            {d.news.map((a) => (
              <li key={a.id} className="news-item">
                <div className="news-item__body">
                  <SourceBadges a={{ ...a, pinned: false }} />
                  <h3><Link to={articlePath(a)}>{a.title}</Link></h3>
                  <p className="news-meta">{a.published_at ? formatDate(a.published_at) : ""}{a.state_label ? ` · ${a.state_label}` : t("states.all-of-nigeria")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="search-section" aria-labelledby="st-p">
        <div className="search-section__head"><h2 id="st-p">{t("states.latest-from-candidates")}</h2>
          <Link to={`/news?source=candidate&state=${d.state}`}>{t("states.all-candidate-posts-for", { label: d.label })}</Link></div>
        {d.posts.length === 0 ? <p className="news-meta">{t("states.no-candidate-posts-yet")}</p> : (
          <ul className="news-list">{d.posts.map((p) => <CandidatePostItem key={p.id} post={p} candidate={p.candidate} />)}</ul>
        )}
      </section>
      <AboutData about={d.about ?? null} />
    </div>
  );
}
