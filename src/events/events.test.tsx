/** Events and volunteering — spec 18 §19.2 (frontend). */
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

import { RequireSignedIn, RequireSystemAdmin } from "../auth/guards";
import { resetRulesCache } from "../moderation/rules";
import AdminEventsPage from "../pages/admin/events/AdminEventsPage";
import CampaignCandidatePage from "../pages/campaign/CampaignCandidatePage";
import AccountVolunteeringPage from "../pages/events/AccountVolunteeringPage";
import EventPage from "../pages/events/EventPage";
import EventsPage from "../pages/events/EventsPage";
import MyEventsPage from "../pages/events/MyEventsPage";
import VolunteerPage from "../pages/events/VolunteerPage";
import { clerkState } from "../test/clerkMock";
import { describe as describeNotice } from "../pages/news/NotificationsPage";
import { refusal } from "./EventEditor";
import { fromLocalInput, toLocalInput, whenWords } from "./types";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventPage />} />
          <Route path="/candidates/:slug/volunteer" element={<VolunteerPage />} />
          <Route element={<RequireSignedIn />}>
            <Route path="/account/events" element={<MyEventsPage />} />
            <Route path="/account/volunteering" element={<AccountVolunteeringPage />} />
            <Route path="/campaign/:candidateId" element={<CampaignCandidatePage />} />
          </Route>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin/events" element={<AdminEventsPage />} />
          </Route>
        </Routes>
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

type Handler = unknown | ((opts: Record<string, unknown>, path: string) => unknown);
function routes(map: Record<string, Handler>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const key = `${(opts.method as string) ?? "GET"} ${path}`;
    const bare = path.split("?")[0];
    const bareKey = `${(opts.method as string) ?? "GET"} ${bare}`;
    const hit = [key, path, bareKey, bare].map((k) => map[k]).find((v) => v !== undefined);
    if (hit === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    const v = typeof hit === "function" ? (hit as (o: Record<string, unknown>, p: string) => unknown)(opts, path) : hit;
    if (v instanceof Error) throw v;
    return v;
  });
}

const ME = { full_name: "Ada Obi", email: "ada@example.com", profile_complete: true, is_system_admin: false, roles: [] };
const SA = { ...ME, is_system_admin: true, roles: [{ role: "system_admin" }], admin_areas: ["overview", "moderation", "events"] };
const CAMPAIGN = { ...ME, roles: [{ role: "candidate", scope_type: "candidate", scope_id: "k1" }] };
const RULES = {
  version: 3, updated: "2026-11-05", draft: false, rules: [{ id: "R11", title: "Lawful events and campaigning", summary: "", examples: [], law: "" }], changes: [],
  reasons: [{ reason: "other", label: "Something else", rule: "" }], profile_reasons: [], legal_email: "legal@example.com", counter_notice_days: 10, appeal_days: 14,
  event_reasons: [{ reason: "inducement", label: "Offers money or gifts to attend or vote", rule: "R11" }, { reason: "other", label: "Something else", rule: "" }],
};
const EID = "e1111111-1111-4111-8111-111111111111";
const organiser = { label: "Amina Bello’s campaign", candidate: { slug: "amina-bello", full_name: "Amina Bello" } };
const card = (over: Record<string, unknown> = {}) => ({
  id: EID, title: "Ikeja town hall", type: "town_hall", type_label: "Town hall", mode: "in_person", mode_label: "In person", status: "published",
  starts_at: "2026-11-14T09:00:00Z", ends_at: "2026-11-14T11:00:00Z", place: "Ikeja Grounds", lga: "Ikeja", state: "lagos", state_label: "Lagos",
  organiser, going: 12, full: false, members_only: false, cover: null, ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  ...card(), description: "Ask your questions.", venue_name: "Ikeja Grounds", venue_address: "1 Obafemi Awolowo Way", address_visibility: "public",
  accessibility_notes: "", registration: "open", capacity: 100, places_left: 88, ended: false, cancelled_reason: "", material_change: null,
  removed: null, calendar_url: `/api/events/${EID}/calendar.ics`, ...over,
});
const eventMe = (over: Record<string, unknown> = {}) => ({
  registration: null, can_register: true, register_block: null, venue_address: null, online_url: null, updates: [], ...over,
});
const organiserEvent = (over: Record<string, unknown> = {}) => ({
  ...detail({ status: "draft" }), venue_address_value: "1 Obafemi Awolowo Way", online_url_value: "", venue_type: "open_ground",
  counts: { registered: 0, waitlisted: 0, checked_in: 0 }, declarations_needed: ["no_inducements", "lawful_venue"],
  checkin_open: false, blackout_flagged: false, ...over,
});
const CANDIDATE = { id: "k1", slug: "amina-bello", full_name: "Amina Bello", position_label: "Senator", published: true, posting_paused_until: null,
  notify_count: 3, photo: null };

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  resetRulesCache();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "prompt").mockReturnValue("We have enough people in Kano.");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("helpers", () => {
  it("Lagos time in words and in the datetime input", () => {
    expect(whenWords("2026-11-14T09:00:00Z")).toBe("Sat 14 Nov, 10:00 (WAT)");
    expect(toLocalInput("2026-11-14T09:00:00Z")).toBe("2026-11-14T10:00");
    expect(fromLocalInput("2026-11-14T10:00")).toBe("2026-11-14T10:00:00+01:00");
    expect(fromLocalInput("")).toBeNull();
    expect(refusal(new ApiError({ status: 409, code: "outside_campaign_period", message: "Rallies for Senator start on 19 August 2026." })))
      .toBe("Rallies for Senator start on 19 August 2026.");
    expect(refusal(new Error("x"))).toMatch(/connection/);
  });
});

