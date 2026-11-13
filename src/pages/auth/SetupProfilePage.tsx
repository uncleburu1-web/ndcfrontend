import { Navigate, useLocation } from "react-router-dom";
import { ProfileForm } from "../../auth/ProfileForm";
import { useMe } from "../../auth/session";
import { Banner, Button, Skeleton } from "../../components/ui";
import "./auth.css";
import { t } from "../../i18n";

/** /setup-profile — full name + phone after sign-up (spec §7.3, AC 1–2). */
export default function SetupProfilePage() {
  const { me, status, error, refresh } = useMe();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "/";

  if (status === "error") {
    return (
      <section className="auth-page">
        <Banner tone="error" title={t("auth.we-couldn-t-load-your-profile")} action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>{t("auth.try-again")}</Button>}>
          {error?.message}
        </Banner>
      </section>
    );
  }
  if (!me) {
    return (
      <section className="auth-page" aria-busy="true">
        <span className="visually-hidden">{t("auth.loading-your-profile")}</span>
        <Skeleton width="60%" height={32} />
        <Skeleton width="80%" />
      </section>
    );
  }
  if (me.profile_complete) return <Navigate to={from} replace />;

  return (
    <section className="auth-page">
      <h1>{t("auth.finish-setting-up-your-profile")}</h1>
      <p className="auth-page__lead">{t("auth.two-details-and-you-re-in")}</p>
      {/* On success /me says profile_complete, and the <Navigate> above takes the user on. */}
      <ProfileForm submitLabel={t("auth.finish-setup")} busyLabel="Saving…" />
    </section>
  );
}
