/** Spec 20 §12: while an account is paused, signed-in pages show only this (Reactivate, Download your data, Delete). */
import { useClerk } from "@clerk/react";
import { useEffect, useState } from "react";
import { ApiError } from "../auth/api";
import { useApi, useMe } from "../auth/session";
import { Banner, Button, EmptyState } from "../components/ui";
import { DeleteSection, DownloadSection } from "../pages/privacy/YourDataPage";
import "./settings.css";

export default function AccountPausedPage() {
  const api = useApi();
  const { refresh } = useMe();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = "Your account is paused | NDCConnect";
  }, []);
  const reactivate = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/me/reactivate/", { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn’t reactivate your account. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="set-paused">
      <EmptyState icon="info" title="Your account is paused"
        action={
          <div className="set-actions">
            <Button onClick={() => void reactivate()} loading={busy} loadingLabel="Reactivating…">Reactivate my account</Button>
            <Button variant="ghost" onClick={() => void signOut({ redirectUrl: "/" })}>Sign out</Button>
          </div>
        }>
        Nothing new is delivered while it’s paused, and your public profile is hidden. Reactivate to use NDCConnect again.
      </EmptyState>
      {error && <Banner tone="error">{error}</Banner>}
      <DownloadSection onDone={() => undefined} />
      <DeleteSection data={null} />
    </div>
  );
}
