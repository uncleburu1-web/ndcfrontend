/** Geography types (spec 19 §13), from the generated OpenAPI schema. */
import type { Schema } from "../api/typed";
import { t } from "../i18n";

export type GeoState = Schema<"StateSchema">;
export type GeoLga = Schema<"LgaSchema">;
export type GeoWard = Schema<"WardSchema">;
export type GeoUnit = Schema<"PollingUnitSchema">;
export type GeoUnitDetail = Schema<"PollingUnitDetailSchema">;
export type GeoConstituency = Schema<"ConstituencySchema">;
export type GeoAbout = Schema<"AboutSchema">;
export type GeoPlace = Schema<"PlaceSchema">;
export type GeoSuggestion = Schema<"SuggestionSchema">;
export type ConfirmItem = Schema<"ConfirmItemSchema">;
export type ConfirmResult = Schema<"ConfirmResult">;
export type LgaPageData = Schema<"LgaPageSchema">;
export type DatasetAdmin = Schema<"DatasetAdminSchema">;
export type DatasetDetail = Schema<"DatasetDetailSchema">;
export type ReviewPage = Schema<"ReviewPage">;
export type ReviewItem = Schema<"ReviewItemSchema">;
export type AliasItem = Schema<"AliasSchema">;
export type ChangePage = Schema<"ChangePage">;

/**
 * What a picker holds. IDs are what the backend checks (§7.3); the text fields are what "My place isn't listed"
 * sends, and what the record keeps beside the link (rule 4).
 */
export interface GeoValue {
  lga_id: number | null;
  ward_id: number | null;
  polling_unit_id: number | null;
  not_listed: boolean;
  lga: string;
  ward: string;
  polling_unit: string;
}

export const EMPTY_GEO: GeoValue = { lga_id: null, ward_id: null, polling_unit_id: null, not_listed: false, lga: "", ward: "", polling_unit: "" };

/** The request fields every form sends (membership, PVC, /me/geo-confirm, review queue). */
export function geoBody(v: GeoValue, withText = true) {
  if (v.not_listed) return { geo_not_listed: true, ...(withText ? { lga: v.lga, ward: v.ward, polling_unit: v.polling_unit } : {}) };
  return { lga_id: v.lga_id, ward_id: v.ward_id, polling_unit_id: v.polling_unit_id };
}

/** Pre-fill from a record's link (or its suggestion) and its typed text. */
export function geoFrom(place: GeoPlace | null | undefined, typed?: { lga?: string; ward?: string; polling_unit?: string }): GeoValue {
  const ok = (x: { id: number; active: boolean } | null | undefined) => (x && x.active ? x.id : null);
  return {
    lga_id: ok(place?.lga), ward_id: ok(place?.ward), polling_unit_id: ok(place?.polling_unit), not_listed: false,
    lga: typed?.lga ?? "", ward: typed?.ward ?? "", polling_unit: typed?.polling_unit ?? "",
  };
}

/** "Ikeja, Lagos State" — "Area council" wording for the FCT (§1.2). */
export const lgaWord = (state: string) => (state === "fct" ? "Area council" : "LGA");

export const CONSTITUENCY_LABEL: Record<string, string> = {
  get senatorial_district() { return t("geo.senatorial-district"); },
  get federal_constituency() { return t("geo.federal-constituency"); },
  get state_constituency() { return t("geo.state-constituency"); },
};
