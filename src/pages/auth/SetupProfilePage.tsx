import { Navigate, useLocation } from "react-router-dom";
import { ProfileForm } from "../../auth/ProfileForm";
import { useMe } from "../../auth/session";
import { Banner, Button, Skeleton } from "../../components/ui";
import "./auth.css";

/** /setup-profile — full name + phone after sign-up (spec §7.3, AC 1–2). */
export default function SetupProfilePage() {
  const { me, status, error, refresh } = useMe();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";

  if (status === "error") {
    return (
      <section className="auth-page">
        <Banner tone="error" title="We couldn't load your profile" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
          {error?.message}
        </Banner>
      </section>
    );
  }
  if (!me) {
    return (
      <section className="auth-page" aria-busy="true">
        <span className="visually-hidden">Loading your profile</span>
        <Skeleton width="60%" height={32} />
        <Skeleton width="80%" />
      </section>
    );
  }
  if (me.profile_complete) return <Navigate to={from} replace />;

  return (
    <section className="auth-page">
      <h1>Finish setting up your profile</h1>
      <p className="auth-page__lead">Two details and you’re in. You can change them later in your account.</p>
      {/* On success /me says profile_complete, and the <Navigate> above takes the user on. */}
      <ProfileForm submitLabel="Finish setup" busyLabel="Saving…" />
    </section>
  );
}
