/** States and geography — spec 19 §19.2 (frontend). */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";
import { FollowProvider } from "../follows/FollowProvider";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown> }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));

import AdminGeographyPage from "../pages/admin/geography/AdminGeographyPage";
import LgaPage from "../pages/geo/LgaPage";
import PollingUnitsPage from "../pages/geo/PollingUnitsPage";
import { describe as describeNotice } from "../pages/news/NotificationsPage";
import { GeoConfirmCard } from "./GeoConfirmCard";
import { GeoPicker } from "./GeoPicker";
import { EMPTY_GEO, geoBody, type GeoValue } from "./types";
import { clearGeoCache } from "./useGeo";

const LGAS = { results: [{ id: 7, code: "07", name: "Ikeja", slug: "ikeja", active: true }, { id: 1, code: "01", name: "Agege", slug: "agege", active: true }] };
const WARDS = { results: [{ id: 50, code: "05", name: "Anifowoshe / Ikeja", polling_units: 2 }] };
const UNITS = { results: [{ id: 501, code: "001", delimitation: "24-07-05-001", name: "Sample Primary School I" },
  { id: 502, code: "002", delimitation: "24-07-05-002", name: "Sample Primary School II" }] };
const UNIT = { id: 502, code: "002", delimitation: "24-07-05-002", name: "Sample Primary School II", active: true, ward: { id: 50, code: "05", name: "Anifowoshe / Ikeja" },
  lga: { id: 7, code: "07", name: "Ikeja", slug: "ikeja", active: true }, state: { slug: "lagos", code: "24", name: "Lagos" }, inec_url: "https://cvr.inecnigeria.org/pu" };

type Handler = unknown | ((opts: Record<string, unknown>, path: string) => unknown);
function routes(map: Record<string, Handler>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const key = `${(opts.method as string) ?? "GET"} ${path}`;
    const bare = path.split("?")[0];
    const hit = [key, path, `${(opts.method as string) ?? "GET"} ${bare}`, bare].map((k) => map[k]).find((v) => v !== undefined);
    if (hit === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    const v = typeof hit === "function" ? (hit as (o: Record<string, unknown>, p: string) => unknown)(opts, path) : hit;
    if (v instanceof Error) throw v;
    return v;
  });
}
const GEO = { "/geo/states/lagos/lgas/": LGAS, "/geo/lgas/7/wards/": WARDS, "/geo/wards/50/polling-units/": UNITS, "/geo/polling-units/24-07-05-002/": UNIT };

function Harness({ onValue, depth }: { onValue: (v: GeoValue) => void; depth?: "lga" | "ward" | "polling_unit" }) {
  const [v, setV] = useState<GeoValue>(EMPTY_GEO);
  return <GeoPicker state="lagos" value={v} depth={depth} onChange={(x) => { setV(x); onValue(x); }} required={["lga"]} />;
}

function renderAt(path: string, el: React.ReactNode, route = "*") {
  return render(<ToastProvider><MemoryRouter initialEntries={[path]}><FollowProvider><Routes><Route path={route} element={el} /></Routes></FollowProvider></MemoryRouter></ToastProvider>);
}

beforeEach(() => {
  h.api.mockReset();
  h.me = null;
  clearGeoCache();
});
afterEach(cleanup);

