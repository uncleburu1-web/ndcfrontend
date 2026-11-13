/** "Upcoming events" on state, community and candidate pages (spec 18 §5). Hidden when there are none. */
import { Link } from "react-router-dom";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { EventCardItem } from "./EventCardItem";
import type { EventList } from "./types";
import "./events.css";
import { t } from "../i18n";

export function UpcomingStrip({ query, title = "Upcoming events", limit = 3, more }: { query: string; title?: string; limit?: number; more?: string }) {
  const api = useApi();
  const res = useRequest(`strip:${query}`, (signal) => api<EventList>(`/events/?${query}`, { anonymous: true, signal }));
  const items = Array.isArray(res.data?.results) ? res.data.results.slice(0, limit) : [];
  if (!items.length) return null;
  return (
    <section className="ev-strip" aria-label={title}>
      <h2>{title}</h2>
      <ul className="ev-cards">{items.map((e) => <EventCardItem key={e.id} e={e} />)}</ul>
      {more && <p><Link to={more}>{t("events.see-all")}</Link></p>}
    </section>
  );
}
