/**
 * Routes — spec §7.3. Public pages stay public; only the auth routes are guarded.
 * The /design-system review page stays dev-only and doesn't need Clerk.
 */
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireSignedIn, SignedOutOnly } from "./auth/guards";
import AppLayout from "./components/layout/AppLayout";
import { EmptyState } from "./components/ui";
import AccountDeactivatedPage from "./pages/auth/AccountDeactivatedPage";
import AccountPage from "./pages/auth/AccountPage";
import SetupProfilePage from "./pages/auth/SetupProfilePage";
import SignInPage from "./pages/auth/SignInPage";
import SignUpPage from "./pages/auth/SignUpPage";

function HomePage() {
  return (
    <div className="page-shell">
      <EmptyState title="NDCConnect is being built">
        Sign-in and accounts are ready. Candidate, news and donation pages arrive with their own specs.
      </EmptyState>
    </div>
  );
}

function NotFound() {
  return (
    <div className="page-shell">
      <EmptyState title="Page not found">That address doesn’t lead anywhere on NDCConnect yet.</EmptyState>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="sign-in/*" element={<SignedOutOnly><SignInPage /></SignedOutOnly>} />
        <Route path="sign-up/*" element={<SignedOutOnly><SignUpPage /></SignedOutOnly>} />
        <Route element={<RequireSignedIn />}>
          <Route path="setup-profile" element={<SetupProfilePage />} />
          <Route path="account/*" element={<AccountPage />} />
        </Route>
        <Route path="account-deactivated" element={<AccountDeactivatedPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

/** Dev-only design-system page (01 §9.4), mounted outside Clerk and the router. */
const DesignSystemPage = import.meta.env.DEV ? lazy(() => import("./pages/DesignSystemPage")) : null;

export function DevDesignSystem() {
  if (!DesignSystemPage) return null;
  return (
    <Suspense fallback={null}>
      <DesignSystemPage />
    </Suspense>
  );
}
