/** /settings/privacy (spec 20 §8): what's public now, what's always private, consents, and Your data. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Banner, Button, RadioGroup, Skeleton, useToast } from "../../components/ui";
import { ConsentsSection } from "../../pages/privacy/YourDataPage";
import type { MyPrivacy } from "../../privacy/types";
import { usePreferences } from "../PreferencesProvider";
import { Loading, SectionShell, useSettingsData } from "../SettingsLayout";

const ALWAYS_PRIVATE: [string, string][] = [
  ["Who you follow and your bells", "Following a candidate says something about your politics."],
  ["Your communities", "Which communities you’re in shows where you live and vote."],
  ["Your events and volunteering", "Only you and the organiser see your registrations; campaigns see applications you sent them."],
  ["Your membership details", "The party keeps its register; nobody else sees it."],
  ["Your PVC check", "Only the Verified voter badge, and only if you turn it on."],
  ["Your donations and contact details", "Donations show your name only if you choose it on that donation."],
  ["Your home state and LGA", "Private unless you show them on your public profile."],
];

export default function PrivacySection() {
  const api = useApi();
  const toast = useToast();
  const { settings, settingsError, loadSettings } = useSettingsData();
  const { patchSettings } = usePreferences();
  const [mine, setMine] = useState<MyPrivacy | null>(null);
  const [mineError, setMineError] = useState(false);
  const [busy, setBusy] = useState(false);
  const loadMine = useCallback(() => {
    api<MyPrivacy>("/me/privacy/").then((d) => { setMine(d); setMineError(false); }).catch(() => setMineError(true));
  }, [api]);
  useEffect(loadMine, [loadMine]);

  const pv = settings?.privacy;
  const setDonationName = async (v: string) => {
    if (!settings || !pv) return;
    setBusy(true);
    patchSettings({ privacy: { ...pv, donation_name_default: v as typeof pv.donation_name_default } });  // shown at once
    try {
      const r = await api<Schema<"SettingsPrivacy">>("/me/settings/privacy/", { method: "PATCH", body: { donation_name_default: v } });
      patchSettings({ privacy: r });
      toast.show({ tone: "success", message: "Default saved. You still choose on each donation." });
    } catch (err) {
      patchSettings({ privacy: pv });
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save that. Try again." });
    } finally {
      setBusy(false);
    }
  };
  const examples = settings?.profile.name_examples;
  const nameNow = examples ? (pv?.name_style === "full" ? examples.full : examples.first_initial) : "";

  return (
    <SectionShell title="Privacy" intro="What anyone can see about you, what never is, and the consents you’ve given.">
      {!pv ? (
        <Loading error={settingsError} retry={() => void loadSettings()} />
      ) : (
        <div className="set-card">
          <h3>What is public about you now</h3>
          <dl className="set-facts">
            <div><dt>Public profile</dt><dd>{pv.public_profile ? "On" : "Off"} · <Link to="/settings/profile">Change</Link></dd></div>
            <div><dt>Verified voter badge</dt><dd>{pv.verified_badge ? "On" : "Off"} · <Link to="/pvc">Change</Link></dd></div>
            <div>
              <dt>Name on news you submit</dt>
              <dd>{pv.named_news > 0 ? `Your name, on ${pv.named_news} ${pv.named_news === 1 ? "story" : "stories"}` : "“A member”"} · <Link to="/news/mine">Change per story</Link></dd>
            </div>
            <div><dt>Name style</dt><dd>{nameNow || "—"} · <Link to="/settings/profile">Change</Link></dd></div>
          </dl>
          <RadioGroup legend="Default name on donations" name="donation_name_default" value={pv.donation_name_default}
            hint="Only pre-selects the choice on the donation form. You still choose on each donation."
            onChange={(v) => !busy && void setDonationName(v)}
            options={[{ value: "anonymous", label: "Anonymous" }, { value: "name", label: `My public name${nameNow ? ` (${nameNow})` : ""}` }]} />
        </div>
      )}
      <div className="set-card">
        <h3>Always private</h3>
        <ul className="set-private">
          {ALWAYS_PRIVATE.map(([what, why]) => (
            <li key={what}><strong>{what}</strong><span className="set-meta">{why}</span></li>
          ))}
        </ul>
      </div>
      {mineError && (
        <Banner tone="error" title="We couldn’t load your consents" action={<Button size="sm" variant="secondary" onClick={loadMine}>Try again</Button>}>
          Check your connection.
        </Banner>
      )}
      {!mine && !mineError && <Skeleton width="100%" height={160} />}
      {mine && <div className="set-embed"><ConsentsSection consents={mine.consents} onChanged={() => { loadMine(); void loadSettings(); }} /></div>}
      <div className="set-card">
        <h3>Your data</h3>
        <p>Download everything NDCConnect keeps about you, make a privacy request, or see your history.</p>
        <Link to="/settings/privacy/data">Open Your data</Link>
      </div>
    </SectionShell>
  );
}
