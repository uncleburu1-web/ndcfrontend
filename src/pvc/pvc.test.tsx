/** PVC as its own unit — spec 08 §12 (frontend). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown>, refresh: vi.fn() }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: h.refresh }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));
vi.mock("../donations/navigation", () => ({ redirectTo: vi.fn() }));

import { ApiError } from "../auth/api";
import { RequirePvcOfficer } from "../auth/guards";
import AdminPvcPage, { waitText, workingDaysSince } from "../pages/admin/pvc/AdminPvcPage";
import AdminPvcSettingsPage from "../pages/admin/pvc/AdminPvcSettingsPage";
import AccountPage from "../pages/auth/AccountPage";
import JoinPage from "../pages/join/JoinPage";
import ArticlePage from "../pages/news/ArticlePage";
import NotificationsPage from "../pages/news/NotificationsPage";
import PvcPage from "../pages/pvc/PvcPage";
import { clerkState } from "../test/clerkMock";

vi.mock("../auth/ProfileForm", () => ({ ProfileForm: () => <p>Profile form</p> }));

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/pvc" element={<PvcPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/news/community/:id" element={<ArticlePage source="community" />} />
          <Route element={<RequirePvcOfficer />}>
            <Route path="/admin/pvc" element={<AdminPvcPage />} />
            <Route path="/admin/pvc/settings" element={<AdminPvcSettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

function routes(map: Record<string, unknown | ((opts: Record<string, unknown>) => unknown)>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const bare = path.split("?")[0];
    const key = `${(opts.method as string) ?? "GET"} ${bare}`;
    const hit = key in map ? map[key] : map[bare];
    if (hit === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    const v = typeof hit === "function" ? (hit as (o: Record<string, unknown>) => unknown)(opts) : hit;
    if (v instanceof Error) throw v;
    return v;
  });
}

const ME = { full_name: "Ada Obi", email: "ada@example.com", profile_complete: true, is_system_admin: false, roles: [], pvc_status: "unverified" };
const CONFIG = { inec_pvc_url: null, inec_voter_check_url: "https://cvr.inecnigeria.org/vvs", guidance_note: "", collection_note: "Collect at INEC LGA offices." };
const VERIFIED = { status: "successful", vin_masked: "•••• 2345", surname: "Obi", lga: "Ikeja", state_label: "Lagos", reviewed_at: "2026-11-01T10:00:00Z", show_badge: false };

beforeEach(() => {
  h.api.mockReset();
  h.refresh.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
});
afterEach(cleanup);

describe("/pvc", () => {
  it("pending: says a notification will follow", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": CONFIG, "GET /me/pvc/": { status: "pending", vin_masked: "•••• 2345", surname: "Obi" }, "/me/membership/": { status: null } });
    renderAt("/pvc");
    expect(await screen.findByText(/We’ll send you a notification when it’s done/)).toBeTruthy();
  });

  it("successful: Verified voter badge, public-badge switch, Join link hidden for active members", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, pvc_status: "successful" };
    routes({ "/pvc/config/": CONFIG, "GET /me/pvc/": VERIFIED, "/me/membership/": { status: "active" },
      "PATCH /me/pvc/badge/": { ...VERIFIED, show_badge: true } });
    renderAt("/pvc");
    expect(await screen.findByText("Verified voter")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: "Continue to Join NDC" })).toBeNull());
    fireEvent.click(screen.getByRole("switch", { name: /Show my Verified voter badge publicly/ }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/pvc/badge/", { method: "PATCH", body: { show_badge: true } }));
    expect(await screen.findByText(/will show beside your name/)).toBeTruthy();
  });

  it("successful but not a member: offers Join; rejected: try again keeps details except the VIN", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": CONFIG, "GET /me/pvc/": VERIFIED, "/me/membership/": { status: null } });
    renderAt("/pvc");
    expect((await screen.findByRole("link", { name: "Continue to Join NDC" })).getAttribute("href")).toBe("/join");
    cleanup();
    routes({ "/pvc/config/": CONFIG, "GET /me/pvc/": { status: "rejected", reason: "Not found in Kano", surname: "Obi", state: "kano", lga: "Nassarawa", vin_masked: "•••• 2345" },
      "/me/membership/": { status: null } });
    renderAt("/pvc");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect((screen.getByLabelText(/^Surname/) as HTMLInputElement).value).toBe("Obi");
    expect((screen.getByLabelText(/^VIN/) as HTMLInputElement).value).toBe("");
  });

  it("submitting refreshes /me so the badge, menu and /join stay in step", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": CONFIG, "GET /me/pvc/": { status: "unverified" }, "/me/membership/": { status: null },
      "PUT /me/pvc/": { status: "pending", vin_masked: "•••• 2345", surname: "Obi" } });
    renderAt("/pvc");
    fireEvent.change(await screen.findByLabelText(/^VIN/), { target: { value: "90F5B0F8E0295612345" } });
    fireEvent.click(screen.getByRole("button", { name: "Send for checking" }));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });

  it("config failure still shows the form and a fallback line", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": new ApiError({ status: 503 }), "GET /me/pvc/": { status: "unverified" }, "/me/membership/": { status: null } });
    renderAt("/pvc");
    expect(await screen.findByText(/INEC’s links couldn’t load/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send for checking" })).toBeTruthy();
  });
});

describe("badge elsewhere", () => {
  it("account page shows the voter status from /me", () => {
    clerkState.isSignedIn = true;
    routes({ "/me/geo-confirm/": { results: [] } });
    h.me = { ...ME, pvc_status: "successful" };
    renderAt("/account");
    expect(screen.getByRole("heading", { name: "Voter status" })).toBeTruthy();
    expect(screen.getByText("Verified voter")).toBeTruthy();
    cleanup();
    h.me = { ...ME, pvc_status: "pending" };
    renderAt("/account");
    expect(screen.getByRole("link", { name: "See status" }).getAttribute("href")).toBe("/pvc");
  });

  it("/join step 1 uses me.pvc_status and never calls /me/pvc/", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, pvc_status: "successful" };
    routes({ "/membership/config/": { open: true, fee_kobo: 2_000_000, requires_approval: true }, "/me/membership/": { status: null, display_status: "pvc_verified" } });
    renderAt("/join");
    expect(await screen.findByText("Verified voter")).toBeTruthy();
    expect(h.api.mock.calls.some(([p]) => p === "/me/pvc/")).toBe(false);
  });

  it("community byline shows the badge only when byline_verified", async () => {
    const article = { id: "c1", source: "community", category: "", category_label: "", title: "Polls open", excerpt: "", state: "", state_label: "",
      image: null, published_at: "2026-11-01T10:00:00Z", edited_at: null, byline: "Ada Obi", byline_verified: true, pinned: false, body: "Text", source_name: "", source_url: "" };
    routes({ "/news/c1/": article });
    renderAt("/news/community/c1");
    expect(await screen.findByText("Verified voter")).toBeTruthy();
    cleanup();
    routes({ "/news/c1/": { ...article, byline: null, byline_verified: false } });
    renderAt("/news/community/c1");
    await screen.findByRole("heading", { name: "Polls open" });
    expect(screen.queryByText("Verified voter")).toBeNull();
  });

  it("notifications render PVC decisions and link to /pvc", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/notifications/": { results: [
        { id: "n1", kind: "pvc_decision", created_at: "2026-11-01T10:00:00Z", read_at: null, decision: "verified", article: null },
        { id: "n2", kind: "pvc_decision", created_at: "2026-11-01T09:00:00Z", read_at: null, decision: "rejected", article: null },
      ] },
      "/me/notifications/preferences/": { announcements: true },
    });
    renderAt("/notifications");
    expect(await screen.findByText("Your PVC is verified. You can now join the NDC.")).toBeTruthy();
    const rejected = screen.getByText("We couldn’t verify your PVC. See why and try again.");
    expect(rejected.closest("a")?.getAttribute("href")).toBe("/pvc");
  });
});

describe("officer queue", () => {
  const row = (over: Record<string, unknown> = {}) => ({ id: "p1", status: "pending", vin_masked: "•••• 2345", surname: "Obi", state: "kano",
    state_label: "Kano", lga: "Nassarawa", polling_unit: "", user_name: "Ada Obi", user_email: "ada@example.com", reviewed_by_email: null,
    created_at: "2026-10-20T09:00:00Z", is_own: false, events: [{ kind: "submitted", note: "", created_at: "2026-10-20T09:00:00Z", actor_email: null }], ...over });

  it("PVC officers are allowed; others aren't", () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, roles: [{ role: "news_reviewer" }] };
    renderAt("/admin/pvc");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("turnaround warning, state filter, history and own-check guard", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, roles: [{ role: "pvc_officer" }] };
    routes({ "/admin/pvc/": { count: 2, results: [row(), row({ id: "p2", user_name: "Pat Officer", is_own: true })], lookup_url: "https://cvr.inecnigeria.org/vvs",
      pending_count: 2, oldest_pending_at: "2026-10-20T09:00:00Z" } });
    renderAt("/admin/pvc");
    expect(await screen.findByText(/Past the 3 working days/)).toBeTruthy();
    expect(screen.getAllByText(/History \(1\)/)).toHaveLength(2);
    const own = screen.getByRole("heading", { name: "Pat Officer" }).closest("li")!;
    expect(within(own).getByText(/This is your own check/)).toBeTruthy();
    expect(within(own).queryByRole("button", { name: "Mark verified" })).toBeNull();
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "kano" } });
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/pvc/?status=pending&state=kano", expect.anything()));
  });

  it("settings: read-only for officers, editable for system admins", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, roles: [{ role: "pvc_officer" }] };
    routes({ "/admin/pvc/settings/": CONFIG });
    renderAt("/admin/pvc/settings");
    expect(await screen.findByText("Only a system admin can change these.")).toBeTruthy();
    expect((screen.getByLabelText(/^Collection note/) as HTMLTextAreaElement).disabled).toBe(true);
    cleanup();
    h.me = { ...ME, is_system_admin: true };
    routes({ "/admin/pvc/settings/": CONFIG, "PATCH /admin/pvc/settings/": (o: Record<string, unknown>) => ({ ...CONFIG, ...(o.body as object) }) });
    renderAt("/admin/pvc/settings");
    fireEvent.change(await screen.findByLabelText(/^Current guidance/), { target: { value: "Registration is closed." } });
    fireEvent.click(screen.getByRole("button", { name: "Save guidance" }));
    expect(await screen.findByText(/Saved\. It shows on \/pvc/)).toBeTruthy();
  });

  it("working-day and wait helpers", () => {
    expect(workingDaysSince(new Date("2026-10-30T09:00:00"), new Date("2026-11-02T10:00:00"))).toBe(1); // Fri → Mon
    expect(waitText("2026-11-01T00:00:00Z", new Date("2026-11-02T04:00:00Z"))).toBe("1 day 4 hours");
  });
});
