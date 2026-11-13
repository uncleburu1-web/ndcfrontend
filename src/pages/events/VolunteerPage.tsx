/** /candidates/:slug/volunteer — spec 18 §9.2: apply to volunteer (consent `volunteering` through the API client). */
import { useAuth } from "@clerk/react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { LgaPicker } from "../../geo/GeoPicker";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, Checkbox, EmptyState, Select, Skeleton, Switch, TextArea, useToast } from "../../components/ui";
import { STATES } from "../../lib/nigeria";
import type { VolunteerOpening } from "../../events/types";
import "../../events/events.css";
import { t } from "../../i18n";

export default function VolunteerPage() {
  const { slug = "" } = useParams();
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const res = useRequest(`volunteering:${slug}`, (signal) => api<VolunteerOpening>(`/candidates/${slug}/volunteering/`, { signal }));
  const [roles, setRoles] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [lga, setLga] = useState<number | null>(null);
  const [availability, setAvailability] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [sharePhone, setSharePhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const o = res.data;
  useEffect(() => { document.title = o ? t("events.volunteer-for-ndcconnect", { String: String(o.candidate.full_name) }) : t("events.volunteer-ndcconnect"); }, [o]);
  const toggle = (list: string[], v: string, set: (x: string[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api(`/candidates/${slug}/volunteering/apply/`, { method: "POST",
        body: { roles, state, geo_lga: lga, availability, note, share_phone: sharePhone } });
      toast.show({ tone: "success", message: t("events.thanks-the-campaign-will-look-at") });
      navigate("/account/volunteering");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        if (!Object.keys(err.fields ?? {}).length) toast.show({ tone: "error", message: err.message });
      }
    } finally {
      setBusy(false);
    }
  };
  if (res.error) return <div className="ev-page ev-narrow"><EmptyState title={t("events.not-found")} action={<Button href="/candidates">{t("events.candidates")}</Button>} /></div>;
  if (!o) return <div className="ev-page ev-narrow"><Skeleton width="100%" height={240} /></div>;
  const states = o.states.length ? STATES.filter((s) => o.states.includes(s.value)) : STATES;
  return (
    <div className="ev-page ev-narrow">
      <header>
        <p className="article-back"><Link to={`/candidates/${slug}`}>← {String(o.candidate.full_name)}</Link></p>
        <h1>{t("events.volunteer-for", { String: String(o.candidate.full_name) })}</h1>
      </header>
      {!o.open ? <EmptyState title={t("events.this-campaign-isn-t-taking-volunteers")} /> : !isSignedIn ? (
        <Banner tone="info" title={t("events.sign-in-to-volunteer")} action={<Button size="sm" href={`/sign-in?redirect_url=${encodeURIComponent(`/candidates/${slug}/volunteer`)}`}>{t("events.sign-in")}</Button>}>
          {o.intro}
        </Banner>
      ) : (
        <form className="ev-form" onSubmit={(ev) => void submit(ev)} noValidate>
          <p>{o.intro}</p>
          <fieldset>
            <legend>{t("events.how-you-can-help")}</legend>
            {o.roles.map((r) => <Checkbox key={String(r.value)} label={String(r.label)} checked={roles.includes(String(r.value))}
              onChange={() => toggle(roles, String(r.value), setRoles)} />)}
            {errors.roles && <Banner tone="error">{errors.roles[0]}</Banner>}
          </fieldset>
          <div className="ev-row">
            <Select label={t("events.state")} required value={state} onChange={(e) => { setState(e.target.value); setLga(null); }} placeholder={t("events.choose-a-state")} options={states}
              error={errors.state?.[0]} />
            <LgaPicker state={state} value={lga} label={t("events.lga-optional")} error={errors.geo_lga?.[0]} onChange={(id) => setLga(id)} />
          </div>
          <fieldset>
            <legend>{t("events.when-you-re-free-optional")}</legend>
            {o.availability.map((a) => <Checkbox key={String(a.value)} label={String(a.label)} checked={availability.includes(String(a.value))}
              onChange={() => toggle(availability, String(a.value), setAvailability)} />)}
          </fieldset>
          <TextArea label={t("events.anything-the-campaign-should-know-optional")} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
            hint={`${note.length} / 300`} error={errors.note?.[0]} />
          <Switch label={t("events.share-my-phone-number-with-the")} checked={sharePhone} onChange={setSharePhone}
            hint={t("events.off-by-default-they-never-see")} />
          <p className="ds-field__hint">{t("events.the-campaign-sees-your-first-name", { v: sharePhone ? t("events.and-phone-number") : "" })}</p>
          <div><Button type="submit" loading={busy} disabled={!roles.length || !state}>{t("events.send-application")}</Button></div>
        </form>
      )}
    </div>
  );
}
