/** Candidate following — spec 04 §12 (frontend). */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({ useApi: () => h.api, useMe: () => ({ me: null, status: "idle", error: null, setMe: () => {}, refresh: () => {} }) }));
vi.mock("../donations/DonationConfigProvider", () => ({
  useDonationConfig: () => ({ config: { open: false, min_kobo: null, max_per_payment_kobo: null, presets_kobo: [] }, loading: false }),
}));

import CandidateProfilePage from "../pages/candidates/CandidateProfilePage";
import CandidatesPage from "../pages/candidates/CandidatesPage";
import FollowingPage from "../pages/following/FollowingPage";
import { clerkState } from "../test/clerkMock";
import { FollowProvider } from "./FollowProvider";
import { PENDING_VOTE_KEY, PENDING_VOTE_TTL_MS } from "./pendingVote";

// ------------------------------------------------------------------ fake API
const summary = (slug: string, full_name: string) => ({
  slug, full_name, party: "NDC", position: "senator", position_label: "Senator", election_year: 2027, state: "kano",
  area_display: "Kano Central Senatorial District, Kano State", photo: null, verified: true,
});
const profile = (slug: string, full_name: string) => ({
  ...summary(slug, full_name), biography: "", campaign_summary: "Water for all.", priorities: [], links: [], published_at: "2026-10-01T00:00:00Z",
});
const POSITIONS = { election_year: 2027, election_years: [2027], positions: [{ position: "senator", label: "Senator", count: 2 }] };

type Fail = { status: number; code?: string };
let server: {
  published: Record<string, string>;
  follows: Map<string, boolean>;
  failNext: Partial<Record<"PUT" | "PATCH" | "DELETE", Fail>>;
  hidden: number;
};

function apiError(f: Fail) {
  return new ApiError({ status: f.status, code: f.code ?? "error", message: `failed ${f.status}` });
}

async function fakeApi(path: string, opts: { method?: string; body?: { notify?: boolean } } = {}) {
  const method = opts.method ?? "GET";
  const failure = server.failNext[method as "PUT"];
  if (failure) {
    delete server.failNext[method as "PUT"];
    throw apiError(failure);
  }
  const mine = path.match(/^\/me\/follows\/([^/?]+)\/$/);
  if (mine) {
    const slug = decodeURIComponent(mine[1]);
    if (method === "DELETE") {
      server.follows.delete(slug);
      return undefined;
    }
    if (!server.published[slug]) throw apiError({ status: 404, code: "not_found" });
    if (method === "PUT") {
      if (!server.follows.has(slug)) server.follows.set(slug, false);
    } else if (method === "PATCH") {
      if (!server.follows.has(slug)) throw apiError({ status: 404 });
      server.follows.set(slug, Boolean(opts.body?.notify));
    }
    return { candidate: summary(slug, server.published[slug]), notify: server.follows.get(slug), followed_at: "2026-11-01T00:00:00Z" };
  }
  if (path.startsWith("/me/follows/?slugs=")) {
    const slugs = path.split("=")[1].split(",").map(decodeURIComponent);
    return { results: slugs.filter((s) => server.follows.has(s)).map((s) => ({ slug: s, notify: server.follows.get(s) })) };
  }
  if (path.startsWith("/me/follows/")) {
    const all = [...server.follows.keys()].filter((s) => server.published[s]);
    const page = Number(new URLSearchParams(path.split("?")[1] ?? "").get("page") ?? 1);
    const slice = all.slice((page - 1) * 20, page * 20);
    return {
      count: all.length, next: null, previous: null, hidden_count: server.hidden,
      results: slice.map((s) => ({ candidate: summary(s, server.published[s]), notify: server.follows.get(s), followed_at: "2026-11-01T00:00:00Z" })),
    };
  }
  if (path.startsWith("/candidates/positions")) return POSITIONS;
  if (path.startsWith("/candidates/?") || path === "/candidates/") {
    const results = Object.entries(server.published).map(([s, n]) => summary(s, n));
    return { count: results.length, next: null, previous: null, results, election_year: 2027 };
  }
  const one = path.match(/^\/candidates\/([^/]+)\/$/);
  if (one) {
    const slug = decodeURIComponent(one[1]);
    if (!server.published[slug]) throw apiError({ status: 404, code: "not_found" });
    return profile(slug, server.published[slug]);
  }
  throw new Error(`unexpected ${method} ${path}`);
}

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FollowProvider>
          <Routes>
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/candidates/:slug" element={<CandidateProfilePage />} />
            <Route path="/following" element={<FollowingPage />} />
            <Route path="/sign-in" element={<p>Sign-in page</p>} />
            <Route path="/sign-up" element={<p>Sign-up page</p>} />
          </Routes>
          <Where />
        </FollowProvider>
      </MemoryRouter>
    </ToastProvider>
  );
}

