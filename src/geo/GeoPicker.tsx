/**
 * The location picker (spec 19 §7.1): LGA → ward → polling unit inside a chosen state, from INEC's list.
 * Lists are native selects (they work with a keyboard, a screen reader and on a 360 px phone); the polling-unit list
 * has a filter box and a "find by code" box. "My place isn't listed" keeps the old free-text fields as a fallback.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Button, Checkbox, Select, TextField } from "../components/ui";
import { geoApi, useGeoList, fold, CODE_RE } from "./useGeo";
import { lgaWord, type GeoLga, type GeoUnit, type GeoValue, type GeoWard } from "./types";
import "./geo.css";

export type GeoDepth = "lga" | "ward" | "polling_unit";

interface Props {
  state: string;
  value: GeoValue;
  onChange: (v: GeoValue) => void;
  /** How far down to ask (PVC and events stop early). */
  depth?: GeoDepth;
  /** Which levels must be chosen (the rest are optional). */
  required?: GeoDepth[];
  /** Field errors, keyed lga / ward / polling_unit (also lga_id … from the backend). */
  errors?: Record<string, string | undefined>;
  /** Offer "My place isn't listed" (on by default). */
  allowNotListed?: boolean;
  /** Text shown above the picker. */
  hint?: string;
  disabled?: boolean;
}

const pickErr = (errors: Props["errors"], k: string) => errors?.[k] ?? errors?.[`${k}_id`];

