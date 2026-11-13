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
import { t } from "../../i18n";
import { InLanguage } from "../../i18n/ContentLanguage";

function RegistrationBox({ e, me, onChange }: { e: EventDetail; me: EventMe | null; onChange: (m: EventMe) => void }) {
  const api = useApi();
  const toast = useToast();
  const { isSignedIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const reg = me?.registration ?? null;
  const act = async (method: "POST" | "DELETE") => {
    if (method === "DELETE" && !window.confirm(t("events.cancel-your-place-at-this-event"))) return;
    setBusy(true);
    try {
      const m = await api<EventMe>(`/events/${e.id}/registration/`, { method });
      onChange(m);
      toast.show({ tone: "success", message: method === "DELETE" ? t("events.your-place-is-cancelled") : m.registration?.status === "waitlisted" ? t("events.you-re-on-the-waitlist") : t("events.you-re-registered") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("events.that-didn-t-work-try-again") });
    } finally {
      setBusy(false);
    }
  };
  if (e.registration === "none") return <div className="ev-box"><p>{t("events.no-sign-up-needed-just-come")}</p></div>;
  return (
    <div className="ev-box" aria-labelledby="reg-h">
      <h2 id="reg-h">{t("events.your-place")}</h2>
      <p className="ev-meta">{t("events.going-2", { going: e.going, v: e.places_left !== null ? t("events.place-left", { places_left: e.places_left, v: e.places_left === 1 ? "" : "s" }) : "" })}</p>
      {reg?.status === "registered" && (
        <>
          <p>{t("events.you-re-registered-show-this-code")}</p>
          <p className="ev-ticket" aria-label={t("events.ticket-code-2", { join: reg.ticket_code.split("").join(" ") })}>{reg.ticket_code}</p>
          {reg.checked_in && <Banner tone="success">{t("events.checked-in-4")}</Banner>}
          {!e.ended && <Button variant="secondary" onClick={() => void act("DELETE")} loading={busy}>{t("events.cancel-my-place")}</Button>}
        </>
      )}
      {reg?.status === "waitlisted" && (
        <>
          <p>{t("events.you-re-number-on-the-waitlist", { waitlist_position: reg.waitlist_position })}</p>
          <Button variant="secondary" onClick={() => void act("DELETE")} loading={busy}>{t("events.leave-the-waitlist")}</Button>
        </>
      )}
      {!reg && !isSignedIn && e.registration === "open" && !e.ended && (
        <Button href={`/sign-in?redirect_url=${encodeURIComponent(`/events/${e.id}`)}`}>{t("events.sign-in-to-register")}</Button>
      )}
      {!reg && isSignedIn && me && me.can_register && (
        <Button onClick={() => void act("POST")} loading={busy}>{e.full ? t("events.join-the-waitlist") : t("events.register")}</Button>
      )}
      {!reg && isSignedIn && me && !me.can_register && (
        <p>{me.register_block?.message ?? t("events.registration-is-closed")}</p>
      )}
      {!reg && !isSignedIn && (e.registration !== "open" || e.ended) && <p>{t("events.registration-is-closed")}</p>}
      <p className="ds-field__hint">{t("events.only-you-and-the-organiser-around")}</p>
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
  useEffect(() => { document.title = e ? t("events.ndcconnect", { title: e.title }) : t("events.event-ndcconnect"); }, [e]);

  if (res.error) {
    return <div className="ev-page ev-narrow"><EmptyState title={t("events.event-not-found")} action={<Button href="/events">{t("events.all-events")}</Button>}>
      {t("events.it-may-have-been-cancelled-or")}</EmptyState></div>;
  }
  if (!e) return <div className="ev-page ev-narrow" aria-busy="true"><Skeleton width="70%" height={36} /><Skeleton width="100%" height={240} /></div>;
  if (e.removed) {
    return (
      <div className="ev-page ev-narrow">
        <h1>{e.title}</h1>
        <Banner tone="warning" title={t("events.removed-by-moderators")}>
          {t.rich("events.this-event-broke-rule-read-the", { rule: e.removed.rule, rule_title: e.removed.rule_title, link: (chunks) => <Link to="/rules">{chunks}</Link> })}
        </Banner>
      </div>
    );
  }
  const address = me?.venue_address ?? e.venue_address;
  const online = me?.online_url ?? null;
  return (
    <div className="ev-page">
      <p className="article-back"><Link to="/events">{t("events.events-2")}</Link></p>
      <header className="ev-hero">
        {e.cover && <img src={e.cover.url} srcSet={e.cover.srcset ?? undefined} alt="" />}
        <span className="ev-meta"><span className="ev-chip">{e.type_label}</span>{e.mode !== "in_person" && <span className="ev-chip">{e.mode_label}</span>}
          {e.members_only && <span className="ev-chip">{t("events.ndc-members-only")}</span>}</span>
        <h1>{e.title}</h1>
        <p className="ev-meta">{t.rich("events.organised-by-2", { x1: e.organiser.candidate
          ? <Link to={`/candidates/${e.organiser.candidate.slug}`}>{e.organiser.label}</Link> : e.organiser.label })}</p>
      </header>
      {e.status === "cancelled" && <Banner tone="warning" title={t("events.cancelled")}>{e.cancelled_reason}</Banner>}
      {e.material_change && e.status === "published" && (
        <Banner tone="info" title={e.material_change.kind === "postponed" ? t("events.postponed") : t("events.updated")}>
          {formatDate(e.material_change.at)}: {e.material_change.words}.
        </Banner>
      )}
      {e.ended && <Banner tone="info">{t("events.this-event-has-ended")}</Banner>}
      <div className="ev-layout">
        <div>
          <dl className="ev-facts">
            <dt>{t("events.when")}</dt><dd>{t.rich("events.to-add-to-calendar", { whenWords: whenWords(e.starts_at), whenWords2: whenWords(e.ends_at, false), a: (chunks) => <a href={e.calendar_url}>{chunks}</a> })}</dd>
            {e.mode !== "online" && <><dt>{t("events.where")}</dt><dd>{e.venue_name}{address ? `, ${address}` : ""}{!address && e.address_visibility === "registered" ? t("events.address-shown-when-you-register") : ""}
              {e.lga ? ` · ${e.lga}` : ""}{e.state_label ? ` · ${e.state_label}` : ""}</dd></>}
            {e.mode !== "in_person" && <><dt>{t("events.online")}</dt><dd>{online ? <a href={online} rel="noopener noreferrer nofollow" target="_blank">{t("events.join-online")}</a> : t("events.the-link-shows-here-when-you")}</dd></>}
            {e.accessibility_notes && <><dt>{t("events.accessibility")}</dt><dd>{e.accessibility_notes}</dd></>}
          </dl>
          <InLanguage language={(e as { language?: string }).language}><ArticleBody body={e.description} /></InLanguage>
          {me && me.updates.length > 0 && (
            <section aria-labelledby="upd-h">
              <h2 id="upd-h">{t("events.updates-from-the-organiser")}</h2>
              <ul className="ev-updates">{me.updates.map((u, i) => <li key={i}><p>{u.text}</p>
                <p className="ev-meta">{formatDate(u.created_at, { withTime: true })}</p></li>)}</ul>
            </section>
          )}
          <p><Button variant="ghost" size="sm" onClick={() => setReporting(true)}>{t("events.report-this-event")}</Button></p>
        </div>
        <RegistrationBox e={e} me={me} onChange={setMe} />
      </div>
      <ReportDialog variant="event" path={`/events/${e.id}/report/`} title={t("events.report-this-event")} open={reporting} onClose={() => setReporting(false)} />
    </div>
  );
}
