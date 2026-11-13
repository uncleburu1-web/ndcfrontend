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
import { t } from "../../../i18n";

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
      {res.data && <p className="ev-meta">{t("admin.upcoming-this-week-inside-a-blackout", { upcoming: res.data.counts.upcoming, this_week: res.data.counts.this_week, blackout_flagged: res.data.counts.blackout_flagged })}</p>}
      <Select label={t("admin.status")} value={status} onChange={(e) => { const p = new URLSearchParams(params); if (e.target.value) p.set("status", e.target.value); else p.delete("status"); setParams(p); }}
        options={[{ value: "", label: t("admin.all") }, { value: "published", label: t("admin.published") }, { value: "cancelled", label: t("admin.cancelled") },
          { value: "hidden", label: t("admin.hidden-while-deciding") }, { value: "removed", label: t("admin.removed") }]} />
      {res.error && <Banner tone="error">{res.error.message}</Banner>}
      {!res.data && !res.error && <Skeleton width="100%" height={200} />}
      {res.data && (
        <table className="ev-table">
          <thead><tr><th>{t("admin.event")}</th><th>{t("admin.organiser")}</th><th>{t("admin.when")}</th><th>{t("admin.registered")}</th><th>{t("admin.status")}</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><Link to={`/events/${r.id}`}>{r.title}</Link>{r.blackout_flagged && <div className="ev-chip ev-chip--warn">{t("admin.blackout-window")}</div>}</td>
              <td>{r.organiser.label}</td><td>{formatDate(r.starts_at, { withTime: true })}</td>
              <td>{r.registered}{r.waitlisted ? t("admin.waitlist", { waitlisted: r.waitlisted }) : ""}</td><td>{r.status}</td>
            </tr>))}</tbody>
        </table>
      )}
      <p className="ds-field__hint">{t("admin.counts-only-nobody-admins-included-can")}</p>
    </div>
  );
}

export default function AdminEventsPage() {
  const [tab, setTab] = useState("party");
  return (
    <div className="adm-page">
      <AdminNav current="events" />
      <header className="adm-page__head"><div><h1>{t("admin.events")}</h1>
        <p>{t("admin.party-events-are-organised-by-ndc")}</p></div></header>
      <Tabs label={t("admin.events")} value={tab} onChange={setTab} tabs={[
        { id: "party", label: t("admin.party-events"), content: <OrganiserEvents base="/admin/events/party/" party /> },
        { id: "all", label: t("admin.all-events"), content: <AllEvents /> },
      ]} />
    </div>
  );
}
