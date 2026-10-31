import { SignUp } from "@clerk/react";
import { AuthFrame } from "./AuthFrame";

/** /sign-up/* — after sign-up the user always lands on /setup-profile (spec §7.3, AC 1). */
export default function SignUpPage() {
  return (
    <AuthFrame privacyNotice>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/setup-profile" />
    </AuthFrame>
  );
}
