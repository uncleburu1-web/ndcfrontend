/**
 * Site chrome: header (with the Clerk account area, spec §7.4), session banners
 * (spec §7.5), and the routed page.
 */
import { Show, UserButton } from "@clerk/react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSessionIssue } from "../../auth/session";
import { Banner, Button, SiteHeader } from "../ui";

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
        <UserButton userProfileUrl="/account" />
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

export default function AppLayout() {
  const path = useLocation().pathname;
  return (
    <>
      <SiteHeader
        links={NAV.map((l) => ({ ...l, current: path.startsWith(l.href) }))}
        donateHref="/donate"
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
