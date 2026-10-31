import type { ReactNode } from "react";
import "./auth.css";

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
          Sign-in is provided by Clerk, which stores your email and login details on servers outside Nigeria.
          NDCConnect itself keeps only your name, email and phone number.
        </p>
      )}
    </section>
  );
}
