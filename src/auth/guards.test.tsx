/** Route guards — spec §7.6, §12, AC 9. */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clerkState } from "../test/clerkMock";
import { ToastProvider } from "../components/ui";
import type { Me } from "./session";

vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);

const session = vi.hoisted(() => ({
  me: null as Me | null,
  status: "idle" as "idle" | "loading" | "ready" | "error",
}));
vi.mock("./session", () => ({
  useMe: () => ({ me: session.me, status: session.status, error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
  useApi: () => () => new Promise(() => {}), // public pages fetch; leave requests pending
}));

import App from "../App";
import { RequireProfileComplete, RequireSignedIn } from "./guards";

const incomplete: Me = { id: "1", email: "a@b.c", full_name: "", phone_number: "", profile_complete: false, roles: [], is_system_admin: false };
const complete: Me = { ...incomplete, full_name: "Ada Obi", phone_number: "+2348031234567", profile_complete: true };

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string, ui: React.ReactNode) {
  // main.tsx wraps the whole app in ToastProvider; mirror that here.
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {ui}
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  session.me = null;
  session.status = "idle";
});
afterEach(cleanup);

describe("RequireSignedIn", () => {
  const routes = (
    <Routes>
      <Route element={<RequireSignedIn />}>
        <Route path="/account" element={<p>Account content</p>} />
      </Route>
      <Route path="/sign-in" element={<p>Sign-in page</p>} />
    </Routes>
  );

  it("sends signed-out users to /sign-in and remembers where they were", () => {
    renderAt("/account?tab=security", routes);
    expect(screen.getByText("Sign-in page")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Faccount%3Ftab%3Dsecurity");
  });

  it("lets signed-in users through", () => {
    clerkState.isSignedIn = true;
    renderAt("/account", routes);
    expect(screen.getByText("Account content")).toBeTruthy();
  });

  it("waits while Clerk is loading instead of redirecting", () => {
    clerkState.isLoaded = false;
    renderAt("/account", routes);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/account");
  });
});

describe("RequireProfileComplete", () => {
  const routes = (
    <Routes>
      <Route element={<RequireProfileComplete />}>
        <Route path="/news/submit" element={<p>Submit news form</p>} />
      </Route>
      <Route path="/setup-profile" element={<p>Setup page</p>} />
    </Routes>
  );

  it("redirects an incomplete profile to /setup-profile", () => {
    clerkState.isSignedIn = true;
    session.me = incomplete;
    session.status = "ready";
    renderAt("/news/submit", routes);
    expect(screen.getByText("Setup page")).toBeTruthy();
  });

  it("lets a complete profile through", () => {
    clerkState.isSignedIn = true;
    session.me = complete;
    session.status = "ready";
    renderAt("/news/submit", routes);
    expect(screen.getByText("Submit news form")).toBeTruthy();
  });
});

describe("public routes are never gated (AC 9)", () => {
  for (const path of ["/", "/candidates", "/donate", "/finance", "/news"]) {
    it(`${path} renders for a signed-out guest without redirecting`, () => {
      renderAt(path, <App />);
      expect(screen.getByTestId("where").textContent).toBe(path);
    });

    it(`${path} renders for a signed-in user with an incomplete profile without redirecting`, () => {
      clerkState.isSignedIn = true;
      session.me = incomplete;
      session.status = "ready";
      renderAt(path, <App />);
      expect(screen.getByTestId("where").textContent).toBe(path);
    });
  }
});

describe("header account area", () => {
  it("shows Sign in when signed out and the user menu when signed in", () => {
    renderAt("/", <App />);
    expect(screen.getAllByRole("button", { name: "Sign in" }).length).toBeGreaterThan(0);
    cleanup();
    clerkState.isSignedIn = true;
    renderAt("/", <App />);
    expect(screen.getAllByRole("button", { name: "User menu" }).length).toBeGreaterThan(0);
  });
});

describe("/following route (spec 04 §4.4)", () => {
  it("requires sign-in", () => {
    renderAt("/following", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Ffollowing");
  });

  it("needs sign-in only — not a completed profile", () => {
    clerkState.isSignedIn = true;
    session.me = incomplete;
    session.status = "ready";
    renderAt("/following", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/following");
    expect(screen.getByRole("heading", { level: 1, name: "Following" })).toBeTruthy();
  });

  it("is linked from the signed-in user menu", () => {
    clerkState.isSignedIn = true;
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Following" })[0].getAttribute("href")).toBe("/following");
  });
});

describe("donation routes (spec 05)", () => {
  it("/my-donations requires sign-in only", () => {
    renderAt("/my-donations", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Fmy-donations");
  });

  for (const path of ["/donate", "/finance", "/donate/receipt/NDC-X"]) {
    it(`${path} is public`, () => {
      renderAt(path, <App />);
      expect(screen.getByTestId("where").textContent).toBe(path);
    });
  }

  it("the header hides Donate while the compliance gate is closed or unknown", () => {
    renderAt("/", <App />);
    expect(screen.queryByRole("link", { name: /Donate/ })).toBeNull();
  });
});

describe("setup-profile route", () => {
  it("requires sign-in", () => {
    renderAt("/setup-profile", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Fsetup-profile");
  });

  it("moves on once the profile is complete", () => {
    clerkState.isSignedIn = true;
    session.me = complete;
    session.status = "ready";
    renderAt("/setup-profile", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/");
  });
});

describe("membership routes (spec 06)", () => {
  for (const [path, heading] of [["/pvc", "Your PVC"], ["/join", "Join the NDC"]]) {
    it(`${path} is a public page, not “Page not found”`, () => {
      renderAt(path, <App />);
      expect(screen.getByTestId("where").textContent).toBe(path);
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeTruthy();
      expect(screen.queryByText("Page not found")).toBeNull();
    });
  }

  it("Join NDC in the header and the mobile bar goes to /join", () => {
    renderAt("/", <App />);
    const links = screen.getAllByRole("link", { name: "Join NDC" });
    expect(links.length).toBe(2);
    for (const l of links) expect(l.getAttribute("href")).toBe("/join");
  });

  it("/membership/card requires sign-in; admin membership pages need an officer", () => {
    renderAt("/membership/card", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Fmembership%2Fcard");
    cleanup();
    clerkState.isSignedIn = true;
    session.me = complete;
    session.status = "ready";
    renderAt("/admin/pvc", <App />);
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("officers with no other admin role get an Admin link to membership", () => {
    clerkState.isSignedIn = true;
    session.me = { ...complete, roles: [{ role: "membership_officer" }] } as Me;
    session.status = "ready";
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Admin" })[0].getAttribute("href")).toBe("/admin/membership");
  });
});

describe("news routes (spec 07)", () => {
  it("/news is a public page, not “Page not found”", () => {
    renderAt("/news", <App />);
    expect(screen.getByRole("heading", { level: 1, name: "News" })).toBeTruthy();
    expect(screen.queryByText("Page not found")).toBeNull();
  });

  it("/news/submit needs sign-in, then a completed profile", () => {
    renderAt("/news/submit", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/sign-in?redirect_url=%2Fnews%2Fsubmit");
    cleanup();
    clerkState.isSignedIn = true;
    session.me = incomplete;
    session.status = "ready";
    renderAt("/news/submit", <App />);
    expect(screen.getByTestId("where").textContent).toBe("/setup-profile");
    cleanup();
    session.me = complete;
    renderAt("/news/submit", <App />);
    expect(screen.getByRole("heading", { level: 1, name: "Submit news" })).toBeTruthy();
  });

  it("signed-in users get the bell and a My news link; reviewers get an Admin link to the queue", () => {
    clerkState.isSignedIn = true;
    session.me = { ...complete, roles: [{ role: "news_reviewer" }] } as Me;
    session.status = "ready";
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Notifications" })[0].getAttribute("href")).toBe("/notifications");
    expect(screen.getAllByRole("link", { name: "My news" })[0].getAttribute("href")).toBe("/news/mine");
    expect(screen.getAllByRole("link", { name: "Admin" })[0].getAttribute("href")).toBe("/admin/news");
  });

  it("/admin/news is closed to ordinary users", () => {
    clerkState.isSignedIn = true;
    session.me = complete;
    session.status = "ready";
    renderAt("/admin/news", <App />);
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });
});

describe("PVC as its own unit (spec 08)", () => {
  it("user menu says Verify your PVC, or Verified voter once the backend confirms it", () => {
    clerkState.isSignedIn = true;
    session.me = { ...complete, pvc_status: "pending" } as Me;
    session.status = "ready";
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Verify your PVC" })[0].getAttribute("href")).toBe("/pvc");
    cleanup();
    session.me = { ...complete, pvc_status: "successful" } as Me;
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Verified voter" })[0].getAttribute("href")).toBe("/pvc");
  });

  it("PVC-only officers get an Admin link to the queue, and the queue opens", () => {
    clerkState.isSignedIn = true;
    session.me = { ...complete, roles: [{ role: "pvc_officer" }] } as Me;
    session.status = "ready";
    renderAt("/", <App />);
    expect(screen.getAllByRole("link", { name: "Admin" })[0].getAttribute("href")).toBe("/admin/pvc");
    cleanup();
    renderAt("/admin/pvc", <App />);
    expect(screen.getByRole("heading", { level: 1, name: "PVC checks" })).toBeTruthy();
  });
});
