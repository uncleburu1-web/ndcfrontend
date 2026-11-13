/** /states/:state/:lga — the LGA page (spec 19 §6.2). The lowest public page: wards are listed, never shown on their own. */
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton } from "../../components/ui";
import { EventCardItem } from "../../events/EventCardItem";
import type { EventCard } from "../../events/types";
import { AboutData } from "../../geo/GeoSections";
import type { LgaPageData } from "../../geo/types";
import { CandidateGrid } from "../../search/CandidateGrid";
import type { CandidateSummary } from "../../candidates/types";
import "../../events/events.css";
import "../../geo/geo.css";
import "../../news/news.css";
import "../../search/search.css";
import { t } from "../../i18n";

export default function LgaPage() {
  const { state = "", lga = "" } = useParams();
  const api = useApi();
  const res = useRequest(`lga:${state}:${lga}`, (signal) =>
    api<LgaPageData>(`/states/${encodeURIComponent(state)}/lgas/${encodeURIComponent(lga)}/`, { anonymous: true, signal }));
  const d = res.data;
  useEffect(() => {
    document.title = d ? t("geo.ndcconnect", { name: d.lga.name, state_label: d.state_label }) : t("geo.lga-ndcconnect");
  }, [d]);

  if ((res.error as ApiError | null)?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title={t("geo.page-not-found")} action={<Button href={`/states/${state}`}>{t("geo.back-to-the-state")}</Button>}>{t("geo.we-couldn-t-find-that-local")}</EmptyState>
      </div>
    );
  }
  if (res.error) return <div className="states-page"><Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>{t("geo.try-again")}</Button>}>{res.error.message}</Banner></div>;
  if (!d) return <div className="states-page"><Skeleton width="100%" height={300} /></div>;

  const word = d.area_council ? "Area council" : "Local government area";
  const stateName = d.state === "fct" ? "Federal Capital Territory" : `${d.state_label} State`;
  return (
    <div className="states-page">
      <p className="article-back"><Link to={`/states/${d.state}`}>← {d.state_label}</Link></p>
      <header className="state-head">
        <div>
          <h1>{d.lga.name}</h1>
          <p className="news-meta">{t("geo.inec-code", { word, stateName, code: d.lga.code })}</p>
        </div>
      </header>
      {!d.lga.active && <Banner tone="warning">{t("geo.no-longer-in-inec-s-current")}</Banner>}

      <section className="search-section" aria-labelledby="lga-c">
        <h2 id="lga-c">{t("geo.candidates-standing-here", { v: d.election_year ? t("geo.in-2", { election_year: d.election_year }) : "" })}</h2>
        {d.groups.length === 0 ? <p className="news-meta">{t("geo.no-published-candidates-for-yet", { name: d.lga.name })}</p> : d.groups.map((g) => (
          <div key={g.key} className="state-group">
            <div className="search-section__head">
              <h3>{g.label}</h3>
              {g.total > g.results.length && <Link to={g.see_all}>{t("geo.see-all", { total: g.total })}</Link>}
            </div>
            <CandidateGrid items={g.results as unknown as CandidateSummary[]} />
          </div>
        ))}
      </section>

      {d.events.length > 0 && (
        <section className="ev-strip" aria-label={t("geo.upcoming-events-in", { name: d.lga.name })}>
          <h2>{t("geo.upcoming-events-in", { name: d.lga.name })}</h2>
          <ul className="ev-cards">{(d.events as unknown as EventCard[]).map((e) => <EventCardItem key={e.id} e={e} />)}</ul>
          <p><Link to={`/events?state=${d.state}`}>{t("geo.all-events-in", { state_label: d.state_label })}</Link></p>
        </section>
      )}

      <section className="search-section" aria-labelledby="lga-com">
        <h2 id="lga-com">{t("geo.community")}</h2>
        {d.community ? (
          <p><Link to={`/communities/${d.community.path}`}>{d.community.name}</Link> <span className="news-meta">{t("geo.members", { members: d.community.members })}</span></p>
        ) : <p className="news-meta">{t.rich("geo.opens-when-the-next-community-update", { link: (chunks) => <Link to="/communities">{chunks}</Link> })}</p>}
      </section>

      <section className="search-section" aria-labelledby="lga-w">
        <div className="search-section__head">
          <h2 id="lga-w">{t("geo.wards-registration-areas")}</h2>
          <Link to={`/polling-units?state=${d.state}&lga=${d.lga.id}`}>{t("geo.find-a-polling-unit")}</Link>
        </div>
        {d.wards.length === 0 ? <p className="news-meta">{t("geo.inec-s-ward-list-isn-t")}</p> : (
          <ul className="geo-list">
            {d.wards.map((w) => (
              <li key={w.id}>{w.name}<p className="news-meta">{t("geo.ward-polling-unit", { code: w.code, polling_units: w.polling_units, v: w.polling_units === 1 ? "" : "s" })}</p></li>
            ))}
          </ul>
        )}
      </section>
      <AboutData about={d.about} />
    </div>
  );
}
