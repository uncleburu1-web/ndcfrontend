/** Settings and user preferences — spec 20 §19.2 (frontend). */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown>, refresh: vi.fn() }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: h.refresh }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
  useMfaBlocked: () => false,
}));
vi.mock("../auth/ProfileForm", () => ({ ProfileForm: () => <p>Profile form</p> }));

import PublicProfilePage from "../pages/people/PublicProfilePage";
import { clerkState } from "../test/clerkMock";
import AccountPausedPage from "./AccountPausedPage";
import { PreferencesProvider } from "./PreferencesProvider";
import { applyToDocument, clean, DEFAULT_PREFS, getPrefs, resetPrefsForTests, setPrefs, STORAGE_KEY } from "./prefsStore";
import SettingsLayout from "./SettingsLayout";
import { AccessibilitySection, LanguageSection } from "./sections/DisplaySections";
import ManageSection from "./sections/ManageSection";
import NotificationsSection from "./sections/NotificationsSection";
import ProfileSection from "./sections/ProfileSection";
// @ts-expect-error plain ESM script without types
import { check } from "../../scripts/check-contrast.mjs";
import prefsScript from "../../public/prefs.js?raw";

const ME = { id: "u1", email: "ada@x.ng", full_name: "Ada Obi", phone_number: "+2348031234567", profile_complete: true, roles: [],
  is_system_admin: false, admin_areas: [], adult_confirmed: true, home_state: "lagos", account_status: "active",
  preferences: { language: "en", theme: "dark", text_size: "large", contrast: "system", motion: "system", saved_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z" } };

const CATEGORIES = [
  { key: "community_posts", label: "New community posts", kinds: ["community_post"], help: "", on: true, locked: false, reason: "" },
  { key: "announcements", label: "Platform announcements", kinds: ["announcement"], help: "", on: true, locked: false, reason: "" },
  { key: "payments", label: "Payments", kinds: ["donation_receipt"], help: "", on: true, locked: true, reason: "Your receipts." },
];

function settings(over: Record<string, unknown> = {}) {
  return {
    account: { full_name: "Ada Obi", phone_number: "", email: "ada@x.ng", created_at: "2026-01-01T00:00:00Z", status: "active", home_state: "lagos",
      membership_status: null, pvc_status: "unverified", staff: false, mfa_enabled: null },
    profile: { public_profile: false, handle: null, name_style: "first_initial", name_examples: { first_initial: "Ada O.", full: "Ada Obi" }, bio: "",
      bio_removed: false, photo_removed: false, profile_location: "none", profile_lga: null, profile_photo: false,
      consent: { version: 1, text: "Your public profile shows your public name and what you choose.", label: "Public profile" } },
    language: { language: "en", options: [{ code: "en", label: "English", native: "English", enabled: true },
      { code: "yo", label: "Yoruba", native: "Yorùbá", enabled: false }] },
    accessibility: { theme: "dark", text_size: "large", contrast: "system", motion: "system" },
    notifications: { categories: CATEGORIES, candidate_bells_paused: false },
    privacy: { donation_name_default: "anonymous", verified_badge: false, named_news: 0, public_profile: false, name_style: "first_initial" },
    connected: { campaigns: [] },
    manage: { upcoming_registrations: 2, pending_volunteer_applications: 1 },
    saved_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
    ...over,
  };
}

type Handler = (opts: { method?: string; body?: unknown } | undefined) => unknown;
function routes(map: Record<string, unknown | Handler>) {
  h.api.mockImplementation(async (path: string, opts?: { method?: string; body?: unknown }) => {
    const key = `${opts?.method ?? "GET"} ${path}`;
    const v = key in map ? map[key] : map[path];
    if (v === undefined) throw new ApiError({ status: 404, code: "not_found", message: `No route ${key}` });
    if (typeof v === "function") return (v as Handler)(opts);
    if (v instanceof ApiError) throw v;
    return v;
  });
}

function renderAt(path: string, element: React.ReactNode, routePath = "/settings") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <PreferencesProvider>
          <Routes>
            <Route path={routePath} element={<SettingsLayout />}>
              <Route path="*" element={element} />
            </Route>
            <Route path="/people/:handle" element={<PublicProfilePage />} />
          </Routes>
        </PreferencesProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  h.api.mockReset();
  h.refresh.mockReset();
  h.me = null;
  clerkState.isSignedIn = false;
  localStorage.clear();
  resetPrefsForTests();
  setPrefs({ ...DEFAULT_PREFS });
});
afterEach(cleanup);

