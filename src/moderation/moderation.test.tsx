/** Reporting and moderation — spec 13 §12 (frontend). */
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
vi.mock("../pages/admin/membership/download", () => ({ saveBlob: vi.fn() }));

import { RequireModerationStaff, RequireSignedIn, RequireSystemAdmin } from "../auth/guards";
import { FollowProvider } from "../follows/FollowProvider";
import { ReportDialog } from "../news/ReportDialog";
import AdminNewsPage from "../pages/admin/news/AdminNewsPage";
import AdminCasePage from "../pages/admin/moderation/AdminCasePage";
import AdminCompliancePage from "../pages/admin/moderation/AdminCompliancePage";
import AdminLegalNoticePage from "../pages/admin/moderation/AdminLegalNoticePage";
import AdminLegalPage from "../pages/admin/moderation/AdminLegalPage";
import AdminModerationPage from "../pages/admin/moderation/AdminModerationPage";
import AdminAppealsPage from "../pages/admin/moderation/AdminAppealsPage";
import NewAppealPage from "../pages/appeals/NewAppealPage";
import CandidatePostPage from "../pages/candidates/CandidatePostPage";
import ArticlePage from "../pages/news/ArticlePage";
import MyNewsPage from "../pages/news/MyNewsPage";
import NotificationsPage from "../pages/news/NotificationsPage";
import CopyrightNoticePage from "../pages/reports/CopyrightNoticePage";
import MyReportsPage from "../pages/reports/MyReportsPage";
import ReportStatusPage from "../pages/reports/ReportStatusPage";
import RulesPage from "../pages/rules/RulesPage";
import { saveBlob } from "../pages/admin/membership/download";
import { clerkState } from "../test/clerkMock";
import { resetRulesCache } from "./rules";
import { RulesUpdatedBanner } from "./RulesUpdatedBanner";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string, extra?: React.ReactNode) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <FollowProvider>
          {extra}
          <Routes>
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/reports/status" element={<ReportStatusPage />} />
            <Route path="/report/copyright" element={<CopyrightNoticePage />} />
            <Route path="/news/community/:id" element={<ArticlePage source="community" />} />
            <Route path="/candidates/:slug/posts/:id" element={<CandidatePostPage />} />
            <Route path="/dialog" element={<DialogHost />} />
            <Route path="/profile-dialog" element={<DialogHost profile />} />
            <Route element={<RequireSignedIn />}>
              <Route path="/reports" element={<MyReportsPage />} />
              <Route path="/news/mine" element={<MyNewsPage />} />
              <Route path="/appeals/new" element={<NewAppealPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
            <Route element={<RequireModerationStaff />}>
              <Route path="/admin/moderation" element={<AdminModerationPage />} />
              <Route path="/admin/moderation/appeals" element={<AdminAppealsPage />} />
              <Route path="/admin/moderation/:id" element={<AdminCasePage />} />
              <Route path="/admin/news" element={<AdminNewsPage />} />
            </Route>
            <Route element={<RequireSystemAdmin />}>
              <Route path="/admin/moderation/legal" element={<AdminLegalPage />} />
              <Route path="/admin/moderation/legal/:id" element={<AdminLegalNoticePage />} />
              <Route path="/admin/moderation/compliance" element={<AdminCompliancePage />} />
            </Route>
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
          <Where />
        </FollowProvider>
      </MemoryRouter>
    </ToastProvider>
  );
}

function DialogHost({ profile }: { profile?: boolean }) {
  return <ReportDialog open onClose={() => {}} path={profile ? "/candidates/amina/report/" : "/news/a1/report/"} variant={profile ? "profile" : "content"} />;
}

