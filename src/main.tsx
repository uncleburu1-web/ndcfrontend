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
  return (
    <ClerkProvider
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
      <EmptyState icon="alert" title="Sign-in isn’t configured">
        Set VITE_CLERK_PUBLISHABLE_KEY in .env (see .env.example) and restart the dev server.
      </EmptyState>
    </main>
  );
}

function Root() {
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
