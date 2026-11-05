/** /events — spec 18 §5: upcoming events (guests too), soonest first; filters in the address; Past tab; Load more. */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Select, Skeleton, Switch, Tabs } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import { EventCardItem } from "../../events/EventCardItem";
import type { EventCard, EventList } from "../../events/types";
import { TYPE_OPTIONS } from "../../events/types";
import "../../events/events.css";

export default function EventsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const when = params.get("when") === "past" ? "past" : "upcoming";
  const query = new URLSearchParams();
  for (const k of ["state", "type", "mode", "this_week", "organiser", "candidate"]) if (params.get(k)) query.set(k, params.get(k)!);
  if (when === "past") query.set("when", "past");
  const key = query.toString();
  const res = useRequest(`events:${key}`, (signal) => api<EventList>(`/events/?${key}`, { anonymous: true, signal }));
  const [items, setItems] = useState<EventCard[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => { if (res.data) { setItems(res.data.results); setNext(res.data.next); } }, [res.data]);
  useEffect(() => { document.title = "Events | NDCConnect"; }, []);
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    try {
      const page = await api<EventList>(`/events/${new URL(next).search}`, { anonymous: true });
      setItems((xs) => [...xs, ...page.results]);
      setNext(page.next);
    } finally {
      setMore(false);
    }
  };
  const list = (
    <>
      {res.error && <Banner tone="error">{res.error.message}</Banner>}
      {!res.data && !res.error && <Skeleton width="100%" height={240} />}
      {res.data && (items.length ? (
        <ul className="ev-cards">{items.map((e) => <EventCardItem key={e.id} e={e} />)}</ul>
      ) : <EmptyState title={when === "past" ? "No past events" : "No upcoming events"}>Try another state or type.</EmptyState>)}
      {next && <Button variant="secondary" onClick={() => void loadMore()} loading={more}>Load more</Button>}
    </>
  );
  return (
    <div className="ev-page">
      <header>
        <h1>Events</h1>
        <p>Rallies, town halls, meetings and trainings from candidates’ campaigns and the party.</p>
      </header>
      <div className="ev-filters" role="group" aria-label="Filter events">
        <Select label="State" value={params.get("state") ?? ""} onChange={(e) => set("state", e.target.value)}
          options={[{ value: "", label: "All states" }, ...STATES]} />
        <Select label="Type" value={params.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}
          options={[{ value: "", label: "All types" }, ...TYPE_OPTIONS]} />
        <Switch label="Online" checked={params.get("mode") === "online"} onChange={(v: boolean) => set("mode", v ? "online" : "")} />
        <Switch label="This week" checked={params.get("this_week") === "1"} onChange={(v: boolean) => set("this_week", v ? "1" : "")} />
      </div>
      <Tabs label="When" value={when} onChange={(v) => set("when", v === "past" ? "past" : "")}
        tabs={[{ id: "upcoming", label: "Upcoming", content: when === "upcoming" ? list : null },
          { id: "past", label: "Past", content: when === "past" ? list : null }]} />
    </div>
  );
}