describe("GeoPicker", () => {
  it("steps LGA → ward → polling unit inside the state and sends IDs", async () => {
    routes(GEO);
    let last = EMPTY_GEO;
    render(<ToastProvider><Harness onValue={(v) => (last = v)} /></ToastProvider>);
    await screen.findByRole("option", { name: "Ikeja" });
    expect((screen.getByLabelText(/^Ward/) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/^LGA/), { target: { value: "7" } });
    await screen.findByRole("option", { name: /Anifowoshe \/ Ikeja · 05 \(2 units\)/ });
    fireEvent.change(screen.getByLabelText(/^Ward/), { target: { value: "50" } });
    await screen.findByRole("option", { name: /Sample Primary School II · 24-07-05-002/ });
    fireEvent.change(screen.getByLabelText(/^Polling unit/), { target: { value: "502" } });
    expect(last).toMatchObject({ lga_id: 7, ward_id: 50, polling_unit_id: 502, lga: "Ikeja", ward: "Anifowoshe / Ikeja", polling_unit: "Sample Primary School II" });
    expect(geoBody(last)).toEqual({ lga_id: 7, ward_id: 50, polling_unit_id: 502 });
    // changing the LGA clears what was below it
    fireEvent.change(screen.getByLabelText(/^LGA/), { target: { value: "1" } });
    expect(last).toMatchObject({ lga_id: 1, ward_id: null, polling_unit_id: null });
  });

  it("finds a unit by code, and refuses a bad code", async () => {
    routes(GEO);
    let last = EMPTY_GEO;
    render(<ToastProvider><Harness onValue={(v) => (last = v)} /></ToastProvider>);
    fireEvent.change(screen.getByLabelText(/find it by code/), { target: { value: "24-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText(/Codes look like/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/find it by code/), { target: { value: "24-07-05-002" } });
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    await waitFor(() => expect(last.polling_unit_id).toBe(502));
    expect(last).toMatchObject({ lga_id: 7, ward_id: 50 });
  });

  it("“My place isn’t listed” swaps to the typed fields and sends text", async () => {
    routes(GEO);
    let last = EMPTY_GEO;
    render(<ToastProvider><Harness onValue={(v) => (last = v)} /></ToastProvider>);
    fireEvent.click(screen.getByRole("checkbox", { name: /isn’t listed/ }));
    fireEvent.change(screen.getByLabelText(/^LGA/), { target: { value: "Ikeja" } });
    fireEvent.change(screen.getByLabelText(/^Polling unit/), { target: { value: "New school" } });
    expect(screen.getByText(/An officer will check this/)).toBeTruthy();
    expect(geoBody(last)).toEqual({ geo_not_listed: true, lga: "Ikeja", ward: "", polling_unit: "New school" });
  });

  it("says “Area council” for the FCT and stops at the LGA when asked", async () => {
    routes({ "/geo/states/fct/lgas/": { results: [{ id: 3, code: "01", name: "Abaji", slug: "abaji", active: true }] } });
    render(<ToastProvider><GeoPicker state="fct" value={EMPTY_GEO} onChange={() => undefined} depth="lga" allowNotListed={false} /></ToastProvider>);
    expect(await screen.findByLabelText(/^Area council/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Ward/)).toBeNull();
  });

  it("switches to typing when INEC's list for the state isn't loaded yet (no error)", async () => {
    routes({ "/geo/states/fct/lgas/": { results: [] } });
    let last = EMPTY_GEO;
    function FctHarness() {
      const [v, setV] = useState<GeoValue>({ ...EMPTY_GEO, lga: "kuje" });
      return <GeoPicker state="fct" value={v} depth="ward" onChange={(x) => { setV(x); last = x; }} required={["lga"]} />;
    }
    render(<ToastProvider><FctHarness /></ToastProvider>);
    expect(await screen.findByText(/isn’t on NDCConnect yet, so type your area council and ward/)).toBeTruthy();
    expect(screen.queryByText("Couldn’t load the list.")).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /isn’t listed/ })).toBeNull();
    expect((screen.getByLabelText(/^Area council/) as HTMLInputElement).value).toBe("kuje");
    fireEvent.change(screen.getByLabelText(/^Ward/), { target: { value: "Rubochi" } });
    expect(geoBody(last)).toEqual({ geo_not_listed: true, lga: "kuje", ward: "Rubochi", polling_unit: "" });
  });
});

