/** Communities — spec 17 §19.2 (frontend). */
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
import AdminCommunitiesPage from "../pages/admin/communities/AdminCommunitiesPage";
import AccountCommunitiesPage from "../pages/communities/AccountCommunitiesPage";
import CommunitiesPage from "../pages/communities/CommunitiesPage";
import CommunityPage from "../pages/communities/CommunityPage";
import { clerkState } from "../test/clerkMock";
import { refusalWords } from "./Composer";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route path="/communities/*" element={<CommunityPage />} />
          <Route element={<RequireSignedIn />}>
            <Route path="/account/communities" element={<AccountCommunitiesPage />} />
          </Route>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin/communities" element={<AdminCommunitiesPage />} />
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

const RULES = {
  version: 2, updated: "2026-11-05", draft: false, rules: [{ id: "R1", title: "No threats", summary: "", examples: [], law: "" }], changes: [],
  reasons: [{ reason: "false", label: "False or misleading", rule: "R4" }, { reason: "other", label: "Something else", rule: "" }],
  profile_reasons: [], legal_email: "legal@example.com", counter_notice_days: 10, appeal_days: 14,
};
const ME = { full_name: "Ada Obi", email: "ada@example.com", profile_complete: true, is_system_admin: false, roles: [] };
const SA = { ...ME, is_system_admin: true, roles: [{ role: "system_admin" }], admin_areas: ["overview", "moderation", "communities", "team"] };

const comm = (over: Record<string, unknown> = {}) => ({
  id: "s1", level: "state", level_label: "State", name: "Lagos", path: "lagos", state: "lagos", parent_id: "n1", active: true,
  members: "1,000+", post_count: 12, has_children: true, ...over,
});
const NATIONAL = comm({ id: "n1", level: "national", level_label: "National", name: "Nigeria", path: "national", state: "", parent_id: null, members: "10,000+" });
const membership = (c: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  community: { id: c.id, level: c.level, level_label: c.level_label, name: c.name, path: c.path },
  level: c.level, how: "verified", how_label: "From your verified PVC", joined_at: "2026-11-01T10:00:00Z", notify_new_posts: false, ...over,
});
const mine = (over: Record<string, unknown> = {}) => ({
  consented: true, verified: true, memberships: [], left_levels: [], state_change_available_at: null, unmatched: false, geography_loaded: true, ...over,
});
const detail = (over: Record<string, unknown> = {}) => ({
  ...comm(), breadcrumb: [{ id: "s1", level: "state", level_label: "State", name: "Lagos", path: "lagos" }], read_scope: "signed_in",
  posting_open: true, ndc_members_only: false, can_read: true, can_post: true, post_block: null,
  membership: { how: "verified", how_label: "From your verified PVC", joined_at: "2026-11-01T10:00:00Z", notify_new_posts: false }, campaigns: [], ...over,
});
const author = (over: Record<string, unknown> = {}) => ({ name: "Tunde A.", verified: false, campaign: "", is_you: false, ...over });
const post = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111", body: "The Third Mainland Bridge needs repairs.", status: "published",
  created_at: "2026-11-05T09:00:00Z", edited_at: null, author: author(), can_edit: false, can_delete: false, notice: null,
  community: { id: "s1", level: "state", level_label: "State", name: "Lagos", path: "lagos" }, comment_count: 2, reaction_count: 3, liked: false, ...over,
});
const comment = (over: Record<string, unknown> = {}) => ({
  id: "c1", body: "Agreed.", status: "published", created_at: "2026-11-05T09:30:00Z", edited_at: null, author: author({ name: "Bisi K." }),
  can_edit: false, can_delete: false, notice: null, ...over,
});
const PINNED = { id: "a1", title: "Voter registration extended", category_label: "Community", published_at: "2026-11-04T10:00:00Z",
  audience: { id: "s1", level: "state", level_label: "State", name: "Lagos", path: "lagos" } };
