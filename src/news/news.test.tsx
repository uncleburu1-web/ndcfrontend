/** News, official announcements and notifications — spec 07 §12 (frontend). */
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

import { RequireNewsReviewer, RequireProfileComplete, RequireSignedIn, RequireSystemAdmin } from "../auth/guards";
import { NotificationBell, badgeText } from "../notifications/NotificationBell";
import { POLL_MS } from "../notifications/useUnreadCount";
import AdminAnnouncementsPage from "../pages/admin/announcements/AdminAnnouncementsPage";
import AnnouncementFormPage from "../pages/admin/announcements/AnnouncementFormPage";
import AdminNewsDetailPage from "../pages/admin/news/AdminNewsDetailPage";
import AdminNewsPage from "../pages/admin/news/AdminNewsPage";
import ArticlePage from "../pages/news/ArticlePage";
import MyNewsPage from "../pages/news/MyNewsPage";
import NewsPage from "../pages/news/NewsPage";
import NotificationsPage from "../pages/news/NotificationsPage";
import SubmitNewsPage from "../pages/news/SubmitNewsPage";
import { clerkState } from "../test/clerkMock";
import { ArticleBody } from "./ArticleBody";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/news" element={<NewsPage />} />
          <Route path="/news/official/:id" element={<ArticlePage source="official" />} />
          <Route path="/news/community/:id" element={<ArticlePage source="community" />} />
          <Route element={<RequireSignedIn />}>
            <Route path="/news/mine" element={<MyNewsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route element={<RequireProfileComplete />}>
              <Route path="/news/submit" element={<SubmitNewsPage />} />
              <Route path="/news/mine/:id" element={<SubmitNewsPage />} />
            </Route>
          </Route>
          <Route path="/setup-profile" element={<p>Setup profile page</p>} />
          <Route element={<RequireNewsReviewer />}>
            <Route path="/admin/news" element={<AdminNewsPage />} />
            <Route path="/admin/news/:id" element={<AdminNewsDetailPage />} />
          </Route>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/announcements/new" element={<AnnouncementFormPage />} />
            <Route path="/admin/announcements/:id" element={<AnnouncementFormPage />} />
          </Route>
        </Routes>
        <Where />
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
const REVIEWER = { ...ME, full_name: "Rita", roles: [{ role: "news_reviewer" }] };
const ADMIN = { ...ME, is_system_admin: true };
const official = (over: Record<string, unknown> = {}) => ({
  id: "o1", source: "official", category: "party", category_label: "Party Announcements", title: "Rally on Saturday", excerpt: "Details…",
  state: "", state_label: "", image: null, published_at: "2026-11-01T10:00:00Z", edited_at: null, byline: null, pinned: false, ...over,
});
const community = (over: Record<string, unknown> = {}) => ({
  ...official(), id: "c1", source: "community", category: "", category_label: "", title: "Polls open early in Ikeja", state: "lagos",
  state_label: "Lagos", ...over,
});
const BODY = "Polling units in Ikeja opened on time this morning, according to INEC officers on ground. ".repeat(2);

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ------------------------------------------------------------------ /news
describe("/news", () => {
  it("shows pinned first, then items, with badges that say official vs community in words", async () => {
    routes({ "/news/": { count: 2, next: null, previous: null, pinned: [official({ id: "p1", title: "Pinned one", pinned: true })],
      results: [official(), community({ byline: "Ada Obi" })] } });
    renderAt("/news");
    await screen.findByText("Pinned one");
    const items = Array.from(document.querySelectorAll<HTMLElement>(".news-item"));
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByText("Pinned one")).toBeTruthy();
    expect(within(items[0]).getByText("Pinned")).toBeTruthy();
    expect(screen.getAllByText("Official").length).toBeGreaterThan(0);
    expect(screen.getByText("Submitted by a member · Reviewed")).toBeTruthy();
    expect(screen.getByText(/by Ada Obi/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Polls open early in Ikeja" }).getAttribute("href")).toBe("/news/community/c1");
  });

  it("keeps the source tab and state filter in the URL", async () => {
    routes({ "/news/": { count: 0, next: null, previous: null, pinned: [], results: [] } });
    renderAt("/news");
    fireEvent.click(await screen.findByRole("link", { name: "Community" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/news?source=community"));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "lagos" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/news?source=community&state=lagos"));
    expect(await screen.findByText("No community news for Lagos yet")).toBeTruthy();
    expect(h.api).toHaveBeenLastCalledWith("/news/?source=community&state=lagos", expect.objectContaining({ anonymous: true }));
  });

  it("sends guests who tap Submit news to sign-in", async () => {
    routes({ "/news/": { count: 0, next: null, previous: null, pinned: [], results: [] } });
    renderAt("/news");
    expect((await screen.findAllByRole("link", { name: "Submit news" }))[0].getAttribute("href")).toBe("/sign-in?redirect_url=%2Fnews%2Fsubmit");
  });
});

// ------------------------------------------------------------ article page
describe("article pages", () => {
  it("community: byline, disclaimer, source and safe links", async () => {
    routes({ "/news/c1/": { ...community(), body: `${BODY}\n\nSee https://inecelectionresults.ng/pu.`, source_name: "", source_url: "https://inec.example/x",
      edited_at: "2026-11-01T12:00:00Z" } });
    renderAt("/news/community/c1");
    expect(await screen.findByRole("heading", { name: "Polls open early in Ikeja" })).toBeTruthy();
    expect(document.querySelector(".news-meta")?.textContent).toMatch(/^by a member · /);
    expect(screen.getByText(/It isn’t an official NDC statement/)).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    const link = screen.getByRole("link", { name: "https://inecelectionresults.ng/pu" });
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("link", { name: "https://inec.example/x" })).toBeTruthy();
  });

  it("official: no disclaimer; wrong source or missing → not found", async () => {
    routes({ "/news/o1/": { ...official(), body: "Hello", source_name: "INEC", source_url: "https://inec.example" } });
    renderAt("/news/official/o1");
    expect(await screen.findByText("Source: INEC —", { exact: false })).toBeTruthy();
    expect(screen.queryByText(/isn’t an official NDC statement/)).toBeNull();
    cleanup();
    routes({ "/news/o1/": { ...official(), body: "Hello", source_name: "", source_url: "" } });
    renderAt("/news/community/o1");
    expect(await screen.findByText("Article not found")).toBeTruthy();
    cleanup();
    routes({});
    renderAt("/news/community/zzz");
    expect(await screen.findByText("Article not found")).toBeTruthy();
  });

  it("reports privately, as a guest with optional email", async () => {
    routes({ "/news/c1/": { ...community(), body: BODY, source_name: "", source_url: "" }, "POST /news/c1/report/": { reference: "RPT-7K2Q9M" } });
    renderAt("/news/community/c1");
    fireEvent.click(await screen.findByRole("button", { name: "Report" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Reports are private/)).toBeTruthy();
    const send = within(dialog).getByRole("button", { name: "Send report" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(within(dialog).getByLabelText("False or misleading (R4)"));
    fireEvent.change(within(dialog).getByLabelText(/Your email/), { target: { value: "me@example.com" } });
    fireEvent.click(send);
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/news/c1/report/",
      { method: "POST", body: { reason: "false", details: "", contact_email: "me@example.com" }, anonymous: true }));
    expect(await screen.findByText("RPT-7K2Q9M")).toBeTruthy(); // spec 13: the reference, with Copy
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Check a report" })).toBeTruthy();
  });

  it("ArticleBody never renders HTML", () => {
    const { container } = render(<ArticleBody body={"<b>bold</b> text\n\nnext http://insecure.example"} />);
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>bold</b>");
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("a")).toBeNull(); // only https links
  });
});

// ------------------------------------------------------------------ submit
describe("/news/submit", () => {
  it("needs a completed profile", () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, profile_complete: false };
    renderAt("/news/submit");
    expect(screen.getByText("Setup profile page")).toBeTruthy();
  });

  it("validates locally, defaults the byline to 'a member', and shows the confirmation", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "POST /me/news/": (o: Record<string, unknown>) => ({ id: "n1", status: "pending", ...(o.body as object) }) });
    renderAt("/news/submit");
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(screen.getByText("Give it a title.")).toBeTruthy();
    expect(screen.getByText("Write at least 100 characters.")).toBeTruthy();
    expect(screen.getAllByText("Tick this to continue.")).toHaveLength(3);
    expect(h.api).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Show as “a member”") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/Results must come from INEC/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Polls open early" } });
    fireEvent.change(screen.getByLabelText(/^Your news/), { target: { value: BODY } });
    expect(screen.getByText(`${BODY.length} / 5,000`)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Source link/), { target: { value: "https://inec.example/x" } });
    for (const cb of [/accurate/, /private information/, /community news rules/]) fireEvent.click(screen.getByLabelText(cb));
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText("Thanks. A reviewer will check it.")).toBeTruthy();
    const [, opts] = h.api.mock.calls.find(([p, o]) => p === "/me/news/" && o?.method === "POST")!;
    expect(opts.body).toMatchObject({ title: "Polls open early", show_author_name: false, declarations: { accurate: true, no_private_info: true, rules: true } });
  });

  it("shows inline API errors", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "POST /me/news/": new ApiError({ status: 409, code: "too_many_pending", message: "You already have 3 articles waiting for review." }) });
    renderAt("/news/submit");
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "T" } });
    fireEvent.change(screen.getByLabelText(/^Your news/), { target: { value: BODY } });
    for (const cb of [/accurate/, /private information/, /community news rules/]) fireEvent.click(screen.getByLabelText(cb));
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByText(/already have 3 articles/)).toBeTruthy();
  });

  it("edits a rejected article and resubmits", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    const mine = { ...community(), body: BODY, source_name: "", source_url: "", status: "rejected", status_label: "Rejected", show_author_name: false,
      decision_reason: "Election results must come from INEC.", removed_reason: "", submitted_at: "2026-11-01T09:00:00Z", created_at: "2026-11-01T09:00:00Z" };
    routes({ "/me/news/c1/": mine, "PATCH /me/news/c1/": { ...mine, status: "pending" }, "/me/news/": { count: 0, results: [] } });
    renderAt("/news/mine/c1");
    expect(await screen.findByText("Election results must come from INEC.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resubmit for review" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/news/mine"));
  });
});

