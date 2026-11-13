import type { ReactNode } from "react";
import "./auth.css";
import { t } from "../../i18n";

/**
 * Centers Clerk's card. On sign-up it also carries the cross-border data notice (spec §9).
 * The final legal wording is pending (spec §15.5); this states the fact plainly meanwhile.
 */
export function AuthFrame({ children, privacyNotice }: { children: ReactNode; privacyNotice?: boolean }) {
  return (
    <section className="auth-frame">
      {children}
      {privacyNotice && (
        <p className="auth-frame__notice">
          {t("auth.sign-in-is-provided-by-clerk")}</p>
      )}
    </section>
  );
}
