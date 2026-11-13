/**
 * Admin two-step verification gate (spec 14 §4.6, §8.2). The server refuses admin requests without the `mfa` claim when
 * ADMIN_MFA_REQUIRED is on; this shows why, and where to turn it on, instead of a page of errors.
 */
import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { adminAreas } from "../auth/guards";
import { useMe, useMfaBlocked } from "../auth/session";
import { Banner, Button, EmptyState } from "../components/ui";
import { t } from "../i18n";

export function AdminMfaGate({ children }: { children?: ReactNode }) {
  const { me } = useMe();
  const blocked = useMfaBlocked();
  const admin = adminAreas(me).length > 0;
  const required = Boolean(me?.admin_mfa_required);
  const off = admin && required && me?.mfa_enabled !== true;
  if (admin && (blocked || off)) {
    return (
      <div className="page-shell">
        <EmptyState icon="shield" title={t("privacy.turn-on-two-step-verification-to")}>
          {t.rich("privacy.admin-accounts-need-a-second-step", { div: <div className="privacy-gate-actions">
            <Button href="/settings/security">{t("privacy.open-account-security")}</Button>
          </div> })}
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
            {t.rich("privacy.development-mode-admin-two-step-verification", { code: (chunks) => <code>{chunks}</code> })}</Banner>
        </div>
        {body}
      </>
    );
  }
  return body;
}