// ------------------------------------------------------------------ mine
describe("/news/mine", () => {
  const item = (status: string, over: Record<string, unknown> = {}) => ({ ...community({ id: status }), body: BODY, source_name: "", source_url: "",
    status, status_label: status, show_author_name: false, decision_reason: "", removed_reason: "", submitted_at: "2026-11-01T09:00:00Z",
    created_at: "2026-11-01T09:00:00Z", title: `Item ${status}`, ...over });

  it("shows statuses, reasons and the right actions; withdraw asks first", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/news/": { count: 4, results: [item("pending"), item("rejected", { decision_reason: "Duplicate." }), item("successful"),
      item("removed", { removed_reason: "Private information" })] },
    "POST /me/news/pending/withdraw/": item("withdrawn", { id: "pending", title: "Item pending" }),
    "PATCH /me/news/successful/": item("successful", { show_author_name: true }) });
    renderAt("/news/mine");
    expect(await screen.findByText("Duplicate.")).toBeTruthy();
    expect(screen.getByText("Private information")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit and resubmit" }).getAttribute("href")).toBe("/news/mine/rejected");
    expect(screen.getByText("published")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Show my name" })[2]);
    expect(await screen.findByText("Your name is now shown.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Withdraw" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Withdrawing is final/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText("Withdrawn")).toBeTruthy();
  });
});

