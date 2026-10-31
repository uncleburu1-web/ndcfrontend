import { SignIn } from "@clerk/react";
import { AuthFrame } from "./AuthFrame";

/** /sign-in/* — Clerk handles credentials, email verification and recovery (spec §7.3). */
export default function SignInPage() {
  return (
    <AuthFrame>
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </AuthFrame>
  );
}
