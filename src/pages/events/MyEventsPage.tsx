/** /account/events — spec 18 §6.3: your upcoming and past registrations, ticket codes, online links. Private to you. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, EmptyState, Skeleton, Tabs } from "../../components/ui";
import type { MyEvent } from "../../events/types";
import { whenWords } from "../../events/types";
import "../../events/events.css";

function Rows({ when }: { when: "upcoming" | "past" }) {
  const api = useApi();
  const res = useRequest(`my-events:${when}`, (signal) => api<{ results: MyEvent[] }>(`/me/events/?when=${when}`, { signal }));
  if (res.error) return <Banner tone="error">{res.error.message}</Banner>;
  if (!res.data) return <Skeleton width="100%" height={160} />;
  if (!res.data.results.length) {
    return <EmptyState title={when === "past" ? "No past events" : "No upcoming events"}>
      <Link to="/events">Find an event</Link></EmptyState>;
  }
  return (
    <ul className="ev-cards">
      {res.data.results.map(({ event: e, registration: r, online_url }) => (
        <li key={e.id} className="ev-box">
          <h2 className="ev-card__title"><Link to={`/events/${e.id}`}>{e.title}</Link></h2>
          <p className="ev-meta">{whenWords(e.starts_at)} · {e.place} · Organised by {e.organiser.label}</p>
          {e.status === "cancelled" && <Banner tone="warning">Cancelled.</Banner>}
          {r.status === "registered" && <p>Ticket code <span className="ev-ticket">{r.ticket_code}</span>{r.checked_in ? " · Checked in" : ""}</p>}
          {r.status === "waitlisted" && <p>Waitlist number {r.waitlist_position}</p>}
          {online_url && when === "upcoming" && <p><a href={online_url} target="_blank" rel="noopener noreferrer nofollow">Join online</a></p>}
        </li>
      ))}
    </ul>
  );
}

export default function MyEventsPage() {
  const [tab, setTab] = useState("upcoming");
  useEffect(() => { document.title = "My events | NDCConnect"; }, []);
  return (
    <div className="ev-page ev-narrow">
      <header>
        <p className="article-back"><Link to="/account">← Account</Link></p>
        <h1>My events</h1>
        <p>Only you can see which events you registered for. To stop registering for events, withdraw that consent in <Link to="/account/privacy">Your data</Link>.</p>
      </header>
      <Tabs label="When" value={tab} onChange={setTab}
        tabs={[{ id: "upcoming", label: "Upcoming", content: <Rows when="upcoming" /> }, { id: "past", label: "Past", content: <Rows when="past" /> }]} />
    </div>
  );
}
