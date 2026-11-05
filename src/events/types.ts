/** Spec 18: event and volunteering shapes, from the generated OpenAPI types. */
import type { Schema } from "../api/typed";

export type EventCard = Schema<"EventCardSchema">;
export type EventDetail = Schema<"EventDetailSchema">;
export type EventMe = Schema<"EventMeSchema">;
export type OrganiserEvent = Schema<"OrganiserEventSchema">;
export type MyEvent = Schema<"MyEventSchema">;
export type EventList = Schema<"EventList">;

export const TYPE_OPTIONS = [
  { value: "rally", label: "Rally" }, { value: "canvass", label: "Canvassing drive" }, { value: "town_hall", label: "Town hall" },
  { value: "meeting", label: "Meeting" }, { value: "training", label: "Training" }, { value: "other", label: "Other" },
];
export const MODE_OPTIONS = [
  { value: "in_person", label: "In person" }, { value: "online", label: "Online" }, { value: "hybrid", label: "In person and online" },
];
/** Rule 3: no place of worship, police station or public office (Electoral Act 2026 s. 96). */
export const VENUE_OPTIONS = [
  { value: "open_ground", label: "Open ground or field" }, { value: "hall", label: "Hall or event centre" }, { value: "hotel", label: "Hotel" },
  { value: "school", label: "School (outside school hours)" }, { value: "market", label: "Market" },
  { value: "street", label: "Street or neighbourhood" }, { value: "private_premises", label: "Private premises" },
];
export const DECLARATION_WORDS: Record<string, string> = {
  no_inducements: "This event offers no money, gifts or goods for attending or voting (a “transport refund” counts). Electoral Act 2026 s. 22.",
  lawful_venue: "The venue isn’t a place of worship, a police station or a public office. Electoral Act 2026 s. 96.",
  police_notified: "The police have been, or will be, told about this public rally (Police Act 2020 s. 83(4)). No permit is needed.",
};
export const VOLUNTEER_ROLE_WORDS: Record<string, string> = {
  canvassing: "Canvassing", events: "Events", social_media: "Social media", logistics: "Logistics", data_and_tech: "Data and tech",
  outreach_youth: "Youth outreach", outreach_women: "Women’s outreach", outreach_disability: "Disability outreach", other: "Other",
};
export const AVAILABILITY_WORDS: Record<string, string> = { weekdays: "Weekdays", weekday_evenings: "Weekday evenings", weekends: "Weekends" };

/** "Sat 14 Nov, 10:00 (WAT)" — Lagos time always (rule 11). */
export function whenWords(iso: string, withDay = true): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: withDay ? "short" : undefined, day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${withDay ? `${g("weekday")} ` : ""}${g("day")} ${g("month")}, ${g("hour")}:${g("minute")} (WAT)`;
}

/** Lagos wall-clock "YYYY-MM-DDTHH:mm" for <input type="datetime-local">, and back to ISO with +01:00. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}
export function fromLocalInput(v: string): string | null {
  return v ? `${v}:00+01:00` : null;
}

export type VolunteerOpening = Schema<"VolunteerOpening">;
export type VolunteerMine = Schema<"VolunteerApplicationMine">;
export type MyVolunteering = Schema<"MyVolunteering">;
export type VolunteerRow = Schema<"VolunteerApplicationRow">;
