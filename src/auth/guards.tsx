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
import { Banner, Button, EmptyState, Skeleton } from "../components/ui";
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

/**
 * Admin pages (spec 03 §8.3). Uses /me's is_system_admin; the backend enforces
 * IsSystemAdmin on every admin endpoint regardless of what the UI shows.
 */
export function RequireSystemAdmin({ children }: { children?: ReactNode }) {
  const { me, status, error, refresh } = useMe();
  if (status === "error") {
    return (
      <Banner tone="error" title="We couldn't load your account" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
        {error?.message}
      </Banner>
    );
  }
  if (!me) return <Pending label="Loading your account" />;
  if (!me.is_system_admin) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="You don’t have access to this page">
          This area is for NDCConnect system administrators.
        </EmptyState>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
}

/** Donation records (spec 05 §7.2): system admins and finance officers. The backend enforces it too. */
export function isFinanceViewer(me: { is_system_admin: boolean; roles: { role: string }[] } | null) {
  return Boolean(me && (me.is_system_admin || me.roles.some((r) => r.role === "finance_officer")));
}

export function RequireFinanceViewer({ children }: { children?: ReactNode }) {
  const { me, status, error, refresh } = useMe();
  if (status === "error") {
    return (
      <Banner tone="error" title="We couldn't load your account" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
        {error?.message}
      </Banner>
    );
  }
  if (!me) return <Pending label="Loading your account" />;
  if (!isFinanceViewer(me)) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="You don’t have access to this page">
          Donation records are for NDCConnect administrators and party finance officers.
        </EmptyState>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
}

/** Membership + PVC admin (spec 06 §5.3): system admins and membership officers. The backend enforces it too. */
export function isMembershipOfficer(me: { is_system_admin: boolean; roles: { role: string }[] } | null) {
  return Boolean(me && (me.is_system_admin || me.roles.some((r) => r.role === "membership_officer")));
}

export function RequireMembershipOfficer({ children }: { children?: ReactNode }) {
  const { me, status, error, refresh } = useMe();
  if (status === "error") {
    return (
      <Banner tone="error" title="We couldn't load your account" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
        {error?.message}
      </Banner>
    );
  }
  if (!me) return <Pending label="Loading your account" />;
  if (!isMembershipOfficer(me)) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="You don’t have access to this page">
          Membership records are for NDCConnect administrators and membership officers.
        </EmptyState>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
}

/** News review (spec 07 §5.5): system admins and news reviewers. The backend enforces it too. */
export function isNewsReviewer(me: { is_system_admin: boolean; roles: { role: string }[] } | null) {
  return Boolean(me && (me.is_system_admin || me.roles.some((r) => r.role === "news_reviewer")));
}

export function RequireNewsReviewer({ children }: { children?: ReactNode }) {
  const { me, status, error, refresh } = useMe();
  if (status === "error") {
    return (
      <Banner tone="error" title="We couldn't load your account" action={<Button variant="secondary" size="sm" onClick={() => void refresh()}>Try again</Button>}>
        {error?.message}
      </Banner>
    );
  }
  if (!me) return <Pending label="Loading your account" />;
  if (!isNewsReviewer(me)) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="You don’t have access to this page">
          News review is for NDCConnect administrators and news reviewers.
        </EmptyState>
      </div>
    );
  }
  return children ? <>{children}</> : <Outlet />;
}
