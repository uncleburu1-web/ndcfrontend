/**
 * The organiser's event editor (spec 18 §14): What, When, Where, Registration; drafts first, then Publish with the
 * declarations (rules 3–5). Used by campaigns (/campaign/:id) and system admins for party events (/admin/events).
 * The server is the judge of the campaign period and blackout windows; their refusals show in words.
 */
import { type FormEvent, useState } from "react";
import { ApiError } from "../auth/api";
import { useApi } from "../auth/session";
import { Banner, Button, Checkbox, Modal, RadioGroup, Select, Switch, TextArea, TextField, useToast } from "../components/ui";
import { formatDate } from "../lib/format";
import { LgaPicker } from "../geo/GeoPicker";
import { STATES } from "../lib/nigeria";
import { UploadProgress } from "../media/UploadProgress";
import { checkImage, useImageUpload } from "../media/useImageUpload";
import type { OrganiserEvent } from "./types";
import { DECLARATION_WORDS, MODE_OPTIONS, TYPE_OPTIONS, VENUE_OPTIONS, fromLocalInput, toLocalInput } from "./types";
import { getLanguage, t } from "../i18n";
import { defaultWritingLanguage, WrittenIn } from "../i18n/ContentLanguage";

export function refusal(err: unknown): string {
  if (!(err instanceof ApiError)) return "That didn’t work. Check your connection and try again.";
  const x = err.extra as { period_start?: string; period_end?: string; until?: string };
  if (err.code === "outside_campaign_period" && x?.period_start) return err.message;
  if (err.code === "publishing_paused" && x?.until) return `${err.message.replace(/\.$/, "")}.`;
  return err.message;
}

interface Props {
  base: string;  // "/campaign/<id>/events/" or "/admin/events/party/"
  party?: boolean;
  editing?: OrganiserEvent | null;
  onSaved: (e: OrganiserEvent) => void;
  onCancel: () => void;
}