// ------------------------------------------------------------------ the device store and /prefs.js
describe("prefs store (§10.2)", () => {
  it("cleans damaged values to the defaults", () => {
    expect(clean({ theme: "neon", text_size: "huge", language: "<script>" })).toEqual(DEFAULT_PREFS);
    expect(clean(null)).toEqual(DEFAULT_PREFS);
  });

  it("applies attributes and lang, and keeps them in localStorage", () => {
    setPrefs({ theme: "dark", text_size: "larger", contrast: "more", motion: "reduce" });
    const html = document.documentElement;
    expect([html.dataset.theme, html.dataset.textSize, html.dataset.contrast, html.dataset.motion]).toEqual(["dark", "larger", "more", "reduce"]);
    expect([html.dataset.scheme, html.dataset.contrastLevel]).toEqual(["dark", "more"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).theme).toBe("dark");
    setPrefs({ theme: "system", contrast: "system" });
    expect([html.dataset.scheme, html.dataset.contrastLevel]).toEqual(["light", "standard"]); // jsdom: no dark or more preference
  });

  it("/prefs.js applies the stored values before the app, with no API call", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "dark", text_size: "large", contrast: "more", motion: "reduce", language: "en" }));
    applyToDocument({ ...DEFAULT_PREFS });
    const src = prefsScript;
    expect(src).not.toMatch(/fetch|XMLHttpRequest/);
    new Function(src)();
    const html = document.documentElement;
    expect([html.dataset.theme, html.dataset.textSize, html.dataset.contrast, html.dataset.motion, html.dataset.scheme]).toEqual(
      ["dark", "large", "more", "reduce", "dark"]);
    localStorage.setItem(STORAGE_KEY, "{not json");
    new Function(src)();
    expect(html.dataset.theme).toBe("system");
  });

  it("check:contrast passes in every theme and contrast", () => {
    const { problems, rows } = check();
    expect(problems).toEqual([]);
    expect(new Set(rows.map((r: { mode: string }) => r.mode)).size).toBe(4);
  });
});

