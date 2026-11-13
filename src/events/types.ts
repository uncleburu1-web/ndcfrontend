/** Spec 18: event and volunteering shapes, from the generated OpenAPI types. */
import type { Schema } from "../api/typed";
import { format, t as tr } from "../i18n";

export type EventCard = Schema<"EventCardSchema">;
export type EventDetail = Schema<"EventDetailSchema">;
export type EventMe = Schema<"EventMeSchema">;
export type OrganiserEvent = Schema<"OrganiserEventSchema">;
export type MyEvent = Schema<"MyEventSchema">;
export type EventList = Schema<"EventList">;

export const TYPE_OPTIONS = [
  { value: "rally", get label() { return tr("events.rally"); } }, { value: "canvass", get label() { return tr("events.canvassing-drive"); } }, { value: "town_hall", get label() { return tr("events.town-hall"); } },
  { value: "meeting", get label() { return tr("events.meeting"); } }, { value: "training", get label() { return tr("events.training"); } }, { value: "other", get label() { return tr("events.other"); } },
];
export const MODE_OPTIONS = [
  { value: "in_person", get label() { return tr("events.in-person"); } }, { value: "online", get label() { return tr("events.online"); } }, { value: "hybrid", get label() { return tr("events.in-person-and-online"); } },
];
/** Rule 3: no place of worship, police station or public office (Electoral Act 2026 s. 96). */
export const VENUE_OPTIONS = [
  { value: "open_ground", get label() { return tr("events.open-ground-or-field"); } }, { value: "hall", get label() { return tr("events.hall-or-event-centre"); } }, { value: "hotel", get label() { return tr("events.hotel"); } },
  { value: "school", get label() { return tr("events.school-outside-school-hours"); } }, { value: "market", get label() { return tr("events.market"); } },
  { value: "street", get label() { return tr("events.street-or-neighbourhood"); } }, { value: "private_premises", get label() { return tr("events.private-premises"); } },
];
export const DECLARATION_WORDS: Record<string, string> = {
  get no_inducements() { return tr("events.this-event-offers-no-money-gifts"); },
  get lawful_venue() { return tr("events.the-venue-isn-t-a-place"); },
  get police_notified() { return tr("events.the-police-have-been-or-will"); },
};
export const VOLUNTEER_ROLE_WORDS: Record<string, string> = {
  get canvassing() { return tr("events.canvassing"); }, get events() { return tr("events.events"); }, get social_media() { return tr("events.social-media"); }, get logistics() { return tr("events.logistics"); }, get data_and_tech() { return tr("events.data-and-tech"); },
  get outreach_youth() { return tr("events.youth-outreach"); }, get outreach_women() { return tr("events.women-s-outreach"); }, get outreach_disability() { return tr("events.disability-outreach"); }, get other() { return tr("events.other"); },
};
export const AVAILABILITY_WORDS: Record<string, string> = { get weekdays() { return tr("events.weekdays"); }, get weekday_evenings() { return tr("events.weekday-evenings"); }, get weekends() { return tr("events.weekends"); } };

/** "Sat 14 Nov, 10:00 (WAT)" — Lagos time always (rule 11). */
export function whenWords(iso: string, withDay = true): string {
  return format.when(iso, withDay); // spec 21 §4: in the current language
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
