/**
 * Create/edit form (spec 03 §8.3). Area fields show/hide by position (§4); priorities
 * and links are add/remove rows; API field errors show inline.
 */
import { useState, type FormEvent } from "react";
import type { ApiError } from "../../../auth/api";
import type { AdminCandidate, CandidateLink } from "../../../candidates/types";
import { Banner, Button, Select, TextArea, TextField } from "../../../components/ui";
import { ConstituencyPicker, POSITION_KIND, useConstituencies } from "../../../geo/ConstituencyPicker";
import { GeoPicker } from "../../../geo/GeoPicker";
import { EMPTY_GEO, type GeoValue } from "../../../geo/types";
import { NOT_IN_FCT, POSITIONS, STATES, positionInfo, type PositionValue } from "../../../lib/nigeria";
import { t } from "../../../i18n";
import { WrittenIn } from "../../../i18n/ContentLanguage";

export interface CandidateFormValues {
  full_name: string;
  position: string;
  election_year: string;
  state: string;
  area_name: string;
  ward_name: string;
  /** Spec 19 §5.2 */
  constituency_id: number | null;
  geo: GeoValue;
  campaign_summary: string;
  biography: string;
  /** Spec 21 §9 */
  biography_language: string;
  priorities: string[];
  links: CandidateLink[];
}

export const IDENTITY_FIELDS: (keyof CandidateFormValues)[] = ["full_name", "position", "election_year", "state", "area_name", "ward_name",
  "constituency_id"];

export function toFormValues(c?: AdminCandidate | null): CandidateFormValues {
  return {
    full_name: c?.full_name ?? "",
    position: c?.position ?? "",
    election_year: c ? String(c.election_year) : "",
    state: c?.state ?? "",
    area_name: c?.area_name ?? "",
    ward_name: c?.ward_name ?? "",
    constituency_id: c?.constituency?.id ?? null,
    geo: { ...EMPTY_GEO, lga_id: c?.lga_id ?? null, ward_id: c?.ward_id ?? null, lga: c?.area_name ?? "", ward: c?.ward_name ?? "",
      not_listed: !!c && !c.lga_id && !!c.area_name },
    campaign_summary: c?.campaign_summary ?? "",
    biography: c?.biography ?? "",
    biography_language: (c as { biography_language?: string } | undefined)?.biography_language ?? "en",
    priorities: c?.priorities ?? [],
    links: c?.links ?? [],
  };
}

/** API payload: drop area fields the position doesn't use so stale values never get saved. */
export function toPayload(v: CandidateFormValues) {
  const info = positionInfo(v.position);
  const local = v.position === "lga_chairman" || v.position === "councillor";
  const picked = local && !v.geo.not_listed && v.geo.lga_id;
  const area = local ? (picked ? "" : v.geo.lga) : v.area_name;
  const ward = local ? (picked ? "" : v.geo.ward) : v.ward_name;
  return {
    full_name: v.full_name,
    position: v.position,
    election_year: Number(v.election_year) || v.election_year,
    state: info?.state ? v.state : "",
    area_name: info?.area ? (picked ? v.geo.lga : area) : "",
    ward_name: info?.ward ? (picked ? v.geo.ward : ward) : "",
    ...(POSITION_KIND[v.position] ? { constituency_id: v.constituency_id } : {}),
    ...(local ? { lga_id: picked ? v.geo.lga_id : null, ward_id: picked && v.position === "councillor" ? v.geo.ward_id : null } : {}),
    campaign_summary: v.campaign_summary,
    biography: v.biography,
    biography_language: v.biography_language,
    priorities: v.priorities.map((p) => p.trim()).filter(Boolean),
    links: v.links.filter((l) => l.label.trim() || l.url.trim()),
  };
}

interface Props {
  initial: CandidateFormValues;
  submitLabel: string;
  busy: boolean;
  error: ApiError | null;
  onSubmit: (values: CandidateFormValues) => void;
}