function routes(map: Record<string, unknown | ((opts: Record<string, unknown>) => unknown)>) {
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

const RULES = {
  version: 2, updated: "2026-11-02", draft: true,
  rules: [
    { id: "R1", title: "No threats or incitement to violence", summary: "Don’t threaten anyone.", examples: ["Calls to attack a rally"], law: "Electoral Act 2026 s. 96" },
    { id: "R3", title: "Election results only from INEC; no false results", summary: "Results come from INEC.", examples: [], law: "Electoral Act 2026 s. 124(4)" },
  ],
  changes: [{ date: "2026-11-02", text: "First published." }],
  reasons: [
    { reason: "results", label: "Election results not from INEC", rule: "R3" },
    { reason: "copyright", label: "Copyright (my content was used)", rule: "R7" },
    { reason: "other", label: "Something else", rule: "" },
  ],
  profile_reasons: [{ reason: "profile_wrong", label: "Wrong or out-of-date details" }, { reason: "not_ndc", label: "Not an NDC candidate" }],
  legal_email: "legal@ndcconnect.example", counter_notice_days: 10, appeal_days: 14,
};

const ME = { full_name: "Ada Obi", email: "ada@example.com", profile_complete: true, is_system_admin: false, roles: [] };
const MOD = { ...ME, roles: [{ role: "moderator", scope_type: "global", scope_id: null }], admin_areas: ["overview", "moderation"] };
const SA = { ...ME, is_system_admin: true, roles: [{ role: "system_admin" }], admin_areas: ["overview", "moderation", "team", "audit"] };

const row = (over: Record<string, unknown> = {}) => ({
  id: "c1", target_kind: "post", kind_label: "Candidate post", title: "Results: we won Kano", state: "kano", status: "open", priority: "urgent",
  priority_label: "Urgent", legal_due_at: null, due: { due_at: "2026-11-03T10:00:00Z", overdue: false, hours: 5 }, opened_at: "2026-11-02T10:00:00Z",
  closed_at: null, decision: "", rule: "", source: "user_report", report_count: 3, top_reason: { reason: "results", label: "Election results not from INEC" },
  burst_flag: false, legal_hold: false, restorable: false, assigned_to: null, ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  ...row(), item: { kind: "post", kind_words: "post", title: "Results: we won Kano", public_url: "/candidates/amina/posts/p1", admin_url: "/admin/posts/p1",
    public: true, status: "published", body: "We won.", candidate: { slug: "amina", full_name: "Amina Bello" }, author: { label: "Campaign account for Amina Bello" } },
  reports: [{ id: "r1", reference: "RPT-7K2Q9M", reason: "results", reason_label: "Election results not from INEC", details: "Not INEC", created_at: "2026-11-02T10:00:00Z",
    status: "open", reporter_label: "Signed-in member", contact_email: "", signed_in: true }],
  note_to_author: "", internal_note: "", decided_by: null, decided_at: null, escalated: false,
  history: [{ event: "opened", note: "", created_at: "2026-11-02T10:00:00Z", actor: null }], notices: [], appeals: [], standing: null,
  blocked: "", is_system_admin: false, rules: RULES.rules, ...over,
});

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  resetRulesCache();
  window.localStorage.clear();
});
afterEach(cleanup);

