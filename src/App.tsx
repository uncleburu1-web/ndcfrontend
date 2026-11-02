/**
 * Routes — spec §7.3. Public pages stay public; only the auth routes are guarded.
 * The /design-system review page stays dev-only and doesn't need Clerk.
 */
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import {
  RequireFinanceViewer,
  RequireMembershipOfficer,
  RequireNewsReviewer,
  RequireProfileComplete,
  RequirePvcOfficer,
  RequireAnyAdmin,
  RequireSignedIn,
  RequireSystemAdmin,
  SignedOutOnly,
} from "./auth/guards";
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
import AdminMembershipDetailPage from "./pages/admin/membership/AdminMembershipDetailPage";
import AdminMembershipPage from "./pages/admin/membership/AdminMembershipPage";
import AdminMembershipPaymentsPage from "./pages/admin/membership/AdminMembershipPaymentsPage";
import AdminMembershipSettingsPage from "./pages/admin/membership/AdminMembershipSettingsPage";
import AdminPvcPage from "./pages/admin/pvc/AdminPvcPage";
import AdminPvcSettingsPage from "./pages/admin/pvc/AdminPvcSettingsPage";
import JoinCompletePage from "./pages/join/JoinCompletePage";
import JoinPage from "./pages/join/JoinPage";
import MembershipCardPage from "./pages/join/MembershipCardPage";
import PvcPage from "./pages/pvc/PvcPage";
import AdminAnnouncementsPage from "./pages/admin/announcements/AdminAnnouncementsPage";
import AnnouncementFormPage from "./pages/admin/announcements/AnnouncementFormPage";
import AdminNewsDetailPage from "./pages/admin/news/AdminNewsDetailPage";
import AdminNewsPage from "./pages/admin/news/AdminNewsPage";
import AdminAuditPage from "./pages/admin/audit/AdminAuditPage";
import AdminHomePage from "./pages/admin/home/AdminHomePage";
import AdminPostDetailPage from "./pages/admin/posts/AdminPostDetailPage";
import AdminTeamPage from "./pages/admin/team/AdminTeamPage";
import AdminUserPage from "./pages/admin/users/AdminUserPage";
import AdminUsersPage from "./pages/admin/users/AdminUsersPage";
import AdminPostsPage from "./pages/admin/posts/AdminPostsPage";
import CampaignCandidatePage from "./pages/campaign/CampaignCandidatePage";
import CampaignHomePage from "./pages/campaign/CampaignHomePage";
import CandidatePostPage from "./pages/candidates/CandidatePostPage";
import SearchPage from "./pages/search/SearchPage";
import StatePage from "./pages/states/StatePage";
import StatesPage from "./pages/states/StatesPage";
import ArticlePage from "./pages/news/ArticlePage";
import MyNewsPage from "./pages/news/MyNewsPage";
import NewsPage from "./pages/news/NewsPage";
import NotificationsPage from "./pages/news/NotificationsPage";
import SubmitNewsPage from "./pages/news/SubmitNewsPage";
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
        Sign-in and accounts are ready. Communities and events arrive with their own specs.
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
          {/* The member's own card — private, no public lookup (spec 06 §4.3) */}
          <Route path="membership/card" element={<MembershipCardPage />} />
          {/* News (spec 07): My submissions and notifications need sign-in; submitting also needs a completed profile */}
          <Route path="news/mine" element={<MyNewsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          {/* Candidate posts (spec 09): linked campaign accounts; the backend checks the candidate link on every call */}
          <Route path="campaign" element={<CampaignHomePage />} />
          <Route path="campaign/:candidateId" element={<CampaignCandidatePage />} />
          <Route element={<RequireProfileComplete />}>
            <Route path="news/submit" element={<SubmitNewsPage />} />
            <Route path="news/mine/:id" element={<SubmitNewsPage />} />
          </Route>
        </Route>
        {/* Public — no account, profile or PVC needed (spec 03 §3.4) */}
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="candidates/:slug" element={<CandidateProfilePage />} />
        <Route path="candidates/:slug/posts/:id" element={<CandidatePostPage />} />
        {/* Search and discovery (spec 12): public, anonymous */}
        <Route path="search" element={<SearchPage />} />
        <Route path="states" element={<StatesPage />} />
        <Route path="states/:state" element={<StatePage />} />
        {/* Donations (spec 05): guests welcome; the page itself says when donations aren't open */}
        <Route path="donate" element={<DonatePage />} />
        <Route path="donate/complete" element={<DonateCompletePage />} />
        <Route path="donate/receipt/:reference" element={<ReceiptPage />} />
        <Route path="finance" element={<FinancePage />} />
        {/* Membership (spec 06): pages are public; applying needs sign-in + profile; paying needs a verified PVC */}
        <Route path="pvc" element={<PvcPage />} />
        <Route path="join" element={<JoinPage />} />
        <Route path="join/complete" element={<JoinCompletePage />} />
        {/* News (spec 07): public reading */}
        <Route path="news" element={<NewsPage />} />
        <Route path="news/official/:id" element={<ArticlePage source="official" />} />
        <Route path="news/community/:id" element={<ArticlePage source="community" />} />
        {/* System admin only (spec 03 §8.3); the backend enforces IsSystemAdmin too */}
        <Route element={<RequireSignedIn />}>
          {/* Admin home: any admin role, each sees only its own cards (spec 11 §4.1) */}
          <Route element={<RequireAnyAdmin />}>
            <Route path="admin" element={<AdminHomePage />} />
          </Route>
          <Route element={<RequireSystemAdmin />}>
            <Route path="admin/team" element={<AdminTeamPage />} />
            <Route path="admin/users" element={<AdminUsersPage />} />
            <Route path="admin/users/:id" element={<AdminUserPage />} />
            <Route path="admin/audit" element={<AdminAuditPage />} />
            <Route path="admin/candidates" element={<AdminCandidatesPage />} />
            <Route path="admin/candidates/new" element={<AdminCandidateEditPage />} />
            <Route path="admin/candidates/:id" element={<AdminCandidateEditPage />} />
            <Route path="admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="admin/announcements/new" element={<AnnouncementFormPage />} />
            <Route path="admin/announcements/:id" element={<AnnouncementFormPage />} />
            <Route path="admin/posts" element={<AdminPostsPage />} />
            <Route path="admin/posts/:id" element={<AdminPostDetailPage />} />
          </Route>
          {/* System admin or finance officer (spec 05 §7.2) */}
          <Route element={<RequireFinanceViewer />}>
            <Route path="admin/donations" element={<AdminDonationsPage />} />
            <Route path="admin/donations/:id" element={<AdminDonationDetailPage />} />
          </Route>
          {/* Membership officer or system admin (spec 06 §7.2) */}
          {/* PVC officer, membership officer or system admin (spec 08 §5.3) */}
          <Route element={<RequirePvcOfficer />}>
            <Route path="admin/pvc" element={<AdminPvcPage />} />
            <Route path="admin/pvc/settings" element={<AdminPvcSettingsPage />} />
          </Route>
          <Route element={<RequireMembershipOfficer />}>
            <Route path="admin/membership" element={<AdminMembershipPage />} />
            <Route path="admin/membership/settings" element={<AdminMembershipSettingsPage />} />
            <Route path="admin/membership/payments" element={<AdminMembershipPaymentsPage />} />
            <Route path="admin/membership/:id" element={<AdminMembershipDetailPage />} />
          </Route>
          {/* News reviewer or system admin (spec 07 §7.3) */}
          <Route element={<RequireNewsReviewer />}>
            <Route path="admin/news" element={<AdminNewsPage />} />
            <Route path="admin/news/:id" element={<AdminNewsDetailPage />} />
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
