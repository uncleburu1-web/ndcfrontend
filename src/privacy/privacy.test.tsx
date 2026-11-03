/** Security and privacy — spec 14 §12 (frontend). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, CANCELLED_REVERIFICATION, CONSENT_DECLINED, createApiClient } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown>, mfaBlocked: false, signOut: vi.fn() }));
vi.mock("@clerk/react", async () => {
  const m = (await import("../test/clerkMock")).clerkMockModule;
  return { ...m, useClerk: () => ({ signOut: h.signOut }) };
});
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
  useMfaBlocked: () => h.mfaBlocked,
}));

import { describe as describeNotification, type NotificationItem } from "../pages/news/NotificationsPage";
import AdminIncidentPage from "../pages/admin/privacy/AdminIncidentPage";
import AdminIncidentsPage from "../pages/admin/privacy/AdminIncidentsPage";
import AdminPrivacyRequestPage from "../pages/admin/privacy/AdminPrivacyRequestPage";
import AdminPrivacyRequestsPage from "../pages/admin/privacy/AdminPrivacyRequestsPage";
import AdminAccessReviewPage from "../pages/admin/team/AdminAccessReviewPage";
import PrivacyPage from "../pages/privacy/PrivacyPage";
import SecurityPage from "../pages/privacy/SecurityPage";
import YourDataPage from "../pages/privacy/YourDataPage";
import { AdminMfaGate } from "./AdminMfaGate";
import { ConsentDialog } from "./ConsentDialog";
import { FollowProvider, useFollows } from "../follows/FollowProvider";
import { clerkState } from "../test/clerkMock";
import { PrivacyChrome } from "./PrivacyChrome";
import type { Incident, MyPrivacy, PrivacyNotice, PrivacyRequest } from "./types";

const ADMIN = { id: "a", email: "sa@x.ng", full_name: "Sade Admin", phone_number: "+2348031234567", profile_complete: true, roles: [],
  is_system_admin: true, admin_areas: ["overview", "privacy", "team"], adult_confirmed: true, mfa_enabled: true, admin_mfa_required: true,
  consents_needed: [], privacy_version: 1 };
const MEMBER = { ...ADMIN, is_system_admin: false, admin_areas: [], email: "ada@x.ng", full_name: "Ada Obi" };

function renderAt(path: string, routes: React.ReactNode) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  h.api.mockReset();
  h.signOut.mockReset();
  h.me = MEMBER;
  h.mfaBlocked = false;
});
afterEach(cleanup);

// ------------------------------------------------------------------ API client
function res(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const HINT = { clerk_error: { type: "forbidden", reason: "reverification-error", metadata: { reverification: { level: "second_factor", afterMinutes: 10 } } } };

describe("API client (spec 14 §4.2, §4.6)", () => {
  it("reverifies with Clerk's prompt and retries with a fresh token", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(403, { error: { status: 403, code: "reverification_required", message: "Confirm", ...HINT } }))
      .mockResolvedValueOnce(res(403, { error: { status: 403, code: "reverification_required", message: "Confirm", ...HINT } }))
      .mockResolvedValueOnce(res(200, { ok: true }));
    const getToken = vi.fn(async () => "t");
    const prompts: number[] = [];
    const withReverification = async <T,>(attempt: () => Promise<T>) => {
      const first = await attempt();
      if ((first as typeof HINT)?.clerk_error) {
        prompts.push(1);
        return attempt();
      }
      return first;
    };
    const api = createApiClient({ baseUrl: "http://x", getToken, fetchImpl, withReverification });
    await expect(api("/admin/pvc/1/reveal/", { method: "POST" })).resolves.toEqual({ ok: true });
    expect(prompts).toHaveLength(1);
    expect(getToken).toHaveBeenLastCalledWith({ skipCache: true });
  });

  it("a cancelled prompt leaves nothing done", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(403, { error: { status: 403, code: "reverification_required", message: "x", ...HINT } }));
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "t", fetchImpl,
      withReverification: async () => { throw new Error("cancelled"); } });
    await expect(api("/me/delete/", { method: "POST" })).rejects.toMatchObject({ code: CANCELLED_REVERIFICATION });
  });

  it("asks for consent, records it and retries once; Not now changes nothing", async () => {
    const consentErr = { error: { status: 403, code: "consent_required", message: "Consent", purpose: "political_following", version: 1, text: "T" } };
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(403, consentErr)).mockResolvedValueOnce(res(201, { slug: "a", notify: false }));
    const onConsentRequired = vi.fn(async (e: ApiError) => e.extra.purpose === "political_following");
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "t", fetchImpl, onConsentRequired });
    await expect(api("/me/follows/a/", { method: "PUT" })).resolves.toEqual({ slug: "a", notify: false });
    expect(onConsentRequired).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const declined = createApiClient({ baseUrl: "http://x", getToken: async () => "t", fetchImpl: vi.fn().mockResolvedValue(res(403, consentErr)),
      onConsentRequired: async () => false });
    await expect(declined("/me/follows/a/", { method: "PUT" })).rejects.toMatchObject({ code: CONSENT_DECLINED });
  });

  it("reports mfa_required to the session", async () => {
    const onMfaRequired = vi.fn();
    const api = createApiClient({ baseUrl: "http://x", getToken: async () => "t", onMfaRequired,
      fetchImpl: vi.fn().mockResolvedValue(res(403, { error: { status: 403, code: "mfa_required", message: "Turn on" } })) });
    await expect(api("/admin/overview/")).rejects.toBeInstanceOf(ApiError);
    expect(onMfaRequired).toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ consent dialog
describe("ConsentDialog", () => {
  it("shows the purpose text and version, Agree and Not now", async () => {
    const onAgree = vi.fn(async () => {});
    const onDecline = vi.fn();
    render(<MemoryRouter><ConsentDialog ask={{ purpose: "political_following", version: 1, label: "Following candidates", text: "Following tells us your political interest." }}
      onAgree={onAgree} onDecline={onDecline} /></MemoryRouter>);
    const dialog = screen.getByRole("dialog", { name: "Following candidates" });
    expect(within(dialog).getByText("Following tells us your political interest.")).toBeTruthy();
    expect(within(dialog).getByText(/Consent version 1/)).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "How we use this" }).getAttribute("href")).toBe("/privacy#follows");
    fireEvent.click(within(dialog).getByRole("button", { name: "Agree" }));
    await waitFor(() => expect(onAgree).toHaveBeenCalled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    expect(onDecline).toHaveBeenCalled();
  });
});

describe("Follow with the consent dialog declined", () => {
  function VoteButton() {
    const f = useFollows();
    return <button type="button" onClick={() => void f.follow("amina", "Amina Bello", { from: "profile" })}>Vote</button>;
  }
  it("Not now changes nothing and shows no error", async () => {
    clerkState.isSignedIn = true;
    h.api.mockImplementation(async (path: string) => {
      if (path.startsWith("/me/follows/amina/")) throw new ApiError({ status: 403, code: CONSENT_DECLINED, message: "Nothing was changed." });
      return { results: [] };
    });
    renderAt("/", <Route path="/" element={<FollowProvider><VoteButton /></FollowProvider>} />);
    fireEvent.click(screen.getByRole("button", { name: "Vote" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/follows/amina/", { method: "PUT" }));
    expect(screen.queryByText(/following Amina/)).toBeNull();
    expect(screen.queryByText("Nothing was changed.")).toBeNull();
    clerkState.isSignedIn = false;
  });
});

// ------------------------------------------------------------------ public pages
const NOTICE: PrivacyNotice = {
  version: 1, updated: "2026-11-03", draft: true, controller: "NDC", contact: "dpo@ndc.ng", security_contact: "sec@ndc.ng",
  categories: [
    { key: "account", label: "Your account", collected: "Name", purpose: "Run it", lawful_basis: "Contract", visible_to: "You", retention: "While it exists", on_deletion: "Erased", sensitive: false },
    { key: "follows", label: "Who you follow", collected: "Follows", purpose: "Following page", lawful_basis: "Explicit consent", visible_to: "Only you", retention: "Until you unfollow", on_deletion: "Deleted", sensitive: true },
  ],
  consents: [{ key: "political_following", label: "Following candidates", version: 1, text: "Following shows interest.", withdraw_effect: "All removed", material_since: 1, notice_anchor: "follows" }],
  processors: [{ name: "Clerk", role: "Sign-in", location: "United States", transfer_basis: "Consent", data: "Email" }],
  rights: [{ key: "access", title: "See what we hold", how: "Download it" }], changes: [{ date: "2026-11-03", text: "First published." }], request_days: 30,
};

describe("/privacy and /security", () => {
  it("renders every category with an anchor, the draft banner and the version", async () => {
    h.api.mockResolvedValue(NOTICE);
    renderAt("/privacy#follows", <Route path="/privacy" element={<PrivacyPage />} />);
    expect(await screen.findByRole("heading", { name: /Who you follow/ })).toBeTruthy();
    expect(document.getElementById("follows")).toBeTruthy();
    expect(screen.getByText(/Last updated .* · version 1/)).toBeTruthy();
    expect(screen.getByText("Draft — under review")).toBeTruthy();
    expect(screen.getByText("Sensitive")).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/privacy/", { anonymous: true });
  });

  it("explains how to report a vulnerability", () => {
    renderAt("/security", <Route path="/security" element={<SecurityPage />} />);
    expect(screen.getByRole("heading", { level: 1, name: "Report a security problem" })).toBeTruthy();
    expect(screen.getByText(/within 3 working days/)).toBeTruthy();
  });
});

// ------------------------------------------------------------------ your data
const MINE: MyPrivacy = {
  consents: [
    { purpose: "political_following", label: "Following candidates", current_version: 1, text: "T", given: true, version: 1, granted_at: "2026-11-01T10:00:00Z",
      method: "dialog", needs_confirmation: false, outdated: false, withdraw_effect: "This removes your 12 follows and their notifications." },
    { purpose: "membership", label: "NDC membership application", current_version: 1, text: "T", given: false, version: null, granted_at: null, method: null,
      needs_confirmation: false, outdated: false, withdraw_effect: "" },
  ],
  requests: [{ id: "r1", reference: "PRV-ABC234", kind: "rectification", kind_label: "Correct my data", details: "LGA", status: "waiting", status_label: "Waiting for you",
    received_at: "2026-11-01T10:00:00Z", due_at: "2026-12-01T10:00:00Z", due_words: "Paused: waiting for the person", overdue: false, closed_at: null, outcome: "",
    self_served: false, events: [{ event: "ask_info", note: "Which LGA?", at: "2026-11-02T10:00:00Z" }] }],
  downloads: ["2026-11-02T09:00:00Z"],
  consent_history: [],
  security_notices: [],
  request_kinds: [{ value: "rectification", label: "Correct my data" }, { value: "erasure", label: "Erase specific data" }],
  delete: { goes: ["Your profile"], stays: ["Donations, anonymised"] },
  privacy_version: 1,
};

describe("/account/privacy", () => {
  const renderMine = () => renderAt("/account/privacy", <><Route path="/account/privacy" element={<YourDataPage />} /><Route path="/account-deleted" element={<p>Gone</p>} /></>);

  it("downloads through the API (reverification is the client's job)", async () => {
    const blob = new Blob(["zip"]);
    h.api.mockImplementation(async (path: string) => (path === "/me/privacy/" ? MINE : blob));
    const created = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() });
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: "Download my data" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/data-export/", { method: "POST", responseType: "blob" }));
    expect(created).toHaveBeenCalledWith(blob);
  });

  it("names the effect before withdrawing, then withdraws", async () => {
    h.api.mockImplementation(async (path: string, o?: { method?: string }) => (path === "/me/privacy/" ? MINE : o?.method === "DELETE" ? { effect: "Removed 12 follows." } : null));
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("This removes your 12 follows and their notifications.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/consents/political_following/", { method: "DELETE" }));
    expect(await screen.findByText("Removed 12 follows.")).toBeTruthy();
  });

  it("deletes only after the typed confirmation, then signs out", async () => {
    h.api.mockImplementation(async (path: string) => (path === "/me/privacy/" ? MINE : { deleted: true }));
    renderMine();
    fireEvent.click(await screen.findByRole("button", { name: "Delete my account" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete my account" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Type "delete"/), { target: { value: "delete" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/delete/", { method: "POST", body: { confirm: "delete" } }));
    await waitFor(() => expect(h.signOut).toHaveBeenCalledWith({ redirectUrl: "/account-deleted" }));
  });

  it("sends other requests and answers a waiting one", async () => {
    h.api.mockImplementation(async (path: string) => (path === "/me/privacy/" ? MINE : { reference: "PRV-NEW234", due_at: "2026-12-03T10:00:00Z" }));
    renderMine();
    fireEvent.change(await screen.findByLabelText(/What are you asking for/), { target: { value: "erasure" } });
    fireEvent.change(screen.getByLabelText(/^Details/), { target: { value: "Please erase my old PVC record." } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/privacy-requests/", { method: "POST", body: { kind: "erasure", details: "Please erase my old PVC record." } }));
    expect(screen.getByText("Which LGA?")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Your answer/), { target: { value: "Ikeja" } });
    fireEvent.click(screen.getByRole("button", { name: "Send answer" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/privacy-requests/r1/answer/", { method: "POST", body: { text: "Ikeja" } }));
  });
});

describe("PrivacyChrome", () => {
  it("asks people with legacy follows to confirm them, counting the prompt", async () => {
    h.me = { ...MEMBER, consents_needed: ["political_following"] };
    h.api.mockResolvedValue(undefined);
    renderAt("/", <Route path="/" element={<PrivacyChrome />} />);
    expect(await screen.findByText("Confirm your follows")).toBeTruthy();
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/consents/political_following/prompted/", { method: "POST" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep them" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/consents/political_following/", { method: "POST" }));
  });
});

// ------------------------------------------------------------------ admin
describe("Admin two-step verification gate", () => {
  const gate = () => renderAt("/admin", <Route element={<AdminMfaGate />}><Route path="/admin" element={<p>Admin home</p>} /></Route>);
  it("blocks admins without two-step verification", () => {
    h.me = { ...ADMIN, mfa_enabled: false };
    gate();
    expect(screen.getByText("Turn on two-step verification to use the admin")).toBeTruthy();
    expect(screen.queryByText("Admin home")).toBeNull();
    expect(screen.getByRole("link", { name: "Open account security" }).getAttribute("href")).toBe("/account/security");
  });
  it("blocks after the server says mfa_required, and lets verified admins in", () => {
    h.mfaBlocked = true;
    h.me = ADMIN;
    gate();
    expect(screen.getByText("Turn on two-step verification to use the admin")).toBeTruthy();
    cleanup();
    h.mfaBlocked = false;
    gate();
    expect(screen.getByText("Admin home")).toBeTruthy();
  });
  it("warns in development when the claim is missing", () => {
    h.me = { ...ADMIN, admin_mfa_required: false, mfa_enabled: null };
    gate();
    expect(screen.getByText("Admin home")).toBeTruthy();
    expect(screen.getByText(/Development mode/)).toBeTruthy();
  });
});

const REQ: PrivacyRequest = { ...MINE.requests[0], status: "open", status_label: "Open", due_words: "Due in 12 days", person_name: "Ada Obi",
  person: { id: "u1", name: "Ada Obi", email: "ada@x.ng", deleted: false }, linked_actions: [{ key: "erase_pvc", label: "PVC record erased" }],
  events: [{ event: "opened", note: "", at: "2026-11-01T10:00:00Z", shown_to_person: true, by: "Ada Obi" }] };

describe("Admin privacy requests", () => {
  beforeEach(() => {
    h.me = ADMIN;
  });
  it("lists requests with due dates in words", async () => {
    h.api.mockResolvedValue({ count: 1, counts: { open: 1, waiting: 0, closed: 0 }, results: [{ ...REQ, overdue: true, due_words: "Overdue by 2 days" }] });
    renderAt("/admin/privacy", <Route path="/admin/privacy" element={<AdminPrivacyRequestsPage />} />);
    expect(await screen.findByText("Overdue by 2 days")).toBeTruthy();
    expect(screen.getByRole("link", { name: "PRV-ABC234" })).toBeTruthy();
  });
  it("asks for more information (pausing the clock) and closes", async () => {
    h.api.mockImplementation(async (path: string) => (path.endsWith("ask-info/") ? { ...REQ, status: "waiting", due_words: "Paused: waiting for the person" } : REQ));
    renderAt("/admin/privacy/requests/r1", <Route path="/admin/privacy/requests/:id" element={<AdminPrivacyRequestPage />} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask for more information" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("The 30-day clock pauses until they answer.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/What you need from them/), { target: { value: "Which LGA is right?" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/privacy/requests/r1/ask-info/", { method: "POST", body: { text: "Which LGA is right?" } }));
    expect(await screen.findByText("Paused: waiting for the person")).toBeTruthy();
  });
});

const INC: Incident = {
  id: "i1", reference: "INC-ABC234", title: "Leaked session", status: "open", status_label: "Open", risk: "high", risk_label: "High risk",
  detected_at: "2026-11-03T08:00:00Z", aware_at: "2026-11-03T09:00:00Z", is_personal_data_breach: true, is_cyber_incident: true, closed_at: null,
  clocks: [
    { key: "ndpc", label: "NDPC", due_at: "2026-11-06T09:00:00Z", done_at: null, state: "due", words: "NDPC: due in 2 days" },
    { key: "ngcert", label: "ngCERT", due_at: "2026-11-06T08:00:00Z", done_at: null, state: "due", words: "ngCERT: due in 2 days" },
    { key: "people", label: "People affected", due_at: "2026-11-03T09:00:00Z", done_at: null, state: "overdue", words: "People affected: tell them now" },
  ],
  events: [], can_send_notice: true, notice_version: 1, notice_sent_version: 0, data_categories: ["account"],
};

describe("Admin incidents", () => {
  beforeEach(() => {
    h.me = ADMIN;
  });
  it("shows clocks in words on the list", async () => {
    h.api.mockResolvedValue({ results: [INC], counts: { open: 1, closed: 0 }, categories: [], processors: [] });
    renderAt("/admin/privacy/incidents", <Route path="/admin/privacy/incidents" element={<AdminIncidentsPage />} />);
    expect(await screen.findByText("NDPC: due in 2 days")).toBeTruthy();
    expect(screen.getByText("People affected: tell them now")).toBeTruthy();
  });
  it("records a notification, previews the notice audience and closes", async () => {
    const done = { ...INC, clocks: INC.clocks.map((c) => (c.key === "ndpc" ? { ...c, state: "done" as const, words: "NDPC: notified 3 Nov 10:00" } : c)) };
    h.api.mockImplementation(async (path: string) => {
      if (path.endsWith("notifications/")) return done;
      if (path.endsWith("notice-preview/")) return { count: 2, unmatched: ["nobody@x.ng"], unmatched_count: 1 };
      if (path.endsWith("close/")) return { ...done, status: "closed", root_cause: "Reused password", closed_at: "2026-11-03T12:00:00Z" };
      return INC;
    });
    renderAt("/admin/privacy/incidents/i1", <Route path="/admin/privacy/incidents/:id" element={<AdminIncidentPage />} />);
    fireEvent.click(await screen.findByRole("button", { name: "Record a notification" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^How/), { target: { value: "NDPC portal" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("NDPC: notified 3 Nov 10:00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Write a notice" }));
    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Account IDs or emails/), { target: { value: "a@x.ng\nb@x.ng\nnobody@x.ng" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Count recipients" }));
    expect(await within(dialog).findByText(/2 accounts will get it/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Close the incident" }));
    dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Root cause/), { target: { value: "Reused password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Close incident" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/privacy/incidents/i1/close/", { method: "POST", body: { root_cause: "Reused password", lessons: "" } }));
  });
});

describe("Access review", () => {
  it("flags inactive holders, keeps or revokes, and finishes", async () => {
    h.me = ADMIN;
    const row = { id: "g1", role: "moderator", role_label: "Moderator", scope_type: "global", scope_id: null, scope_label: "", note: "",
      user: { id: "u2", full_name: "Idle Mod", email: "idle@x.ng", is_active: true }, granted_by: "sa@x.ng", granted_at: "2026-07-01T00:00:00Z",
      is_active: true, revoked_at: null, revoked_by: null, is_own: false, last_seen_at: null, mfa_enabled: false, inactive: true };
    h.api.mockImplementation(async (_p: string, o?: { method?: string }) => (o?.method === "POST" ? {} : { due: true, last_review: null, results: [row] }));
    renderAt("/admin/team/review", <Route path="/admin/team/review" element={<AdminAccessReviewPage />} />);
    expect(await screen.findByText("Inactive 60+ days")).toBeTruthy();
    expect(screen.getByText("Access review due")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish review" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/team/review/", { method: "POST", body: { kept: 1, revoked: 0, notes: "" } }));
  });
});

describe("Notifications", () => {
  it("describes security notices and privacy request updates", () => {
    const base = { id: "n", created_at: "", read_at: null, article: null } as unknown as NotificationItem;
    const s = describeNotification({ ...base, kind: "security_notice", decision: "", security_notice: { reference: "INC-1", text: "We fixed it." } });
    expect(s).toMatchObject({ href: "/account/privacy", icon: "shield" });
    expect(s.text).toContain("We fixed it.");
    const p = describeNotification({ ...base, kind: "privacy_request_update", decision: "done", privacy_request: { id: "r", reference: "PRV-1", status: "done", status_label: "Done" } });
    expect(p.text).toBe("Your privacy request is done (PRV-1).");
  });
});