// ---------------------------------------------------------------- public
describe("rules and reporting", () => {
  it("rules page: anchors, law, draft label, changes, agency contact", async () => {
    routes({ "/rules/": RULES });
    renderAt("/rules#R3");
    expect(await screen.findByRole("heading", { name: /R3 Election results only from INEC/ })).toBeTruthy();
    expect(document.getElementById("R3")).toBeTruthy();
    expect(screen.getByText(/Draft — under legal review/)).toBeTruthy();
    expect(screen.getByText(/Electoral Act 2026 s. 124\(4\)/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "legal@ndcconnect.example" })).toBeTruthy();
    expect(screen.getByText(/First published/)).toBeTruthy();
  });

  it("rules-updated banner shows once per version for signed-in users", async () => {
    clerkState.isSignedIn = true;
    routes({ "/rules/": RULES });
    renderAt("/elsewhere", <RulesUpdatedBanner />);
    expect(await screen.findByText(/Our community rules were updated/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/ }));
    cleanup();
    renderAt("/elsewhere", <RulesUpdatedBanner />);
    await screen.findByText("elsewhere");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText(/Our community rules were updated/)).toBeNull();
    cleanup();
    resetRulesCache();
    routes({ "/rules/": { ...RULES, version: 3 } });
    renderAt("/elsewhere", <RulesUpdatedBanner />);
    expect(await screen.findByText(/Our community rules were updated/)).toBeTruthy();
  });

  it("report dialog: reasons with rules, reference with Copy", async () => {
    clerkState.isSignedIn = true;
    routes({ "/rules/": RULES, "POST /news/a1/report/": { reference: "RPT-ABC234" } });
    renderAt("/dialog");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByLabelText("Election results not from INEC (R3)"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("RPT-ABC234")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "My reports" })).toBeTruthy();
  });

  it("report dialog: copyright goes to the form; profile variant has profile reasons", async () => {
    routes({ "/rules/": RULES });
    renderAt("/dialog");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByLabelText("Copyright (my content was used) (R7)"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to the copyright form" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/report/copyright"));
    cleanup();
    renderAt("/profile-dialog");
    const d2 = await screen.findByRole("dialog");
    expect(await within(d2).findByLabelText("Not an NDC candidate")).toBeTruthy();
    expect(within(d2).queryByLabelText(/Election results/)).toBeNull();
  });

  it("my reports and the status lookup", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/reports/": { results: [{ reference: "RPT-ABC234", target_kind: "post", title: "", reason: "results", reason_label: "Election results not from INEC",
        status: "actioned", status_label: "Action taken", created_at: "2026-11-02T10:00:00Z", resolved_at: "2026-11-02T12:00:00Z" }] },
      "/reports/status/": (_o: unknown, p: string) => (p.includes("RPT-ABC234") ? { reference: "RPT-ABC234", status_label: "Under review" } : new ApiError({ status: 404, message: "We couldn’t find a report with that reference." })),
    });
    renderAt("/reports");
    expect(await screen.findByText("A candidate post we removed")).toBeTruthy();
    expect(screen.getAllByText(/Action taken/).length).toBeGreaterThan(0);
    cleanup();
    renderAt("/reports/status");
    fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "RPT-ABC234" } });
    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    expect(await screen.findByText("Under review")).toBeTruthy();
  });

  it("copyright form shows field errors from the server", async () => {
    routes({ "POST /report/copyright/": new ApiError({ status: 400, code: "validation_error", message: "Please correct the highlighted fields.",
      fields: { good_faith: ["Tick this to continue."] } }) });
    renderAt("/report/copyright");
    fireEvent.click(screen.getByRole("button", { name: "Send notice" }));
    expect(await screen.findByText("Tick this to continue.")).toBeTruthy();
  });

  it("removed items show the notice with the rule and none of the content", async () => {
    routes({ "/news/a1/": new ApiError({ status: 410, code: "removed", message: "Removed by NDCConnect.",
      removed: true, rule: "R3", rule_title: "Election results only from INEC; no false results", kind: "news story", source: "rules" } as never) });
    renderAt("/news/community/a1");
    expect(await screen.findByRole("heading", { name: "Removed by NDCConnect" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /R3: Election results only from INEC/ }).getAttribute("href")).toBe("/rules#R3");
    cleanup();
    routes({ "/candidates/amina/posts/p1/": new ApiError({ status: 410, code: "removed", message: "x", rule: "R7", rule_title: "Respect copyright",
      kind: "post", source: "copyright" } as never) });
    renderAt("/candidates/amina/posts/p1");
    expect(await screen.findByText(/removed after a copyright notice/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- authors
describe("authors", () => {
  const view = (over: Record<string, unknown> = {}) => ({
    paused_until: "2026-12-12T10:00:00Z",
    removals: [{ case: "c9", target_kind: "article", target_id: "a1", title: "Old story", rule: "R4", rule_title: "No knowingly false or misleading information",
      note_to_author: "Not accurate", decided_at: "2026-11-01T10:00:00Z", decision: "removed", source: "user_report", can_appeal: true,
      appeal_until: "2026-11-15T10:00:00Z", appeal: null, copyright_notice: null, can_counter_notice: false }],
    restrictions: [{ id: "x1", kind: "news_pause", kind_label: "Community news paused", rule: "R4", rule_title: "No knowingly false or misleading information",
      reason: "Repeated", starts_at: "2026-11-02T10:00:00Z", ends_at: "2026-12-12T10:00:00Z", lifted_at: null, active: true, can_appeal: true, appeal: null }],
    ...over,
  });
  const mine = { id: "a1", source: "community", status: "removed", status_label: "Removed", title: "Old story", removed_reason: "R4", show_author_name: false,
    submitted_at: "2026-10-30T10:00:00Z", created_at: "2026-10-30T10:00:00Z", decision_reason: "" };

  it("my news: pause banner, disabled Submit, removal with Appeal", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/news/": { count: 1, results: [mine] }, "/me/moderation/": view() });
    renderAt("/news/mine");
    expect(await screen.findByText(/You can submit community news again on/)).toBeTruthy();
    const submit = screen.getByRole("button", { name: "Submit news" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getAllByRole("link", { name: /R4: No knowingly false/ })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Appeal \(until/ }).getAttribute("href")).toBe("/appeals/new?case=c9");
    expect(screen.getByRole("link", { name: "Appeal" }).getAttribute("href")).toBe("/appeals/new?restriction=x1");
  });

  it("appeal form: once only, within the window, and status afterwards", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let sent: unknown = null;
    routes({ "/me/moderation/": view(), "POST /me/appeals/": (o: Record<string, unknown>) => { sent = o.body; return { id: "ap1", status: "pending" }; } });
    renderAt("/appeals/new?case=c9");
    expect(await screen.findByText(/someone other than the person who made the decision/i)).toBeTruthy();
    const send = screen.getByRole("button", { name: "Send appeal" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Why do you think/), { target: { value: "It was accurate." } });
    fireEvent.click(send);
    expect(await screen.findByText("Appeal sent")).toBeTruthy();
    expect(sent).toEqual({ case: "c9", restriction: undefined, statement: "It was accurate.", evidence_url: "" });
    cleanup();
    const closed = view();
    closed.removals[0] = { ...closed.removals[0], can_appeal: false };
    routes({ "/me/moderation/": closed });
    renderAt("/appeals/new?case=c9");
    expect(await screen.findByText(/window to appeal this decision has closed/)).toBeTruthy();
    cleanup();
    const appealed = view();
    appealed.removals[0] = { ...appealed.removals[0], can_appeal: false,
      appeal: { id: "ap1", status: "denied", status_label: "Not upheld", created_at: "", decided_at: "", reason: "Rules apply" } as never };
    routes({ "/me/moderation/": appealed });
    renderAt("/appeals/new?case=c9");
    expect(await screen.findByText(/Appeal: Not upheld/)).toBeTruthy();
  });

  it("notifications for the new kinds never name the moderator", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/notifications/": { results: [
        { id: "n1", kind: "content_removed", created_at: "2026-11-02T10:00:00Z", read_at: null, decision: "removed", article: null,
          case: { id: "c9", target_kind: "post", title: "Results", rule: "R3", rule_title: "Election results only from INEC; no false results" } },
        { id: "n2", kind: "report_outcome", created_at: "2026-11-02T10:00:00Z", read_at: null, decision: "kept", article: null,
          case: { id: "c8", target_kind: "article", title: "Polls open", rule: "", rule_title: "" } },
      ] },
      "/me/notifications/preferences/": { announcements: true },
    });
    renderAt("/notifications");
    expect(await screen.findByText(/Your post “Results” was removed for breaking R3/)).toBeTruthy();
    expect(screen.getByText(/the content stays up/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /was removed/ }).getAttribute("href")).toBe("/appeals/new?case=c9");
  });
});

