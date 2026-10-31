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
  { value: "president", label: "President", state: false, area: false, ward: false },
  { value: "governor", label: "Governor", state: true, area: false, ward: false },
  { value: "senator", label: "Senator", state: true, area: true, ward: false, areaLabel: "Senatorial district" },
  { value: "house_of_reps", label: "Member, House of Representatives", state: true, area: true, ward: false, areaLabel: "Federal constituency" },
  { value: "state_assembly", label: "Member, State House of Assembly", state: true, area: true, ward: false, areaLabel: "State constituency" },
  { value: "lga_chairman", label: "LGA Chairman", state: true, area: true, ward: false, areaLabel: "Local government area" },
  { value: "councillor", label: "Councillor", state: true, area: true, ward: true, areaLabel: "Local government area" },
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
