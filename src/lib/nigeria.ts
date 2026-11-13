import { t } from "../i18n";
/**
 * Reference data mirrored from ndcbackend/apps/candidates/reference.py (spec 03 §4).
 * Positions are in display order; each declares the area fields it needs.
 */
export type PositionValue =
  | "president"
  | "governor"
  | "senator"
  | "house_of_reps"
  | "state_assembly"
  | "lga_chairman"
  | "councillor";

export interface PositionInfo {
  value: PositionValue;
  label: string;
  state: boolean;
  area: boolean;
  ward: boolean;
  areaLabel?: string;
}

export const POSITIONS: PositionInfo[] = [
  { value: "president", get label() { return t("lib.president"); }, state: false, area: false, ward: false },
  { value: "governor", get label() { return t("lib.governor"); }, state: true, area: false, ward: false },
  { value: "senator", get label() { return t("lib.senator"); }, state: true, area: true, ward: false, get areaLabel() { return t("lib.senatorial-district"); } },
  { value: "house_of_reps", get label() { return t("lib.member-house-of-representatives"); }, state: true, area: true, ward: false, get areaLabel() { return t("lib.federal-constituency"); } },
  { value: "state_assembly", get label() { return t("lib.member-state-house-of-assembly"); }, state: true, area: true, ward: false, get areaLabel() { return t("lib.state-constituency"); } },
  { value: "lga_chairman", get label() { return t("lib.lga-chairman"); }, state: true, area: true, ward: false, get areaLabel() { return t("lib.local-government-area"); } },
  { value: "councillor", get label() { return t("lib.councillor"); }, state: true, area: true, ward: true, get areaLabel() { return t("lib.local-government-area"); } },
];

export const positionInfo = (value: string) => POSITIONS.find((p) => p.value === value);

/** The FCT has no Governor and no State House of Assembly. */
export const NOT_IN_FCT: PositionValue[] = ["governor", "state_assembly"];

export const STATES: { value: string; label: string }[] = [
  ["abia", "Abia"], ["adamawa", "Adamawa"], ["akwa_ibom", "Akwa Ibom"], ["anambra", "Anambra"], ["bauchi", "Bauchi"],
  ["bayelsa", "Bayelsa"], ["benue", "Benue"], ["borno", "Borno"], ["cross_river", "Cross River"], ["delta", "Delta"],
  ["ebonyi", "Ebonyi"], ["edo", "Edo"], ["ekiti", "Ekiti"], ["enugu", "Enugu"], ["gombe", "Gombe"], ["imo", "Imo"],
  ["jigawa", "Jigawa"], ["kaduna", "Kaduna"], ["kano", "Kano"], ["katsina", "Katsina"], ["kebbi", "Kebbi"],
  ["kogi", "Kogi"], ["kwara", "Kwara"], ["lagos", "Lagos"], ["nasarawa", "Nasarawa"], ["niger", "Niger"],
  ["ogun", "Ogun"], ["ondo", "Ondo"], ["osun", "Osun"], ["oyo", "Oyo"], ["plateau", "Plateau"], ["rivers", "Rivers"],
  ["sokoto", "Sokoto"], ["taraba", "Taraba"], ["yobe", "Yobe"], ["zamfara", "Zamfara"], ["fct", "Federal Capital Territory"],
].map(([value, label]) => ({ value, label }));

export const stateLabel = (value: string) => STATES.find((s) => s.value === value)?.label ?? "";
