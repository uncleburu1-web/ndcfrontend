/**
 * Admin two-step verification gate (spec 14 §4.6, §8.2). The server refuses admin requests without the `mfa` claim when
 * ADMIN_MFA_REQUIRED is on; this shows why, and where to turn it on, instead of a page of errors.
 */
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { adminAreas } from "../auth/guards";
import { useMe, useMfaBlocked } from "../auth/session";
import { Banner, Button, EmptyState } from "../components/ui";

export function AdminMfaGate({ children }: { children?: ReactNode }) {
  const { me } = useMe();
  const blocked = useMfaBlocked();
  const admin = adminAreas(me).length > 0;
  const required = Boolean(me?.admin_mfa_required);
  const off = admin && required && me?.mfa_enabled !== true;
  if (admin && (blocked || off)) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title="Turn on two-step verification to use the admin">
          Admin accounts need a second step when signing in (an authenticator app or a passkey). Turn it on in your account’s security
          settings, then sign in again.
          <div className="privacy-gate-actions">
            <Button href="/settings/security">Open account security</Button>
          </div>
        </EmptyState>
      </div>
    );
  }
  const body = children ? <>{children}</> : <Outlet />;
  if (admin && !required && me?.mfa_enabled == null) {
    return (
      <>
        <div className="app-banner">
          <Banner tone="warning" dismissKey="admin-mfa-dev">
            Development mode: admin two-step verification isn’t enforced, and the <code>mfa</code> session claim isn’t configured in Clerk.
          </Banner>
        </div>
        {body}
      </>
    );
  }
  return body;
}
