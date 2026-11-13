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
import { t, lazy } from "../../i18n";

const ALWAYS_PRIVATE: [string, string][] = lazy(() => [
  [t("settings.who-you-follow-and-your-bells"), t("settings.following-a-candidate-says-something-about")],
  [t("settings.your-communities"), t("settings.which-communities-you-re-in-shows")],
  [t("settings.your-events-and-volunteering"), t("settings.only-you-and-the-organiser-see")],
  [t("settings.your-membership-details"), t("settings.the-party-keeps-its-register-nobody")],
  [t("settings.your-pvc-check"), t("settings.only-the-verified-voter-badge-and")],
  [t("settings.your-donations-and-contact-details"), t("settings.donations-show-your-name-only-if")],
  [t("settings.your-home-state-and-lga"), t("settings.private-unless-you-show-them-on")],
]);

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
      toast.show({ tone: "success", message: t("settings.default-saved-you-still-choose-on") });
    } catch (err) {
      patchSettings({ privacy: pv });
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-save-that-try-again") });
    } finally {
      setBusy(false);
    }
  };
  const examples = settings?.profile.name_examples;
  const nameNow = examples ? (pv?.name_style === "full" ? examples.full : examples.first_initial) : "";

  return (
    <SectionShell title={t("settings.privacy")} intro={t("settings.what-anyone-can-see-about-you")}>
      {!pv ? (
        <Loading error={settingsError} retry={() => void loadSettings()} />
      ) : (
        <div className="set-card">
          <h3>{t("settings.what-is-public-about-you-now")}</h3>
          <dl className="set-facts">
            <div><dt>{t("settings.public-profile")}</dt><dd>{pv.public_profile ? t("settings.on-2") : t("settings.off-2")} · <Link to="/settings/profile">{t("settings.change")}</Link></dd></div>
            <div><dt>{t("settings.verified-voter-badge")}</dt><dd>{pv.verified_badge ? t("settings.on-2") : t("settings.off-2")} · <Link to="/pvc">{t("settings.change")}</Link></dd></div>
            <div>
              <dt>{t("settings.name-on-news-you-submit")}</dt>
              <dd>{pv.named_news > 0 ? `Your name, on ${pv.named_news} ${pv.named_news === 1 ? "story" : "stories"}` : t("settings.a-member")} · <Link to="/news/mine">{t("settings.change-per-story")}</Link></dd>
            </div>
            <div><dt>{t("settings.name-style")}</dt><dd>{nameNow || "—"} · <Link to="/settings/profile">{t("settings.change")}</Link></dd></div>
          </dl>
          <RadioGroup legend={t("settings.default-name-on-donations")} name="donation_name_default" value={pv.donation_name_default}
            hint={t("settings.only-pre-selects-the-choice-on")}
            onChange={(v) => !busy && void setDonationName(v)}
            options={[{ value: "anonymous", label: t("settings.anonymous") }, { value: "name", label: t("settings.my-public-name", { v: nameNow ? ` (${nameNow})` : "" }) }]} />
        </div>
      )}
      <div className="set-card">
        <h3>{t("settings.always-private")}</h3>
        <ul className="set-private">
          {ALWAYS_PRIVATE.map(([what, why]) => (
            <li key={what}><strong>{what}</strong><span className="set-meta">{why}</span></li>
          ))}
        </ul>
      </div>
      {mineError && (
        <Banner tone="error" title={t("settings.we-couldn-t-load-your-consents")} action={<Button size="sm" variant="secondary" onClick={loadMine}>{t("settings.try-again")}</Button>}>
          {t("settings.check-your-connection")}</Banner>
      )}
      {!mine && !mineError && <Skeleton width="100%" height={160} />}
      {mine && <div className="set-embed"><ConsentsSection consents={mine.consents} onChanged={() => { loadMine(); void loadSettings(); }} /></div>}
      <div className="set-card">
        <h3>{t("settings.your-data")}</h3>
        <p>{t("settings.download-everything-ndcconnect-keeps-about-you")}</p>
        <Link to="/settings/privacy/data">{t("settings.open-your-data")}</Link>
      </div>
    </SectionShell>
  );
}