describe("notifications (spec 18 §10)", () => {
  const n = (over: Record<string, unknown>) => ({ id: "n1", kind: "event_update", decision: "", count: 1, read_at: null, created_at: "2026-11-05T10:00:00Z",
    event: { id: EID, title: "Ikeja town hall", starts_at: "2026-11-14T09:00:00Z", status: "published", organiser: "Amina Bello’s campaign" }, ...over });
  it("names the event and a short word, and links to it; volunteer notices go to your volunteering", () => {
    const d = (x: Record<string, unknown>) => describeNotice(x as any);
    expect(d(n({ decision: "postponed" }))).toMatchObject({ text: "Ikeja town hall: postponed", href: `/events/${EID}` });
    expect(d(n({ kind: "event_reminder", decision: "hour" })).text).toBe("Ikeja town hall starts within the hour");
    expect(d(n({ kind: "event_waitlist" })).text).toMatch(/a place opened/);
    expect(d(n({ kind: "candidate_event" })).text).toBe("Amina Bello’s campaign posted an event: Ikeja town hall");
    const cand = { slug: "amina-bello", full_name: "Amina Bello", photo: null };
    expect(d(n({ kind: "volunteer_decision", decision: "accepted", event: null, candidate: cand })))
      .toMatchObject({ text: "Amina Bello’s campaign accepted your volunteer application", href: "/account/volunteering" });
    expect(d(n({ kind: "volunteer_update", event: null, candidate: cand, volunteer_update: { text: "Training Saturday." } })).text)
      .toBe("Update from Amina Bello’s campaign: Training Saturday.");
  });
});