// ------------------------------------------------------------------ review
describe("review", () => {
  const adminItem = (over: Record<string, unknown> = {}) => ({ ...community(), body: BODY, source_name: "", source_url: "https://inec.example/x",
    status: "pending", status_label: "Pending", show_author_name: false, decision_reason: "", removed_reason: "", submitted_at: "2026-11-01T09:00:00Z",
    created_at: "2026-11-01T09:00:00Z", author_name: "Ada Obi", author_email: "ada@example.com", is_own: false, open_reports: 0, important: false,
    removed_at: null, decided_at: null, events: [], case: null, ...over });

  it("is for news reviewers only", () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, roles: [{ role: "moderator" }] };
    renderAt("/admin/news");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("queue shows counts and tabs", async () => {
    clerkState.isSignedIn = true;
    h.me = REVIEWER;
    routes({ "/admin/news/": { count: 1, results: [adminItem()], counts: { pending: 1, reported: 2, oldest_open_report: null, paused_until: null } } });
    renderAt("/admin/news");
    expect(await screen.findByRole("link", { name: "Pending (1)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reported (2)" })).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/admin/news/?status=pending", expect.anything());
  });

  it("approve; reject with a preset reason; remove needs a reason and a rule", async () => {
    clerkState.isSignedIn = true;
    h.me = REVIEWER;
    routes({ "/admin/news/c1/": adminItem(), "POST /admin/news/c1/approve/": adminItem({ status: "successful" }),
      "POST /admin/news/c1/reject/": adminItem({ status: "rejected", decision_reason: "Duplicate. Same as yesterday." }),
      "POST /admin/news/c1/remove/": adminItem({ status: "removed", removed_reason: "Private" }) });
    renderAt("/admin/news/c1");
    expect(await screen.findByText(/No false or unsourced election results/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Duplicate." } });
    fireEvent.change(within(dialog).getByLabelText(/More detail/), { target: { value: "Same as yesterday." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject article" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/news/c1/reject/", { method: "POST", body: { reason: "Duplicate. Same as yesterday." } }));
    cleanup();
    renderAt("/admin/news/c1");
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    dialog = screen.getByRole("dialog");
    expect((within(dialog).getByRole("button", { name: "Remove article" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "Private" } });
    expect((within(dialog).getByRole("button", { name: "Remove article" }) as HTMLButtonElement).disabled).toBe(true); // spec 13: rule required
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove article" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/news/c1/remove/",
      { method: "POST", body: { reason: "Private", rule: "R5", note_to_author: "Private" } }));
  });

  it("own submission: no Approve/Reject; reports open the moderation case", async () => {
    clerkState.isSignedIn = true;
    h.me = REVIEWER;
    routes({ "/admin/news/c1/": adminItem({ is_own: true }) });
    renderAt("/admin/news/c1");
    expect(await screen.findByText(/This is your own submission/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    cleanup();
    routes({ "/admin/news/c1/": adminItem({ status: "successful",
      case: { id: "k9", status: "open", priority: "high", decision: "", rule: "", open_reports: 2, reports: 2 } }) });
    renderAt("/admin/news/c1");
    const link = await screen.findByRole("link", { name: "Reports: open the case" });
    expect(link.getAttribute("href")).toBe("/admin/moderation/k9");
    expect(screen.getByText(/2 open of 2 reports/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });
});

// ------------------------------------------------------------ announcements
describe("announcements", () => {
  it("system admins only", () => {
    clerkState.isSignedIn = true;
    h.me = REVIEWER;
    renderAt("/admin/announcements");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("election updates need a source; notify asks with the count", async () => {
    clerkState.isSignedIn = true;
    h.me = ADMIN;
    routes({ "/admin/announcements/notify-count/": { count: 1234 }, "POST /admin/announcements/": { ...official(), id: "o9" }, "/admin/announcements/o9/": new ApiError({ status: 404 }) });
    renderAt("/admin/announcements/new");
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: "election_updates" } });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Polling hours" } });
    fireEvent.change(screen.getByLabelText(/^Announcement/), { target: { value: "Polls open at 8:30." } });
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    expect(screen.getByText("Official Election Updates need a source (e.g. INEC).")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Source name/), { target: { value: "INEC" } });
    fireEvent.change(screen.getByLabelText(/^Source link/), { target: { value: "https://inec.example/x" } });
    fireEvent.click(screen.getByLabelText("Notify everyone"));
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/1,234 users will get an in-app notification/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish and notify" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/announcements/", expect.objectContaining({ method: "POST",
      body: expect.objectContaining({ category: "election_updates", notify: true, source_name: "INEC" }) })));
  });

  it("editing never offers to notify; pinning a 4th asks which to unpin", async () => {
    clerkState.isSignedIn = true;
    h.me = ADMIN;
    const a = { ...official(), body: "x", source_name: "", source_url: "", status: "successful", status_label: "Successful", show_author_name: false,
      decision_reason: "", removed_reason: "", submitted_at: null, created_at: "2026-11-01T09:00:00Z", author_name: "Sam", author_email: "s@x",
      is_own: true, open_reports: 0, important: false, removed_at: null, decided_at: null, events: [], case: null };
    routes({ "/admin/announcements/o1/": a, "POST /admin/announcements/o1/pin/": new ApiError({ status: 409, code: "too_many_pinned", message: "x" }),
      "/admin/announcements/": { count: 3, results: [{ ...a, id: "p1", title: "Old pinned", pinned: true }], paused_until: null, pinned_count: 3 } });
    renderAt("/admin/announcements/o1");
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.queryByLabelText("Notify everyone")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pin to the top of News" }));
    expect(await screen.findByRole("button", { name: "Unpin “Old pinned”" })).toBeTruthy();
  });
});

// ------------------------------------------------------------ notifications
describe("notifications", () => {
  it("badge text caps at 99+", () => {
    expect(badgeText(5)).toBe("5");
    expect(badgeText(150)).toBe("99+");
  });

  it("bell: hidden badge at 0, accessible name, polls only while visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    clerkState.isSignedIn = true;
    let n = 0;
    routes({ "/me/notifications/unread-count/": () => ({ unread: n }) });
    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    const link = await screen.findByRole("link", { name: "Notifications" });
    expect(link.querySelector(".notif-bell__badge")).toBeNull();
    n = 3;
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS); });
    expect(await screen.findByRole("link", { name: "Notifications, 3 unread" })).toBeTruthy();
    const calls = h.api.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_MS * 2); });
    expect(h.api.mock.calls.length).toBe(calls);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("list, mark read on open, mark all, preference switch", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/notifications/": { results: [
        { id: "n1", kind: "announcement", created_at: "2026-11-01T10:00:00Z", read_at: null, decision: "", article: { id: "o1", source: "official", title: "Rally", public: true } },
        { id: "n2", kind: "news_decision", created_at: "2026-11-01T09:00:00Z", read_at: "2026-11-01T09:30:00Z", decision: "rejected", article: { id: "c1", source: "community", title: "Polls", public: false } },
      ] },
      "/me/notifications/preferences/": { announcements: true },
      "PATCH /me/notifications/preferences/": { announcements: false },
      "POST /me/notifications/n1/read/": { ok: true },
      "POST /me/notifications/read-all/": { updated: 1 },
    });
    renderAt("/notifications");
    expect(await screen.findByText("NDCConnect: Rally")).toBeTruthy();
    expect(screen.getByText("Your news “Polls” wasn’t approved")).toBeTruthy();
    expect(screen.getByText("Unread:")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: /Official announcements/ }));
    expect(await screen.findByText("Official announcements turned off.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(screen.queryByText("Unread:")).toBeNull());
    fireEvent.click(screen.getByText("Your news “Polls” wasn’t approved"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/news/mine"));
  });

  it("empty state", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/notifications/": { results: [] }, "/me/notifications/preferences/": { announcements: true } });
    renderAt("/notifications");
    expect(await screen.findByText("No notifications yet")).toBeTruthy();
  });
});
