import { UserProfile } from "@clerk/react";
import { ProfileForm } from "../../auth/ProfileForm";
import "./auth.css";

/**
 * /account/* — NDCConnect details (name, phone via /me) plus Clerk's own account
 * screen for email, password and sessions (spec §7.3).
 */
export default function AccountPage() {
  return (
    <section className="account-page">
      <h1>Your account</h1>
      <div className="account-page__grid">
        <div className="account-page__panel">
          <h2>NDCConnect details</h2>
          <p className="auth-page__lead">Only you and platform administrators can see these.</p>
          <ProfileForm submitLabel="Save changes" busyLabel="Saving…" successMessage="Changes saved." />
        </div>
        <div className="account-page__clerk">
          <h2>Sign-in and security</h2>
          <UserProfile path="/account" routing="path" />
        </div>
      </div>
    </section>
  );
}
