/**
 * /settings (spec 20 §4). Desktop: the section list on the left, the section on the right. Phone: the list, and each
 * section on its own page with a back link. Guests see Language, Accessibility and About, and a sign-in card.
 */
import { useAuth } from "@clerk/react";
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Banner, Button, Icon, Skeleton } from "../components/ui";
import { SECTIONS } from "./constants";
import { usePreferences } from "./PreferencesProvider";
import "./settings.css";
import { t } from "../i18n";

export function SettingsNav({ showSignIn = true }: { showSignIn?: boolean }) {
  const { isSignedIn } = useAuth();
  const shown = isSignedIn ? SECTIONS : SECTIONS.filter((s) => s.guest);
  return (
    <nav className="set-nav" aria-label={t("settings.settings-sections")}>
      <ul>
        {shown.map((s) => (
          <li key={s.path}>
            <NavLink to={`/settings/${s.path}`} className={({ isActive }) => `set-nav__link${isActive ? " is-current" : ""}`}>
              <Icon name={s.icon} size={20} />
              <span>
                <strong>{s.label}</strong>
                <small>{s.blurb}</small>
              </span>
              <Icon name="chevronRight" size={16} />
            </NavLink>
          </li>
        ))}
      </ul>
      {!isSignedIn && showSignIn && <SignInCard />}
    </nav>
  );
}

export function SignInCard() {
  const { pathname } = useLocation();
  return (
    <div className="set-card set-signin">
      <h2>{t("settings.sign-in-to-manage-your-account")}</h2>
      <p>{t("settings.your-profile-notifications-privacy-and-security")}</p>
      <Button href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`}>{t("settings.sign-in")}</Button>
    </div>
  );
}

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const atIndex = /^\/settings\/?$/.test(pathname);
  useEffect(() => {
    if (atIndex) document.title = t("settings.settings-ndcconnect");
  }, [atIndex]);
  return (
    <div className={`set-page${atIndex ? " set-page--index" : ""}`}>
      <h1 className="set-page__title">{t("settings.settings")}</h1>
      <div className="set-page__grid">
        <aside className="set-page__nav">
          <SettingsNav showSignIn={atIndex} />
        </aside>
        <div className="set-page__section">
          {!atIndex && (
            <p className="set-back">
              <Link to="/settings">{t.rich("settings.settings-2", { icon: <Icon name="chevronLeft" size={16} /> })}</Link>
            </p>
          )}
          {atIndex ? (
            <div className="set-card set-intro">
              <p>{t("settings.choose-a-section-each-one-saves")}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}

/** A signed-in section: the settings once loaded, a skeleton meanwhile, an error with "Try again" if loading failed. */
export function useSettingsData() {
  const { settings, settingsError, loadSettings, signedIn } = usePreferences();
  useEffect(() => {
    if (signedIn && !settings) void loadSettings();
  }, [signedIn, settings, loadSettings]);
  return { settings, settingsError, loadSettings };
}

export function SectionShell({ title, intro, children, guestOk = false }: { title: string; intro?: React.ReactNode; children: React.ReactNode;
  guestOk?: boolean }) {
  const { isSignedIn, isLoaded } = useAuth();
  useEffect(() => {
    document.title = t("settings.settings-ndcconnect-2", { title });
  }, [title]);
  return (
    <section className="set-section" aria-labelledby="set-section-h">
      <h2 id="set-section-h">{title}</h2>
      {intro && <p className="set-lead">{intro}</p>}
      {!guestOk && isLoaded && !isSignedIn ? <SignInCard /> : children}
    </section>
  );
}

export function Loading({ error, retry }: { error: { message: string } | null; retry: () => void }) {
  if (error) {
    return (
      <Banner tone="error" title={t("settings.we-couldn-t-load-your-settings")} action={<Button size="sm" variant="secondary" onClick={retry}>{t("settings.try-again")}</Button>}>
        {error.message}
      </Banner>
    );
  }
  return <Skeleton width="100%" height={240} />;
}
