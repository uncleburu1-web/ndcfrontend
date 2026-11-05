/** Search and discovery — spec 12 §12 (frontend). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown>, setMe: vi.fn() }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: h.setMe, refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));
vi.mock("../donations/DonationConfigProvider", () => ({
  useDonationConfig: () => ({ config: { open: false, min_kobo: 50000, max_per_payment_kobo: 500000000, presets_kobo: [] }, loading: false }),
}));

import { FollowProvider } from "../follows/FollowProvider";
import CandidatesPage from "../pages/candidates/CandidatesPage";
import NewsPage from "../pages/news/NewsPage";
import SearchPage from "../pages/search/SearchPage";
import StatePage from "../pages/states/StatePage";
import StatesPage from "../pages/states/StatesPage";
import { clerkState } from "../test/clerkMock";
import { HeaderSearch } from "./HeaderSearch";
import { Highlight } from "./Highlight";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string, withHeader = false) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <FollowProvider>
          {withHeader && <HeaderSearch />}
          <Routes>
            <Route path="/search" element={<SearchPage />} />
            <Route path="/states" element={<StatesPage />} />
            <Route path="/states/:state" element={<StatePage />} />
            <Route path="/candidates" element={<CandidatesPage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="*" element={<p>Elsewhere</p>} />
          </Routes>
          <Where />
        </FollowProvider>
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

const cand = (over: Record<string, unknown> = {}) => ({ slug: "muhammad-bello", full_name: "Muhammad Bello", position: "governor", position_label: "Governor",
  party: "NDC", election_year: 2027, state: "kano", area_display: "Kano State", photo: null, verified: true, ...over });
const article = (over: Record<string, unknown> = {}) => ({ id: "a1", source: "official", category: "party", category_label: "Party Announcements",
  title: "Rally in Ọ̀ṣogbo <script>alert(1)</script>", excerpt: "x", state: "osun", state_label: "Osun", image: null, published_at: "2026-11-01T10:00:00Z",
  edited_at: null, byline: null, pinned: false, snippet: "Supporters gathered in Ọ̀ṣogbo on Friday.", matches: [[23, 30]], title_matches: [[9, 16]],
  url: "/news/official/a1", ...over });
const post = (over: Record<string, unknown> = {}) => ({ id: "p1", source: "candidate", kind: "news", kind_label: "News", title: "Kano town hall", excerpt: "x",
  image: null, published_at: "2026-11-01T10:00:00Z", edited_at: null, state: "kano", state_label: "Kano",
  candidate: { slug: "muhammad-bello", full_name: "Muhammad Bello", photo: null, verified: true }, snippet: "Meet Kano traders.", matches: [[5, 9]],
  title_matches: [[0, 4]], url: "/candidates/muhammad-bello/posts/p1", ...over });
const ALL = { candidates: { count: 7, results: [cand()] }, news: { count: 1, results: [article()] }, posts: { count: 1, results: [post()] },
  did_you_mean: null, election_year: 2027 };

beforeEach(() => {
  h.api.mockReset();
  h.setMe.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  sessionStorage.clear();
});
afterEach(cleanup);

describe("Highlight", () => {
  it("marks ranges and keeps everything else as text", () => {
    render(<p data-testid="t"><Highlight text="<script>x</script> Ọ̀ṣogbo" ranges={[[19, 26]]} /></p>);
    const p = screen.getByTestId("t");
    expect(p.querySelector("script")).toBeNull();
    expect(p.textContent).toBe("<script>x</script> Ọ̀ṣogbo");
    expect(p.querySelector("mark")?.textContent).toBe("Ọ̀ṣogbo");
  });
});

describe("header search", () => {
  it('"/" focuses the field (not while typing elsewhere); Enter opens /search', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    routes({ "/search/suggest/": { candidates: [], titles: [] }, "/search/": ALL });
    renderAt("/elsewhere", true);
    fireEvent.keyDown(document.body, { key: "/" });
    const box = await screen.findByRole("combobox", { name: "Search NDCConnect" });
    await waitFor(() => expect(document.activeElement).toBe(box));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "/" }); // typing "/" in a field does nothing
    input.remove();
    fireEvent.change(box, { target: { value: "kano" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=kano"));
  });

  it("suggestions: keyboard, ARIA, anonymous request, Esc", async () => {
    routes({ "/search/suggest/": { candidates: [cand()], titles: [{ type: "news", title: "Kano rally", url: "/news/official/a1" }] } });
    renderAt("/elsewhere", true);
    const toggle = screen.getByRole("button", { name: "Search" });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const box = await screen.findByRole("combobox");
    fireEvent.keyDown(box, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    const box2 = await screen.findByRole("combobox");
    fireEvent.change(box2, { target: { value: "mu" } });
    const list = await screen.findByRole("listbox", { name: "Suggestions" });
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    expect(h.api).toHaveBeenCalledWith("/search/suggest/?q=mu", expect.objectContaining({ anonymous: true }));
    expect(screen.getByText("2 suggestions")).toBeTruthy();
    fireEvent.keyDown(box2, { key: "ArrowDown" });
    expect(box2.getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(box2, { key: "ArrowDown" });
    fireEvent.keyDown(box2, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/news/official/a1"));
  });

  it("narrow screens: a search link to /search; '/' goes there", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    renderAt("/elsewhere", true);
    expect(screen.getByRole("link", { name: "Search" }).getAttribute("href")).toBe("/search");
    fireEvent.keyDown(document.body, { key: "/" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search"));
  });
});

describe("/search", () => {
  it("All: tabs with counts, sections, See all, highlights", async () => {
    routes({ "/search/": ALL });
    renderAt("/search?q=kano");
    expect(await screen.findByRole("link", { name: "Candidates (7)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "News (1)" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all 7" }).getAttribute("href")).toBe("/search?q=kano&type=candidates");
    expect(screen.getByText("Muhammad Bello")).toBeTruthy();
    expect(screen.getByText("Posted by Muhammad Bello")).toBeTruthy();
    const title = screen.getByRole("link", { name: /Rally in/ });
    expect(title.textContent).toContain("<script>");
    expect(title.querySelector("mark")?.textContent).toBe("Ọ̀ṣogbo");
    expect(h.api).toHaveBeenCalledWith("/search/?q=kano", expect.objectContaining({ anonymous: true }));
    expect(screen.getByText("9 results")).toBeTruthy();
  });

  it("type tabs show their own filters and keep them in the URL", async () => {
    routes({ "/search/": { count: 1, page: 1, next: null, previous: null, results: [article()], did_you_mean: null, election_year: 2027 } });
    renderAt("/search?q=kano&type=news");
    await screen.findByText(/Supporters gathered/);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "week" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=kano&type=news&since=week"));
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "community" } });
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/search/?q=kano&type=news&since=week&source=community", expect.anything()));
  });

  it("no results: Did you mean and tips; too short", async () => {
    routes({ "/search/": { ...ALL, candidates: { count: 0, results: [] }, news: { count: 0, results: [] }, posts: { count: 0, results: [] },
      did_you_mean: "Muhammad Bello" } });
    renderAt("/search?q=muhamad");
    expect(await screen.findByText("No results for “muhamad”")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Muhammad Bello" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=Muhammad+Bello"));
    cleanup();
    renderAt("/search?q=k");
    expect(screen.getByText("Type at least 2 characters.")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalledWith(expect.stringMatching(/^\/search\/\?q=k$/), expect.anything());
  });

  it("busy search shows a friendly message", async () => {
    routes({ "/search/": new ApiError({ status: 503, code: "search_unavailable", message: "x" }) });
    renderAt("/search?q=kano");
    expect(await screen.findByText("Search is busy. Try again in a moment.")).toBeTruthy();
  });
});

describe("home state", () => {
  it("pre-fills the state with a chip; clearing lasts for the session", async () => {
    h.me = { full_name: "Ada", email: "a@b.c", roles: [], is_system_admin: false, home_state: "lagos" };
    clerkState.isSignedIn = true;
    routes({ "/search/": ALL });
    renderAt("/search?q=kano");
    expect(await screen.findByText(/Filtered to your state:/)).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/search/?q=kano&state=lagos", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Show all states" }));
    await waitFor(() => expect(h.api).toHaveBeenLastCalledWith("/search/?q=kano", expect.anything()));
    expect(sessionStorage.getItem("ndc_home_state_off")).toBe("1");
  });

  it("/candidates and /news use it too", async () => {
    h.me = { full_name: "Ada", email: "a@b.c", roles: [], is_system_admin: false, home_state: "kano" };
    routes({ "/candidates/": { count: 0, results: [], election_year: 2027 }, "/candidates/positions/": { election_year: 2027, election_years: [2027], positions: [] },
      "/news/": { count: 0, next: null, previous: null, pinned: [], results: [] } });
    renderAt("/candidates");
    expect(await screen.findByText(/Filtered to your state:/)).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/candidates/?state=kano", expect.anything());
    cleanup();
    renderAt("/news");
    expect(await screen.findByText(/Filtered to your state:/)).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/news/?state=kano", expect.anything());
  });

  it("/candidates with q keeps relevance order from the server", async () => {
    routes({ "/candidates/": { count: 2, results: [cand({ slug: "b", full_name: "Muhammad Sani", position: "senator", position_label: "Senator" }),
      cand()], election_year: 2027 }, "/candidates/positions/": { election_year: 2027, election_years: [2027], positions: [] } });
    renderAt("/candidates?q=mohammed");
    await screen.findByText("Muhammad Sani");
    const names = screen.getAllByRole("link").map((l) => l.textContent).filter((t) => t?.startsWith("Muhammad"));
    expect(names[0]).toContain("Muhammad Sani");
  });
});

describe("/states", () => {
  it("directory lists states with counts", async () => {
    routes({ "/states/": { results: [{ state: "kano", label: "Kano", candidates: 3, news: 1, posts: 0 }] } });
    renderAt("/states");
    expect((await screen.findByRole("link", { name: /Kano/ })).getAttribute("href")).toBe("/states/kano");
    expect(screen.getByText("3 candidates · 1 news story")).toBeTruthy();
  });

  const DETAIL = {
    state: "kano", label: "Kano", election_year: 2027,
    groups: [{ position: "president", label: "National", total: 1, results: [cand({ slug: "p", full_name: "Peter Nation", position: "president", position_label: "President" })] },
      { position: "senator", label: "Senator", total: 9, results: [cand({ slug: "s", full_name: "Sani Senator" })] }],
    news: [article({ title: "Kano budget" })], posts: [post()],
  };

  it("state page: groups, See all links, news and posts; sign-in prompt for guests", async () => {
    routes({ "/states/kano/": DETAIL });
    renderAt("/states/kano");
    expect(await screen.findByRole("heading", { level: 1, name: "Kano on NDCConnect" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "National" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all 9" }).getAttribute("href")).toBe("/candidates?state=kano&position=senator");
    expect(screen.getByRole("link", { name: "Kano budget" })).toBeTruthy();
    expect(screen.getByText("Posted by Muhammad Bello")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to make this your state" })).toBeTruthy();
  });

  it("Make this my state saves the home state", async () => {
    h.me = { full_name: "Ada", email: "a@b.c", roles: [], is_system_admin: false, home_state: "" };
    clerkState.isSignedIn = true;
    routes({ "/states/kano/": DETAIL, "PATCH /me/": (o: Record<string, unknown>) => ({ ...h.me, ...(o.body as object) }) });
    renderAt("/states/kano");
    fireEvent.click(await screen.findByRole("button", { name: "Make this my state" }));
    await waitFor(() => expect(h.setMe).toHaveBeenCalledWith(expect.objectContaining({ home_state: "kano" })));
    expect(await screen.findByText("Kano is now your state. Only you can see this.")).toBeTruthy();
  });

  it("unknown state → Page not found", async () => {
    routes({});
    renderAt("/states/atlantis");
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });
});
