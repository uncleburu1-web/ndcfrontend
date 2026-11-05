/** /admin/events — spec 18 §15 (system admins): party events (create, publish, check-in) and every event with counts only. */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Select, Skeleton, Tabs } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { OrganiserEvents } from "../../../events/OrganiserEvents";
import type { EventCard } from "../../../events/types";
import { AdminNav } from "../AdminNav";
import "../../../events/events.css";

type Row = EventCard & { registered: number; waitlisted: number; blackout_flagged: boolean };

function AllEvents() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const res = useRequest(`admin-events:${status}`, (signal) =>
    api<{ results: Row[]; counts: Record<string, number> }>(`/admin/events/${status ? `?status=${status}` : ""}`, { signal }));
  const flagged = params.get("flagged") === "1";
  const rows = (res.data?.results ?? []).filter((r) => !flagged || r.blackout_flagged);
  return (
    <div className="ev-form">
      {res.data && <p className="ev-meta">{res.data.counts.upcoming} upcoming · {res.data.counts.this_week} this week · {res.data.counts.blackout_flagged} inside a blackout window</p>}
      <Select label="Status" value={status} onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set("status", e.target.value); else p.delete("status"); setParams(p); }}
        options={[{ value: "", label: "All" }, { value: "published", label: "Published" }, { value: "cancelled", label: "Cancelled" },
          { value: "hidden", label: "Hidden while deciding" }, { value: "removed", label: "Removed" }]} />
      {res.error && <Banner tone="error">{res.error.message}</Banner>}
      {!res.data && !res.error && <Skeleton width="100%" height={200} />}
      {res.data && (
        <table className="ev-table">
          <thead><tr><th>Event</th><th>Organiser</th><th>When</th><th>Registered</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/events/${r.id}`}>{r.title}</Link>{r.blackout_flagged && <div className="ev-chip ev-chip--warn">Blackout window</div>}</td>
              <td>{r.organiser.label}</td><td>{formatDate(r.starts_at, { withTime: true })}</td>
              <td>{r.registered}{r.waitlisted ? ` (+${r.waitlisted} waitlist)` : ""}</td><td>{r.status}</td>
            </tr>))}</tbody>
        </table>
      )}
      <p className="ds-field__hint">Counts only. Nobody, admins included, can list who registered.</p>
    </div>
  );
}

export default function AdminEventsPage() {
  const [tab, setTab] = useState("party");
  return (
    <div className="adm-page">
      <AdminNav current="events" />
      <header className="adm-page__head"><div><h1>Events</h1>
        <p>Party events are organised by NDC. Campaign events are run by candidates’ linked accounts from their campaign page.</p></div></header>
      <Tabs label="Events" value={tab} onChange={setTab} tabs={[
        { id: "party", label: "Party events", content: <OrganiserEvents base="/admin/events/party/" party /> },
        { id: "all", label: "All events", content: <AllEvents /> },
      ]} />
    </div>
  );
}
