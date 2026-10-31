/**
 * Create/edit form (spec 03 §8.3). Area fields show/hide by position (§4); priorities
 * and links are add/remove rows; API field errors show inline.
 */
import { useState, type FormEvent } from "react";
import type { ApiError } from "../../../auth/api";
import type { AdminCandidate, CandidateLink } from "../../../candidates/types";
import { Banner, Button, Select, TextArea, TextField } from "../../../components/ui";
import { NOT_IN_FCT, POSITIONS, STATES, positionInfo, type PositionValue } from "../../../lib/nigeria";

export interface CandidateFormValues {
  full_name: string;
  position: string;
  election_year: string;
  state: string;
  area_name: string;
  ward_name: string;
  campaign_summary: string;
  biography: string;
  priorities: string[];
  links: CandidateLink[];
}

export const IDENTITY_FIELDS: (keyof CandidateFormValues)[] = ["full_name", "position", "election_year", "state", "area_name", "ward_name"];

export function toFormValues(c?: AdminCandidate | null): CandidateFormValues {
  return {
    full_name: c?.full_name ?? "",
    position: c?.position ?? "",
    election_year: c ? String(c.election_year) : "",
    state: c?.state ?? "",
    area_name: c?.area_name ?? "",
    ward_name: c?.ward_name ?? "",
    campaign_summary: c?.campaign_summary ?? "",
    biography: c?.biography ?? "",
    priorities: c?.priorities ?? [],
    links: c?.links ?? [],
  };
}

/** API payload: drop area fields the position doesn't use so stale values never get saved. */
export function toPayload(v: CandidateFormValues) {
  const info = positionInfo(v.position);
  return {
    full_name: v.full_name,
    position: v.position,
    election_year: Number(v.election_year) || v.election_year,
    state: info?.state ? v.state : "",
    area_name: info?.area ? v.area_name : "",
    ward_name: info?.ward ? v.ward_name : "",
    campaign_summary: v.campaign_summary,
    biography: v.biography,
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
  const stateOptions = STATES.filter((s) => !(s.value === "fct" && NOT_IN_FCT.includes(v.position as PositionValue)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} noValidate className="adm-form" aria-busy={busy || undefined}>
      {error && error.code !== "validation_error" && <Banner tone="error">{error.message}</Banner>}
      {error?.code === "validation_error" && <Banner tone="error">Please correct the highlighted fields.</Banner>}

      <fieldset className="adm-form__group">
        <legend>Identity</legend>
        <TextField label="Full name" name="full_name" required value={v.full_name} onChange={(e) => set("full_name", e.target.value)} error={fe("full_name")} />
        <div className="adm-form__row">
          <Select
            label="Office sought"
            name="position"
            required
            value={v.position}
            placeholder="Choose an office"
            onChange={(e) => set("position", e.target.value)}
            options={POSITIONS.map((p) => ({ value: p.value, label: p.label }))}
            error={fe("position")}
          />
          <TextField
            label="Election year"
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
            label="State"
            name="state"
            required
            value={v.state}
            placeholder="Choose a state"
            onChange={(e) => set("state", e.target.value)}
            options={stateOptions}
            error={fe("state")}
            hint={NOT_IN_FCT.includes(v.position as PositionValue) ? "The FCT has no office of this kind." : undefined}
          />
        )}
        {info?.area && (
          <TextField
            label={info.areaLabel ?? "Area"}
            name="area_name"
            required
            value={v.area_name}
            onChange={(e) => set("area_name", e.target.value)}
            error={fe("area_name")}
            hint={info.value === "senator" ? "For example: Kano Central Senatorial District" : undefined}
          />
        )}
        {info?.ward && (
          <TextField label="Ward" name="ward_name" required value={v.ward_name} onChange={(e) => set("ward_name", e.target.value)} error={fe("ward_name")} />
        )}
        {info && !info.state && <p className="adm-form__note">A {info.label} candidate represents the whole country, so no area is needed.</p>}
      </fieldset>

      <fieldset className="adm-form__group">
        <legend>Campaign</legend>
        <TextArea
          label="Campaign summary"
          name="campaign_summary"
          rows={3}
          maxLength={1000}
          value={v.campaign_summary}
          onChange={(e) => set("campaign_summary", e.target.value)}
          error={fe("campaign_summary")}
          hint="One short paragraph, up to 1,000 characters."
        />

        <div className="adm-rows">
          <p className="ds-field__label" id="priorities-label">Priorities</p>
          <p className="ds-field__hint">Up to 8, each under 120 characters.</p>
          {v.priorities.map((p, i) => (
            <div key={i} className="adm-rows__row">
              <TextField
                label={`Priority ${i + 1}`}
                value={p}
                maxLength={120}
                onChange={(e) => set("priorities", v.priorities.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button variant="ghost" size="sm" onClick={() => set("priorities", v.priorities.filter((_, j) => j !== i))}>
                Remove<span className="visually-hidden"> priority {i + 1}</span>
              </Button>
            </div>
          ))}
          {fe("priorities") && <p className="ds-field__error">{fe("priorities")}</p>}
          {v.priorities.length < 8 && (
            <Button variant="secondary" size="sm" onClick={() => set("priorities", [...v.priorities, ""])}>
              Add a priority
            </Button>
          )}
        </div>

        <TextArea
          label="Biography"
          name="biography"
          rows={8}
          maxLength={5000}
          value={v.biography}
          onChange={(e) => set("biography", e.target.value)}
          error={fe("biography")}
          hint="Plain text. Leave a blank line between paragraphs. Up to 5,000 characters."
        />

        <div className="adm-rows">
          <p className="ds-field__label">Links</p>
          <p className="ds-field__hint">Website or social profiles. Up to 5, https:// only.</p>
          {v.links.map((l, i) => (
            <div key={i} className="adm-rows__row adm-rows__row--link">
              <TextField label={`Link ${i + 1} label`} value={l.label} maxLength={40}
                onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
              <TextField label={`Link ${i + 1} URL`} value={l.url} type="text" inputMode="url" placeholder="https://"
                onChange={(e) => set("links", v.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Button variant="ghost" size="sm" onClick={() => set("links", v.links.filter((_, j) => j !== i))}>
                Remove<span className="visually-hidden"> link {i + 1}</span>
              </Button>
            </div>
          ))}
          {fe("links") && <p className="ds-field__error">{fe("links")}</p>}
          {v.links.length < 5 && (
            <Button variant="secondary" size="sm" onClick={() => set("links", [...v.links, { label: "", url: "" }])}>
              Add a link
            </Button>
          )}
        </div>
      </fieldset>

      <Button type="submit" loading={busy} loadingLabel="Saving…">
        {submitLabel}
      </Button>
    </form>
  );
}
