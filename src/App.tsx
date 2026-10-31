/**
 * App shell. Feature pages arrive with their own specs; this unit only ships the
 * design system. The /design-system review page is dev-only (spec §9.4): it is
 * imported behind `import.meta.env.DEV`, so production builds drop it entirely.
 * No router dependency is added yet — that decision belongs to the first page-level spec.
 */
import { lazy, Suspense } from "react";
import { EmptyState, SiteHeader } from "./components/ui";

const DesignSystemPage = import.meta.env.DEV ? lazy(() => import("./pages/DesignSystemPage")) : null;

const NAV = [
  { label: "Candidates", href: "/candidates" },
  { label: "News", href: "/news" },
  { label: "Communities", href: "/communities" },
  { label: "Finance", href: "/finance" },
  { label: "PVC", href: "/pvc" },
];

export default function App() {
  const path = window.location.pathname;

  if (DesignSystemPage && path === "/design-system") {
    return (
      <Suspense fallback={null}>
        <DesignSystemPage />
      </Suspense>
    );
  }

  return (
    <>
      <SiteHeader links={NAV} donateHref="/donate" joinHref="/join" />
      <main style={{ maxWidth: "var(--bp-md)", margin: "0 auto", padding: "var(--space-12) var(--space-4)" }}>
        <EmptyState
          title="NDCConnect is being built"
          action={import.meta.env.DEV ? <a href="/design-system">Open the design system</a> : undefined}
        >
          The design system is ready. Feature pages arrive with their own specs.
        </EmptyState>
      </main>
    </>
  );
}
