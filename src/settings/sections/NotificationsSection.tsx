/** /settings/notifications (spec 20 §7): switchable categories, essential ones locked, and a pause for every candidate bell. */
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Icon, Switch, useToast } from "../../components/ui";
import { usePreferences } from "../PreferencesProvider";
import { Loading, SectionShell, useSettingsData } from "../SettingsLayout";
import { t } from "../../i18n";

type Notifications = Schema<"SettingsNotifications">;

export default function NotificationsSection() {
  const api = useApi();
  const toast = useToast();
  const { settings, settingsError, loadSettings } = useSettingsData();
  const { patchSettings } = usePreferences();
  const [busy, setBusy] = useState<string | null>(null);
  const n = settings?.notifications;

  const save = async (key: string, on: boolean, words: string) => {
    setBusy(key);
    try {
      const r = await api<Notifications>("/me/settings/notifications/", { method: "PATCH", body: { [key]: on } });
      patchSettings({ notifications: r });
      toast.show({ tone: "success", message: words });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-save-that-try-again") });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionShell title={t("settings.notifications")}
      intro={t("settings.all-notices-appear-in-the-app")}>
      {!n ? (
        <Loading error={settingsError} retry={() => void loadSettings()} />
      ) : (
        <>
          <div className="set-card">
            <h3>{t("settings.candidates-you-follow")}</h3>
            <p className="set-meta">
              {t.rich("settings.following-a-candidate-shows-them-in", { link: (chunks) => <Link to="/following">{chunks}</Link> })}</p>
            <Switch label={t("settings.pause-all-candidate-bells")} checked={n.candidate_bells_paused} disabled={busy === "candidate_bells_paused"}
              onChange={(on) => void save("candidate_bells_paused", on, on ? t("settings.candidate-bells-paused-your-bells-stay") : t("settings.candidate-bells-back-on"))}
              hint={t("settings.stops-candidate-post-notices-without-changing")} />
          </div>
          <div className="set-card">
            <h3>{t("settings.you-choose")}</h3>
            <ul className="set-switches">
              {n.categories.filter((c) => !c.locked).map((c) => (
                <li key={c.key}>
                  <Switch label={c.label} checked={c.on} disabled={busy === c.key} hint={c.help || undefined}
                    onChange={(on) => void save(c.key, on, `${c.label}: ${on ? "on" : "off"}.`)} />
                </li>
              ))}
            </ul>
          </div>
          <div className="set-card">
            <h3>{t("settings.always-on")}</h3>
            <p className="set-meta">{t("settings.these-are-about-your-own-records")}</p>
            <ul className="set-locked">
              {n.categories.filter((c) => c.locked).map((c) => (
                <li key={c.key}>
                  <Icon name="lock" size={16} />
                  <div>
                    <strong>{c.label}</strong>
                    {c.reason && <p className="set-meta">{c.reason}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SectionShell>
  );
}
