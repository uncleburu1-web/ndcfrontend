/**
 * Minimal stand-in for @clerk/react in unit tests. Tests set `clerkState` to choose
 * signed-in / signed-out; Clerk's own UI components render labelled placeholders.
 */
import type { ReactNode } from "react";

export const clerkState = { isLoaded: true, isSignedIn: false };

export const clerkMockModule = {
  useAuth: () => ({ ...clerkState, getToken: async () => "test-token" }),
  useClerk: () => ({ signOut: async () => {} }),
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    (when === "signed-in") === clerkState.isSignedIn ? <>{children}</> : null,
  UserButton: () => <button type="button">User menu</button>,
  SignIn: () => <div>Clerk sign-in</div>,
  SignUp: () => <div>Clerk sign-up</div>,
  UserProfile: () => <div>Clerk user profile</div>,
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
};
