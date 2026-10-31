import { ClerkProvider } from "@clerk/react";
import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router-dom";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";
import App, { DevDesignSystem } from "./App";
import { clerkAppearance } from "./auth/clerkAppearance";
import { SessionProvider } from "./auth/session";
import { EmptyState, ToastProvider } from "./components/ui";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

/** ClerkProvider wired to React Router so Clerk navigates without full page reloads. */
function ClerkWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const appearance = useMemo(() => clerkAppearance(), []);
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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ClerkWithRouter>
        <SessionProvider>
          <App />
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
