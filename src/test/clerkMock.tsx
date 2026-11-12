/**
 * Minimal stand-in for @clerk/react in unit tests. Tests set `clerkState` to choose
 * signed-in / signed-out; Clerk's own UI components render labelled placeholders.
 */
import type { ReactNode } from "react";

export const clerkState = { isLoaded: true, isSignedIn: false, reverifyCancel: false, reverifyPrompts: 0 };

/** Clerk's useReverification stand-in: when the fetcher returns the reverification hint, "prompt" and retry once. */
function useReverificationMock<A extends unknown[], R>(fetcher: (...args: A) => Promise<R>) {
  return async (...args: A) => {
    const first = await fetcher(...args);
    const hint = (first as { clerk_error?: { reason?: string } } | null)?.clerk_error?.reason === "reverification-error";
    if (!hint) return first;
    clerkState.reverifyPrompts += 1;
    if (clerkState.reverifyCancel) throw new Error("reverification cancelled");
    return fetcher(...args);
  };
}

export const clerkMockModule = {
  useAuth: () => ({ ...clerkState, getToken: async () => "test-token" }),
  useClerk: () => ({ signOut: async () => {} }),
  useUser: () => ({ isLoaded: true, user: clerkState.isSignedIn ? { hasImage: false, imageUrl: "", externalAccounts: [] } : null }),
  useReverification: useReverificationMock,
  Show: ({ when, children }: { when: string; children: ReactNode }) =>
    (when === "signed-in") === clerkState.isSignedIn ? <>{children}</> : null,
  UserButton: Object.assign(({ children }: { children?: ReactNode }) => <div><button type="button">User menu</button>{children}</div>, {
    MenuItems: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Link: ({ label, href }: { label: string; href: string }) => <a href={href}>{label}</a>,
  }),
  SignIn: () => <div>Clerk sign-in</div>,
  SignUp: () => <div>Clerk sign-up</div>,
  UserProfile: () => <div>Clerk user profile</div>,
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
};
