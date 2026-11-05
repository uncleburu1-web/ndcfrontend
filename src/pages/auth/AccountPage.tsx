import { UserProfile } from "@clerk/react";
import { Link } from "react-router-dom";
import { ProfileForm } from "../../auth/ProfileForm";
import { useState } from "react";
import { ApiError } from "../../auth/api";
import { useApi, useMe } from "../../auth/session";
import { Select, StatusBadge, useToast } from "../../components/ui";
import { STATES, stateLabel } from "../../lib/nigeria";
import { VerifiedVoterBadge } from "../../pvc/VerifiedVoterBadge";
import "./auth.css";

/**
 * /account/* — NDCConnect details (name, phone via /me) plus Clerk's own account
 * screen for email, password and sessions (spec §7.3).
 */
function VoterStatus() {
  const { me } = useMe();
  if (!me) return null;
  const st = me.pvc_status ?? "unverified";
  return (
    <div className="account-voter">
      <h2>Voter status</h2>
      <p>
        {st === "successful" ? <VerifiedVoterBadge /> : <StatusBadge set="pvc" status={st} />}{" "}
        <Link to="/pvc">{st === "successful" ? "View PVC details" : st === "pending" ? "See status" : "Verify your PVC"}</Link>
      </p>
      <p className="auth-page__lead">Only needed to join the NDC. Private unless you choose to show the badge.</p>
    </div>
  );
}

/** Spec 12 §4.5: optional, private; only pre-fills state filters. */
function HomeState() {
  const { me, setMe } = useMe();
  const api = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const change = async (value: string) => {
    setBusy(true);
    try {
      setMe(await api("/me/", { method: "PATCH", body: { home_state: value } }));
      toast.show({ tone: "success", message: value ? `Home state set to ${stateLabel(value)}.` : "Home state cleared." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save." });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="account-voter">
      <h2>Home state</h2>
      <Select label="Home state" value={me.home_state ?? ""} disabled={busy} onChange={(e) => void change(e.target.value)}
        hint="Used to show your state first. Only you can see it." options={[{ value: "", label: "Not set" }, ...STATES]} />
    </div>
  );
}

export default function AccountPage() {
  return (
    <section className="account-page">
      <h1>Your account</h1>
      <div className="account-page__grid">
        <div className="account-page__panel">
          <h2>NDCConnect details</h2>
          <p className="auth-page__lead">Only you and platform administrators can see these.</p>
          <ProfileForm submitLabel="Save changes" busyLabel="Saving…" successMessage="Changes saved." />
          <VoterStatus />
          <HomeState />
          <div className="account-voter">
            <h2>Events and volunteering</h2>
            <p><Link to="/account/events">My events</Link> · <Link to="/account/volunteering">My volunteering</Link></p>
          </div>
        </div>
        <div className="account-page__clerk">
          <h2>Sign-in and security</h2>
          <UserProfile path="/account" routing="path" />
        </div>
      </div>
    </section>
  );
}