describe("public pages", () => {
  it("LGA page: groups, wards with counts, community, inactive banner, FCT wording", async () => {
    routes({
      "/states/lagos/lgas/ikeja/": {
        state: "lagos", state_label: "Lagos", lga: { id: 7, code: "07", name: "Ikeja", slug: "ikeja", active: false }, area_council: false,
        election_year: 2027, events: [], community: { id: "c1", path: "lagos/ikeja", name: "Ikeja", members: "100+" },
        groups: [{ key: "lga_chairman", label: "LGA Chairman", position: "lga_chairman", constituency: null, total: 7, see_all: "/candidates?position=lga_chairman&lga=7",
          results: [{ slug: "tunde", full_name: "Tunde Ade", position: "lga_chairman", position_label: "LGA Chairman", area_display: "Ikeja", state: "lagos", photo: null }] }],
        wards: [{ id: 50, code: "05", name: "Anifowoshe / Ikeja", polling_units: 2 }],
        about: { kind: "polling_units", source: "INEC 2026", published_on: "2026-10-01", applied_at: "2026-10-02T00:00:00Z", states: 37, lgas: 774, wards: 8809, polling_units: 176846, constituencies: 0 },
      },
    });
    renderAt("/states/lagos/ikeja", <LgaPage />, "/states/:state/:lga");
    expect(await screen.findByRole("heading", { level: 1, name: "Ikeja" })).toBeTruthy();
    expect(screen.getByText("No longer in INEC’s current list.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all 7" }).getAttribute("href")).toBe("/candidates?position=lga_chairman&lga=7");
    expect(screen.getByText(/2 polling units/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ikeja" }).getAttribute("href")).toBe("/communities/lagos/ikeja");
    expect(screen.getByText(/176,846 polling/)).toBeTruthy();
  });

  it("LGA page 404", async () => {
    routes({});
    renderAt("/states/lagos/nowhere", <LgaPage />, "/states/:state/:lga");
    expect(await screen.findByText("Page not found")).toBeTruthy();
  });

  it("finder: browse by place, filter, look up a code; links to INEC, never asks for a VIN", async () => {
    routes({ ...GEO, "/geo/about/": { datasets: [], inec_url: "https://cvr.inecnigeria.org/pu" } });
    renderAt("/polling-units?state=lagos&lga=7&ward=50", <PollingUnitsPage />);
    const table = await screen.findByRole("table");
    await within(table).findByText("Sample Primary School I");
    fireEvent.change(screen.getByLabelText(/Part of the name/), { target: { value: "school ii" } });
    expect(within(table).queryByText("Sample Primary School I")).toBeNull();
    expect(within(table).getAllByRole("link", { name: "Check with INEC" })[0].getAttribute("href")).toBe("https://cvr.inecnigeria.org/pu");
    fireEvent.change(screen.getByLabelText(/Polling-unit code/), { target: { value: "24-07-05-002" } });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(screen.queryByLabelText(/VIN/)).toBeNull();
    expect(screen.queryByText(/you vote here/i)).toBeNull();
  });
});

describe("Account confirm card", () => {
  const ITEM = { kind: "membership", state: "lagos", typed: { lga: "IKEJA", ward: "", polling_unit: "school" }, retired: false,
    current: { lga: null, ward: null, polling_unit: null },
    suggestion: { lga: { id: 7, name: "Ikeja", code: "07", score: 1 }, ward: { id: 50, name: "Anifowoshe / Ikeja", code: "05", score: 0.8 },
      polling_unit: { id: 501, name: "Sample Primary School I", code: "24-07-05-001", score: 0.7 } } };

  it("is pre-filled with the suggestion and confirms with IDs", async () => {
    let n = 0;
    routes({ ...GEO, "/me/geo-confirm/": () => ({ results: n++ ? [] : [ITEM] }),
      "POST /me/geo-confirm/membership/": { kind: "membership", geo_source: "chosen", waits_for_officer: false, place: ITEM.current } });
    render(<ToastProvider><MemoryRouter><GeoConfirmCard /></MemoryRouter></ToastProvider>);
    expect(await screen.findByRole("heading", { name: "Confirm where you vote" })).toBeTruthy();
    await screen.findByRole("option", { name: /Sample Primary School I ·/ });
    expect((screen.getByLabelText(/^Polling unit/) as HTMLSelectElement).value).toBe("501");
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/me/geo-confirm/membership/", { method: "POST", body: { lga_id: 7, ward_id: 50, polling_unit_id: 501 } }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Confirm where you vote" })).toBeNull());
  });

  it("hidden when nothing needs confirming; shows a field error from the server", async () => {
    routes({ "/me/geo-confirm/": { results: [] } });
    const { container } = render(<ToastProvider><MemoryRouter><GeoConfirmCard /></MemoryRouter></ToastProvider>);
    await waitFor(() => expect(h.api).toHaveBeenCalled());
    expect(container.textContent).toBe("");
    cleanup();
    routes({ ...GEO, "/me/geo-confirm/": { results: [ITEM] },
      "POST /me/geo-confirm/membership/": new ApiError({ status: 400, code: "geo_inactive", message: "That place is no longer in INEC’s current list.", field: "polling_unit" }) });
    render(<ToastProvider><MemoryRouter><GeoConfirmCard /></MemoryRouter></ToastProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(await screen.findByText("That place is no longer in INEC’s current list.")).toBeTruthy();
  });
});