export function GeoPicker({ state, value, onChange, depth = "polling_unit", required = [], errors, allowNotListed = true, hint,
  disabled }: Props) {
  const api = useApi();
  const id = useId();
  const word = lgaWord(state);
  const lgas = useGeoList<GeoLga>(state ? (a) => geoApi.lgas(a, state) : null, `lgas:${state}`);
  const wantWard = depth !== "lga";
  const wantUnit = depth === "polling_unit";
  const wards = useGeoList<GeoWard>(wantWard && value.lga_id ? (a) => geoApi.wards(a, value.lga_id!) : null, `wards:${value.lga_id}`);
  const units = useGeoList<GeoUnit>(wantUnit && value.ward_id ? (a) => geoApi.units(a, value.ward_id!) : null, `units:${value.ward_id}`);
  const [filter, setFilter] = useState("");
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState("");
  const [finding, setFinding] = useState(false);

  const shown = useMemo(() => {
    const f = fold(filter);
    return f ? units.data.filter((u) => fold(u.name).includes(f) || u.delimitation.includes(f) || u.code === f) : units.data;
  }, [filter, units.data]);

  const set = (patch: Partial<GeoValue>) => onChange({ ...value, ...patch });
  // INEC's list for this state isn't loaded yet: the only way to answer is to type it (an officer links it later).
  const noList = lgas.loaded && lgas.data.length === 0;
  useEffect(() => {
    if (noList && !value.not_listed) onChange({ ...value, not_listed: true, lga_id: null, ward_id: null, polling_unit_id: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noList]);
  const nameOf = <T extends { id: number; name: string }>(list: T[], v: number | null) => list.find((x) => x.id === v)?.name ?? "";

  const findCode = async () => {
    const c = code.trim();
    if (!CODE_RE.test(c)) {
      setCodeMsg("Codes look like 24-07-05-004.");
      return;
    }
    setFinding(true);
    setCodeMsg("");
    try {
      const u = await geoApi.byCode(api, c);
      if (u.state.slug !== state) setCodeMsg(`That code is in ${u.state.name}, not the state you chose.`);
      else if (!u.active) setCodeMsg("That polling unit is no longer in INEC’s current list.");
      else {
        onChange({ ...value, not_listed: false, lga_id: u.lga.id, ward_id: u.ward.id, polling_unit_id: u.id, lga: u.lga.name,
          ward: u.ward.name, polling_unit: u.name });
        setCodeMsg(`Found: ${u.name}.`);
      }
    } catch (err) {
      setCodeMsg(err instanceof ApiError && err.status === 404 ? "No polling unit has that code." : "Couldn’t look that up. Try again.");
    } finally {
      setFinding(false);
    }
  };

  if (!state) return <p className="news-meta">Choose your state first.</p>;
  const isReq = (k: GeoDepth) => required.includes(k);

  return (
    <fieldset className="geo-picker" disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="visually-hidden">Where you vote</legend>
      {hint && <p id={`${id}-hint`} className="news-meta">{hint}</p>}
      {value.not_listed ? (
        <div className="geo-picker__typed">
          <TextField label={word} value={value.lga} required={isReq("lga")} maxLength={120} error={pickErr(errors, "lga")}
            onChange={(e) => set({ lga: e.target.value })} />
          {wantWard && <TextField label="Ward" value={value.ward} required={isReq("ward")} maxLength={120} error={pickErr(errors, "ward")}
            onChange={(e) => set({ ward: e.target.value })} />}
          {wantUnit && <TextField label="Polling unit" value={value.polling_unit} required={isReq("polling_unit")} maxLength={160}
            error={pickErr(errors, "polling_unit")} onChange={(e) => set({ polling_unit: e.target.value })} />}
          <p className="news-meta">{noList ? `INEC’s list for this state isn’t on NDCConnect yet, so type your ${word.toLowerCase()}${wantWard ? " and ward" : ""}. An officer will check it.` : "An officer will check this against INEC’s list."}</p>
        </div>
      ) : (
        <>
          <Select label={word} required={isReq("lga")} value={value.lga_id ? String(value.lga_id) : ""} placeholder={lgas.loading ? "Loading…" : `Choose your ${word}`}
            options={lgas.data.map((l) => ({ value: String(l.id), label: l.name }))} error={pickErr(errors, "lga") ?? (lgas.error ? "Couldn’t load the list." : undefined)}
            onChange={(e) => {
              const v = Number(e.target.value) || null;
              set({ lga_id: v, ward_id: null, polling_unit_id: null, lga: nameOf(lgas.data, v), ward: "", polling_unit: "" });
            }} />
          {wantWard && (
            <Select label="Ward" required={isReq("ward")} disabled={!value.lga_id} value={value.ward_id ? String(value.ward_id) : ""}
              placeholder={!value.lga_id ? `Choose your ${word} first` : wards.loading ? "Loading…" : "Choose your ward"}
              hint="Wards are INEC registration areas."
              options={wards.data.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.code} (${w.polling_units} unit${w.polling_units === 1 ? "" : "s"})` }))}
              error={pickErr(errors, "ward")}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                set({ ward_id: v, polling_unit_id: null, ward: nameOf(wards.data, v), polling_unit: "" });
                setFilter("");
              }} />
          )}
          {wantUnit && value.ward_id && units.data.length > 12 && (
            <TextField label="Filter polling units" value={filter} onChange={(e) => setFilter(e.target.value)} hint="Part of the name or the code" />
          )}
          {wantUnit && (
            <Select label="Polling unit" required={isReq("polling_unit")} disabled={!value.ward_id}
              value={value.polling_unit_id ? String(value.polling_unit_id) : ""}
              placeholder={!value.ward_id ? "Choose your ward first" : units.loading ? "Loading…" : shown.length ? "Choose your polling unit" : "No match"}
              options={shown.map((u) => ({ value: String(u.id), label: `${u.name} · ${u.delimitation}` }))}
              error={pickErr(errors, "polling_unit")}
              onChange={(e) => {
                const v = Number(e.target.value) || null;
                set({ polling_unit_id: v, polling_unit: nameOf(units.data, v) });
              }} />
          )}
          {wantUnit && (
            <div className="geo-picker__code">
              <TextField label="Or find it by code" value={code} placeholder="24-07-05-004" inputMode="numeric" maxLength={12}
                hint={codeMsg || "The code is on your voter’s card and on INEC’s polling-unit locator."} onChange={(e) => setCode(e.target.value)} />
              <Button type="button" variant="secondary" size="sm" loading={finding} onClick={() => void findCode()}>Find</Button>
            </div>
          )}
        </>
      )}
      {allowNotListed && !noList && (
        <Checkbox label="My place isn’t listed" checked={value.not_listed}
          hint={value.not_listed ? undefined : "Type it instead; an officer links it later."}
          onChange={(e) => set({ not_listed: e.target.checked })} />
      )}
    </fieldset>
  );
}

/** Just the LGA (events, volunteering, LGA chairmen). Sends the ID; the name is written from it on the server. */
export function LgaPicker({ state, value, onChange, label, required, error, optional = true }: {
  state: string; value: number | null; onChange: (id: number | null, name: string) => void; label?: string; required?: boolean;
  error?: string; optional?: boolean;
}) {
  const lgas = useGeoList<GeoLga>(state ? (a) => geoApi.lgas(a, state) : null, `lgas:${state}`);
  const word = lgaWord(state);
  if (!state) return <Select label={label ?? word} disabled value="" options={[]} placeholder="Choose the state first" />;
  return (
    <Select label={label ?? word} required={required} value={value ? String(value) : ""} error={error ?? (lgas.error ? "Couldn’t load the list." : undefined)}
      options={[...(optional ? [{ value: "", label: lgas.loading ? "Loading…" : `Any ${word.toLowerCase()} / not sure` }] : []),
        ...lgas.data.map((l) => ({ value: String(l.id), label: l.name }))]}
      placeholder={optional ? undefined : `Choose the ${word}`}
      onChange={(e) => {
        const id = Number(e.target.value) || null;
        onChange(id, lgas.data.find((l) => l.id === id)?.name ?? "");
      }} />
  );
}