const calls = (method: string, prefix: string) =>
  h.api.mock.calls.filter(([p, o]) => (o?.method ?? "GET") === method && String(p).startsWith(prefix));

beforeEach(() => {
  server = { published: { "amina-bello": "Amina Bello", "musa-ibrahim": "Musa Ibrahim" }, follows: new Map(), failNext: {}, hidden: 0 };
  h.api.mockReset();
  h.api.mockImplementation(fakeApi);
  clerkState.isLoaded = true;
  clerkState.isSignedIn = true;
  window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const voteButton = () => screen.getByRole("button", { name: /^(Vote|Voted · Following|Tap again to unfollow) ?, Amina Bello$/ });

// ----------------------------------------------------------------- profile
describe("profile Vote and bell", () => {
  it("follows, shows the bell (off), toggles it, and unfollows with the two-tap confirmation", async () => {
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1, name: /Amina Bello/ });
    expect(screen.getByText("Voting here means following, not an official ballot.")).toBeTruthy();
    expect(screen.getByText("Who you follow is private.")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("link", { name: /Donate/ })).toBeNull();

    fireEvent.click(voteButton());
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("true"));
    expect(server.follows.get("amina-bello")).toBe(false);
    const bell = screen.getByRole("switch", { name: /Notify me when Amina Bello posts/ });
    expect(bell.getAttribute("aria-checked")).toBe("false");

    fireEvent.click(bell);
    await waitFor(() => expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true"));
    expect(server.follows.get("amina-bello")).toBe(true);

    fireEvent.click(voteButton());
    expect(voteButton().textContent).toContain("Tap again to unfollow");
    fireEvent.click(voteButton());
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("false"));
    expect(screen.queryByRole("switch")).toBeNull();
    expect(server.follows.has("amina-bello")).toBe(false);
  });

  it("reverts the bell and explains when saving fails", async () => {
    server.follows.set("amina-bello", false);
    renderAt("/candidates/amina-bello");
    const bell = await screen.findByRole("switch");
    server.failNext.PATCH = { status: 500 };
    fireEvent.click(bell);
    expect(await screen.findByText("We couldn't update notifications for Amina Bello. Try again.")).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("shows the existing follow state from the private endpoint only", async () => {
    server.follows.set("amina-bello", true);
    renderAt("/candidates/amina-bello");
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    // The public profile request stays anonymous (cacheable, spec 04 §7.2).
    expect(h.api).toHaveBeenCalledWith("/candidates/amina-bello/", expect.objectContaining({ anonymous: true }));
    expect(calls("GET", "/me/follows/?slugs=amina-bello")).toHaveLength(1);
  });

  it("handles a candidate unpublished meanwhile: toast, then the not-found page", async () => {
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1, name: /Amina Bello/ });
    delete server.published["amina-bello"];
    fireEvent.click(voteButton());
    expect(await screen.findByText("This candidate is no longer listed.")).toBeTruthy();
    expect(await screen.findByText("Candidate not found")).toBeTruthy();
  });

  it("says when you're going too fast (429)", async () => {
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1, name: /Amina Bello/ });
    server.failNext.PUT = { status: 429, code: "throttled" };
    fireEvent.click(voteButton());
    expect(await screen.findByText("You're doing that too fast. Try again in a minute.")).toBeTruthy();
    expect(voteButton().getAttribute("aria-pressed")).toBe("false");
  });
});