describe("notices", () => {
  it("say which record and what happened, never the unit", () => {
    const base = { id: "n", created_at: "2026-11-01T00:00:00Z", read_at: null, decision: "", reason: "" };
    const a = describeNotice({ ...base, kind: "geo_unit_changed", geo: { record: "pvc", change: "moved" } } as never);
    expect(a?.text).toBe("INEC moved the polling unit on your PVC check. Please choose the current one");
    expect(a?.href).toBe("/settings/account");
    expect(describeNotice({ ...base, kind: "geo_confirm", geo: { record: "membership", change: "" } } as never)?.text).toBe("Confirm where you vote on your membership");
  });
});

describe("admin geography", () => {
  const DS = { id: 9, kind: "polling_units", status: "previewed", source: "INEC 2026", published_on: null, notes: "", checksum: "abcdef1234567890", loaded_at: "2026-11-01T00:00:00Z",
    applied_at: null, applied_by: null, first_approval_by: null, states: 0, lgas: 0, wards: 0, polling_units: 0, constituencies: 0, deactivated: 0, changes: 3,
    error_count: 0, needs_second_admin: false,
    preview: { rows: 5, errors: [], error_count: 0, counts: { added: { polling_unit: 1 }, renamed: { ward: 1 }, restored: {}, retired: { polling_unit: 1 }, moved: 0 },
      per_state: { lagos: 4 }, affected: { memberships: 2, pvc_records: 0 }, renamed: { ward: [{ code: "24-07-06", old: "A", new: "B" }] }, retired: {}, moved: [],
      active_units: 5, current_units: 5 } };

  it("system admins upload, preview and apply; the second admin path shows", async () => {
    h.me = { id: "u", email: "a@example.com", is_system_admin: true, admin_areas: ["overview", "geography"], roles: [] };
    let applied = 0;
    routes({
      "GET /admin/geography/datasets/": { results: [DS] },
      "GET /admin/geography/datasets/9/": () => ({ ...DS, first_approval_by: "a@example.com", needs_second_admin: true }),
      "POST /admin/geography/datasets/": DS,
      "POST /admin/geography/datasets/9/apply/": () => (applied++ ? { ...DS, status: "applied" }
        : new ApiError({ status: 409, code: "geo_second_admin_required", message: "A second system admin must apply it too." })),
    });
    renderAt("/admin/geography", <AdminGeographyPage />);
    const file = new File(["state_code\n"], "v2.csv", { type: "text/csv" });
    fireEvent.change(await screen.findByLabelText("File"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(await screen.findByText(/2 memberships and 0 PVC/)).toBeTruthy();
    const call = h.api.mock.calls.find(([p, o]) => p === "/admin/geography/datasets/" && o?.method === "POST")!;
    expect(call[1].body).toBeInstanceOf(FormData);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/a different system admin must apply it too/)).toBeTruthy();
  });

  it("officers see only the review tab, with typed text and no names", async () => {
    h.me = { id: "o", email: "o@example.com", is_system_admin: false, admin_areas: ["overview", "pvc", "geography"], roles: [{ role: "pvc_officer" }] };
    routes({
      ...GEO,
      "/admin/geography/review/": { kinds: ["pvc"], count: 1, next: null, groups: [{ state: "lagos", lga: "Ikejaa", count: 1 }],
        results: [{ kind: "pvc", id: "r1", state: "lagos", typed: { lga: "Ikejaa", ward: "", polling_unit: "" }, why: "person_choice",
          current: { lga: null, ward: null, polling_unit: null }, pending: { lga: { id: 7, name: "Ikeja", code: "07", active: true }, ward: null, polling_unit: null },
          suggestion: { lga: { id: 7, name: "Ikeja", code: "07", score: 0.7 }, ward: null, polling_unit: null }, record_url: "/admin/pvc?record=r1" }] },
      "POST /admin/geography/review/pvc/r1/": { ok: true },
    });
    renderAt("/admin/geography", <AdminGeographyPage />);
    expect(await screen.findByText(/Typed: Ikejaa/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Files" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Accept their choice" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/geography/review/pvc/r1/", { method: "POST", body: { action: "accept" } }));
  });
});
