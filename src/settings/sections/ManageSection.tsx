/** /settings/manage (spec 20 §12): pause or delete the account. Download first; both ask you to confirm it's you. */
import { useEffect, useState } from "react";
import type { Schema } from "../../api/typed";
import { ApiError, CANCELLED_REVERIFICATION } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Banner, Button, Modal, TextField } from "../../components/ui";
import { DeleteSection, DownloadSection } from "../../pages/privacy/YourDataPage";
import type { MyPrivacy } from "../../privacy/types";
import { SectionShell, useSettingsData } from "../SettingsLayout";
import { t, lazy } from "../../i18n";

const PAUSE_ROWS: [string, string][] = lazy(() => [
  [t("settings.signing-in"), t("settings.still-works-but-shows-only-your")],
  [t("settings.public-profile"), t("settings.hidden")],
  [t("settings.bylines"), t("settings.kept-as-they-are")],
  [t("settings.notifications"), t("settings.none-while-paused")],
  [t("settings.follows-bells-communities"), t("settings.kept-but-nothing-new-is-delivered")],
  [t("settings.future-event-registrations"), t("settings.cancelled-so-your-place-goes-to")],
  [t("settings.volunteer-applications-waiting-for-a-decision"), t("settings.withdrawn")],
  [t("settings.membership-and-pvc-check"), t("settings.unchanged-a-paused-member-stays-on")],
  [t("settings.donations"), t("settings.unchanged")],
  [t("settings.undo"), t("settings.reactivate-at-any-time-by-signing")],
]);

export function PauseDialog({ open, onClose, manage }: { open: boolean; onClose: () => void; manage: Schema<"SettingsManage"> | null }) {
  const api = useApi();
  const { refresh } = useMe();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pause = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/me/pause/", { method: "POST", body: { confirm: typed } });
      onClose();
      await refresh(); // /me now says "paused": the app shows only the paused screen
    } catch (err) {
      if (err instanceof ApiError && err.code === CANCELLED_REVERIFICATION) return;
      setError(err instanceof ApiError ? err.message : t("settings.couldn-t-pause-your-account-nothing"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("settings.pause-your-account")}
      footer={
        <div className="set-actions">
          <Button variant="danger" onClick={() => void pause()} loading={busy} loadingLabel={t("settings.pausing")} disabled={typed.trim().toLowerCase() !== "pause"}>
            {t("settings.pause-my-account")}</Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>{t("settings.cancel")}</Button>
        </div>
      }>
      {manage && (manage.upcoming_registrations > 0 || manage.pending_volunteer_applications > 0) && (
        <Banner tone="warning">
          {manage.upcoming_registrations > 0 && <>{t("settings.upcoming-event-other-will-be-cancelled", { upcoming_registrations: manage.upcoming_registrations })}</>}
          {manage.pending_volunteer_applications > 0 && <>{t("settings.volunteer-other-will-be-withdrawn", { pending_volunteer_applications: manage.pending_volunteer_applications })}</>}
        </Banner>
      )}
      <p>{t("settings.you-can-reactivate-at-any-time")}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <TextField label={t("settings.type-pause-to-confirm")} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
    </Modal>
  );
}

export default function ManageSection() {
  const api = useApi();
  const { settings } = useSettingsData();
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<MyPrivacy | null>(null);
  useEffect(() => {
    api<MyPrivacy>("/me/privacy/").then(setMine).catch(() => setMine(null));
  }, [api]);
  return (
    <SectionShell title={t("settings.account-management")} intro={t("settings.pausing-can-be-undone-deleting-can")}>
      <div className="set-card">
        <h3>{t("settings.pause-your-account-2")}</h3>
        <table className="set-table">
          <caption className="visually-hidden">{t("settings.what-pausing-does")}</caption>
          <tbody>
            {PAUSE_ROWS.map(([what, effect]) => (
              <tr key={what}><th scope="row">{what}</th><td>{effect}</td></tr>
            ))}
          </tbody>
        </table>
        <Button variant="secondary" onClick={() => setOpen(true)}>{t("settings.pause-my-account")}</Button>
      </div>
      <PauseDialog open={open} onClose={() => setOpen(false)} manage={settings?.manage ?? null} />
      <div className="set-embed">
        <p className="set-first">{t("settings.download-your-data-first")}</p>
        <DownloadSection onDone={() => undefined} />
        <DeleteSection data={mine} />
      </div>
    </SectionShell>
  );
}
