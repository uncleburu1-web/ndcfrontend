/** Candidate posts — spec 09 §12 (frontend). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../donations/DonationConfigProvider", () => ({
  useDonationConfig: () => ({ config: { open: false, min_kobo: 50000, max_per_payment_kobo: 500000000, presets_kobo: [] }, loading: false }),
}));

import { RequireSignedIn, RequireSystemAdmin } from "../auth/guards";
import { FollowProvider } from "../follows/FollowProvider";
import AdminPostDetailPage from "../pages/admin/posts/AdminPostDetailPage";
import AdminPostsPage from "../pages/admin/posts/AdminPostsPage";
import CampaignCandidatePage from "../pages/campaign/CampaignCandidatePage";
import CampaignHomePage from "../pages/campaign/CampaignHomePage";
import CandidatePostPage from "../pages/candidates/CandidatePostPage";
import CandidateProfilePage from "../pages/candidates/CandidateProfilePage";
import NewsPage from "../pages/news/NewsPage";
import NotificationsPage from "../pages/news/NotificationsPage";
import { clerkState } from "../test/clerkMock";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <FollowProvider>
          <Routes>
            <Route path="/news" element={<NewsPage />} />
            <Route path="/candidates/:slug" element={<CandidateProfilePage />} />
            <Route path="/candidates/:slug/posts/:id" element={<CandidatePostPage />} />
            <Route element={<RequireSignedIn />}>
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/campaign" element={<CampaignHomePage />} />
              <Route path="/campaign/:candidateId" element={<CampaignCandidatePage />} />
            </Route>
            <Route element={<RequireSystemAdmin />}>
              <Route path="/admin/posts" element={<AdminPostsPage />} />
              <Route path="/admin/posts/:id" element={<AdminPostDetailPage />} />
            </Route>
          </Routes>
          <Where />
        </FollowProvider>
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

const ME = { full_name: "Ada Obi", email: "ada@example.com", profile_complete: true, is_system_admin: false, roles: [] };
const CAMPAIGN = { ...ME, roles: [{ role: "candidate", scope_type: "candidate", scope_id: "k1" }] };
const ADMIN = { ...ME, is_system_admin: true };
const CAND = { id: "k1", slug: "amina-bello", full_name: "Amina Bello", position: "governor", position_label: "Governor", state: "kano", photo: null, verified: true };
const camp = (over: Record<string, unknown> = {}) => ({ ...CAND, status: "published", published: true, notify_count: 312, posting_paused_until: null, ...over });
const post = (over: Record<string, unknown> = {}) => ({
  id: "p1", kind: "announcement", kind_label: "Announcement", title: "Town hall in Kano", excerpt: "Join us…", body: "Join us at the town hall.\n\nSee https://example.com for details.",
  image: null, published_at: "2026-11-01T10:00:00Z", edited_at: null, candidate: CAND, ...over,
});
const campaignPost = (over: Record<string, unknown> = {}) => ({ ...post(), status: "published", status_label: "Published", removed_reason: "", removed_at: null, created_at: "2026-11-01T10:00:00Z", ...over });
const PROFILE = { ...CAND, party: "NDC", election_year: 2027, area_display: "Kano State", biography: "Bio.", campaign_summary: "Jobs.", priorities: [], links: [] };

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
});
afterEach(cleanup);

// --------------------------------------------------------------- public
describe("public pages", () => {
  it("profile shows a Posts tab only when the candidate has posts", async () => {
    routes({ "/candidates/amina-bello/": PROFILE, "/candidates/amina-bello/posts/": { count: 0, results: [] } });
    renderAt("/candidates/amina-bello");
    expect(await screen.findByRole("heading", { level: 1, name: /Amina Bello/ })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /Posts/ })).toBeNull();
    cleanup();
    routes({ "/candidates/amina-bello/": PROFILE, "/candidates/amina-bello/posts/": { count: 1, results: [post()] } });
    renderAt("/candidates/amina-bello");
    fireEvent.click(await screen.findByRole("tab", { name: "Posts (1)" }));
    expect((await screen.findByRole("link", { name: "Town hall in Kano" })).getAttribute("href")).toBe("/candidates/amina-bello/posts/p1");
  });

  it("post page: attribution in words, campaign line, Edited, safe links, Report", async () => {
    routes({ "/candidates/amina-bello/posts/p1/": post({ edited_at: "2026-11-01T12:00:00Z" }) });
    renderAt("/candidates/amina-bello/posts/p1");
    expect(await screen.findByRole("heading", { level: 1, name: "Town hall in Kano" })).toBeTruthy();
    expect(screen.getByText("Posted by Amina Bello")).toBeTruthy();
    expect(screen.queryByText("Official")).toBeNull();
    expect(screen.getByText(/Campaign content from Amina Bello/)).toBeTruthy();
    expect(screen.getByText(/Edited/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link.getAttribute("rel")).toContain("nofollow");
    fireEvent.click(screen.getByRole("button", { name: "Report" }));
    expect(await screen.findByRole("dialog", { name: "Report this post" })).toBeTruthy();
  });

  it("post page 404", async () => {
    routes({});
    renderAt("/candidates/amina-bello/posts/nope");
    expect(await screen.findByText("Post not found")).toBeTruthy();
  });

  it("/news Candidates tab; candidate items say Posted by …", async () => {
    routes({ "/news/": { count: 1, next: null, previous: null, pinned: [], results: [{ ...post(), source: "candidate", state: "kano", state_label: "Kano" }] } });
    renderAt("/news?source=candidate");
    expect(await screen.findByText("Posted by Amina Bello")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Candidates" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Town hall in Kano" }).getAttribute("href")).toBe("/candidates/amina-bello/posts/p1");
  });
});

// ------------------------------------------------------------- campaign
describe("/campaign", () => {
  beforeEach(() => {
    clerkState.isSignedIn = true;
    h.me = CAMPAIGN;
  });

  it("no linked candidate → no access", async () => {
    routes({ "/campaign/candidates/": { results: [] } });
    renderAt("/campaign");
    expect(await screen.findByText("You don’t have access to this page")).toBeTruthy();
  });

  it("one candidate goes straight to it; several show a picker", async () => {
    routes({ "/campaign/candidates/": { results: [camp()] }, "/campaign/candidates/k1/posts/": { results: [], candidate: camp() } });
    renderAt("/campaign");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/campaign/k1"));
    cleanup();
    routes({ "/campaign/candidates/": { results: [camp(), camp({ id: "k2", slug: "bayo", full_name: "Bayo Ade" })] } });
    renderAt("/campaign");
    expect((await screen.findByRole("link", { name: /Bayo Ade/ })).getAttribute("href")).toBe("/campaign/k2");
  });

  it("not linked to this candidate → no access", async () => {
    routes({ "/campaign/candidates/k9/posts/": new ApiError({ status: 403, code: "permission_denied", message: "No" }) });
    renderAt("/campaign/k9");
    expect(await screen.findByText("You don’t have access to this page")).toBeTruthy();
  });

  it("validates, counts, confirms with the notify count, then publishes", async () => {
    let sent: unknown = null;
    routes({
      "/campaign/candidates/k1/posts/": { results: [], candidate: camp() },
      "POST /campaign/candidates/k1/posts/": (o: Record<string, unknown>) => { sent = o.body; return campaignPost({ title: "Rally Saturday" }); },
    });
    renderAt("/campaign/k1");
    fireEvent.click((await screen.findAllByRole("button", { name: "New post" }))[0]);
    expect(screen.getByText(/Electoral Act 2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Choose Announcement or News.")).toBeTruthy();
    expect(screen.getByText("Give it a title.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("News"));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Rally Saturday" } });
    fireEvent.change(screen.getByRole("textbox", { name: /^Post/ }), { target: { value: "Come out." } });
    expect(screen.getByText("14 / 150")).toBeTruthy();
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Choose an image"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/Confirm you took this photo/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Choose an image"), { target: { files: [] } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish now?" });
    expect(within(dialog).getByText(/312 followers with notifications on will be notified/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish now" }));
    expect(await screen.findByRole("link", { name: "Rally Saturday" })).toBeTruthy();
    expect(sent).toEqual({ kind: "news", title: "Rally Saturday", body: "Come out." });
  });

  it("edit says followers won't be notified again; delete asks first", async () => {
    routes({
      "/campaign/candidates/k1/posts/": { results: [campaignPost()], candidate: camp() },
      "PATCH /campaign/candidates/k1/posts/p1/": campaignPost({ edited_at: "2026-11-01T11:00:00Z" }),
      "DELETE /campaign/candidates/k1/posts/p1/": null,
    });
    renderAt("/campaign/k1");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const dialog = await screen.findByRole("dialog", { name: "Save changes?" });
    expect(within(dialog).getByText(/Followers won’t be notified again/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/Edited/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Delete this post?" })).getByRole("button", { name: "Delete post" }));
    expect(await screen.findByText("No posts yet")).toBeTruthy();
  });

  it("paused banner hides New post and Edit; removed posts show the reason", async () => {
    routes({ "/campaign/candidates/k1/posts/": { results: [campaignPost({ status: "removed", removed_reason: "False or unsourced election results." })],
      candidate: camp({ posting_paused_until: "2027-01-16T07:00:00Z" }) } });
    renderAt("/campaign/k1");
    expect(await screen.findByText("Posting is paused")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New post" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByText("False or unsourced election results.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("unpublished candidate shows a banner", async () => {
    routes({ "/campaign/candidates/k1/posts/": { results: [], candidate: camp({ published: false, status: "draft" }) } });
    renderAt("/campaign/k1");
    expect(await screen.findByText(/isn’t published/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New post" })).toBeNull();
  });
});

// -------------------------------------------------------- notifications
describe("notifications", () => {
  it("candidate items link to the post; the empty state points to /following", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/notifications/": { results: [{ id: "n1", kind: "candidate_post", created_at: "2026-11-01T10:00:00Z", read_at: null, decision: "",
        article: null, post: { id: "p1", kind: "announcement", kind_label: "Announcement", title: "Town hall" }, candidate: { slug: "amina-bello", full_name: "Amina Bello", photo: null } }] },
      "/me/notifications/preferences/": { announcements: true },
      "POST /me/notifications/n1/read/": { ok: true },
    });
    renderAt("/notifications");
    fireEvent.click(await screen.findByText(/Amina Bello .*Town hall/));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/candidates/amina-bello/posts/p1"));
    cleanup();
    routes({ "/me/notifications/": { results: [] }, "/me/notifications/preferences/": { announcements: true } });
    renderAt("/notifications");
    expect((await screen.findByRole("link", { name: "See who you follow" })).getAttribute("href")).toBe("/following");
  });
});

// ---------------------------------------------------------------- admin
describe("/admin/posts", () => {
  const adminPost = (over: Record<string, unknown> = {}) => ({ ...campaignPost(), author_email: "camp@example.com", editor_email: "", open_reports: 2,
    events: [{ event: "published", note: "", created_at: "2026-11-01T10:00:00Z", actor_email: "camp@example.com" }],
    case: { id: "k1", status: "open", priority: "urgent", decision: "", rule: "", open_reports: 1, reports: 1 }, ...over });

  it("is closed to non-admins", () => {
    clerkState.isSignedIn = true;
    h.me = CAMPAIGN;
    renderAt("/admin/posts");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("lists with the reported count; Reported goes to the moderation queue (spec 13)", async () => {
    clerkState.isSignedIn = true;
    h.me = ADMIN;
    routes({ "/admin/posts/": { count: 1, results: [adminPost()], counts: { reported: 1, oldest_open_report: "2026-11-01T11:00:00Z" } } });
    renderAt("/admin/posts");
    expect(await screen.findByRole("link", { name: "Reported (1)" })).toBeTruthy();
    expect(screen.getByText(/Oldest open report/)).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Reported (1)" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/moderation?type=posts"));
  });

  it("remove with a reason and a rule, restore, the case link and the self-moderation message", async () => {
    clerkState.isSignedIn = true;
    h.me = ADMIN;
    let removedWith: unknown = null;
    routes({
      "/admin/posts/p1/": adminPost(),
      "POST /admin/posts/p1/remove/": (o: Record<string, unknown>) => { removedWith = o.body; return adminPost({ status: "removed", removed_reason: (o.body as { reason: string }).reason, open_reports: 0 }); },
      "POST /admin/posts/p1/restore/": adminPost(),
    });
    renderAt("/admin/posts/p1");
    expect((await screen.findByRole("link", { name: "Reports: open the case" })).getAttribute("href")).toBe("/admin/moderation/k1");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    let dialog = await screen.findByRole("dialog", { name: "Remove this post?" });
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "False or unsourced election results." } });
    expect((within(dialog).getByRole("button", { name: "Remove post" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove post" }));
    expect(await screen.findByRole("button", { name: "Restore" })).toBeTruthy();
    expect(removedWith).toEqual({ reason: "False or unsourced election results.", rule: "R3", note_to_author: "False or unsourced election results." });
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByRole("button", { name: "Remove" })).toBeTruthy();
    // linked admins: the server refuses, the page explains
    routes({ "/admin/posts/p1/": adminPost(), "POST /admin/posts/p1/remove/": new ApiError({ status: 403, code: "self_moderation", message: "x" }) });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    dialog = await screen.findByRole("dialog", { name: "Remove this post?" });
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove post" }));
    expect(await screen.findByText(/another admin has to act on this post/)).toBeTruthy();
  });
});
