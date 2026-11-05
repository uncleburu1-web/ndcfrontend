/** Admin home, team, users and audit — spec 11 §12 (frontend). */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown> }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));

import { RequireAnyAdmin, RequireSystemAdmin, adminAreas } from "../auth/guards";
import { formatAge } from "../lib/format";
import { AdminNav } from "../pages/admin/AdminNav";
import AdminAuditPage from "../pages/admin/audit/AdminAuditPage";
import AdminHomePage from "../pages/admin/home/AdminHomePage";
import AdminTeamPage from "../pages/admin/team/AdminTeamPage";
import AdminUserPage from "../pages/admin/users/AdminUserPage";
import AdminUsersPage from "../pages/admin/users/AdminUsersPage";
import { clerkState } from "../test/clerkMock";
import type { Overview } from "./types";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireAnyAdmin />}>
            <Route path="/admin" element={<AdminHomePage />} />
          </Route>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin/team" element={<AdminTeamPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/:id" element={<AdminUserPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
          </Route>
          <Route path="*" element={<p>Elsewhere</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

function routes(map: Record<string, unknown | ((opts: Record<string, unknown>, path: string) => unknown)>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const bare = path.split("?")[0];
    const key = `${(opts.method as string) ?? "GET"} ${bare}`;
    const hit = key in map ? map[key] : map[bare];
    if (hit === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    const v = typeof hit === "function" ? (hit as (o: Record<string, unknown>, p: string) => unknown)(opts, path) : hit;
    if (v instanceof Error) throw v;
    return v;
  });
}

const BASE = { full_name: "Sam", email: "sam@example.com", profile_complete: true, roles: [] as { role: string }[] };
const SA = { ...BASE, is_system_admin: true, admin_areas: ["overview", "candidates", "donations", "pvc", "membership", "news", "announcements", "posts", "team", "audit"] };
const NEWS = { ...BASE, is_system_admin: false, roles: [{ role: "news_reviewer" }], admin_areas: ["overview", "news"] };
const PLAIN = { ...BASE, is_system_admin: false, admin_areas: [] };
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const card = (over: Record<string, unknown> = {}) => ({ key: "news_pending", label: "Community news to review", count: 2, href: "/admin/news",
  oldest_at: ago(30), target_hours: 24, target_working_days: null, any_is_warning: false, severity: "warning", ...over });
const overview = (over: Partial<Overview> = {}): Overview => ({
  generated_at: new Date().toISOString(), roles: [{ role: "news_reviewer", label: "News reviewer" }],
  attention: [card() as never], stats: [{ group: "content", label: "Content", stats: [
    { group: "content", key: "community", label: "Community news published", total: 40, this_week: 12, last_week: 8, kobo: false }] }],
  failed: [], blackouts: { active: [], next: null }, ...over,
});

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = true;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ----------------------------------------------------------------- guard + nav
describe("access", () => {
  it("/admin is for any admin role; others see no access", async () => {
    h.me = PLAIN;
    renderAt("/admin");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
    cleanup();
    h.me = NEWS;
    routes({ "/admin/overview/": overview() });
    renderAt("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Admin" })).toBeTruthy();
  });

  it("team, users and audit are system admin only", () => {
    h.me = NEWS;
    renderAt("/admin/team");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("AdminNav: Overview first; officers see their areas; system admins also Team and Audit log", () => {
    h.me = NEWS;
    render(<MemoryRouter><AdminNav current="overview" /></MemoryRouter>);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Overview", "News review"]);
    cleanup();
    h.me = SA;
    render(<MemoryRouter><AdminNav current="team" /></MemoryRouter>);
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names[0]).toBe("Overview");
    expect(names).toContain("Team");
    expect(names).toContain("Audit log");
    expect(screen.getByRole("link", { name: "Team" }).getAttribute("aria-current")).toBe("page");
  });

  it("adminAreas falls back to roles; a candidate link alone isn't admin", () => {
    expect(adminAreas({ is_system_admin: false, roles: [{ role: "candidate" }] })).toEqual([]);
    expect(adminAreas({ is_system_admin: false, roles: [{ role: "finance_officer" }] })).toEqual(["overview", "donations"]);
    expect(formatAge(ago(3))).toBe("3 h");
    expect(formatAge(ago(72))).toBe("3 days");
  });
});

