import { UserProfile } from "@clerk/react";
import { Link } from "react-router-dom";
import { ProfileForm } from "../../auth/ProfileForm";
import { useMe } from "../../auth/session";
import { StatusBadge } from "../../components/ui";
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
        </div>
        <div className="account-page__clerk">
          <h2>Sign-in and security</h2>
          <UserProfile path="/account" routing="path" />
        </div>
      </div>
    </section>
  );
}