// ------------------------------------------------------------------ PreferencesProvider (§13)
describe("PreferencesProvider", () => {
  it("copies a guest's display settings to an account that never saved its own, once", async () => {
    setPrefs({ theme: "dark", text_size: "larger", deviceSet: true });
    clerkState.isSignedIn = true;
    h.me = { ...ME, preferences: { ...ME.preferences, theme: "system", text_size: "standard", saved_at: null } };
    routes({
      "POST /me/settings/import-device/": (o: { body?: unknown } | undefined) => {
        expect(o?.body).toMatchObject({ theme: "dark", text_size: "larger" });
        return { accessibility: { theme: "dark", text_size: "larger", contrast: "system", motion: "system" },
          language: { language: "en", options: [] }, saved_at: "2026-11-12T10:00:00Z" };
      },
      "/me/settings/": settings(),
    });
    renderAt("/settings/accessibility", <AccessibilitySection />);
    expect(await screen.findByText("We kept your display settings.")).toBeTruthy();
    expect(getPrefs()).toMatchObject({ theme: "dark", text_size: "larger", deviceSet: false });
  });

  it("the account's values win when it has saved its own", async () => {
    setPrefs({ theme: "light", deviceSet: true });
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/settings/": settings() });
    renderAt("/settings/accessibility", <AccessibilitySection />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(document.documentElement.dataset.textSize).toBe("large");
    expect(h.api).not.toHaveBeenCalledWith("/me/settings/import-device/", expect.anything());
  });

  it("refetches on focus and applies newer values from another device", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let theme = "dark";
    routes({ "/me/settings/": () => settings({ accessibility: { theme, text_size: "large", contrast: "system", motion: "system" },
      updated_at: theme === "dark" ? "2026-11-01T10:00:00Z" : "2026-11-12T11:00:00Z" }) });
    renderAt("/settings/accessibility", <AccessibilitySection />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    theme = "light";
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
  });
});

// ------------------------------------------------------------------ sections
describe("sections", () => {
  it("guests change the theme on this device; signed-in sections ask them to sign in", async () => {
    renderAt("/settings/accessibility", <AccessibilitySection />);
    fireEvent.click(screen.getByLabelText("Dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(getPrefs().deviceSet).toBe(true);
    expect(h.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Larger (125%)"));
    expect(document.documentElement.dataset.textSize).toBe("larger");
    cleanup();
    renderAt("/settings/notifications", <NotificationsSection />);
    expect(screen.getByRole("heading", { name: "Sign in to manage your account" })).toBeTruthy();
  });

  it("signed in: a failed save goes back and says why in words", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/settings/": settings(),
      "PATCH /me/settings/accessibility/": new ApiError({ status: 400, code: "validation_error", message: "Choose one of: system, light, dark." }) });
    renderAt("/settings/accessibility", <AccessibilitySection />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    fireEvent.click(screen.getByLabelText("Light"));
    expect(await screen.findByText("Choose one of: system, light, dark.")).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("languages not yet translated can't be chosen", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/settings/": settings() });
    renderAt("/settings/language", <LanguageSection />);
    const yo = await screen.findByLabelText("Yorùbá (Yoruba)");
    await waitFor(() => expect((yo as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText("English") as HTMLInputElement).checked).toBe(true);
  });

  it("notifications: switches save, essential categories are locked", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/settings/": settings(),
      "PATCH /me/settings/notifications/": (o: { body?: unknown } | undefined) => {
        expect(o?.body).toEqual({ community_posts: false });
        return { categories: CATEGORIES.map((c) => (c.key === "community_posts" ? { ...c, on: false } : c)), candidate_bells_paused: false };
      },
    });
    renderAt("/settings/notifications", <NotificationsSection />);
    const sw = await screen.findByRole("switch", { name: "New community posts" });
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByRole("switch", { name: "New community posts" }).getAttribute("aria-checked")).toBe("false"));
    expect(screen.queryByRole("switch", { name: "Payments" })).toBeNull();
    const locked = screen.getByRole("heading", { name: "Always on" }).parentElement!;
    expect(within(locked).getByText("Payments")).toBeTruthy();
    expect(within(locked).getByText("Your receipts.")).toBeTruthy();
  });

  it("public profile: the consent dialog comes first, then it's on with its address", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/me/settings/": settings(),
      "POST /me/settings/public-profile/": (o: { body?: unknown } | undefined) => {
        expect(o?.body).toEqual({ consent: true, version: 1 });
        return { ...settings().profile, public_profile: true, handle: "k7m2qx" };
      },
    });
    renderAt("/settings/profile", <ProfileSection />);
    fireEvent.click(await screen.findByRole("switch", { name: "Public profile" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Your public profile shows your public name and what you choose.")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalledWith("/me/settings/public-profile/", expect.anything());
    fireEvent.click(within(dialog).getByRole("button", { name: "I agree, turn it on" }));
    expect(await screen.findByRole("link", { name: "/people/k7m2qx" })).toBeTruthy();
  });

  it("pause: the typed confirmation, then /me refreshes into the paused screen", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/settings/": settings(), "/me/privacy/": { delete: { goes: ["Your account"], stays: ["Receipts"] } }, "POST /me/pause/": { paused: true } });
    renderAt("/settings/manage", <ManageSection />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause my account" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/2 upcoming event registrations will be cancelled/)).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Pause my account" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Type "pause" to confirm'), { target: { value: "pause" } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.api).toHaveBeenCalledWith("/me/pause/", { method: "POST", body: { confirm: "pause" } });
  });

  it("the paused screen offers Reactivate, Download and Delete", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, account_status: "paused" };
    routes({ "POST /me/reactivate/": { active: true } });
    render(<ToastProvider><MemoryRouter><AccountPausedPage /></MemoryRouter></ToastProvider>);
    expect(screen.getByRole("heading", { name: "Your account is paused" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download my data" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete my account" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reactivate my account" }));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });
});

// ------------------------------------------------------------------ public profile page (§5.1)
describe("/people/:handle", () => {
  it("shows only the chosen fields", async () => {
    routes({ "/people/k7m2qx/": { handle: "k7m2qx", name: "Ada O.", bio: "Teacher in Ikeja.", location: { state: "lagos", state_label: "Lagos", lga: "Ikeja" },
      verified_voter: false, photo_url: null, member_since: "2026-01", news: [{ id: "n1", title: "Turnout in Ikeja", published_at: "2026-10-01T10:00:00Z" }] } });
    renderAt("/people/k7m2qx", null, "/x");
    expect(await screen.findByRole("heading", { name: "Ada O." })).toBeTruthy();
    expect(screen.getByText("Teacher in Ikeja.")).toBeTruthy();
    expect(screen.getByText("Ikeja, Lagos")).toBeTruthy();
    expect(screen.getByText("On NDCConnect since January 2026")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Turnout in Ikeja" }).getAttribute("href")).toBe("/news/community/n1");
    expect(screen.queryByText(/Verified voter/)).toBeNull();
    expect(screen.queryByText(/follow|communit|donat/i)).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    expect(h.api).toHaveBeenCalledWith("/people/k7m2qx/", { anonymous: true });
  });

  it("404 when it's off", async () => {
    routes({});
    renderAt("/people/zzzzzz", null, "/x");
    expect(await screen.findByRole("heading", { name: "This profile isn’t available" })).toBeTruthy();
  });
});
