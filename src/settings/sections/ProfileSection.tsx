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

type Profile = Schema<"SettingsProfile">;
const BIO_MAX = 300;

export function ProfileConsentDialog({ open, consent, busy, onAgree, onClose }: { open: boolean; consent: Profile["consent"]; busy: boolean;
  onAgree: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={consent.label || "Show a public profile"}
      footer={
        <div className="set-actions">
          <Button onClick={onAgree} loading={busy} loadingLabel="Turning on…">I agree, turn it on</Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Not now</Button>
        </div>
      }>
      <p>{consent.text}</p>
      <p className="set-meta">Consent version {consent.version}. You can turn the profile off, or withdraw this consent, at any time.</p>
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
    <div className="set-card set-preview" aria-label="Preview of your public profile">
      <p className="set-meta">Preview: what anyone with the link sees</p>
      <div className="set-preview__head">
        {p.profile_photo && !p.photo_removed && user?.hasImage ? <Avatar name={name} src={user.imageUrl} size="lg" /> : <Avatar name={shown || name} size="lg" />}
        <div>
          <strong>{shown || "A member"}</strong>
          {where && <p className="set-meta">{where}</p>}
        </div>
      </div>
      {p.bio && !p.bio_removed && <p className="set-preview__bio">{p.bio}</p>}
      <p className="set-meta">Never shown: who you follow, your communities, membership, PVC details, donations, or any counts about you.</p>
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
  const [bioError, setBioError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const homeState = me?.home_state ?? "";
  const lgas = useGeoList<GeoLga>(homeState ? (a) => geoApi.lgas(a, homeState) : null, `lgas:${homeState}`);  // cached; ready when "State and LGA" is picked

  useEffect(() => {
    if (p) setBio(p.bio);
  }, [p?.bio]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) {
    return (
      <SectionShell title="Profile">
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
      toast.show({ tone: "success", message: "Your public profile is on." });
    } catch (err) {
      if (!(err instanceof ApiError && err.code === CONSENT_DECLINED)) {
        toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t turn it on. Try again." });
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
      toast.show({ tone: "success", message: "Your public profile is off. The link stops working within 5 minutes." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t turn it off. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const bioLeft = BIO_MAX - bio.length;
  const name = me?.full_name ?? "";
  return (
    <SectionShell title="Profile" intro="A public profile is off unless you turn it on. Your public name is built from your account name.">
      <div className="set-card">
        <Switch label="Public profile" checked={p.public_profile} disabled={busy === "public"}
          onChange={(on) => (on ? setAsking(true) : void turnOff())}
          hint={p.public_profile && p.handle
            ? <>Live at <Link to={`/people/${p.handle}`}>/people/{p.handle}</Link>. Linked only from news you publish under your name; not listed or searchable.</>
            : "Off. Nobody can see a profile page for you."} />
      </div>
      <ProfileConsentDialog open={asking} consent={p.consent} busy={busy === "public"} onAgree={() => void turnOn()} onClose={() => setAsking(false)} />

      <div className="set-card">
        <RadioGroup legend="Public name" name="name_style" value={p.name_style}
          hint="Used on news you publish under your name, in communities and on your public profile."
          onChange={(v) => void save({ name_style: v }, "name", "Public name updated.", { name_style: v as Profile["name_style"] })}
          options={[
            { value: "first_initial", label: `First name and last initial: ${p.name_examples.first_initial || "Ada O."}` },
            { value: "full", label: `Full name: ${p.name_examples.full || "Ada Obi"}` },
          ]} />
      </div>

      <div className="set-card">
        <TextArea label="Bio" value={bio} maxLength={BIO_MAX} rows={3}
          onChange={(e) => { setBio(e.target.value); setBioError(""); }}
          hint={`${bioLeft} characters left. Plain text; links aren’t made clickable. Anyone can report it.`} error={bioError || undefined} />
        {p.bio_removed && <Banner tone="warning">A moderator removed your bio from your public profile. Writing a new one shows it again.</Banner>}
        <Button onClick={() => void save({ bio }, "bio", "Bio saved.")} loading={busy === "bio"} loadingLabel="Saving…" disabled={bio === p.bio}>
          Save bio
        </Button>
      </div>

      <div className="set-card">
        <RadioGroup legend="Location shown" name="profile_location" value={p.profile_location}
          hint={homeState ? "Never your ward or polling unit." : "Set your home state in My account to show a location."}
          onChange={(v) => {
            if (v === "lga") patchSettings({ profile: { ...p, profile_location: "lga" } } as never);
            else void save({ profile_location: v }, "location", "Location updated.", { profile_location: v as Profile["profile_location"], profile_lga: null });
          }}
          options={[
            { value: "none", label: "Nothing" },
            { value: "state", label: homeState ? `State: ${stateLabel(homeState)}` : "State" },
            { value: "lga", label: "State and LGA" },
          ]} />
        {p.profile_location === "lga" && homeState && (
          <Select label="LGA" value={p.profile_lga ? String(p.profile_lga.id) : ""} disabled={busy === "location" || lgas.loading}
            onChange={(e) => e.target.value && void save({ profile_location: "lga", profile_lga: Number(e.target.value) }, "location", "Location updated.")}
            options={[{ value: "", label: lgas.loading ? "Loading…" : "Choose your LGA" },
              ...lgas.data.filter((l) => l.active).map((l) => ({ value: String(l.id), label: l.name }))]} />
        )}
      </div>

      <div className="set-card">
        <Switch label="Show my photo" checked={p.profile_photo} disabled={busy === "photo"}
          onChange={(on) => void save({ profile_photo: on }, "photo", on ? "Your photo shows on your profile." : "Photo hidden.", { profile_photo: on })}
          hint="Your sign-in photo, changed in Security. Shown only on your public profile." />
        {p.photo_removed && <Banner tone="warning">A moderator removed your photo from your public profile. A new photo shows again.</Banner>}
      </div>

      <Preview p={p} name={name} />
    </SectionShell>
  );
}
