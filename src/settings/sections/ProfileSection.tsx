/** /settings/profile — public profile and public name style (spec 20 §5). */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError, CONSENT_DECLINED } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { useUser } from "@clerk/react";
import { Avatar, Banner, Button, Modal, RadioGroup, Select, Switch, TextArea, useToast } from "../../components/ui";
import { geoApi, useGeoList } from "../../geo/useGeo";
import type { GeoLga } from "../../geo/types";
import { stateLabel } from "../../lib/nigeria";
import { usePreferences } from "../PreferencesProvider";
import { Loading, SectionShell, useSettingsData } from "../SettingsLayout";
import { getLanguage, t } from "../../i18n";
import { defaultWritingLanguage, WrittenIn } from "../../i18n/ContentLanguage";

type Profile = Schema<"SettingsProfile">;
const BIO_MAX = 300;

export function ProfileConsentDialog({ open, consent, busy, onAgree, onClose }: { open: boolean; consent: Profile["consent"]; busy: boolean;
  onAgree: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={consent.label || t("settings.show-a-public-profile")}
      footer={
        <div className="set-actions">
          <Button onClick={onAgree} loading={busy} loadingLabel={t("settings.turning-on")}>{t("settings.i-agree-turn-it-on")}</Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("settings.not-now")}</Button>
        </div>
      }>
      <p>{consent.text}</p>
      <p className="set-meta">{t("settings.consent-version-you-can-turn-the", { version: consent.version })}</p>
    </Modal>
  );
}

function Preview({ p, name }: { p: Profile; name: string }) {
  const { user } = useUser();
  const { me } = useMe();
  const shown = p.name_style === "full" ? p.name_examples.full : p.name_examples.first_initial;
  const where = p.profile_location === "state" && me?.home_state ? stateLabel(me.home_state)
    : p.profile_location === "lga" && p.profile_lga && me?.home_state ? `${p.profile_lga.name}, ${stateLabel(me.home_state)}` : "";
  return (
    <div className="set-card set-preview" aria-label={t("settings.preview-of-your-public-profile")}>
      <p className="set-meta">{t("settings.preview-what-anyone-with-the-link")}</p>
      <div className="set-preview__head">
        {p.profile_photo && !p.photo_removed && user?.hasImage ? <Avatar name={name} src={user.imageUrl} size="lg" /> : <Avatar name={shown || name} size="lg" />}
        <div>
          <strong>{shown || t("settings.a-member-2")}</strong>
          {where && <p className="set-meta">{where}</p>}
        </div>
      </div>
      {p.bio && !p.bio_removed && <p className="set-preview__bio">{p.bio}</p>}
      <p className="set-meta">{t("settings.never-shown-who-you-follow-your")}</p>
    </div>
  );
}