// ------------------------------------------------------------------------ home
describe("/admin home", () => {
  it("renders only the sections in the payload, with severity in words", async () => {
    h.me = NEWS;
    routes({ "/admin/overview/": overview() });
    renderAt("/admin");
    const attn = await screen.findByRole("region", { name: "Needs your attention" });
    expect(within(attn).getByText("Community news to review")).toBeTruthy();
    expect(within(attn).getByText(/Oldest: 30 h/)).toBeTruthy();
    expect(within(attn).getByText("Over target")).toBeTruthy();
    expect(within(attn).getByRole("link", { name: "Open Community news to review" }).getAttribute("href")).toBe("/admin/news");
    expect(screen.getByText("+12 this week")).toBeTruthy();
    expect(screen.getByText(/up from 8 last week/)).toBeTruthy();
    for (const missing of ["Readiness", "Background jobs", "Recent activity"]) expect(screen.queryByRole("heading", { name: missing })).toBeNull();
  });

  it("all clear, blackout banners, failed card", async () => {
    h.me = NEWS;
    routes({ "/admin/overview/": overview({
      attention: [card({ count: 0, severity: "ok" }) as never],
      failed: [{ app: "posts", label: "Candidate posts" }],
      blackouts: { active: [{ offices: ["Governor"], start: ago(1), end: ago(-5), state: "active" }],
        next: { offices: ["President"], start: ago(-48), end: ago(-72), state: "upcoming" } },
    }) });
    renderAt("/admin");
    expect(await screen.findByText("You’re all caught up.")).toBeTruthy();
    expect(screen.getByText(/Campaign blackout for Governor until/)).toBeTruthy();
    expect(screen.getByText(/Next campaign blackout: President/)).toBeTruthy();
    expect(screen.getByText("Couldn’t load Candidate posts.")).toBeTruthy();
  });

  it("system admins see readiness, jobs and activity", async () => {
    h.me = SA;
    routes({ "/admin/overview/": overview({
      readiness: { items: [
        { group: "donations", label: "DONATIONS_COMPLIANCE_APPROVED", state: "not_set", ok: false, detail: "" },
        { group: "inec", label: "INEC voter checker link", state: "ready", ok: true, detail: "" }], blackouts: [] },
      jobs: [{ job: "sweep_payments", label: "Recheck stuck payments", state: "failed", state_label: "Failed", manual: false,
        started_at: ago(1), finished_at: ago(1), summary: "", error: "ProviderError: timeout" }],
      activity: [{ id: "e1", created_at: ago(1), action: "news.approved", action_label: "approved community news", actor: "rita@example.com",
        actor_id: "u1", target_type: "news.article", target_label: "Article", target_id: "a1", link: "/admin/news/a1", summary: "" }],
    }) });
    renderAt("/admin");
    expect(await screen.findByText(/DONATIONS_COMPLIANCE_APPROVED/)).toBeTruthy();
    expect(screen.getByText("Not set")).toBeTruthy();
    expect(screen.getByText("Ready")).toBeTruthy();
    expect(screen.getByText("A background job failed")).toBeTruthy();
    expect(screen.getByText(/ProviderError: timeout/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Article" }).getAttribute("href")).toBe("/admin/news/a1");
    expect(screen.getByRole("link", { name: "See the full audit log" })).toBeTruthy();
  });

  it("refreshes every 60 s only while visible, and keeps the numbers on a failed refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.me = NEWS;
    let n = 2;
    let fail = false;
    routes({ "/admin/overview/": () => (fail ? new ApiError({ status: 500, message: "x" }) : overview({ attention: [card({ count: n }) as never] })) });
    renderAt("/admin");
    await screen.findByText("Community news to review");
    n = 5;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    await waitFor(() => expect(screen.getAllByText("5").length).toBeGreaterThan(0));
    const calls = h.api.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(h.api.mock.calls.length).toBe(calls);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Couldn’t refresh just now. Showing the last numbers.")).toBeTruthy();
    expect(screen.getByText("Community news to review")).toBeTruthy();
  });
});

// ------------------------------------------------------------------------ team
const assignment = (over: Record<string, unknown> = {}) => ({
  id: "a1", role: "news_reviewer", role_label: "News reviewer", scope_type: "global", scope_id: null, scope_label: "Everywhere",
  user: { id: "u2", full_name: "Rita Reviewer", email: "rita@example.com", is_active: true }, note: "", granted_by: "sam@example.com",
  granted_at: ago(48), is_active: true, revoked_at: null, revoked_by: null, is_own: false, ...over,
});
const GRANTABLE = [{ role: "system_admin", label: "System administrator", description: "manage every admin area, people, roles and settings" },
  { role: "news_reviewer", label: "News reviewer", description: "approve or reject community news and act on news reports" }];

describe("/admin/team", () => {
  it("grants with a confirmation and the system admin warning; error codes in words", async () => {
    h.me = SA;
    let body: unknown = null;
    let attempt = 0;
    routes({
      "/admin/team/": { results: [assignment({ id: "own", role: "system_admin", role_label: "System administrator", is_own: true,
        user: { id: "u1", full_name: "Sam", email: "sam@example.com", is_active: true } }), assignment()], grantable: GRANTABLE },
      "POST /admin/team/": (o: Record<string, unknown>) => {
        body = o.body;
        attempt += 1;
        return attempt === 1 ? new ApiError({ status: 404, code: "user_not_found", message: "No NDCConnect account uses that email. They need to sign in once first." })
          : assignment({ id: "a9", role: "system_admin", role_label: "System administrator" });
      },
    });
    renderAt("/admin/team");
    expect(await screen.findByRole("heading", { name: "System administrators" })).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: "system_admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Grant role" }));
    const dlg = await screen.findByRole("dialog", { name: "Grant this role?" });
    expect(within(dlg).getByText(/full access to every admin area/)).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Grant role" }));
    expect(await screen.findByText(/They need to sign in once first/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Grant role" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Grant this role?" })).getByRole("button", { name: "Grant role" }));
    await waitFor(() => expect(body).toEqual({ email: "new@example.com", role: "system_admin", note: "" }));
    expect(await screen.findByText(/is now a system administrator/)).toBeTruthy();
  });

  it("revoke with a reason; last-admin message; candidate links are read-only", async () => {
    h.me = SA;
    let sent: unknown = null;
    routes({
      "/admin/team/": { results: [assignment(), assignment({ id: "c1", role: "candidate", role_label: "Candidate", scope_type: "candidate",
        scope_id: "k1", scope_label: "Amina Bello" })], grantable: GRANTABLE },
      "POST /admin/team/a1/revoke/": (o: Record<string, unknown>) => {
        sent = o.body;
        return new ApiError({ status: 409, code: "last_system_admin", message: "There must always be at least one system administrator." });
      },
    });
    renderAt("/admin/team");
    expect((await screen.findByRole("link", { name: "Manage on the candidate page" })).getAttribute("href")).toBe("/admin/candidates/k1");
    fireEvent.click(screen.getByRole("button", { name: "Revoke News reviewer from Rita Reviewer" }));
    const dlg = await screen.findByRole("dialog", { name: "Remove News reviewer?" });
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "Left" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Revoke role" }));
    expect(await screen.findByText(/at least one system administrator/)).toBeTruthy();
    expect(sent).toEqual({ reason: "Left" });
  });

  it("Show revoked asks for revoked rows", async () => {
    h.me = SA;
    routes({ "/admin/team/": { results: [], grantable: GRANTABLE } });
    renderAt("/admin/team");
    fireEvent.click(await screen.findByRole("switch", { name: "Show revoked" }));
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/team/?revoked=1", expect.anything()));
  });
});

