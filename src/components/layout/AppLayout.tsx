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
import AccountPausedPage from "../../settings/AccountPausedPage";
import { LanguageSwitch } from "../../settings/LanguageSwitch";
import { t } from "../../i18n";

export const NAV = [
  { get label() { return t("layout.candidates"); }, href: "/candidates" },
  { get label() { return t("layout.news"); }, href: "/news" },
  { get label() { return t("layout.communities"); }, href: "/communities" },
  { get label() { return t("layout.events"); }, href: "/events" },  // spec 18
  { get label() { return t("layout.states"); }, href: "/states" },
  { get label() { return t("layout.finance"); }, href: "/finance" },
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
          {t("layout.sign-in")}</Button>
      </Show>
      <Show when="signed-in">
        <NotificationBell />
        <UserButton userProfileUrl="/settings/security">
          <UserButton.MenuItems>
            <UserButton.Link label={t("layout.settings")} labelIcon={<Icon name="user" size={16} />} href="/settings" />
            <UserButton.Link label={t("layout.notifications")} labelIcon={<Icon name="bell" size={16} />} href="/notifications" />
            <UserButton.Link label={t("layout.following")} labelIcon={<Icon name="heart" size={16} />} href="/following" />
            <UserButton.Link label={t("layout.my-donations")} labelIcon={<Icon name="inbox" size={16} />} href="/my-donations" />
            <UserButton.Link label={t("layout.my-membership")} labelIcon={<Icon name="user" size={16} />} href="/join" />
            <UserButton.Link label={t("layout.my-news")} labelIcon={<Icon name="inbox" size={16} />} href="/news/mine" />
            <UserButton.Link label={t("layout.my-reports")} labelIcon={<Icon name="shield" size={16} />} href="/reports" />
            {isCampaignAccount(me) && <UserButton.Link label={t("layout.my-campaign")} labelIcon={<Icon name="bell" size={16} />} href="/campaign" />}
            {me?.home_state && <UserButton.Link label={t("layout.your-state")} labelIcon={<Icon name="mapPin" size={16} />} href={`/states/${me.home_state}`} />}
            <UserButton.Link label={verified ? t("layout.verified-voter") : t("layout.verify-your-pvc")} labelIcon={<Icon name={verified ? "verified" : "shield"} size={16} />} href="/pvc" />
            <UserButton.Link label={t("layout.your-data")} labelIcon={<Icon name="lock" size={16} />} href="/settings/privacy/data" />
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
              {t("layout.sign-in")}</Button>
          }
        >
          {t("layout.your-session-ended-sign-in-again")}</Banner>
      </div>
    );
  }
  if (issue === "auth-unavailable") {
    return (
      <div className="app-banner">
        <Banner tone="warning" dismissible onDismiss={clearIssue}>
          {t("layout.sign-in-is-temporarily-unavailable-public")}</Banner>
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
  const base = isCampaignAccount(me) ? [...NAV, { label: t("layout.my-campaign"), href: "/campaign" }] : NAV;
  const links = adminHref ? [...base, { label: t("layout.admin"), href: adminHref }] : base;
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
        {/* Spec 20 §12: a paused account sees only the paused screen until it reactivates */}
        {me?.account_status === "paused" ? <AccountPausedPage /> : <Outlet />}
      </main>
      <footer className="site-footer">
        <ul>
          <li><Link to="/polling-units">{t("layout.find-a-polling-unit")}</Link></li>
          <li><Link to="/rules">{t("layout.community-rules")}</Link></li>
          <li><Link to="/reports/status">{t("layout.check-a-report")}</Link></li>
          <li><Link to="/report/copyright">{t("layout.copyright-notice")}</Link></li>
          <li><Link to="/privacy">{t("layout.privacy")}</Link></li>
          <li><Link to="/security">{t("layout.security")}</Link></li>
          <li><Link to="/settings">{t("layout.settings")}</Link></li>
          <li><LanguageSwitch /></li>
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
