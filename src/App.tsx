/**
 * Routes — spec §7.3. Public pages stay public; only the auth routes are guarded.
 * The /design-system review page stays dev-only and doesn't need Clerk.
 */
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireFinanceViewer, RequireSignedIn, RequireSystemAdmin, SignedOutOnly } from "./auth/guards";
import AppLayout from "./components/layout/AppLayout";
import AdminCandidateEditPage from "./pages/admin/candidates/AdminCandidateEditPage";
import AdminCandidatesPage from "./pages/admin/candidates/AdminCandidatesPage";
import CandidateProfilePage from "./pages/candidates/CandidateProfilePage";
import CandidatesPage from "./pages/candidates/CandidatesPage";
import FollowingPage from "./pages/following/FollowingPage";
import AdminDonationDetailPage from "./pages/admin/donations/AdminDonationDetailPage";
import AdminDonationsPage from "./pages/admin/donations/AdminDonationsPage";
import DonateCompletePage from "./pages/donate/DonateCompletePage";
import DonatePage from "./pages/donate/DonatePage";
import MyDonationsPage from "./pages/donate/MyDonationsPage";
import ReceiptPage from "./pages/donate/ReceiptPage";
import FinancePage from "./pages/finance/FinancePage";
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
          {/* Sign-in only — never profile completion or PVC (spec 04 §4.4). */}
          <Route path="following" element={<FollowingPage />} />
          <Route path="my-donations" element={<MyDonationsPage />} />
        </Route>
        {/* Public — no account, profile or PVC needed (spec 03 §3.4) */}
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="candidates/:slug" element={<CandidateProfilePage />} />
        {/* Donations (spec 05): guests welcome; the page itself says when donations aren't open */}
        <Route path="donate" element={<DonatePage />} />
        <Route path="donate/complete" element={<DonateCompletePage />} />
        <Route path="donate/receipt/:reference" element={<ReceiptPage />} />
        <Route path="finance" element={<FinancePage />} />
        {/* System admin only (spec 03 §8.3); the backend enforces IsSystemAdmin too */}
        <Route element={<RequireSignedIn />}>
          <Route element={<RequireSystemAdmin />}>
            <Route path="admin/candidates" element={<AdminCandidatesPage />} />
            <Route path="admin/candidates/new" element={<AdminCandidateEditPage />} />
            <Route path="admin/candidates/:id" element={<AdminCandidateEditPage />} />
          </Route>
          {/* System admin or finance officer (spec 05 §7.2) */}
          <Route element={<RequireFinanceViewer />}>
            <Route path="admin/donations" element={<AdminDonationsPage />} />
            <Route path="admin/donations/:id" element={<AdminDonationDetailPage />} />
          </Route>
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