export function CandidateForm({ initial, submitLabel, busy, error, onSubmit }: Props) {
  const [v, setV] = useState<CandidateFormValues>(initial);
  const set = <K extends keyof CandidateFormValues>(k: K, value: CandidateFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const info = positionInfo(v.position);
  const fe = (name: string) => error?.fields?.[name]?.[0];
  const cons = useConstituencies(info?.state ? v.state : "", v.position);
  const local = v.position === "lga_chairman" || v.position === "councillor";
  const conChosen = !!POSITION_KIND[v.position] && !!v.constituency_id;
  const stateOptions = STATES.filter((s) => !(s.value === "fct" && NOT_IN_FCT.includes(v.position as PositionValue)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} noValidate className="adm-form" aria-busy={busy || undefined}>
      {error && error.code !== "validation_error" && <Banner tone="error">{error.message}</Banner>}
      {error?.code === "validation_error" && <Banner tone="error">{t("admin.please-correct-the-highlighted-fields")}</Banner>}

      <fieldset className="adm-form__group">
        <legend>{t("admin.identity")}</legend>
        <TextField label={t("admin.full-name")} name="full_name" required value={v.full_name} onChange={(e) => set("full_name", e.target.value)} error={fe("full_name")} />
        <div className="adm-form__row">
          <Select
            label={t("admin.office-sought")}
            name="position"
            required
            value={v.position}
            placeholder={t("admin.choose-an-office")}
            onChange={(e) => set("position", e.target.value)}
            options={POSITIONS.map((p) => ({ value: p.value, label: p.label }))}
            error={fe("position")}
          />
          <TextField
            label={t("admin.election-year")}
            name="election_year"
            required
            inputMode="numeric"
            value={v.election_year}
            onChange={(e) => set("election_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
            error={fe("election_year")}
            placeholder="2027"
          />
        </div>
        {info?.state && (
          <Select
            label={t("admin.state")}
            name="state"
            required
            value={v.state}
            placeholder={t("admin.choose-a-state")}
            onChange={(e) => setV((x) => ({ ...x, state: e.target.value, constituency_id: null, geo: EMPTY_GEO }))}
            options={stateOptions}
            error={fe("state")}
            hint={NOT_IN_FCT.includes(v.position as PositionValue) ? t("admin.the-fct-has-no-office-of") : undefined}
          />
        )}
        {POSITION_KIND[v.position] && cons.data.length > 0 && (
          <ConstituencyPicker state={v.state} position={v.position} value={v.constituency_id} list={cons} error={fe("constituency_id")}
            onChange={(id, name) => setV((x) => ({ ...x, constituency_id: id, area_name: id ? name : x.area_name }))} />
        )}
        {local && v.state && (
          <GeoPicker state={v.state} value={v.geo} onChange={(g) => set("geo", g)} depth={v.position === "councillor" ? "ward" : "lga"}
            required={v.position === "councillor" ? ["lga", "ward"] : ["lga"]}
            errors={{ lga: fe("lga_id") ?? fe("area_name"), ward: fe("ward_id") ?? fe("ward_name") }} />
        )}
        {info?.area && !local && !conChosen && (
          <TextField
            label={info.areaLabel ?? t("admin.area")}
            name="area_name"
            required
            value={v.area_name}
            onChange={(e) => set("area_name", e.target.value)}
            error={fe("area_name")}
            hint={info.value === "senator" ? t("admin.for-example-kano-central-senatorial-district") : undefined}
          />
        )}
        {info?.ward && !local && (
          <TextField label={t("admin.ward")} name="ward_name" required value={v.ward_name} onChange={(e) => set("ward_name", e.target.value)} error={fe("ward_name")} />
        )}
        {info && !info.state && <p className="adm-form__note">{t("admin.a-candidate-represents-the-whole-country", { label: info.label })}</p>}
      </fieldset>

      <fieldset className="adm-form__group">
        <legend>{t("admin.campaign")}</legend>
        <TextArea
          label={t("admin.campaign-summary")}
          name="campaign_summary"
          rows={3}
          maxLength={1000}
          value={v.campaign_summary}
          onChange={(e) => set("campaign_summary", e.target.value)}
          error={fe("campaign_summary")}
          hint={t("admin.one-short-paragraph-up-to-1")}
        />

        <div className="adm-rows">
          <p className="ds-field__label" id="priorities-label">{t("admin.priorities")}</p>
          <p className="ds-field__hint">{t("admin.up-to-8-each-under-120")}</p>
          {v.priorities.map((p, i) => (
            <div key={i} className="adm-rows__row">
              <TextField
                label={t("admin.priority", { v: i + 1 })}
                value={p}
                maxLength={120}
                onChange={(e) => set("priorities", v.priorities.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button variant="ghost" size="sm" onClick={() => set("priorities", v.priorities.filter((_, j) => j !== i))}>
                {t.rich("admin.remove-priority", { v: i + 1, span: (chunks) => <span className="visually-hidden">{chunks}</span> })}
              </Button>
            </div>
          ))}
          {fe("priorities") && <p className="ds-field__error">{fe("priorities")}</p>}
          {v.priorities.length < 8 && (
            <Button variant="secondary" size="sm" onClick={() => set("priorities", [...v.priorities, ""])}>
              {t("admin.add-a-priority")}</Button>
          )}
        </div>

        <TextArea
          label={t("admin.biography")}
          name="biography"
          rows={8}
          maxLength={5000}
          value={v.biography}
          onChange={(e) => set("biography", e.target.value)}
          error={fe("biography")}
          hint={t("admin.plain-text-leave-a-blank-line-2")}
        />
        <WrittenIn value={v.biography_language} onChange={(lang) => set("biography_language", lang)} />

        <div className="adm-rows">
          <p className="ds-field__label">{t("admin.links")}</p>
          <p className="ds-field__hint">{t("admin.website-or-social-profiles-up-to")}</p>
          {v.links.map((l, i) => (
            <div key={i} className="adm-rows__row adm-rows__row--link">
              <TextField label={t("admin.link-label", { v: i + 1 })} value={l.label} maxLength={40}
                onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <TextField label={t("admin.link-url", { v: i + 1 })} value={l.url} type="text" inputMode="url" placeholder="https://"
                onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => set("links", v.links.filter((_, j) => j !== i))}>
                {t.rich("admin.remove-link", { v: i + 1, span: (chunks) => <span className="visually-hidden">{chunks}</span> })}
              </Button>
            </div>
          ))}
          {fe("links") && <p className="ds-field__error">{fe("links")}</p>}
          {v.links.length < 5 && (
            <Button variant="secondary" size="sm" onClick={() => set("links", [...v.links, { label: "", url: "" }])}>
              {t("admin.add-a-link")}</Button>
          )}
        </div>
      </fieldset>

      <Button type="submit" loading={busy} loadingLabel={t("admin.saving")}>
        {submitLabel}
      </Button>
    </form>
  );
}