const POST_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  resetRulesCache();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- /communities
describe("/communities", () => {
  it("signed out: browse national and states, sign-in banner, counts banded", async () => {
    routes({ "/communities/": [NATIONAL, comm()] });
    renderAt("/communities");
    expect(await screen.findByRole("link", { name: /Nigeria/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Lagos.*1,000\+ members/ })).toBeTruthy();
    expect(screen.getByText("Sign in to take part")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalledWith("/me/communities/", expect.anything());
  });

  it("join asks the server (consent is handled by the API client), then shows your communities", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let joined = false;
    routes({
      "/communities/": [NATIONAL, comm()],
      "/me/communities/": () => mine({ consented: joined, memberships: joined ? [membership(NATIONAL), membership(comm())] : [] }),
      "POST /me/communities/join/": () => { joined = true; return mine({ memberships: [membership(NATIONAL), membership(comm())] }); },
    });
    renderAt("/communities");
    fireEvent.click(await screen.findByRole("button", { name: "Join communities" }));
    expect(await screen.findByRole("heading", { name: "Your communities" })).toBeTruthy();
    expect(screen.getByText("You’ve joined.")).toBeTruthy();
    const yours = screen.getByRole("heading", { name: "Your communities" }).closest("section")!;
    expect(within(yours).getByRole("link", { name: /Lagos/ })).toBeTruthy();
    expect(screen.queryByText(/Verify your PVC to join your local/)).toBeNull();
  });

  it("not verified: banner, choose a state (30-day hint), errors in words", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let tries = 0;
    let sent: unknown = null;
    routes({
      "/communities/": [NATIONAL, comm()],
      "/me/communities/": mine({ verified: false, memberships: [membership(NATIONAL, { how: "chosen", how_label: "You joined" })] }),
      "POST /me/communities/state/": (o: Record<string, unknown>) => {
        sent = o.body;
        tries += 1;
        return tries === 1 ? new ApiError({ status: 409, code: "too_soon", message: "You can change your state community once every 30 days." })
          : mine({ verified: false, memberships: [membership(NATIONAL), membership(comm(), { how: "chosen", how_label: "You chose it" })] });
      },
    });
    renderAt("/communities");
    expect(await screen.findByText("Verify your PVC to join your local communities")).toBeTruthy();
    expect(screen.getByText(/ward \(registration area\)/)).toBeTruthy();
    const select = screen.getByLabelText(/Choose your state community/);
    expect(screen.getByText(/once every 30 days/)).toBeTruthy();
    const join = screen.getByRole("button", { name: "Join" }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    fireEvent.change(select, { target: { value: "lagos" } });
    fireEvent.click(join);
    expect(await screen.findByText("You can change your state community once every 30 days.")).toBeTruthy();
    expect(sent).toEqual({ state: "lagos" });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("You’ve joined your state community.")).toBeTruthy();
    expect(screen.queryByLabelText(/Choose your state community/)).toBeNull();
  });

  it("unmatched polling unit and geography not loaded say so", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/communities/": [NATIONAL], "/me/communities/": mine({ unmatched: true, geography_loaded: false, memberships: [membership(comm())] }) });
    renderAt("/communities");
    expect(await screen.findByText(/couldn’t match your polling unit/)).toBeTruthy();
    expect(screen.getByText(/open when INEC’s polling-unit list is loaded/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- community page
describe("/communities/<path>", () => {
  it("feed: breadcrumb, pinned announcement, posts, load more", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/communities/lookup/?path=lagos": detail(),
      "/communities/s1/posts/": { pinned: [PINNED], results: [post()], next: "http://api.test/api/v1/communities/s1/posts/?cursor=abc", previous: null },
      "/communities/s1/posts/?cursor=abc": { pinned: [], results: [post({ id: "22222222-2222-4222-8222-222222222222", body: "Second page post here." })],
        next: null, previous: null },
    });
    renderAt("/communities/lagos");
    expect(await screen.findByRole("heading", { level: 1, name: "Lagos" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Community levels" })).toBeTruthy();
    expect(screen.getByText(/You’re a member · From your verified PVC/)).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Voter registration extended" })).toBeTruthy();
    expect(screen.getByText(/Pinned · Community/)).toBeTruthy();
    expect(screen.getByText(/Third Mainland Bridge/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "2 comments" }).getAttribute("href")).toBe(`/communities/lagos/posts/${POST_ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Second page post here.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("composer: counter, minimum length, refusal in words, new post on top", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let n = 0;
    routes({
      "/communities/lookup/?path=lagos": detail(),
      "/communities/s1/posts/": { pinned: [], results: [], next: null, previous: null },
      "POST /communities/s1/posts/": (o: Record<string, unknown>) => {
        n += 1;
        if (n === 1) return new ApiError({ status: 429, code: "too_soon", message: "You’re posting quickly. Wait a moment.", until: "2026-11-05T12:00:00Z" });
        if (n === 2) return new ApiError({ status: 400, code: "invalid", message: "Check the form.", fields: { body: ["Links to that site aren’t allowed."] } });
        return post({ id: "33333333-3333-4333-8333-333333333333", body: (o.body as { body: string }).body, author: author({ name: "Ada O.", is_you: true }),
          can_edit: true, can_delete: true, comment_count: 0, reaction_count: 0 });
      },
    });
    renderAt("/communities/lagos");
    expect(await screen.findByText("No posts yet")).toBeTruthy();
    const box = screen.getByLabelText("Write a post");
    const send = screen.getByRole("button", { name: "Post" }) as HTMLButtonElement;
    fireEvent.change(box, { target: { value: "too short" } });
    expect(send.disabled).toBe(true);
    expect(screen.getByText("9 / 2,000")).toBeTruthy();
    fireEvent.change(box, { target: { value: "x".repeat(2001) } });
    expect(send.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "Our ward needs a new borehole." } });
    fireEvent.click(send);
    expect(await screen.findByText(/You’re posting quickly\. Wait a moment \(until/)).toBeTruthy();
    fireEvent.click(send);
    expect(await screen.findByText("Links to that site aren’t allowed.")).toBeTruthy();
    fireEvent.click(send);
    expect(await screen.findByText("Our ward needs a new borehole.")).toBeTruthy();
    expect(screen.getByText("Ada O. (you)")).toBeTruthy();
    expect((screen.getByLabelText("Write a post") as HTMLTextAreaElement).value).toBe("");
  });

  it("campaign accounts pick the campaign they post for", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let body: unknown = null;
    routes({
      "/communities/lookup/?path=lagos": detail({ campaigns: [{ id: "k1", name: "Amina Bello" }, { id: "k2", name: "Musa Ali" }] }),
      "/communities/s1/posts/": { pinned: [], results: [], next: null, previous: null },
      "POST /communities/s1/posts/": (o: Record<string, unknown>) => { body = o.body; return post({ author: author({ campaign: "Campaign team · Musa Ali" }) }); },
    });
    renderAt("/communities/lagos");
    fireEvent.change(await screen.findByLabelText("Write a post"), { target: { value: "Rally at Ikeja on Saturday." } });
    const send = screen.getByRole("button", { name: "Post" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Posting for/), { target: { value: "k2" } });
    fireEvent.click(send);
    await waitFor(() => expect(body).toEqual({ body: "Rally at Ikeja on Saturday.", campaign_candidate: "k2" }));
    await waitFor(() => expect(document.querySelector(".comm-post__campaign")?.textContent).toBe("Campaign team · Musa Ali"));
  });

  it("paused or blocked members see why instead of the composer", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/communities/lookup/?path=lagos": detail({ can_post: false, post_block: { code: "posting_paused", message: "Your community posting is paused.", until: "2026-11-08T10:00:00Z" } }),
      "/communities/s1/posts/": { pinned: [], results: [post()], next: null, previous: null },
    });
    renderAt("/communities/lagos");
    expect(await screen.findByText(/Your community posting is paused\. \(until/)).toBeTruthy();
    expect(screen.queryByLabelText("Write a post")).toBeNull();
  });

  it("members-only levels: signed out asks to sign in; not a member explains placement", async () => {
    const ward = detail({ id: "w1", level: "ward", level_label: "Ward (registration area)", name: "Ward 05", path: "lagos/ikeja/05", can_read: false,
      can_post: false, membership: null, read_scope: "members", breadcrumb: [] });
    routes({ "/communities/lookup/?path=lagos%2Fikeja%2F05": ward });
    renderAt("/communities/lagos/ikeja/05");
    expect(await screen.findByText("Sign in to read this community")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalledWith(expect.stringContaining("/posts/"), expect.anything());
    cleanup();
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/communities/lookup/?path=lagos%2Fikeja%2F05": { ...ward, post_block: { code: "verification_required", message: "Verify", until: null } } });
    renderAt("/communities/lagos/ikeja/05");
    expect(await screen.findByText("Only members can read this community")).toBeTruthy();
    expect(screen.getByText(/We place you automatically once your PVC is verified/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Verify your PVC" })).toBeTruthy();
    expect(screen.getByText("Ward (registration area)")).toBeTruthy();
  });

  it("unknown path: not found", async () => {
    routes({ "/communities/lookup/?path=nowhere": new ApiError({ status: 404, message: "Not found" }) });
    renderAt("/communities/nowhere");
    expect(await screen.findByText("Community not found")).toBeTruthy();
  });

  it("post page: Like toggles the count, comments listed, comment added", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let reaction = "";
    routes({
      "/communities/lookup/?path=lagos": detail(),
      [`/community-posts/${POST_ID}/`]: post(),
      [`/community-posts/${POST_ID}/comments/`]: { count: 1, next: null, previous: null, results: [comment()] },
      [`PUT /community-posts/${POST_ID}/reaction/`]: () => { reaction = "PUT"; return { liked: true, reaction_count: 4 }; },
      [`DELETE /community-posts/${POST_ID}/reaction/`]: () => { reaction = "DELETE"; return { liked: false, reaction_count: 3 }; },
      [`POST /community-posts/${POST_ID}/comments/`]: (o: Record<string, unknown>) =>
        comment({ id: "c2", body: (o.body as { body: string }).body, author: author({ name: "Ada O.", is_you: true }) }),
    });
    renderAt(`/communities/lagos/posts/${POST_ID}`);
    expect(await screen.findByText(/Third Mainland Bridge/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "← Lagos" })).toBeTruthy();
    expect(await screen.findByText("Agreed.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "2 comments" })).toBeTruthy();
    const like = screen.getByRole("button", { name: "Like, 3 likes" });
    expect(like.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(like);
    const liked = await screen.findByRole("button", { name: "Like, 4 likes" });
    expect(liked.getAttribute("aria-pressed")).toBe("true");
    expect(reaction).toBe("PUT");
    fireEvent.click(liked);
    expect(await screen.findByRole("button", { name: "Like, 3 likes" })).toBeTruthy();
    expect(reaction).toBe("DELETE");
    fireEvent.change(screen.getByLabelText("Write a comment"), { target: { value: "Me too" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(await screen.findByText("Me too")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "3 comments" })).toBeTruthy();
  });

  it("own post: edit and delete (with a confirm); others' posts can be reported", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let reported: unknown = null;
    const own = post({ author: author({ name: "Ada O.", is_you: true }), can_edit: true, can_delete: true });
    routes({
      "/rules/": RULES,
      "/communities/lookup/?path=lagos": detail(),
      "/communities/s1/posts/": { pinned: [], results: [own, post({ id: "44444444-4444-4444-8444-444444444444", body: "Someone else wrote this." })], next: null, previous: null },
      [`PATCH /community-posts/${POST_ID}/`]: (o: Record<string, unknown>) => ({ ...own, body: (o.body as { body: string }).body, edited_at: "2026-11-05T10:00:00Z" }),
      [`DELETE /community-posts/${POST_ID}/`]: { ...own, status: "deleted", notice: { kind: "deleted", rule: "", rule_title: "" }, can_edit: false, can_delete: false },
      "POST /community-posts/44444444-4444-4444-8444-444444444444/report/": (o: Record<string, unknown>) => { reported = o.body; return { reference: "RPT-ABC123" }; },
    });
    renderAt("/communities/lagos");
    expect(await screen.findByText("Someone else wrote this.")).toBeTruthy();
    const mineCard = screen.getByText("Ada O. (you)").closest("article")!;
    expect(within(mineCard).queryByRole("button", { name: /^Report/ })).toBeNull();
    fireEvent.click(within(mineCard).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(mineCard).getByLabelText("Edit your post"), { target: { value: "The bridge needs urgent repairs." } });
    fireEvent.click(within(mineCard).getByRole("button", { name: "Save" }));
    expect(await within(mineCard).findByText("The bridge needs urgent repairs.")).toBeTruthy();
    expect(within(mineCard).getByText(/Edited/)).toBeTruthy();
    fireEvent.click(within(mineCard).getByRole("button", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith("Delete your post? Its comments go with it.");
    expect(await within(mineCard).findByText("Deleted by the author.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Report post by Tunde A." }));
    const dialog = await screen.findByRole("dialog", { name: "Report this post" });
    fireEvent.click(within(dialog).getByLabelText(/False or misleading/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("RPT-ABC123")).toBeTruthy();
    expect(reported).toEqual({ reason: "false", details: "", contact_email: "" });
  });

  it("hidden and removed items show a notice, not the body", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/communities/lookup/?path=lagos": detail(),
      "/communities/s1/posts/": { pinned: [], next: null, previous: null, results: [
        post({ status: "hidden", body: "", notice: { kind: "hidden", rule: "", rule_title: "" }, author: author({ name: "Ada O.", is_you: true }) }),
        post({ id: "55555555-5555-4555-8555-555555555555", status: "removed", body: "", notice: { kind: "removed", rule: "R1", rule_title: "No threats" } }),
      ] },
    });
    renderAt("/communities/lagos");
    expect(await screen.findByText("Your post is hidden while moderators review a report.")).toBeTruthy();
    expect(screen.getByText(/Removed by moderators for breaking rule R1: No threats/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Like/ })).toBeNull();
  });
});

describe("composer refusals (§13.3)", () => {
  it("every code shows in words; timed ones add the date", () => {
    const words: Record<string, string> = {
      community_closed: "This community has closed.", posting_paused: "Your community posting is paused.",
      not_a_member: "Only members can post here.", verification_required: "Verify your PVC to join your LGA, ward and polling unit communities.",
      state_change_too_soon: "You can change your state community once every 30 days.", duplicate_post: "You’ve already posted that.",
      too_soon: "You’re posting quickly.", edit_window_closed: "Posts can be edited for 15 minutes.",
      publishing_paused: "Posting is paused here.", ndc_members_only: "This community is for NDC members.", rate_limited: "Too many requests. Wait a moment.",
    };
    for (const [code, message] of Object.entries(words)) {
      expect(refusalWords(new ApiError({ status: 400, code, message }))).toBe(message);
    }
    for (const code of ["too_soon", "posting_paused", "publishing_paused"]) {
      expect(refusalWords(new ApiError({ status: 409, code, message: "Paused.", until: "2026-11-08T10:00:00Z" }))).toMatch(/^Paused \(until .+\)\.$/);
    }
    expect(refusalWords(new ApiError({ status: 400, code: "invalid", message: "Check the form.", fields: { body: ["Too long."] } }))).toBe("Too long.");
    expect(refusalWords(new TypeError("offline"))).toMatch(/Check your connection/);
  });
});

// ---------------------------------------------------------------- account
describe("/account/communities", () => {
  it("lists how each was assigned; bells only below state; leave confirms; rejoin", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    const lga = comm({ id: "l1", level: "lga", level_label: "LGA", name: "Ikeja", path: "lagos/ikeja" });
    const sent: Record<string, unknown> = {};
    routes({
      "/me/communities/": mine({ memberships: [membership(NATIONAL), membership(comm()), membership(lga)], left_levels: ["ward"] }),
      "PATCH /me/communities/l1/": (o: Record<string, unknown>) => {
        sent.bell = o.body;
        return mine({ memberships: [membership(NATIONAL), membership(comm()), membership(lga, { notify_new_posts: true })], left_levels: ["ward"] });
      },
      "DELETE /me/communities/s1/": () => { sent.leave = true; return mine({ memberships: [membership(NATIONAL)], left_levels: [] }); },
      "POST /me/communities/rejoin/": (o: Record<string, unknown>) => { sent.rejoin = o.body; return mine({ memberships: [membership(NATIONAL)] }); },
    });
    renderAt("/account/communities");
    expect(await screen.findByRole("heading", { name: "Your communities" })).toBeTruthy();
    expect(screen.getAllByText(/From your verified PVC/).length).toBe(3);
    expect(screen.queryByRole("switch", { name: "New posts in Lagos" })).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "New posts in Ikeja" }));
    expect(await screen.findByText("You’ll be told about new posts.")).toBeTruthy();
    expect(sent.bell).toEqual({ notify_new_posts: true });
    fireEvent.click(screen.getByRole("button", { name: /Rejoin your ward/ }));
    await waitFor(() => expect(sent.rejoin).toEqual({ level: "ward" }));
    cleanup();
    routes({
      "/me/communities/": mine({ memberships: [membership(NATIONAL), membership(comm())] }),
      "DELETE /me/communities/s1/": () => { sent.leave = true; return mine({ memberships: [membership(NATIONAL)] }); },
    });
    renderAt("/account/communities");
    const lagos = (await screen.findByRole("link", { name: "Lagos" })).closest("li")!;
    fireEvent.click(within(lagos).getByRole("button", { name: "Leave" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("also leaves your LGA, ward and polling unit"));
    expect(await screen.findByText("You’ve left.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Lagos" })).toBeNull();
  });

  it("not verified: change state, or the date it's next available", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/communities/": mine({ verified: false, memberships: [membership(comm(), { how: "chosen", how_label: "You chose it" })],
      state_change_available_at: "2026-12-01T10:00:00Z" }) });
    renderAt("/account/communities");
    expect(await screen.findByRole("heading", { name: "Change your state community" })).toBeTruthy();
    expect(screen.getByText(/You can change it again on/)).toBeTruthy();
    expect(screen.queryByLabelText(/^State/)).toBeNull();
  });

  it("needs sign-in", () => {
    renderAt("/account/communities");
    expect(screen.getByTestId("where").textContent).not.toBe("/account/communities");
  });
});

// ---------------------------------------------------------------- admin
describe("/admin/communities", () => {
  it("system admins: tree, expand to children, settings saved", async () => {
    clerkState.isSignedIn = true;
    h.me = SA;
    const admin = (c: Record<string, unknown>, over: Record<string, unknown> = {}) => ({ ...c, member_count: "1,204", read_scope: "signed_in",
      posting_open: true, ndc_members_only: false, open_cases: 2, moderators: [], ...over });
    let patched: unknown = null;
    routes({
      "/admin/communities/": admin(NATIONAL),
      "/admin/communities/?parent=n1": [admin(comm())],
      "/admin/communities/n1/": admin(NATIONAL, { moderators: ["mod@example.com"] }),
      "PATCH /admin/communities/n1/": (o: Record<string, unknown>) => { patched = o.body; return admin(NATIONAL, { posting_open: false, moderators: ["mod@example.com"] }); },
    });
    h.api.mockImplementationOnce(async () => [admin(NATIONAL)]);
    renderAt("/admin/communities");
    expect(await screen.findByRole("link", { name: "Nigeria" })).toBeTruthy();
    expect(screen.getByText(/1,204 members/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByText(/mod@example\.com/)).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Lagos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "2" }).getAttribute("href")).toBe("/admin/moderation?type=communities&community=n1");
    fireEvent.click(screen.getAllByRole("switch", { name: "Posting open" })[0]);
    expect(await screen.findByText("Saved.")).toBeTruthy();
    expect(patched).toEqual({ posting_open: false });
  });

  it("not for other users", () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    renderAt("/admin/communities");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
  });
});
