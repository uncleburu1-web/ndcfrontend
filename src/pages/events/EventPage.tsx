/**
 * /events/:id — spec 18 §5, §6, §14. Public details (cacheable) plus /events/{id}/me/ for your place, the online link,
 * a registered-only address and organiser updates. Register asks for consent through the API client.
 */
import { useAuth } from "@clerk/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { ArticleBody } from "../../news/ArticleBody";
import { ReportDialog } from "../../news/ReportDialog";
import type { EventDetail, EventMe } from "../../events/types";
import { whenWords } from "../../events/types";
import "../../events/events.css";

function RegistrationBox({ e, me, onChange }: { e: EventDetail; me: EventMe | null; onChange: (m: EventMe) => void }) {
  const api = useApi();
  const toast = useToast();
  const { isSignedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const reg = me?.registration ?? null;
  const act = async (method: "POST" | "DELETE") => {
    if (method === "DELETE" && !window.confirm("Cancel your place at this event?")) return;
    setBusy(true);
    try {
      const m = await api<EventMe>(`/events/${e.id}/registration/`, { method });
      onChange(m);
      toast.show({ tone: "success", message: method === "DELETE" ? "Your place is cancelled." :
        m.registration?.status === "waitlisted" ? "You’re on the waitlist." : "You’re registered." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work. Try again." });
    } finally {
      setBusy(false);
    }
  };
  if (e.registration === "none") return <div className="ev-box"><p>No sign-up needed: just come along.</p></div>;
  return (
    <div className="ev-box" aria-labelledby="reg-h">
      <h2 id="reg-h">Your place</h2>
      <p className="ev-meta">{e.going} going{e.places_left !== null ? ` · ${e.places_left} place${e.places_left === 1 ? "" : "s"} left` : ""}</p>
      {reg?.status === "registered" && (
        <>
          <p>You’re registered. Show this code at check-in:</p>
          <p className="ev-ticket" aria-label={`Ticket code ${reg.ticket_code.split("").join(" ")}`}>{reg.ticket_code}</p>
          {reg.checked_in && <Banner tone="success">Checked in.</Banner>}
          {!e.ended && <Button variant="secondary" onClick={() => void act("DELETE")} loading={busy}>Cancel my place</Button>}
        </>
      )}
      {reg?.status === "waitlisted" && (
        <>
          <p>You’re number {reg.waitlist_position} on the waitlist. We’ll tell you if a place opens.</p>
          <Button variant="secondary" onClick={() => void act("DELETE")} loading={busy}>Leave the waitlist</Button>
        </>
      )}
      {!reg && !isSignedIn && e.registration === "open" && !e.ended && (
        <Button href={`/sign-in?redirect_url=${encodeURIComponent(`/events/${e.id}`)}`}>Sign in to register</Button>
      )}
      {!reg && isSignedIn && me && me.can_register && (
        <Button onClick={() => void act("POST")} loading={busy}>{e.full ? "Join the waitlist" : "Register"}</Button>
      )}
      {!reg && isSignedIn && me && !me.can_register && (
        <p>{me.register_block?.message ?? "Registration is closed."}</p>
      )}
      {!reg && !isSignedIn && (e.registration !== "open" || e.ended) && <p>Registration is closed.</p>}
      <p className="ds-field__hint">Only you, and the organiser around the event, can see that you registered.</p>
    </div>
  );
}

export default function EventPage() {
  const { id = "" } = useParams();
  const api = useApi();
  const { isSignedIn } = useAuth();
  const res = useRequest(`event:${id}`, (signal) => api<EventDetail>(`/events/${id}/`, { anonymous: true, signal }));
  const mine = useRequest(`event-me:${id}:${isSignedIn ? 1 : 0}`, (signal) =>
    isSignedIn ? api<EventMe>(`/events/${id}/me/`, { signal }) : Promise.resolve(null));
  const [me, setMe] = useState<EventMe | null>(null);
  const [reporting, setReporting] = useState(false);
  useEffect(() => { setMe(mine.data); }, [mine.data]);
  const e = res.data;
  useEffect(() => { document.title = e ? `${e.title} | NDCConnect` : "Event | NDCConnect"; }, [e]);

  if (res.error) {
    return <div className="ev-page ev-narrow"><EmptyState title="Event not found" action={<Button href="/events">All events</Button>}>
      It may have been cancelled or the link is wrong.</EmptyState></div>;
  }
  if (!e) return <div className="ev-page ev-narrow" aria-busy="true"><Skeleton width="70%" height={36} /><Skeleton width="100%" height={240} /></div>;
  if (e.removed) {
    return (
      <div className="ev-page ev-narrow">
        <h1>{e.title}</h1>
        <Banner tone="warning" title="Removed by moderators">
          This event broke rule {e.removed.rule}: {e.removed.rule_title}. <Link to="/rules">Read the rules</Link>
        </Banner>
      </div>
    );
  }
  const address = me?.venue_address ?? e.venue_address;
  const online = me?.online_url ?? null;
  return (
    <div className="ev-page">
      <p className="article-back"><Link to="/events">← Events</Link></p>
      <header className="ev-hero">
        {e.cover && <img src={e.cover.url} srcSet={e.cover.srcset ?? undefined} alt="" />}
        <span className="ev-meta"><span className="ev-chip">{e.type_label}</span>{e.mode !== "in_person" && <span className="ev-chip">{e.mode_label}</span>}
          {e.members_only && <span className="ev-chip">NDC members only</span>}</span>
        <h1>{e.title}</h1>
        <p className="ev-meta">Organised by {e.organiser.candidate
          ? <Link to={`/candidates/${e.organiser.candidate.slug}`}>{e.organiser.label}</Link> : e.organiser.label}</p>
      </header>
      {e.status === "cancelled" && <Banner tone="warning" title="Cancelled">{e.cancelled_reason}</Banner>}
      {e.material_change && e.status === "published" && (
        <Banner tone="info" title={e.material_change.kind === "postponed" ? "Postponed" : "Updated"}>
          {formatDate(e.material_change.at)}: {e.material_change.words}.
        </Banner>
      )}
      {e.ended && <Banner tone="info">This event has ended.</Banner>}
      <div className="ev-layout">
        <div>
          <dl className="ev-facts">
            <dt>When</dt><dd>{whenWords(e.starts_at)} to {whenWords(e.ends_at, false)}{" "}
              <a href={e.calendar_url}>Add to calendar</a></dd>
            {e.mode !== "online" && <><dt>Where</dt><dd>{e.venue_name}{address ? `, ${address}` : ""}{!address && e.address_visibility === "registered" ? " · Address shown when you register" : ""}
              {e.lga ? ` · ${e.lga}` : ""}{e.state_label ? ` · ${e.state_label}` : ""}</dd></>}
            {e.mode !== "in_person" && <><dt>Online</dt><dd>{online ? <a href={online} rel="noopener noreferrer nofollow" target="_blank">Join online</a>
              : "The link shows here when you register."}</dd></>}
            {e.accessibility_notes && <><dt>Accessibility</dt><dd>{e.accessibility_notes}</dd></>}
          </dl>
          <ArticleBody body={e.description} />
          {me && me.updates.length > 0 && (
            <section aria-labelledby="upd-h">
              <h2 id="upd-h">Updates from the organiser</h2>
              <ul className="ev-updates">{me.updates.map((u, i) => <li key={i}><p>{u.text}</p>
                <p className="ev-meta">{formatDate(u.created_at, { withTime: true })}</p></li>)}</ul>
            </section>
          )}
          <p><Button variant="ghost" size="sm" onClick={() => setReporting(true)}>Report this event</Button></p>
        </div>
        <RegistrationBox e={e} me={me} onChange={setMe} />
      </div>
      <ReportDialog variant="event" path={`/events/${e.id}/report/`} title="Report this event" open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
}
