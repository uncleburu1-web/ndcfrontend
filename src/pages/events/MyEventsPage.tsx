/** /account/events — spec 18 §6.3: your upcoming and past registrations, ticket codes, online links. Private to you. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, EmptyState, Skeleton, Tabs } from "../../components/ui";
import type { MyEvent } from "../../events/types";
import { whenWords } from "../../events/types";
import "../../events/events.css";
import { t } from "../../i18n";

function Rows({ when }: { when: "upcoming" | "past" }) {
  const api = useApi();
  const res = useRequest(`my-events:${when}`, (signal) => api<{ results: MyEvent[] }>(`/me/events/?when=${when}`, { signal }));
  if (res.error) return <Banner tone="error">{res.error.message}</Banner>;
  if (!res.data) return <Skeleton width="100%" height={160} />;
  if (!res.data.results.length) {
    return <EmptyState title={when === "past" ? t("events.no-past-events") : t("events.no-upcoming-events")}>
      <Link to="/events">{t("events.find-an-event")}</Link></EmptyState>;
  }
  return (
    <ul className="ev-cards">
      {res.data.results.map(({ event: e, registration: r, online_url }) => (
        <li key={e.id} className="ev-box">
          <h2 className="ev-card__title"><Link to={`/events/${e.id}`}>{e.title}</Link></h2>
          <p className="ev-meta">{t("events.organised-by-3", { whenWords: whenWords(e.starts_at), place: e.place, label: e.organiser.label })}</p>
          {e.status === "cancelled" && <Banner tone="warning">{t("events.cancelled-2")}</Banner>}
          {r.status === "registered" && <p>{t.rich("events.ticket-code-3", { ticket_code: r.ticket_code, span: (chunks) => <span className="ev-ticket">{chunks}</span>, v: r.checked_in ? t("events.checked-in-5") : "" })}</p>}
          {r.status === "waitlisted" && <p>{t("events.waitlist-number", { waitlist_position: r.waitlist_position })}</p>}
          {online_url && when === "upcoming" && <p><a href={online_url} target="_blank" rel="noopener noreferrer nofollow">{t("events.join-online")}</a></p>}
        </li>
      ))}
    </ul>
  );
}

export default function MyEventsPage() {
  const [tab, setTab] = useState("upcoming");
  useEffect(() => { document.title = t("events.my-events-ndcconnect"); }, []);
  return (
    <div className="ev-page ev-narrow">
      <header>
        <p className="article-back"><Link to="/settings/account">{t("events.my-account")}</Link></p>
        <h1>{t("events.my-events")}</h1>
        <p>{t.rich("events.only-you-can-see-which-events", { link: (chunks) => <Link to="/settings/privacy/data">{chunks}</Link> })}</p>
      </header>
      <Tabs label={t("events.when")} value={tab} onChange={setTab}
        tabs={[{ id: "upcoming", label: t("events.upcoming"), content: <Rows when="upcoming" /> }, { id: "past", label: t("events.past"), content: <Rows when="past" /> }]} />
    </div>
  );
}