// ----------------------------------------------------------------------- users
const userDetail = (over: Record<string, unknown> = {}) => ({
  id: "u2", full_name: "Rita Reviewer", email: "rita@example.com", joined_at: ago(500), profile_complete: true, is_active: true, deleted: false,
  roles: [{ role: "news_reviewer", scope_type: "global" }], phone_masked: "•••• 4567", updated_at: ago(10), deactivated_at: null,
  clerk_deleted_at: null, deactivation: null, assignments: [assignment()], recent_actions: [], is_self: false, ...over,
});

describe("/admin/users", () => {
  it("needs 3 characters, then searches; filters stay in the URL", async () => {
    h.me = SA;
    routes({ "/admin/users/": { count: 1, results: [{ ...userDetail(), roles: [{ role: "news_reviewer", scope_type: "global" }] }] } });
    renderAt("/admin/users");
    expect(screen.getByText("Search for an account")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Name or email/), { target: { value: "ri" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Type at least 3 characters.")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Name or email/), { target: { value: "rita" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("link", { name: "Rita Reviewer" })).toBeTruthy();
    expect(screen.getByText("News reviewer")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "deactivated" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/users?q=rita&status=deactivated"));
  });

  it("account page: no political data, phone reveal, deactivate needs a reason, Retry sign-in block", async () => {
    h.me = SA;
    let reason: unknown = null;
    routes({
      "/admin/users/u2/": userDetail(),
      "/admin/team/": { results: [], grantable: GRANTABLE },
      "POST /admin/users/u2/phone/": { phone_number: "+2348031234567" },
      "POST /admin/users/u2/deactivate/": (o: Record<string, unknown>) => {
        reason = (o.body as { reason: string }).reason;
        return { user: userDetail({ is_active: false, deactivation: { at: ago(0), by: "sam@example.com", reason, clerk_ban: "failed" } }), clerk_ban: "failed" };
      },
    });
    renderAt("/admin/users/u2");
    expect(await screen.findByRole("heading", { level: 1, name: "Rita Reviewer" })).toBeTruthy();
    const text = Array.from(document.querySelectorAll(".adm-panel")).map((x) => x.textContent).join(" ");  // page content, not the nav
    for (const word of ["Follow", "Donation", "Membership", "VIN", "PVC"]) expect(text).not.toContain(word);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText(/\+2348031234567/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    const dlg = await screen.findByRole("dialog", { name: "Deactivate this account?" });
    const confirm = within(dlg).getByRole("button", { name: "Deactivate" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dlg).getByLabelText(/Reason/), { target: { value: "Spam" } });
    fireEvent.click(confirm);
    expect(await screen.findByText("Sign-in block failed")).toBeTruthy();
    expect(reason).toBe("Spam");
    fireEvent.click(screen.getByRole("button", { name: "Retry sign-in block" }));
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/users/u2/deactivate/", expect.objectContaining({ body: { reason: "Spam" } })));
  });

  it("your own account has no Deactivate", async () => {
    h.me = SA;
    routes({ "/admin/users/u1/": userDetail({ id: "u1", is_self: true }), "/admin/team/": { results: [], grantable: GRANTABLE } });
    renderAt("/admin/users/u1");
    expect(await screen.findByText("This is you")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Deactivate" })).toBeNull();
  });
});

// ----------------------------------------------------------------------- audit
describe("/admin/audit", () => {
  it("filters live in the URL; rows expand with details", async () => {
    h.me = SA;
    routes({
      "/admin/audit/actions/": { areas: [{ area: "news", label: "News", actions: [{ action: "news.approved", label: "approved community news" }] },
        { area: "audit", label: "Audit views", actions: [] }] },
      "/admin/audit/": { count: 1, results: [{ id: "e1", created_at: ago(2), action: "news.approved", action_label: "approved community news",
        actor: "rita@example.com", actor_id: "u2", target_type: "news.article", target_label: "Article", target_id: "a1", link: "/admin/news/a1",
        summary: "", metadata: {}, ip_address: "10.0.0.1", user_agent: "Firefox" }] },
    });
    renderAt("/admin/audit");
    expect(await screen.findByText(/approved community news/, { selector: "summary *, summary" })).toBeTruthy();
    fireEvent.change(await screen.findByLabelText("Area"), { target: { value: "news" } });
    fireEvent.change(screen.getByLabelText(/^Who/), { target: { value: "rita@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/audit?area=news&actor=rita%40example.com"));
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/audit/?area=news&actor=rita%40example.com", expect.anything()));
    expect(screen.getByText(/"ip": "10.0.0.1"/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the article" }).getAttribute("href")).toBe("/admin/news/a1");
  });
});
