/** /settings/notifications (spec 20 §7): switchable categories, essential ones locked, and a pause for every candidate bell. */
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Schema } from "../../api/typed";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { Icon, Switch, useToast } from "../../components/ui";
import { usePreferences } from "../PreferencesProvider";
import { Loading, SectionShell, useSettingsData } from "../SettingsLayout";

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
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save that. Try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <SectionShell title="Notifications"
      intro="All notices appear in the app under the bell. Turning a category off stops new notices of that kind; ones you already have stay until you read or delete them.">
      {!n ? (
        <Loading error={settingsError} retry={() => void loadSettings()} />
      ) : (
        <>
          <div className="set-card">
            <h3>Candidates you follow</h3>
            <p className="set-meta">
              Following a candidate shows them in your <Link to="/following">Following</Link> list. The bell beside each one decides whether you get
              their posts. Unfollowing turns the bell off; pausing all bells doesn’t unfollow anyone.
            </p>
            <Switch label="Pause all candidate bells" checked={n.candidate_bells_paused} disabled={busy === "candidate_bells_paused"}
              onChange={(on) => void save("candidate_bells_paused", on, on ? "Candidate bells paused. Your bells stay as they are." : "Candidate bells back on.")}
              hint="Stops candidate post notices without changing any bell." />
          </div>
          <div className="set-card">
            <h3>You choose</h3>
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
            <h3>Always on</h3>
            <p className="set-meta">These are about your own records, payments and safety, so they can’t be turned off.</p>
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