// -------------------------------------------------------------- guest flow
describe("guest taps Vote", () => {
  beforeEach(() => {
    clerkState.isSignedIn = false;
  });

  it("opens the sign-in prompt and remembers the vote for after sign-in", async () => {
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1, name: /Amina Bello/ });
    fireEvent.click(voteButton());
    const dialog = await screen.findByRole("dialog", { name: "Sign in to vote for Amina Bello" });
    expect(within(dialog).getByText(/voting means following: it’s free, private and you don’t need to donate/)).toBeTruthy();
    expect(calls("PUT", "/me/follows/")).toHaveLength(0);
    expect(calls("GET", "/me/follows/")).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Sign in" }));
    expect(screen.getByTestId("where").textContent).toBe(`/sign-in?redirect_url=${encodeURIComponent("/candidates/amina-bello")}`);
    const saved = JSON.parse(window.sessionStorage.getItem(PENDING_VOTE_KEY)!);
    expect(saved).toMatchObject({ slug: "amina-bello", name: "Amina Bello", tries: 0 });
  });

  it("Create account goes to sign-up; Not now just closes", async () => {
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1, name: /Amina Bello/ });
    fireEvent.click(voteButton());
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_VOTE_KEY)).toBeNull();
    fireEvent.click(voteButton());
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Create account" }));
    expect(screen.getByTestId("where").textContent).toBe("/sign-up");
    expect(window.sessionStorage.getItem(PENDING_VOTE_KEY)).toContain("amina-bello");
  });

  it("completes the vote once after sign-in, then clears it", async () => {
    window.sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ slug: "amina-bello", name: "Amina Bello", at: Date.now(), tries: 0 }));
    clerkState.isSignedIn = true;
    renderAt("/following");
    expect(await screen.findByText("You're now following Amina Bello.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View profile" })).toBeTruthy();
    expect(calls("PUT", "/me/follows/amina-bello/")).toHaveLength(1);
    expect(window.sessionStorage.getItem(PENDING_VOTE_KEY)).toBeNull();
    expect(server.follows.has("amina-bello")).toBe(true);
  });

  it("ignores an expired pending vote", async () => {
    window.sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ slug: "amina-bello", name: "Amina Bello", at: Date.now() - PENDING_VOTE_TTL_MS - 1000, tries: 0 }));
    clerkState.isSignedIn = true;
    renderAt("/following");
    await screen.findByText("You’re not following anyone yet.");
    expect(calls("PUT", "/me/follows/")).toHaveLength(0);
    expect(window.sessionStorage.getItem(PENDING_VOTE_KEY)).toBeNull();
  });

  it("drops the pending vote with a message when the candidate is gone", async () => {
    window.sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ slug: "gone-person", name: "Gone Person", at: Date.now(), tries: 0 }));
    clerkState.isSignedIn = true;
    renderAt("/following");
    expect(await screen.findByText("Gone Person is no longer listed, so we couldn't complete your vote.")).toBeTruthy();
    expect(window.sessionStorage.getItem(PENDING_VOTE_KEY)).toBeNull();
  });

  it("keeps the pending vote for one retry after a network failure", async () => {
    window.sessionStorage.setItem(PENDING_VOTE_KEY, JSON.stringify({ slug: "amina-bello", name: "Amina Bello", at: Date.now(), tries: 0 }));
    clerkState.isSignedIn = true;
    server.failNext.PUT = { status: 0, code: "network_error" };
    renderAt("/following");
    await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem(PENDING_VOTE_KEY)!).tries).toBe(1));
  });
});