export function EventEditor({ base, party = false, editing = null, onSaved, onCancel }: Props) {
  const api = useApi();
  const toast = useToast();
  const { upload: uploadImage, progress } = useImageUpload("event_image");
  const [f, setF] = useState({
    type: editing?.type ?? "rally", mode: editing?.mode ?? "in_person", title: editing?.title ?? "", description: editing?.description ?? "",
    language: (editing as { language?: string } | null)?.language ?? defaultWritingLanguage(getLanguage()),
    starts_at: toLocalInput(editing?.starts_at), ends_at: toLocalInput(editing?.ends_at), venue_name: editing?.venue_name ?? "",
    venue_address: editing?.venue_address_value ?? "", venue_type: editing?.venue_type && editing.venue_type !== "online" ? editing.venue_type : "",
    address_visibility: editing?.address_visibility ?? "public", state: editing?.state ?? "", lga_text: editing?.lga ?? "",
    geo_lga: editing?.geo_lga ? Number(editing.geo_lga) : null as number | null,
    online_url: editing?.online_url_value ?? "", accessibility_notes: editing?.accessibility_notes ?? "",
    capacity: editing?.capacity ? String(editing.capacity) : "", registration: editing?.registration ?? "open",
    members_only: editing?.members_only ?? false,
  });
  const [image, setImage] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean | number | null) => setF({ ...f, [k]: v });

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    setBanner("");
    const imageProblem = image ? checkImage(image) : null;
    if (imageProblem) return setErrors({ image: imageProblem.message });
    if (image && !rights) return setErrors({ rights: "Confirm you took this photo or have the right to share it." });
    setBusy(true);
    const body = { ...f, starts_at: fromLocalInput(f.starts_at), ends_at: fromLocalInput(f.ends_at), capacity: f.capacity ? Number(f.capacity) : null,
      ...(party ? {} : { members_only: false }) };
    try {
      let saved = editing
        ? await api<OrganiserEvent>(`${base}${editing.id}/`, { method: "PATCH", body })
        : await api<OrganiserEvent>(base, { method: "POST", body });
      if (image) saved = await uploadImage<OrganiserEvent>(image, { targetId: saved.id, url: `${base}${saved.id}/image/`, field: "image" });
      toast.show({ tone: "success", message: editing ? t("events.saved") : t("events.draft-saved-publish-it-when-you") });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields ?? {}).length) {
        setErrors(Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]])));
      } else {
        setBanner(refusal(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const online = f.mode !== "in_person";
  const inPerson = f.mode !== "online";
  return (
    <form className="ev-form" onSubmit={(ev) => void save(ev)} noValidate aria-label={editing ? t("events.edit-event") : t("events.new-event")}>
      <h2>{editing ? t("events.edit-event") : t("events.new-event")}</h2>
      {banner && <Banner tone="error">{banner}</Banner>}
      {editing?.status === "published" && <Banner tone="info">{t("events.changing-the-date-time-venue-or")}</Banner>}
      <fieldset>
        <legend>{t("events.what")}</legend>
        <div className="ev-row">
          <Select label={t("events.type")} required value={f.type} onChange={(e) => set("type", e.target.value)} options={TYPE_OPTIONS} error={errors.type}
            hint={!party && (f.type === "rally" || f.type === "canvass") ? t("events.rallies-and-canvassing-must-fall-inside") : undefined} />
          <Select label={t("events.how-people-take-part")} required value={f.mode} onChange={(e) => set("mode", e.target.value)} options={MODE_OPTIONS} />
        </div>
        <TextField label={t("events.title")} required maxLength={120} value={f.title} onChange={(e) => set("title", e.target.value)} error={errors.title}
          hint={`${f.title.length} / 120`} />
        <TextArea label={t("events.description")} required rows={6} maxLength={4000} value={f.description} onChange={(e) => set("description", e.target.value)}
          error={errors.description} hint={t("events.4-000-plain-text", { length: f.description.length.toLocaleString() })} />
        <WrittenIn value={f.language} onChange={(language) => setF({ ...f, language })} />
      </fieldset>
      <fieldset>
        <legend>{t("events.when-lagos-time")}</legend>
        <div className="ev-row">
          <TextField label={t("events.starts")} type="datetime-local" required value={f.starts_at} onChange={(e) => set("starts_at", e.target.value)} error={errors.starts_at} />
          <TextField label={t("events.ends")} type="datetime-local" required value={f.ends_at} onChange={(e) => set("ends_at", e.target.value)} error={errors.ends_at} />
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("events.where")}</legend>
        <div className="ev-row">
          <Select label={t("events.state")} required={inPerson} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value, geo_lga: null, lga_text: "" })}
            options={[{ value: "", label: inPerson ? t("events.choose-a-state") : t("events.nationwide") }, ...STATES]} error={errors.state} />
          {/* Spec 19 §7.2: the LGA comes from INEC's list; the text is written from it */}
          <LgaPicker state={f.state} value={f.geo_lga} error={errors.geo_lga} label={t("events.lga-optional")}
            onChange={(id, name) => setF({ ...f, geo_lga: id, lga_text: id ? name : "" })} />
        </div>
        {inPerson && (
          <>
            <TextField label={t("events.venue-name")} required value={f.venue_name} maxLength={200} onChange={(e) => set("venue_name", e.target.value)} error={errors.venue_name} />
            <TextField label={t("events.address")} required value={f.venue_address} maxLength={200} onChange={(e) => set("venue_address", e.target.value)}
              error={errors.venue_address} />
            <Select label={t("events.type-of-venue")} required value={f.venue_type} onChange={(e) => set("venue_type", e.target.value)} placeholder={t("events.choose")}
              options={VENUE_OPTIONS} error={errors.venue_type}
              hint={t("events.places-of-worship-police-stations-and")} />
            <RadioGroup legend={t("events.who-sees-the-address")} name="address-vis" value={f.address_visibility} onChange={(v) => set("address_visibility", v)}
              options={[{ value: "public", label: t("events.everyone") }, { value: "registered", label: t("events.registered-people-only-for-private-premises") }]} />
          </>
        )}
        {online && <TextField label={t("events.meeting-link")} required value={f.online_url} onChange={(e) => set("online_url", e.target.value)}
          error={errors.online_url} hint={t("events.starts-with-https-only-registered-people")} />}
        <TextField label={t("events.accessibility-notes-optional")} maxLength={300} value={f.accessibility_notes}
          onChange={(e) => set("accessibility_notes", e.target.value)} hint={t("events.for-example-step-free-access-sign")} />
      </fieldset>
      <fieldset>
        <legend>{t("events.registration")}</legend>
        <RadioGroup legend={t("events.sign-up")} name="registration" value={f.registration} onChange={(v) => set("registration", v)}
          options={[{ value: "open", label: t("events.open") }, { value: "closed", label: t("events.closed") }, { value: "none", label: t("events.no-sign-up-information-only") }]} />
        <TextField label={t("events.capacity-optional")} type="number" min={1} max={100000} value={f.capacity} onChange={(e) => set("capacity", e.target.value)}
          error={errors.capacity} hint={t("events.empty-for-no-limit-when-it")} />
        {party && <Switch label={t("events.ndc-members-only")} checked={f.members_only} onChange={(v: boolean) => set("members_only", v)} />}
      </fieldset>
      <fieldset>
        <legend>{t("events.cover-image-optional")}</legend>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={t("events.choose-a-cover-image")} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        {errors.image && <p className="ds-field__error" role="alert">{errors.image}</p>}
        {image && <Checkbox label={t("events.we-took-this-photo-or-have")} checked={rights} onChange={(e) => setRights(e.target.checked)}
          error={errors.rights} />}
      </fieldset>
      <div className="ev-actions">
        <UploadProgress progress={progress} />
        <Button type="submit" loading={busy}>{editing ? t("events.save") : t("events.save-draft")}</Button>
        <Button variant="secondary" onClick={onCancel}>{t("events.cancel")}</Button>
      </div>
    </form>
  );
}