// ------------------------------------------------------------------ admin
describe("moderation queue and cases", () => {
  it("is closed to people without a moderation role", () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    renderAt("/admin/moderation");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });

  it("queue: urgency order, due and overdue words, tabs and filters", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    routes({ "/admin/moderation/cases/": { count: 2, is_system_admin: false, counts: { open: 2, mine: 0, escalated: 0, appeals: 1 }, results: [
      row(), row({ id: "c2", priority: "low", priority_label: "Low", title: "Spammy", due: { due_at: "", overdue: true, hours: 50 }, burst_flag: true }),
    ] } });
    renderAt("/admin/moderation");
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]).getByText("Urgent")).toBeTruthy();
    expect(within(rows[1]).getByText("Due in 5 h")).toBeTruthy();
    expect(within(rows[2]).getByText("Overdue by 2 days")).toBeTruthy();
    expect(within(rows[2]).getByText(/Burst of reports/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Appeals (1)" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Escalated/ })).toBeNull(); // system admins only
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "posts" } });
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/moderation/cases/?tab=open&type=posts", expect.anything()));
    fireEvent.click(screen.getByLabelText("Overdue only"));
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/admin/moderation/cases/?tab=open&type=posts&overdue=1", expect.anything()));
  });

  it("old reported tabs redirect to the queue", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...MOD, roles: [{ role: "news_reviewer" }], admin_areas: ["overview", "moderation", "news"] };
    routes({ "/admin/moderation/cases/": { count: 0, results: [], counts: {}, is_system_admin: false } });
    renderAt("/admin/news?tab=reported");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/admin/moderation?type=news"));
  });

  it("case: claim, someone-else banner, remove needs a rule, escalate, reporter masked", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    let removed: unknown = null;
    routes({
      "/rules/": RULES,
      "/admin/moderation/cases/c1/": detail({ assigned_to: { id: "u2", email: "other@example.com", me: false } }),
      "POST /admin/moderation/cases/c1/claim/": detail({ assigned_to: { id: "u1", email: "ada@example.com", me: true } }),
      "POST /admin/moderation/cases/c1/remove/": (o: Record<string, unknown>) => { removed = o.body; return detail({ status: "closed", decision: "removed", rule: "R3" }); },
    });
    renderAt("/admin/moderation/c1");
    expect(await screen.findByText(/other@example.com has this case open/)).toBeTruthy();
    expect(screen.getByText("Signed-in member")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show reporter" })).toBeNull(); // system admins only
    fireEvent.click(screen.getByRole("button", { name: "Take this case" }));
    expect(await screen.findByRole("button", { name: "Release" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove this post?" });
    const go = within(dialog).getByRole("button", { name: "Remove" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R3" } });
    fireEvent.change(within(dialog).getByLabelText(/Note to the author/), { target: { value: "Only INEC results" } });
    fireEvent.click(within(dialog).getByLabelText(/Also add a warning/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove and warn" }));
    await waitFor(() => expect(removed).toEqual({ rule: "R3", note_to_author: "Only INEC results", internal_note: "", warn: true }));
  });

  it("case: escalate needs a note; pause length; blocked message", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    let paused: unknown = null;
    const news = detail({ target_kind: "article", kind_label: "News", item: { ...detail().item, kind: "article", kind_words: "news story", official: false,
      author: { email: "writer@example.com", name: "Wale" } }, standing: { user_id: "u5", removals: 2, warnings: 0, pauses: 0, paused_until: null,
      suggestion: "This author has had 2 removals in 12 months: consider a warning.", active_pause: null } });
    routes({ "/rules/": RULES, "/admin/moderation/cases/c1/": news,
      "POST /admin/moderation/cases/c1/pause/": (o: Record<string, unknown>) => { paused = o.body; return news; } });
    renderAt("/admin/moderation/c1");
    expect(await screen.findByText(/consider a warning/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Escalate" }));
    let dialog = await screen.findByRole("dialog", { name: /Escalate/ });
    expect((within(dialog).getByRole("button", { name: "Escalate" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Go back" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause community news" }));
    dialog = await screen.findByRole("dialog", { name: /Pause this author/ });
    fireEvent.click(within(dialog).getByLabelText("30 days"));
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pause for 30 days" }));
    await waitFor(() => expect(paused).toEqual({ days: 30, rule: "R1", reason: "" }));
    cleanup();
    routes({ "/admin/moderation/cases/c1/": detail({ blocked: "self_moderation" }) });
    renderAt("/admin/moderation/c1");
    expect(await screen.findByText(/it’s about your own content/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("system admins can reveal the reporter (audited server-side)", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    routes({ "/admin/moderation/cases/c1/": detail({ is_system_admin: true }),
      "POST /admin/moderation/cases/c1/reports/r1/reporter/": { reporter: { email: "rep@example.com", name: "Rep" }, contact_email: "" } });
    renderAt("/admin/moderation/c1");
    fireEvent.click(await screen.findByRole("button", { name: "Show reporter" }));
    expect(await screen.findByText("Rep (rep@example.com)")).toBeTruthy();
  });

  it("appeals: Decide hidden for the original decider; not upheld needs a reason", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    const appeal = (over: Record<string, unknown> = {}) => ({ id: "ap1", kind: "removal", kind_label: "Removal", status: "pending", status_label: "Waiting for a decision",
      statement: "It was INEC’s figure.", evidence_url: "", created_at: "2026-11-02T10:00:00Z", decided_at: null, decision_reason: "", case: "c1", title: "Results",
      target_kind: "post", original: { rule: "R3", rule_title: "Election results only from INEC", note: "", decided_at: "2026-11-01T10:00:00Z", ends_at: null },
      can_decide: true, own_decision: false, ...over });
    let decided: unknown = null;
    routes({ "/admin/moderation/cases/": { count: 0, results: [], counts: { appeals: 2 }, is_system_admin: false },
      "/admin/moderation/appeals/": { results: [appeal(), appeal({ id: "ap2", can_decide: false, own_decision: true, title: "Mine" })] },
      "POST /admin/moderation/appeals/ap1/decide/": (o: Record<string, unknown>) => { decided = o.body; return appeal({ status: "denied" }); } });
    renderAt("/admin/moderation/appeals");
    expect(await screen.findByText(/You made the original decision/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Decide" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("dialog", { name: "Decide this appeal" });
    fireEvent.click(within(dialog).getByLabelText(/Not upheld/));
    const save = within(dialog).getByRole("button", { name: "Save decision" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "INEC hadn’t published it" } });
    fireEvent.click(save);
    await waitFor(() => expect(decided).toEqual({ upheld: false, reason: "INEC hadn’t published it" }));
  });

  it("community case (spec 17): hide while deciding, unhide, pause with scope", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    const sent: Record<string, unknown> = {};
    const item: Record<string, unknown> = { kind: "community_post", kind_words: "community post", title: "Lagos roads", public: true, status: "published", body: "Fix the roads now",
      community: { id: "m1", name: "Ikeja", path: "lagos/ikeja", level: "lga" }, author: { email: "tunde@example.com", name: "Tunde A." } };
    const standing = { user_id: "u5", removals: 0, warnings: 0, pauses: 0, paused_until: null, suggestion: "", active_pause: null };
    let current: Record<string, unknown> = detail({ target_kind: "community_post", kind_label: "Community post", assigned_to: { email: MOD.email, me: true }, item, standing });
    routes({ "/rules/": RULES, "/admin/moderation/cases/c1/": () => current,
      "POST /admin/moderation/cases/c1/hide/": (o: Record<string, unknown>) => {
        sent.hide = o.body; current = { ...current, item: { ...item, status: "hidden", hidden_at: "2026-11-05T10:00:00Z" } }; return current; },
      "POST /admin/moderation/cases/c1/unhide/": (o: Record<string, unknown>) => { sent.unhide = o.body; current = { ...current, item }; return current; },
      "POST /admin/moderation/cases/c1/pause/": (o: Record<string, unknown>) => { sent.pause = o.body; return current; } });
    renderAt("/admin/moderation/c1");
    expect(await screen.findByRole("link", { name: "Ikeja" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide while deciding" }));
    expect(await screen.findByText(/Hidden while deciding/)).toBeTruthy();
    expect(sent.hide).toEqual({ note: "" });
    expect(screen.getByText(/nothing reverts on its own/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Hide while deciding" })).toBeTruthy());
    expect(sent.unhide).toEqual({});
    fireEvent.click(screen.getByRole("button", { name: "Pause community posting" }));
    const dialog = await screen.findByRole("dialog", { name: /community posting/ });
    fireEvent.click(within(dialog).getByLabelText("1 day"));
    fireEvent.click(within(dialog).getByLabelText(/Ikeja and the levels below/));
    fireEvent.change(within(dialog).getByLabelText(/Rule it broke/), { target: { value: "R1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pause for 1 day" }));
    await waitFor(() => expect(sent.pause).toEqual({ days: 1, rule: "R1", reason: "", scope: "community" }));
  });
});

describe("event cases (spec 18 §8)", () => {
  it("shows the event as readers see it, hides and unhides, and never offers warn or pause", async () => {
    clerkState.isSignedIn = true;
    h.me = MOD;
    const sent: Record<string, unknown> = {};
    const item: Record<string, unknown> = { kind: "event", kind_words: "event", title: "Ikeja rally", public: true, status: "published",
      body: "Come out.", state: "lagos", author: { label: "Campaign account for Amina Bello" },
      event: { type_label: "Rally", starts_at: "2026-11-14T09:00:00Z", venue: "Ikeja Grounds", venue_type_label: "Open ground or field", registered: 42 } };
    let current: Record<string, unknown> = detail({ target_kind: "event", kind_label: "Event", assigned_to: { email: MOD.email, me: true }, item });
    routes({ "/rules/": RULES, "/admin/moderation/cases/c1/": () => current,
      "POST /admin/moderation/cases/c1/hide/": (o: Record<string, unknown>) => {
        sent.hide = o.body; current = { ...current, item: { ...item, status: "hidden", hidden_at: "2026-11-05T10:00:00Z" } }; return current; },
      "POST /admin/moderation/cases/c1/unhide/": () => { current = { ...current, item }; return current; } });
    renderAt("/admin/moderation/c1");
    expect(await screen.findByText(/Ikeja Grounds \(Open ground or field\)/)).toBeTruthy();
    expect(screen.getByText(/42 registered/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Warn the author" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Pause community/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hide while deciding" }));
    expect(await screen.findByRole("button", { name: "Unhide" })).toBeTruthy();
    expect(sent.hide).toEqual({ note: "" });
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Hide while deciding" })).toBeTruthy());
  });
});

describe("legal notices and compliance", () => {
  const notice = (over: Record<string, unknown> = {}) => ({
    id: "n1", reference: "LGL-ABC234", kind: "agency", kind_label: "Government agency notice", sender_name: "Officer", sender_org: "NITDA",
    received_at: "2026-11-02T08:00:00Z", due_at: new Date(Date.now() - 3_600_000).toISOString(), status: "open", overdue: true, acknowledged_at: null, items: 1,
    pending_items: 1, sender_contact: "legal@nitda.example", sender_reference: "", legal_basis: "NITDA Act s. 6", acknowledged_how: "", has_attachment: false,
    work_description: "", declaration_accepted: false, signature: "", counter_notice_at: null, counter_notice_text: "", owner_notified_at: null, counter_notice_days: 10,
    items_detail: [{ id: "i1", outcome: "pending", outcome_label: "Waiting", outcome_reason: "",
      case: { id: "c1", title: "Polls story", target_kind: "article", status: "open", decision: "", legal_hold: false, restorable: false } }],
    ...over,
  });

  it("list shows deadlines in words; log form validates on the server", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    routes({ "/admin/moderation/legal/": { count: 1, results: [notice()] },
      "POST /admin/moderation/legal/": new ApiError({ status: 400, code: "legal_basis_required", message: "An agency notice must state the law and section it relies on." }) });
    renderAt("/admin/moderation/legal");
    expect(await screen.findByText(/Overdue by/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Log a notice" }));
    const dialog = await screen.findByRole("dialog", { name: "Log a legal notice" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Log notice" }));
    expect(await within(dialog).findByText(/must state the law and section/)).toBeTruthy();
  });

  it("notice: acknowledge, outcome needs a reason when not removed, hold", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    const calls: string[] = [];
    routes({
      "/admin/moderation/legal/n1/": notice(),
      "POST /admin/moderation/legal/n1/acknowledge/": () => { calls.push("ack"); return notice({ acknowledged_at: "2026-11-02T09:00:00Z", acknowledged_how: "Email" }); },
      "PATCH /admin/moderation/legal/n1/items/i1/": (o: Record<string, unknown>) => { calls.push(JSON.stringify(o.body)); return notice(); },
      "POST /admin/moderation/legal/n1/hold/": () => { calls.push("hold"); return notice(); },
    });
    renderAt("/admin/moderation/legal/n1");
    expect(await screen.findByText("Deadline passed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark acknowledged" }));
    let dialog = await screen.findByRole("dialog", { name: "Mark acknowledged" });
    fireEvent.change(within(dialog).getByLabelText(/How it was acknowledged/), { target: { value: "Email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(calls).toContain("ack"));
    fireEvent.click(screen.getByRole("button", { name: "Record outcome" }));
    dialog = await screen.findByRole("dialog", { name: "Record the outcome" });
    fireEvent.click(within(dialog).getByLabelText(/Not removed/));
    const save = within(dialog).getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "No legal basis stated" } });
    fireEvent.click(save);
    await waitFor(() => expect(calls).toContain(JSON.stringify({ outcome: "not_removed", reason: "No legal basis stated" })));
    fireEvent.click(screen.getByRole("button", { name: "Put on legal hold" }));
    await waitFor(() => expect(calls).toContain("hold"));
  });

  it("compliance: figures with definitions, CSV download", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    const year = new Date().getFullYear();
    routes({ "/admin/moderation/compliance/": (_o: unknown, p: string) => (p.includes("format=csv") ? new Blob(["year,item"]) : {
      year, frozen: false, registered_users: 1200, harmful_by_rule: { R1: 1, R2: 0, R5: 0, R6: 0 }, safety_statement: "We protect people.", years: [year],
      items: [{ key: "large_platform", label: "Large Service Platform?", value: "No", definition: "Threshold is 1,000,000." },
        { key: "disinformation", label: "Disinformation/misinformation takedowns", value: 2, definition: "R3 and R4 removals." }] }) });
    renderAt("/admin/moderation/compliance");
    expect(await screen.findByText("Disinformation/misinformation takedowns")).toBeTruthy();
    expect(screen.getByText(/No \(1,200 accounts\)/)).toBeTruthy();
    expect(screen.getByText("R3 and R4 removals.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.anything(), `ndcconnect-nitda-compliance-${year}.csv`));
  });
});
