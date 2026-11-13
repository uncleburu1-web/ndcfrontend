/**
 * Constituency picker for the candidate editor (spec 19 §5.2): senators, House of Representatives and State Assembly
 * candidates stand in a constituency. Until INEC's constituency files are loaded the list is empty and the editor keeps
 * its free-text area field.
 */
import { Select } from "../components/ui";
import { geoApi, useGeoList } from "./useGeo";
import { CONSTITUENCY_LABEL, type GeoConstituency } from "./types";
import { t } from "../i18n";

export const POSITION_KIND: Record<string, string> = {
  senator: "senatorial_district", house_of_reps: "federal_constituency", state_assembly: "state_constituency",
};

export function useConstituencies(state: string, position: string) {
  const kind = POSITION_KIND[position];
  return useGeoList<GeoConstituency>(state && kind ? (a) => geoApi.constituencies(a, state, kind) : null, `con:${state}:${kind}`);
}

export function ConstituencyPicker({ state, position, value, onChange, error, list }: {
  state: string; position: string; value: number | null; onChange: (id: number | null, name: string) => void; error?: string;
  list: { data: GeoConstituency[]; loading: boolean };
}) {
  const kind = POSITION_KIND[position];
  if (!kind) return null;
  return (
    <Select label={CONSTITUENCY_LABEL[kind]} value={value ? String(value) : ""} error={error}
      options={[{ value: "", label: list.loading ? t("geo.loading") : t("geo.not-chosen-type-the-area-below") },
        ...list.data.map((c) => ({ value: String(c.id), label: c.name }))]}
      onChange={(e) => {
        const id = Number(e.target.value) || null;
        onChange(id, list.data.find((c) => c.id === id)?.name ?? "");
      }}
      hint={state ? undefined : t("geo.choose-the-state-first")} />
  );
}
