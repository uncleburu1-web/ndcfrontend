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

export default function LgaPage() {
  const { state = "", lga = "" } = useParams();
  const api = useApi();
  const res = useRequest(`lga:${state}:${lga}`, (signal) =>
    api<LgaPageData>(`/states/${encodeURIComponent(state)}/lgas/${encodeURIComponent(lga)}/`, { anonymous: true, signal }));
  const d = res.data;
  useEffect(() => {
    document.title = d ? `${d.lga.name}, ${d.state_label} | NDCConnect` : "LGA | NDCConnect";
  }, [d]);

  if ((res.error as ApiError | null)?.status === 404) {
    return (
      <div className="page-shell">
        <EmptyState title="Page not found" action={<Button href={`/states/${state}`}>Back to the state</Button>}>We couldn’t find that local government area.</EmptyState>
      </div>
    );
  }
  if (res.error) return <div className="states-page"><Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner></div>;
  if (!d) return <div className="states-page"><Skeleton width="100%" height={300} /></div>;

  const word = d.area_council ? "Area council" : "Local government area";
  const stateName = d.state === "fct" ? "Federal Capital Territory" : `${d.state_label} State`;
  return (
    <div className="states-page">
      <p className="article-back"><Link to={`/states/${d.state}`}>← {d.state_label}</Link></p>
      <header className="state-head">
        <div>
          <h1>{d.lga.name}</h1>
          <p className="news-meta">{word} · {stateName} · INEC code {d.lga.code}</p>
        </div>
      </header>
      {!d.lga.active && <Banner tone="warning">No longer in INEC’s current list.</Banner>}

      <section className="search-section" aria-labelledby="lga-c">
        <h2 id="lga-c">Candidates standing here{d.election_year ? ` in ${d.election_year}` : ""}</h2>
        {d.groups.length === 0 ? <p className="news-meta">No published candidates for {d.lga.name} yet.</p> : d.groups.map((g) => (
          <div key={g.key} className="state-group">
            <div className="search-section__head">
              <h3>{g.label}</h3>
              {g.total > g.results.length && <Link to={g.see_all}>See all {g.total}</Link>}
            </div>
            <CandidateGrid items={g.results as unknown as CandidateSummary[]} />
          </div>
        ))}
      </section>

      {d.events.length > 0 && (
        <section className="ev-strip" aria-label={`Upcoming events in ${d.lga.name}`}>
          <h2>Upcoming events in {d.lga.name}</h2>
          <ul className="ev-cards">{(d.events as unknown as EventCard[]).map((e) => <EventCardItem key={e.id} e={e} />)}</ul>
          <p><Link to={`/events?state=${d.state}`}>All events in {d.state_label}</Link></p>
        </section>
      )}

      <section className="search-section" aria-labelledby="lga-com">
        <h2 id="lga-com">Community</h2>
        {d.community ? (
          <p><Link to={`/communities/${d.community.path}`}>{d.community.name}</Link> <span className="news-meta">· {d.community.members} members</span></p>
        ) : <p className="news-meta">Opens when the next community update runs (nightly). See <Link to="/communities">Communities</Link>.</p>}
      </section>

      <section className="search-section" aria-labelledby="lga-w">
        <div className="search-section__head">
          <h2 id="lga-w">Wards (registration areas)</h2>
          <Link to={`/polling-units?state=${d.state}&lga=${d.lga.id}`}>Find a polling unit</Link>
        </div>
        {d.wards.length === 0 ? <p className="news-meta">INEC’s ward list isn’t loaded for this area yet.</p> : (
          <ul className="geo-list">
            {d.wards.map((w) => (
              <li key={w.id}>{w.name}<p className="news-meta">Ward {w.code} · {w.polling_units} polling unit{w.polling_units === 1 ? "" : "s"}</p></li>
            ))}
          </ul>
        )}
      </section>
      <AboutData about={d.about} />
    </div>
  );
}
