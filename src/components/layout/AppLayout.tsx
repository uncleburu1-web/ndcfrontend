/**
 * Site chrome: header (with the Clerk account area, spec §7.4), session banners
 * (spec §7.5), and the routed page.
 */
import { Show, UserButton } from "@clerk/react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { isFinanceViewer } from "../../auth/guards";
import { useMe, useSessionIssue } from "../../auth/session";
import { DonationConfigProvider, useDonationConfig } from "../../donations/DonationConfigProvider";
import { FollowProvider } from "../../follows/FollowProvider";
import { Banner, Button, Icon, SiteHeader } from "../ui";

const NAV = [
  { label: "Candidates", href: "/candidates" },
  { label: "News", href: "/news" },
  { label: "Communities", href: "/communities" },
  { label: "Finance", href: "/finance" },
  { label: "PVC", href: "/pvc" },
];

function AccountArea() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <Show when="signed-out">
        <Button variant="secondary" onClick={() => navigate(`/sign-in?redirect_url=${encodeURIComponent(location.pathname)}`)}>
          Sign in
        </Button>
      </Show>
      <Show when="signed-in">
        <UserButton userProfileUrl="/account">
          <UserButton.MenuItems>
            <UserButton.Link label="Following" labelIcon={<Icon name="heart" size={16} />} href="/following" />
            <UserButton.Link label="My donations" labelIcon={<Icon name="inbox" size={16} />} href="/my-donations" />
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
  // Admin link: system admins land on candidates; finance officers on donations (the backend still enforces access).
  const adminHref = me?.is_system_admin ? "/admin/candidates" : isFinanceViewer(me) ? "/admin/donations" : null;
  const links = adminHref ? [...NAV, { label: "Admin", href: adminHref }] : NAV;
  return (
    <>
      <SiteHeader
        links={links.map((l) => ({ ...l, current: l.label === "Admin" ? path.startsWith("/admin") : path.startsWith(l.href) }))}
        donateHref={config.open ? "/donate" : undefined}
        joinHref="/join"
        account={<AccountArea />}
      />
      <SessionBanners />
      <main id="main">
        <Outlet />
      </main>
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