describe("/events", () => {
  it("guests see cards; filters go in the address and the request; Load more appends", async () => {
    const seen: string[] = [];
    routes({
      "/events/": (_o: Record<string, unknown>, p: string) => {
        seen.push(p);
        if (p.includes("cursor=2")) return { results: [card({ id: "e2", title: "Kano rally", type_label: "Rally", going: 0, full: true })], next: null, previous: null };
        return { results: [card()], next: "http://x/api/events/?cursor=2", previous: null };
      },
    });
    renderAt("/events");
    expect(await screen.findByText("Ikeja town hall")).toBeTruthy();
    expect(screen.getByText(/12 going/)).toBeTruthy();
    expect(screen.getByText(/Organised by Amina Bello’s campaign/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Kano rally")).toBeTruthy();
    expect(screen.getByText(/Full · waitlist/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "lagos" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/events?state=lagos"));
    await waitFor(() => expect(seen.some((p) => p.includes("state=lagos"))).toBe(true));
    fireEvent.click(screen.getByRole("tab", { name: "Past" }));
    await waitFor(() => expect(seen.some((p) => p.includes("when=past"))).toBe(true));
  });

  it("empty state", async () => {
    routes({ "/events/": { results: [], next: null, previous: null } });
    renderAt("/events");
    expect(await screen.findByText("No upcoming events")).toBeTruthy();
  });
});

describe("/events/:id", () => {
  it("signed out: details, calendar link, sign in to register", async () => {
    routes({ [`/events/${EID}/`]: detail() });
    renderAt(`/events/${EID}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Ikeja town hall" })).toBeTruthy();
    expect(screen.getByText(/1 Obafemi Awolowo Way/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add to calendar" }).getAttribute("href")).toBe(`/api/events/${EID}/calendar.ics`);
    expect(screen.getByText(/88 places left/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to register" }).getAttribute("href")).toContain(encodeURIComponent(`/events/${EID}`));
    expect(screen.getByText(/Only you, and the organiser around the event/)).toBeTruthy();
  });

  it("register shows the ticket; cancel asks first; the online link only comes from /me", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let mine = eventMe();
    const sent: string[] = [];
    routes({
      [`/events/${EID}/`]: detail({ mode: "hybrid", mode_label: "In person and online" }),
      [`/events/${EID}/me/`]: () => mine,
      [`POST /events/${EID}/registration/`]: () => {
        sent.push("POST");
        mine = eventMe({ can_register: false, registration: { status: "registered", ticket_code: "K7M2QX", checked_in: false, waitlist_position: null },
          online_url: "https://meet.example.com/abc", updates: [{ text: "Gates open at 9.", created_at: "2026-11-10T08:00:00Z" }] });
        return mine;
      },
      [`DELETE /events/${EID}/registration/`]: () => { sent.push("DELETE"); mine = eventMe(); return mine; },
    });
    renderAt(`/events/${EID}`);
    expect(await screen.findByText("The link shows here when you register.")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Register" }));
    expect(await screen.findByLabelText("Ticket code K 7 M 2 Q X")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Join online" }).getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Gates open at 9.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel my place" }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Register" })).toBeTruthy();
    expect(sent).toEqual(["POST", "DELETE"]);
  });

  it("waitlist, refusal in words, cancelled and removed states", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      [`/events/${EID}/`]: detail({ full: true, places_left: 0 }),
      [`/events/${EID}/me/`]: eventMe(),
      [`POST /events/${EID}/registration/`]: new ApiError({ status: 409, code: "too_many_registrations", message: "You can hold up to 20 upcoming places." }),
    });
    renderAt(`/events/${EID}`);
    fireEvent.click(await screen.findByRole("button", { name: "Join the waitlist" }));
    expect(await screen.findByText("You can hold up to 20 upcoming places.")).toBeTruthy();
    cleanup();

    routes({ [`/events/${EID}/`]: detail({ status: "cancelled", cancelled_reason: "Venue flooded.", registration: "closed" }),
      [`/events/${EID}/me/`]: eventMe({ can_register: false, register_block: { code: "event_not_open", message: "This event was cancelled." } }) });
    renderAt(`/events/${EID}`);
    expect(await screen.findByText("Venue flooded.")).toBeTruthy();
    expect(await screen.findByText("This event was cancelled.")).toBeTruthy();
    cleanup();

    routes({ [`/events/${EID}/`]: detail({ removed: { rule: "R11", rule_title: "Lawful events and campaigning" } }) });
    renderAt(`/events/${EID}`);
    expect(await screen.findByText(/broke rule R11: Lawful events and campaigning/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Register" })).toBeNull();
  });

  it("report uses the event reasons", async () => {
    let body: unknown = null;
    routes({ [`/events/${EID}/`]: detail(), "/rules/": RULES,
      [`POST /events/${EID}/report/`]: (o: Record<string, unknown>) => { body = o.body; return { reference: "RPT-ABC234" }; } });
    renderAt(`/events/${EID}`);
    fireEvent.click(await screen.findByRole("button", { name: "Report this event" }));
    const dialog = await screen.findByRole("dialog", { name: "Report this event" });
    fireEvent.click(await within(dialog).findByLabelText(/Offers money or gifts/));
    fireEvent.click(within(dialog).getByRole("button", { name: /Send report|Report/ }));
    await waitFor(() => expect((body as Record<string, unknown>)?.reason).toBe("inducement"));
  });

  it("not found", async () => {
    routes({});
    renderAt(`/events/${EID}`);
    expect(await screen.findByText("Event not found")).toBeTruthy();
  });
});

describe("/account/events and /account/volunteering", () => {
  it("my events lists codes and waitlist numbers; past tab", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/events/": (_o: Record<string, unknown>, p: string) => (p.includes("past") ? { results: [] } : { results: [
      { event: card(), registration: { status: "registered", ticket_code: "K7M2QX", checked_in: false, waitlist_position: null }, online_url: null },
      { event: card({ id: "e2", title: "Kano rally" }), registration: { status: "waitlisted", ticket_code: "Q2W3E4", checked_in: false, waitlist_position: 3 }, online_url: null },
    ] }) });
    renderAt("/account/events");
    expect(await screen.findByText("K7M2QX")).toBeTruthy();
    expect(screen.getByText("Waitlist number 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Past" }));
    expect(await screen.findByText("No past events")).toBeTruthy();
  });

  it("volunteering: status, decline reason, updates, withdraw", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    const app = (over: Record<string, unknown> = {}) => ({ id: "a1", candidate: { slug: "amina-bello", full_name: "Amina Bello" }, status: "pending",
      status_label: "Waiting for the campaign", roles: ["canvassing", "events"], created_at: "2026-11-01T10:00:00Z", decline_reason: "", ...over });
    routes({ "/me/volunteering/": { results: [app(), app({ id: "a2", status: "declined", status_label: "Declined", decline_reason: "Full in Kano." })],
      updates: [{ text: "Training on Saturday.", candidate: "Amina Bello", created_at: "2026-11-03T10:00:00Z" }] },
      "POST /me/volunteering/a1/withdraw/": app({ status: "withdrawn", status_label: "Withdrawn" }) });
    renderAt("/account/volunteering");
    expect(await screen.findByText("Full in Kano.")).toBeTruthy();
    expect(screen.getAllByText(/Canvassing, Events/)).toHaveLength(2);
    expect(screen.getByText("Training on Saturday.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText("Withdrawn")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Withdraw" })).toBeNull();
  });
});

describe("/candidates/:slug/volunteer", () => {
  const opening = (over: Record<string, unknown> = {}) => ({
    candidate: { slug: "amina-bello", full_name: "Amina Bello" }, open: true, intro: "Help us reach every ward.", states: ["lagos", "kano"],
    roles: [{ value: "canvassing", label: "Canvassing" }, { value: "events", label: "Events" }],
    availability: [{ value: "weekends", label: "Weekends" }], all_roles: [], ...over,
  });

  it("signed out asks to sign in; closed says so", async () => {
    routes({ "/candidates/amina-bello/volunteering/": opening() });
    renderAt("/candidates/amina-bello/volunteer");
    expect(await screen.findByText("Sign in to volunteer")).toBeTruthy();
    cleanup();
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/candidates/amina-bello/volunteering/": opening({ open: false }) });
    renderAt("/candidates/amina-bello/volunteer");
    expect(await screen.findByText(/isn’t taking volunteers/)).toBeTruthy();
  });

  it("apply: roles and state required; phone off by default; goes to your volunteering", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let body: Record<string, unknown> = {};
    routes({ "/candidates/amina-bello/volunteering/": opening(),
      "POST /candidates/amina-bello/volunteering/apply/": (o: Record<string, unknown>) => { body = o.body as Record<string, unknown>; return {}; } });
    renderAt("/candidates/amina-bello/volunteer");
    const send = (await screen.findByRole("button", { name: "Send application" })) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    // only the states the campaign asked for
    expect(within(screen.getByLabelText(/^State/)).queryByRole("option", { name: "Rivers" })).toBeNull();
    fireEvent.click(screen.getByLabelText("Canvassing"));
    fireEvent.change(screen.getByLabelText(/^State/), { target: { value: "kano" } });
    fireEvent.click(screen.getByLabelText("Weekends"));
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/account/volunteering"));
    expect(body).toEqual({ roles: ["canvassing"], state: "kano", geo_lga: null, availability: ["weekends"], note: "", share_phone: false });
  });
});

describe("/campaign/:candidateId — Events and Volunteers tabs", () => {
  it("new event draft, publish with declarations, refusals in words, check-in", async () => {
    clerkState.isSignedIn = true;
    h.me = CAMPAIGN;
    const sent: Record<string, unknown> = {};
    let ev = organiserEvent();
    routes({
      "/campaign/candidates/k1/posts/": { results: [], candidate: CANDIDATE },
      "/campaign/k1/events/": { results: [] },
      "POST /campaign/k1/events/": (o: Record<string, unknown>) => { sent.create = o.body; return ev; },
      [`POST /campaign/k1/events/${EID}/publish/`]: (o: Record<string, unknown>) => {
        sent.publish = o.body;
        ev = organiserEvent({ status: "published", checkin_open: true, counts: { registered: 1, waitlisted: 0, checked_in: 0 } });
        return ev;
      },
      [`/campaign/k1/events/${EID}/checkin/`]: { counts: { registered: 1, waitlisted: 0, checked_in: 0 }, results: [{ ticket_code: "K7M2QX", name: "Tunde A.", checked_in: false }] },
      [`POST /campaign/k1/events/${EID}/checkin/`]: (o: Record<string, unknown>) => { sent.checkin = o.body; return { ticket_code: "K7M2QX", name: "Tunde A.", checked_in: true }; },
    });
    renderAt("/campaign/k1");
    fireEvent.click(await screen.findByRole("tab", { name: "Events" }));
    fireEvent.click(await screen.findByRole("button", { name: "New event" }));
    const form = await screen.findByRole("form", { name: "New event" });
    fireEvent.change(within(form).getAllByLabelText(/^Type/)[0], { target: { value: "town_hall" } });
    fireEvent.change(within(form).getByLabelText(/^Title/), { target: { value: "Ikeja town hall" } });
    fireEvent.change(within(form).getByLabelText(/^Description/), { target: { value: "Ask your questions." } });
    fireEvent.change(within(form).getByLabelText(/^Starts/), { target: { value: "2026-11-14T10:00" } });
    fireEvent.change(within(form).getByLabelText(/^Ends/), { target: { value: "2026-11-14T12:00" } });
    fireEvent.change(within(form).getByLabelText(/^State/), { target: { value: "lagos" } });
    fireEvent.change(within(form).getByLabelText(/^Venue name/), { target: { value: "Ikeja Grounds" } });
    fireEvent.change(within(form).getByLabelText(/^Address/), { target: { value: "1 Obafemi Awolowo Way" } });
    fireEvent.change(within(form).getByLabelText(/^Type of venue/), { target: { value: "open_ground" } });
    expect(within(form).queryByRole("switch", { name: "NDC members only" })).toBeNull();
    fireEvent.click(within(form).getByRole("button", { name: "Save draft" }));
    const dash = await screen.findByRole("region", { name: "Event: Ikeja town hall" });
    expect(sent.create).toMatchObject({ type: "town_hall", starts_at: "2026-11-14T10:00:00+01:00", ends_at: "2026-11-14T12:00:00+01:00",
      venue_type: "open_ground", capacity: null, members_only: false });

    fireEvent.click(within(dash).getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish this event?" });
    const go = within(dialog).getByRole("button", { name: "Publish" }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(within(dialog).getByLabelText(/no money, gifts or goods/));
    expect(go.disabled).toBe(true);
    fireEvent.click(within(dialog).getByLabelText(/isn’t a place of worship/));
    fireEvent.click(go);
    await waitFor(() => expect(sent.publish).toEqual({ declarations: { no_inducements: true, lawful_venue: true } }));

    fireEvent.click(await screen.findByRole("button", { name: "Check-in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check in K7M2QX" }));
    await waitFor(() => expect(sent.checkin).toEqual({ code: "K7M2QX" }));
    expect(await screen.findByText("Tunde A. checked in.")).toBeTruthy();
  });

  it("server refusals show as a banner (campaign period)", async () => {
    clerkState.isSignedIn = true;
    h.me = CAMPAIGN;
    routes({
      "/campaign/candidates/k1/posts/": { results: [], candidate: CANDIDATE },
      "/campaign/k1/events/": { results: [] },
      "POST /campaign/k1/events/": new ApiError({ status: 409, code: "outside_campaign_period", message: "Rallies for Senator can start from 19 August 2026.",
        extra: { period_start: "2026-08-19", period_end: "2027-01-15" } }),
    });
    renderAt("/campaign/k1");
    fireEvent.click(await screen.findByRole("tab", { name: "Events" }));
    fireEvent.click(await screen.findByRole("button", { name: "New event" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Rallies for Senator can start from 19 August 2026.")).toBeTruthy();
  });

  it("volunteers: open sign-up, accept, decline with reason, show contact, send update", async () => {
    clerkState.isSignedIn = true;
    h.me = CAMPAIGN;
    const sent: Record<string, unknown> = {};
    const vrow = (over: Record<string, unknown> = {}) => ({ id: "v1", name: "Tunde A.", status: "pending", state: "kano", state_label: "Kano", lga: "",
      roles: ["canvassing"], availability: ["weekends"], note: "Free on Saturdays.", created_at: "2026-11-02T10:00:00Z", ...over });
    routes({
      "/campaign/candidates/k1/posts/": { results: [], candidate: CANDIDATE },
      "/campaign/k1/events/": { results: [] },
      "/campaign/k1/volunteering/": { candidate: { slug: "amina-bello", full_name: "Amina Bello" }, open: false, intro: "", states: [], roles: [],
        availability: [], all_roles: [{ value: "canvassing", label: "Canvassing" }, { value: "events", label: "Events" }] },
      "PATCH /campaign/k1/volunteering/": (o: Record<string, unknown>) => { sent.opening = o.body; return { candidate: { slug: "amina-bello", full_name: "Amina Bello" },
        open: true, intro: "Help us.", states: [], roles: [{ value: "canvassing", label: "Canvassing" }], availability: [],
        all_roles: [{ value: "canvassing", label: "Canvassing" }, { value: "events", label: "Events" }] }; },
      "/campaign/k1/volunteers/": (_o: Record<string, unknown>, p: string) => ({ results: p.includes("accepted") ? [vrow({ id: "v3", name: "Ngozi E.", status: "accepted" })]
        : [vrow(), vrow({ id: "v2", name: "Bisi K." })], counts: { pending: 2, accepted: 1, declined: 0, withdrawn: 0, ended: 0 } }),
      "POST /campaign/k1/volunteers/v1/decide/": (o: Record<string, unknown>) => { sent.accept = o.body; return vrow({ status: "accepted" }); },
      "POST /campaign/k1/volunteers/v2/decide/": (o: Record<string, unknown>) => { sent.decline = o.body; return vrow({ id: "v2", status: "declined" }); },
      "/campaign/k1/volunteers/v3/contact/": { full_name: "Ngozi Eze", phone_number: null },
      "POST /campaign/k1/volunteers/updates/": (o: Record<string, unknown>) => { sent.update = o.body; return {}; },
    });
    renderAt("/campaign/k1");
    fireEvent.click(await screen.findByRole("tab", { name: "Volunteers" }));
    fireEvent.change(await screen.findByLabelText("What volunteers will do"), { target: { value: "Help us." } });
    fireEvent.click(screen.getByLabelText("Canvassing"));
    fireEvent.click(screen.getByRole("switch", { name: "Taking volunteers" }));
    await waitFor(() => expect(sent.opening).toEqual({ open: true, intro: "Help us.", roles: ["canvassing"] }));

    expect(await screen.findByText("Bisi K.")).toBeTruthy();
    expect(screen.queryByText(/@/)).toBeNull();  // never an email
    const rows = screen.getAllByRole("row");
    fireEvent.click(within(rows[1]).getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(sent.accept).toEqual({ accept: true, reason: "" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));  // the accepted row leaves the Pending list
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => expect(sent.decline).toEqual({ accept: false, reason: "We have enough people in Kano." }));

    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "accepted" } });
    fireEvent.click(await screen.findByRole("button", { name: "Show contact" }));
    const dialog = await screen.findByRole("dialog", { name: "Contact details" });
    expect(within(dialog).getByText("Ngozi Eze")).toBeTruthy();
    expect(within(dialog).getByText("They didn’t share a phone number.")).toBeTruthy();
    expect(within(dialog).getByText(/This view is recorded/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    fireEvent.change(screen.getByLabelText("Update"), { target: { value: "Training on Saturday at 10." } });
    fireEvent.click(screen.getByRole("button", { name: "Send update" }));
    await waitFor(() => expect(sent.update).toEqual({ text: "Training on Saturday at 10.", role: "" }));
  });
});

describe("/admin/events", () => {
  it("system admins: party events with members-only, all events with counts only", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    routes({
      "/admin/events/party/": { results: [] },
      "/admin/events/": { results: [{ ...card(), registered: 40, waitlisted: 2, blackout_flagged: true }],
        counts: { upcoming: 5, this_week: 2, blackout_flagged: 1 } },
    });
    renderAt("/admin/events");
    fireEvent.click(await screen.findByRole("button", { name: "New event" }));
    expect(await screen.findByRole("switch", { name: "NDC members only" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("tab", { name: "All events" }));
    expect(await screen.findByText("40 (+2 waitlist)")).toBeTruthy();
    expect(screen.getByText("Blackout window")).toBeTruthy();
    expect(screen.getByText(/1 inside a blackout window/)).toBeTruthy();
    expect(screen.getByText(/Nobody, admins included, can list who registered/)).toBeTruthy();
  });

  it("not for other users", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({});
    renderAt("/admin/events");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Events" })).toBeNull());
  });
});
