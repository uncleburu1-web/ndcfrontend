/** A campaign's (or the party's) events: list with counts, New event, editor, per-event dashboard (spec 18 §14). */
import { useEffect, useState } from "react";
import { useApi } from "../auth/session";
import { useRequest } from "../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton } from "../components/ui";
import { EventDashboard, EventEditor } from "./EventEditor";
import type { OrganiserEvent } from "./types";
import "./events.css";

export function OrganiserEvents({ base, party = false, canWrite = true }: { base: string; party?: boolean; canWrite?: boolean }) {
  const api = useApi();
  const res = useRequest(`organiser-events:${base}`, (signal) => api<{ results: OrganiserEvent[] }>(base, { signal }));
  const [items, setItems] = useState<OrganiserEvent[] | null>(null);
  const [mode, setMode] = useState<"list" | "new" | OrganiserEvent>("list");
  useEffect(() => { if (res.data) setItems(res.data.results); }, [res.data]);
  if (res.error) return <Banner tone="error">{res.error.message}</Banner>;
  if (!items) return <Skeleton width="100%" height={200} />;
  const upsert = (e: OrganiserEvent) => setItems((xs) => [e, ...(xs ?? []).filter((x) => x.id !== e.id)]);
  if (mode !== "list") {
    return <EventEditor base={base} party={party} editing={mode === "new" ? null : mode} onCancel={() => setMode("list")}
      onSaved={(e) => { upsert(e); setMode("list"); }} />;
  }
  return (
    <div className="ev-form">
      {canWrite && <div><Button onClick={() => setMode("new")}>New event</Button></div>}
      {items.length === 0 ? (
        <EmptyState title="No events yet">Events appear on {party ? "the Events page" : "the candidate’s profile, the Events page and state and community pages"} once published.</EmptyState>
      ) : items.map((e) => (
        <EventDashboard key={e.id} base={base} e={e} onEdit={() => setMode(e)}
          onChange={(n) => (n ? upsert(n) : setItems((xs) => (xs ?? []).filter((x) => x.id !== e.id)))} />
      ))}
    </div>
  );
}
