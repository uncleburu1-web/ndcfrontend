/** /settings/manage (spec 20 §12): pause or delete the account. Download first; both ask you to confirm it's you. */
import { useEffect, useState } from "react";
import type { Schema } from "../../api/typed";
import { ApiError, CANCELLED_REVERIFICATION } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Banner, Button, Modal, TextField } from "../../components/ui";
import { DeleteSection, DownloadSection } from "../../pages/privacy/YourDataPage";
import type { MyPrivacy } from "../../privacy/types";
import { SectionShell, useSettingsData } from "../SettingsLayout";

const PAUSE_ROWS: [string, string][] = [
  ["Signing in", "Still works, but shows only “Your account is paused” with Reactivate, Download your data and Delete."],
  ["Public profile", "Hidden."],
  ["Bylines", "Kept as they are."],
  ["Notifications", "None while paused."],
  ["Follows, bells, communities", "Kept, but nothing new is delivered."],
  ["Future event registrations", "Cancelled, so your place goes to someone else."],
  ["Volunteer applications waiting for a decision", "Withdrawn."],
  ["Membership and PVC check", "Unchanged. A paused member stays on the party register."],
  ["Donations", "Unchanged."],
  ["Undo", "Reactivate at any time by signing in."],
];

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
      setError(err instanceof ApiError ? err.message : "Couldn’t pause your account. Nothing changed. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Pause your account?"
      footer={
        <div className="set-actions">
          <Button variant="danger" onClick={() => void pause()} loading={busy} loadingLabel="Pausing…" disabled={typed.trim().toLowerCase() !== "pause"}>
            Pause my account
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        </div>
      }>
      {manage && (manage.upcoming_registrations > 0 || manage.pending_volunteer_applications > 0) && (
        <Banner tone="warning">
          {manage.upcoming_registrations > 0 && <>{manage.upcoming_registrations} upcoming event {manage.upcoming_registrations === 1 ? "registration" : "registrations"} will be cancelled. </>}
          {manage.pending_volunteer_applications > 0 && <>{manage.pending_volunteer_applications} volunteer {manage.pending_volunteer_applications === 1 ? "application" : "applications"} will be withdrawn.</>}
        </Banner>
      )}
      <p>You can reactivate at any time by signing in. You’ll be asked to confirm it’s you first.</p>
      {error && <Banner tone="error">{error}</Banner>}
      <TextField label='Type "pause" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
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
    <SectionShell title="Account management" intro="Pausing can be undone; deleting can’t.">
      <div className="set-card">
        <h3>Pause your account</h3>
        <table className="set-table">
          <caption className="visually-hidden">What pausing does</caption>
          <tbody>
            {PAUSE_ROWS.map(([what, effect]) => (
              <tr key={what}><th scope="row">{what}</th><td>{effect}</td></tr>
            ))}
          </tbody>
        </table>
        <Button variant="secondary" onClick={() => setOpen(true)}>Pause my account</Button>
      </div>
      <PauseDialog open={open} onClose={() => setOpen(false)} manage={settings?.manage ?? null} />
      <div className="set-embed">
        <p className="set-first">Download your data first</p>
        <DownloadSection onDone={() => undefined} />
        <DeleteSection data={mine} />
      </div>
    </SectionShell>
  );
}
