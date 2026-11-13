import { ClerkProvider } from "@clerk/react";
import React, { useMemo, useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import App, { DevDesignSystem } from "./App";
import { clerkAppearance } from "./auth/clerkAppearance";
import { SessionProvider } from "./auth/session";
import { EmptyState, ToastProvider } from "./components/ui";
import { PreferencesProvider } from "./settings/PreferencesProvider";
import { getPrefs, resolved, subscribe } from "./settings/prefsStore";
import { clerkLocalization, setLanguage, useLanguage } from "./i18n";
import { t } from "./i18n";

/** Spec 20 §10.2: Clerk's colours follow the theme and contrast in use (re-read from the tokens when they change). */
const paletteKey = () => {
  const r = resolved(getPrefs());
  return `${r.scheme}-${r.contrastLevel}`;
};

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/** ClerkProvider wired to React Router so Clerk navigates without full page reloads. */
function ClerkWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const palette = useSyncExternalStore(subscribe, paletteKey, paletteKey);
  const appearance = useMemo(() => clerkAppearance(), [palette]); // eslint-disable-line react-hooks/exhaustive-deps
  const lang = useLanguage();
  const localization = useMemo(() => clerkLocalization(), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ClerkProvider
      localization={localization as never}
      publishableKey={PUBLISHABLE_KEY!}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}

function MissingClerkKey() {
  return (
    <main className="page-shell">
      <EmptyState icon="alert" title={t("main.sign-in-isn-t-configured")}>
        {t("main.set-vite-clerk-publishable-key-in")}</EmptyState>
    </main>
  );
}

/** Spec 21 §5.4: the interface follows the language preference (device or account, spec 20); `?lang=` (a shared link)
 * applies when the person has no saved choice (§23.9), and `qps` is the pseudo-language in development. */
const urlLang = new URLSearchParams(window.location.search).get("lang");
function followPrefs() {
  const p = getPrefs();
  const wanted = urlLang && (!p.deviceSet || urlLang === "qps") && (import.meta.env.DEV || import.meta.env.VITE_I18N_PSEUDO === "1" || urlLang !== "qps") ? urlLang : p.language;
  void setLanguage(wanted || "en");
}
followPrefs();
subscribe(followPrefs);

function Root() {
  useLanguage(); // a language switch re-renders the whole tree, in place
  if (import.meta.env.DEV && window.location.pathname === "/design-system") return <DevDesignSystem />;
  if (!PUBLISHABLE_KEY) return <MissingClerkKey />;
  return (
    <BrowserRouter>
      <ClerkWithRouter>
        <SessionProvider>
          <PreferencesProvider>
            <App />
          </PreferencesProvider>
        </SessionProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </React.StrictMode>
);
