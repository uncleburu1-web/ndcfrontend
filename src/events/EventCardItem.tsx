/** One event in a list (spec 18 §14): date block, title, chips, organiser, place, how many going. */
import { Link } from "react-router-dom";
import type { EventCard } from "./types";
import { t } from "../i18n";

function dateParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }).formatToParts(new Date(iso));
  return { day: parts.find((p) => p.type === "day")?.value ?? "", mon: parts.find((p) => p.type === "month")?.value ?? "" };
}

export function timeWords(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" })
    .format(new Date(iso));
}

export function EventCardItem({ e }: { e: EventCard }) {
  const d = dateParts(e.starts_at);
  return (
    <li>
      <Link className="ev-card" to={`/events/${e.id}`}>
        <span className="ev-date" aria-hidden="true"><span className="ev-date__day">{d.day}</span><span className="ev-date__mon">{d.mon}</span></span>
        <span>
          <p className="ev-card__title">{e.title}</p>
          <span className="ev-meta">
            <span className="ev-chip">{e.type_label}</span>
            {e.mode !== "in_person" && <span className="ev-chip">{e.mode_label}</span>}
            {e.status === "cancelled" && <span className="ev-chip ev-chip--warn">{t("events.cancelled")}</span>}
            <span>{t("events.wat", { timeWords: timeWords(e.starts_at) })}</span>
          </span>
          <span className="ev-meta">
            <span>{t("events.organised-by", { label: e.organiser.label })}</span>
            <span>· {e.place}{e.lga ? `, ${e.lga}` : ""}{e.state_label && e.mode !== "online" ? `, ${e.state_label}` : ""}</span>
            <span>· {e.full ? t("events.full-waitlist") : t("events.going", { going: e.going })}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
