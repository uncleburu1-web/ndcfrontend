/**
 * Site chrome: header (with the Clerk account area, spec §7.4), session banners
 * (spec §7.5), and the routed page.
 */
import { Show, UserButton } from "@clerk/react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { isAnyAdmin, isCampaignAccount } from "../../auth/guards";
import { useMe, useSessionIssue } from "../../auth/session";
import { DonationConfigProvider, useDonationConfig } from "../../donations/DonationConfigProvider";
import { FollowProvider } from "../../follows/FollowProvider";
import { NotificationBell } from "../../notifications/NotificationBell";
import { RulesUpdatedBanner } from "../../moderation/RulesUpdatedBanner";
import { PrivacyChrome } from "../../privacy/PrivacyChrome";
import "../../privacy/privacy.css";
import { HeaderSearch } from "../../search/HeaderSearch";
import "../../moderation/moderation.css";
import { Banner, Button, Icon, SiteHeader } from "../ui";

export const NAV = [
  { label: "Candidates", href: "/candidates" },
  { label: "News", href: "/news" },
  { label: "Communities", href: "/communities" },
  { label: "Events", href: "/events" },  // spec 18
  { label: "States", href: "/states" },
  { label: "Finance", href: "/finance" },
  { label: "PVC", href: "/pvc" },
];

function AccountArea() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useMe();
  const verified = me?.pvc_status === "successful"; // spec 08: the badge comes from the backend, never inferred
  return (
    <>
      <Show when="signed-out">
        <Button variant="secondary" onClick={() => navigate(`/sign-in?redirect_url=${encodeURIComponent(location.pathname)}`)}>
          Sign in
        </Button>
      </Show>
      <Show when="signed-in">
        <NotificationBell />
        <UserButton userProfileUrl="/account">
          <UserButton.MenuItems>
            <UserButton.Link label="Following" labelIcon={<Icon name="heart" size={16} />} href="/following" />
            <UserButton.Link label="My donations" labelIcon={<Icon name="inbox" size={16} />} href="/my-donations" />
            <UserButton.Link label="My membership" labelIcon={<Icon name="user" size={16} />} href="/join" />
            <UserButton.Link label="My news" labelIcon={<Icon name="inbox" size={16} />} href="/news/mine" />
            <UserButton.Link label="My reports" labelIcon={<Icon name="shield" size={16} />} href="/reports" />
            {isCampaignAccount(me) && <UserButton.Link label="My campaign" labelIcon={<Icon name="bell" size={16} />} href="/campaign" />}
            {me?.home_state && <UserButton.Link label="Your state" labelIcon={<Icon name="mapPin" size={16} />} href={`/states/${me.home_state}`} />}
            <UserButton.Link label={verified ? "Verified voter" : "Verify your PVC"} labelIcon={<Icon name={verified ? "verified" : "shield"} size={16} />} href="/pvc" />
            <UserButton.Link label="Your data" labelIcon={<Icon name="lock" size={16} />} href="/account/privacy" />
          </UserButton.MenuItems>
        </UserButton>
      </Show>
    </>
  );
}

function SessionBanners() {
  const { issue, clearIssue } = useSessionIssue();
  const navigate = useNavigate();
  if (issue === "session-ended") {
    return (
      <div className="app-banner">
        <Banner
          tone="warning"
          dismissible
          onDismiss={clearIssue}
          action={
            <Button size="sm" onClick={() => { clearIssue(); navigate("/sign-in"); }}>
              Sign in
            </Button>
          }
        >
          Your session ended. Sign in again.
        </Banner>
      </div>
    );
  }
  if (issue === "auth-unavailable") {
    return (
      <div className="app-banner">
        <Banner tone="warning" dismissible onDismiss={clearIssue}>
          Sign-in is temporarily unavailable. Public pages still work; try signed-in actions again shortly.
        </Banner>
      </div>
    );
  }
  return null;
}

function Chrome() {
  const path = useLocation().pathname;
  const { me } = useMe();
  const { config } = useDonationConfig();
  // Admin link: every admin role lands on the Admin home (spec 11 §4.1); the backend still enforces access.
  const adminHref = isAnyAdmin(me) ? "/admin" : null;
  const base = isCampaignAccount(me) ? [...NAV, { label: "My campaign", href: "/campaign" }] : NAV;
  const links = adminHref ? [...base, { label: "Admin", href: adminHref }] : base;
  return (
    <>
      <SiteHeader
        links={links.map((l) => ({ ...l, current: l.label === "Admin" ? path.startsWith("/admin") : path.startsWith(l.href) }))}
        donateHref={config.open ? "/donate" : undefined}
        joinHref="/join"
        account={<AccountArea />}
        search={<HeaderSearch />}
      />
      <SessionBanners />
      <RulesUpdatedBanner />
      <PrivacyChrome />
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <ul>
          <li><Link to="/rules">Community rules</Link></li>
          <li><Link to="/reports/status">Check a report</Link></li>
          <li><Link to="/report/copyright">Copyright notice</Link></li>
          <li><Link to="/privacy">Privacy</Link></li>
          <li><Link to="/security">Security</Link></li>
        </ul>
      </footer>
    </>
  );
}

export default function AppLayout() {
  return (
    <DonationConfigProvider>
      <FollowProvider>
        <Chrome />
      </FollowProvider>
    </DonationConfigProvider>
  );
}