const STATUS_WORDS: Record<string, string> = { get draft() { return t("events.draft"); }, get published() { return t("events.published"); }, get hidden() { return t("events.hidden-while-moderators-decide"); },
  get cancelled() { return t("events.cancelled"); }, get removed() { return t("events.removed-by-moderators"); } };

/** Publish / cancel / close / update / check-in for one event (spec 18 §6.4, §7). */
export function EventDashboard({ base, e, onChange, onEdit }: { base: string; e: OrganiserEvent; onChange: (e: OrganiserEvent | null) => void;
  onEdit: () => void }) {
  const api = useApi();
  const toast = useToast();
  const [modal, setModal] = useState<"" | "publish" | "cancel" | "update">("");
  const [decl, setDecl] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [checkin, setCheckin] = useState<{ counts: OrganiserEvent["counts"]; results: { ticket_code: string; name: string; checked_in: boolean }[] } | null>(null);
  const [code, setCode] = useState("");
  const act = async (label: string, path: string, body: Record<string, unknown>, done: string) => {
    setBusy(label);
    try {
      onChange(await api<OrganiserEvent>(`${base}${e.id}/${path}/`, { method: "POST", body }));
      toast.show({ tone: "success", message: done });
      setModal("");
      setText("");
    } catch (err) {
      toast.show({ tone: "error", message: refusal(err) });
    } finally {
      setBusy("");
    }
  };
  const openCheckin = async () => {
    try {
      setCheckin(await api(`${base}${e.id}/checkin/`));
    } catch (err) {
      toast.show({ tone: "error", message: refusal(err) });
    }
  };
  const doCheckin = async (c: string) => {
    try {
      const r = await api<{ ticket_code: string; name: string; checked_in: boolean }>(`${base}${e.id}/checkin/`, { method: "POST", body: { code: c } });
      setCheckin((x) => x && { ...x, results: x.results.map((y) => (y.ticket_code === r.ticket_code ? r : y)) });
      toast.show({ tone: "success", message: t("events.checked-in", { name: r.name }) });
      setCode("");
    } catch (err) {
      toast.show({ tone: "error", message: refusal(err) });
    }
  };
  const del = async () => {
    if (!window.confirm(t("events.delete-this-draft"))) return;
    try {
      await api(`${base}${e.id}/`, { method: "DELETE" });
      onChange(null);
    } catch (err) {
      toast.show({ tone: "error", message: refusal(err) });
    }
  };
  const needed = e.declarations_needed;
  return (
    <section className="ev-box" aria-label={t("events.event", { title: e.title })}>
      <h3 className="ev-card__title">{e.title}</h3>
      <p className="ev-meta"><span className="ev-chip">{STATUS_WORDS[e.status] ?? e.status}</span>
        {formatDate(e.starts_at, { withTime: true })} · {e.place}</p>
      {e.blackout_flagged && <Banner tone="warning">{t("events.a-campaign-blackout-window-now-covers")}</Banner>}
      <div className="ev-counts" aria-label={t("events.counts")}>
        <div className="ev-count">{t.rich("events.registered", { registered: e.counts.registered, strong: (chunks) => <strong>{chunks}</strong> })}</div>
        <div className="ev-count">{t.rich("events.waitlist", { waitlisted: e.counts.waitlisted, strong: (chunks) => <strong>{chunks}</strong> })}</div>
        <div className="ev-count">{t.rich("events.checked-in-2", { checked_in: e.counts.checked_in, strong: (chunks) => <strong>{chunks}</strong> })}</div>
      </div>
      <div className="ev-actions">
        {(e.status === "draft" || e.status === "published") && <Button size="sm" variant="secondary" onClick={onEdit}>{t("events.edit")}</Button>}
        {e.status === "draft" && <Button size="sm" onClick={() => setModal("publish")}>{t("events.publish")}</Button>}
        {e.status === "draft" && <Button size="sm" variant="ghost" onClick={() => void del()}>{t("events.delete-draft")}</Button>}
        {e.status === "published" && e.registration === "open" && <Button size="sm" variant="ghost" loading={busy === "close"}
          onClick={() => void act("close", "close-registration", {}, t("events.registration-closed"))}>{t("events.close-registration")}</Button>}
        {e.status === "published" && <Button size="sm" variant="ghost" onClick={() => setModal("update")}>{t("events.send-update")}</Button>}
        {e.status === "published" && <Button size="sm" variant="ghost" onClick={() => setModal("cancel")}>{t("events.cancel-event")}</Button>}
        {e.checkin_open && <Button size="sm" variant="secondary" onClick={() => void openCheckin()}>{t("events.check-in")}</Button>}
      </div>
      {checkin && (
        <div className="ev-form" aria-label={t("events.check-in")}>
          <form className="ev-actions" onSubmit={(ev) => { ev.preventDefault(); void doCheckin(code); }}>
            <TextField label={t("events.ticket-code")} value={code} maxLength={6} onChange={(ev) => setCode(ev.target.value.toUpperCase())} />
            <Button type="submit" disabled={code.length < 6}>{t("events.check-in-2")}</Button>
          </form>
          <ul className="ev-checkin">
            {checkin.results.map((r) => (
              <li key={r.ticket_code}><span><strong>{r.ticket_code}</strong> · {r.name}</span>
                {r.checked_in ? <span className="ev-chip">{t("events.checked-in-3")}</span> :
                  <Button size="sm" variant="secondary" onClick={() => void doCheckin(r.ticket_code)} aria-label={t("events.check-in-3", { ticket_code: r.ticket_code })}>{t("events.check-in-2")}</Button>}</li>
            ))}
          </ul>
          <p className="ds-field__hint">{t("events.open-from-24-hours-before-to")}</p>
        </div>
      )}
      <Modal open={modal === "publish"} onClose={() => setModal("")} title={t("events.publish-this-event")}
        footer={<><Button variant="secondary" onClick={() => setModal("")}>{t("events.go-back")}</Button>
          <Button disabled={needed.some((k) => !decl[k])} loading={busy === "publish"}
            onClick={() => void act("publish", "publish", { declarations: decl }, t("events.published-2"))}>{t("events.publish")}</Button></>}>
        <p>{t("events.confirm-each-of-these-they-re")}</p>
        {needed.map((k) => <Checkbox key={k} label={DECLARATION_WORDS[k] ?? k} checked={Boolean(decl[k])}
          onChange={(ev) => setDecl({ ...decl, [k]: ev.target.checked })} />)}
      </Modal>
      <Modal open={modal === "cancel"} onClose={() => setModal("")} title={t("events.cancel-this-event")}
        footer={<><Button variant="secondary" onClick={() => setModal("")}>{t("events.go-back")}</Button>
          <Button variant="danger" disabled={text.trim().length < 10} loading={busy === "cancel"}
            onClick={() => void act("cancel", "cancel", { reason: text }, t("events.cancelled-everyone-registered-is-told"))}>{t("events.cancel-event")}</Button></>}>
        <TextArea label={t("events.reason-registrants-see-it")} rows={3} maxLength={300} value={text} onChange={(ev) => setText(ev.target.value)} />
      </Modal>
      <Modal open={modal === "update"} onClose={() => setModal("")} title={t("events.send-an-update-to-registrants")}
        footer={<><Button variant="secondary" onClick={() => setModal("")}>{t("events.go-back")}</Button>
          <Button disabled={text.trim().length < 10} loading={busy === "update"}
            onClick={() => void act("update", "updates", { text }, t("events.update-sent"))}>{t("events.send")}</Button></>}>
        <TextArea label={t("events.update")} rows={3} maxLength={500} value={text} onChange={(ev) => setText(ev.target.value)} hint={t("events.up-to-3-per-event")} />
      </Modal>
    </section>
  );
}