// -------------------------------------------------------------------- list
describe("/candidates list", () => {
  it("merges private follow state into the cards and Vote doesn't open the profile", async () => {
    server.follows.set("musa-ibrahim", false);
    renderAt("/candidates");
    const musa = await screen.findByRole("button", { name: /Musa Ibrahim$/ });
    await waitFor(() => expect(musa.getAttribute("aria-pressed")).toBe("true"));
    expect(calls("GET", "/me/follows/?slugs=")).toHaveLength(1);
    expect(screen.getByText(/Voting here means following, not an official ballot\./)).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull(); // no bell on cards

    fireEvent.click(voteButton());
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByTestId("where").textContent).toBe("/candidates");
    expect(await screen.findByRole("button", { name: "Turn on notifications" })).toBeTruthy();
  });

  it("makes no follow-state request for guests", async () => {
    clerkState.isSignedIn = false;
    renderAt("/candidates");
    await screen.findByRole("button", { name: /Musa Ibrahim$/ });
    expect(calls("GET", "/me/follows/")).toHaveLength(0);
  });

  it("keeps cards usable when follow states fail to load", async () => {
    h.api.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.startsWith("/me/follows/?slugs=")) throw new ApiError({ status: 500 });
      return fakeApi(path, opts);
    });
    renderAt("/candidates");
    await screen.findByRole("button", { name: /Musa Ibrahim$/ });
    fireEvent.click(voteButton());
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("true"));
  });
});

// --------------------------------------------------------------- following
describe("/following", () => {
  it("shows the empty state", async () => {
    renderAt("/following");
    expect(await screen.findByText("You’re not following anyone yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse candidates" }).getAttribute("href")).toBe("/candidates");
  });

  it("lists followed candidates with bells, notes hidden ones, and drops a row on unfollow", async () => {
    server.follows.set("amina-bello", true);
    server.follows.set("musa-ibrahim", false);
    server.hidden = 1;
    renderAt("/following");
    expect(await screen.findByRole("link", { name: "Amina Bello" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Musa Ibrahim" })).toBeTruthy();
    expect(screen.getByText("Some candidates you followed are no longer listed.")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Amina Bello/ }).getAttribute("aria-checked")).toBe("true");

    // The follow state is seeded just after the rows render: wait for it, and for each tap to land, so slow machines don't race.
    await waitFor(() => expect(voteButton().textContent).toContain("Voted · Following"));
    fireEvent.click(voteButton());
    await waitFor(() => expect(voteButton().textContent).toContain("Tap again to unfollow"));
    fireEvent.click(voteButton());
    await waitFor(() => expect(screen.queryByRole("link", { name: "Amina Bello" })).toBeNull(), { timeout: 5000 });
    expect(screen.getByRole("link", { name: "Musa Ibrahim" })).toBeTruthy();
  });

  it("paginates", async () => {
    for (let i = 0; i < 23; i++) {
      server.published[`person-${i}`] = `Person ${i}`;
      server.follows.set(`person-${i}`, false);
    }
    renderAt("/following");
    expect(await screen.findByRole("link", { name: "Person 0" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /^Person \d+$/ })).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/following?page=2"));
    expect(await screen.findByRole("link", { name: "Person 20" })).toBeTruthy();
  });
});

// ------------------------------------------------------------- sign-out
describe("signing out", () => {
  it("forgets follow state", async () => {
    server.follows.set("amina-bello", false);
    const view = renderAt("/candidates/amina-bello");
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("true"));
    clerkState.isSignedIn = false;
    await act(async () => {
      view.rerender(
        <ToastProvider>
          <MemoryRouter initialEntries={["/candidates/amina-bello"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <FollowProvider>
              <Routes>
                <Route path="/candidates/:slug" element={<CandidateProfilePage />} />
              </Routes>
            </FollowProvider>
          </MemoryRouter>
        </ToastProvider>
      );
    });
    await waitFor(() => expect(voteButton().getAttribute("aria-pressed")).toBe("false"));
  });
});
