/**
 * Route guards — spec §7.6. The backend enforces everything again; these only shape the UI.
 *
 * RequireProfileComplete is ONLY for features that need a real name and phone.
 * Never wrap candidate pages, following, notifications or donating with it,
 * and nothing here looks at PVC status.
 */
import { useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Banner, Button, Skeleton } from "../components/ui";
import { useMe } from "./session";

function Pending({ label }: { label: string }) {
  return (
    <div className="auth-pending" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <Skeleton width="40%" height={28} />
      <Skeleton width="70%" />
      <Skeleton width="55%" />
    </div>
  );
}

/** Signed-out users go to /sign-in and come back here afterwards. */
export function RequireSignedIn({ children }: { children?: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  if (!isLoaded) return <Pending label="Checking your session" />;
  if (!isSignedIn) {
    const back = location.pathname + location.search;
    return <Navigate to={`/sign-in?redirect_url=${encodeURIComponent(back)}`} replace />;
  }
  return children ? <>{children}</> : <Outlet />;
}

/** Sign-in / sign-up pages: signed-in users don't need them. */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Pending label="Checking your session" />;
  if (isSignedIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Incomplete profiles go to /setup-profile, then come back. Use only where §6.4 requires it. */
export function RequireProfileComplete({ children }: { children?: ReactNode }) {
  const { me, status, error, refresh } = useMe();
  const location = useLocation();

  if (status === "error") {
    return (
      <Banner tone="error" title="We couldn't load your profile" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
        {error?.message}
      </Banner>
    );
  }
  if (!me) return <Pending label="Loading your profile" />;
  if (!me.profile_complete) {
    return <Navigate to="/setup-profile" replace state={{ from: location.pathname + location.search }} />;
  }
  return children ? <>{children}</> : <Outlet />;
}