export default function ProfileSection() {
  const api = useApi();
  const toast = useToast();
  const { me } = useMe();
  const { settings, settingsError, loadSettings } = useSettingsData();
  const { patchSettings } = usePreferences();
  const p = settings?.profile;
  const [bio, setBio] = useState("");
  const [bioLanguage, setBioLanguage] = useState<string>(defaultWritingLanguage(getLanguage()));
  const [bioError, setBioError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const homeState = me?.home_state ?? "";
  const lgas = useGeoList<GeoLga>(homeState ? (a) => geoApi.lgas(a, homeState) : null, `lgas:${homeState}`);  // cached; ready when "State and LGA" is picked

  useEffect(() => {
    if (p) setBio(p.bio);
    if (p?.bio_language && p.bio_language !== "und") setBioLanguage(p.bio_language);
  }, [p?.bio]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <SectionShell title={t("settings.profile")}>
        <Loading error={settingsError} retry={() => void loadSettings()} />
      </SectionShell>
    );
  }

  /** Switches and radios show the new choice at once and go back if the save fails. */
  const save = async (body: Record<string, unknown>, what: string, done = "Saved.", optimistic?: Partial<Profile>) => {
    setBusy(what);
    if (optimistic) patchSettings({ profile: { ...p, ...optimistic } });
    try {
      const r = await api<Profile>("/me/settings/profile/", { method: "PATCH", body });
      patchSettings({ profile: r });
      toast.show({ tone: "success", message: done });
      return true;
    } catch (err) {
      if (optimistic) patchSettings({ profile: p });
      const msg = err instanceof ApiError ? err.message : "Couldn’t save. Try again.";
      if (what === "bio") setBioError(msg);
      else toast.show({ tone: "error", message: msg });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const turnOn = async () => {
    setBusy("public");
    try {
      const r = await api<Profile>("/me/settings/public-profile/", { method: "POST", body: { consent: true, version: p.consent.version } });
      patchSettings({ profile: r, privacy: settings ? { ...settings.privacy, public_profile: true } : undefined } as never);
      setAsking(false);
      toast.show({ tone: "success", message: t("settings.your-public-profile-is-on") });
    } catch (err) {
      if (!(err instanceof ApiError && err.code === CONSENT_DECLINED)) {
        toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-turn-it-on-try") });
      }
    } finally {
      setBusy(null);
    }
  };
  const turnOff = async () => {
    setBusy("public");
    try {
      const r = await api<Profile>("/me/settings/public-profile/", { method: "DELETE" });
      patchSettings({ profile: r, privacy: settings ? { ...settings.privacy, public_profile: false } : undefined } as never);
      toast.show({ tone: "success", message: t("settings.your-public-profile-is-off-the") });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-turn-it-off-try") });
    } finally {
      setBusy(null);
    }
  };

  const bioLeft = BIO_MAX - bio.length;
  const name = me?.full_name ?? "";
  return (
    <SectionShell title={t("settings.profile")} intro={t("settings.a-public-profile-is-off-unless")}>
      <div className="set-card">
        <Switch label={t("settings.public-profile")} checked={p.public_profile} disabled={busy === "public"}
          onChange={(on) => (on ? setAsking(true) : void turnOff())}
          hint={p.public_profile && p.handle ? <>{t.rich("settings.live-at-people-linked-only-from", { handle: p.handle, link: (chunks) => <Link to={`/people/${p.handle}`}>{chunks}</Link> })}</> : t("settings.off-nobody-can-see-a-profile")} />
      </div>
      <ProfileConsentDialog open={asking} consent={p.consent} busy={busy === "public"} onAgree={() => void turnOn()} onClose={() => setAsking(false)} />

      <div className="set-card">
        <RadioGroup legend={t("settings.public-name")} name="name_style" value={p.name_style}
          hint={t("settings.used-on-news-you-publish-under")}
          onChange={(v) => void save({ name_style: v }, "name", t("settings.public-name-updated"), { name_style: v as Profile["name_style"] })}
          options={[
            { value: "first_initial", label: t("settings.first-name-and-last-initial", { v: p.name_examples.first_initial || t("settings.ada-o") }) },
            { value: "full", label: t("settings.full-name", { v: p.name_examples.full || t("settings.ada-obi") }) },
          ]} />
      </div>

      <div className="set-card">
        <TextArea label={t("settings.bio")} value={bio} maxLength={BIO_MAX} rows={3}
          onChange={(e) => { setBio(e.target.value); setBioError(""); }}
          hint={t("settings.characters-left-plain-text-links-aren", { bioLeft })} error={bioError || undefined} />
        <WrittenIn value={bioLanguage} onChange={setBioLanguage} />
        {p.bio_removed && <Banner tone="warning">{t("settings.a-moderator-removed-your-bio-from")}</Banner>}
        <Button onClick={() => void save({ bio, bio_language: bioLanguage }, "bio", t("settings.bio-saved"))} loading={busy === "bio"} loadingLabel={t("settings.saving")} disabled={bio === p.bio && bioLanguage === p.bio_language}>
          {t("settings.save-bio")}</Button>
      </div>

      <div className="set-card">
        <RadioGroup legend={t("settings.location-shown")} name="profile_location" value={p.profile_location}
          hint={homeState ? t("settings.never-your-ward-or-polling-unit") : t("settings.set-your-home-state-in-my")}
          onChange={(v) => {
            if (v === "lga") patchSettings({ profile: { ...p, profile_location: "lga" } } as never);
            else void save({ profile_location: v }, "location", t("settings.location-updated"), { profile_location: v as Profile["profile_location"], profile_lga: null });
          }}
          options={[
            { value: "none", label: t("settings.nothing") },
            { value: "state", label: homeState ? t("settings.state", { stateLabel: stateLabel(homeState) }) : t("settings.state-2") },
            { value: "lga", label: t("settings.state-and-lga") },
          ]} />
        {p.profile_location === "lga" && homeState && (
          <Select label="LGA" value={p.profile_lga ? String(p.profile_lga.id) : ""} disabled={busy === "location" || lgas.loading}
            onChange={(e) => e.target.value && void save({ profile_location: "lga", profile_lga: Number(e.target.value) }, "location", t("settings.location-updated"))}
            options={[{ value: "", label: lgas.loading ? t("settings.loading") : t("settings.choose-your-lga") },
              ...lgas.data.filter((l) => l.active).map((l) => ({ value: String(l.id), label: l.name }))]} />
        )}
      </div>

      <div className="set-card">
        <Switch label={t("settings.show-my-photo")} checked={p.profile_photo} disabled={busy === "photo"}
          onChange={(on) => void save({ profile_photo: on }, "photo", on ? t("settings.your-photo-shows-on-your-profile") : t("settings.photo-hidden"), { profile_photo: on })}
          hint={t("settings.your-sign-in-photo-changed-in")} />
        {p.photo_removed && <Banner tone="warning">{t("settings.a-moderator-removed-your-photo-from")}</Banner>}
      </div>

      <Preview p={p} name={name} />
    </SectionShell>
  );
}
