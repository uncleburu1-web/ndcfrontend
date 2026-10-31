/** Public candidate pages — spec 03 §8.1–8.2, §12. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../auth/api";
import { ToastProvider } from "../../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), flags: { donations: false } }));
vi.mock("../../auth/session", () => ({ useApi: () => h.api }));
vi.mock("../../config", () => ({
  get donationsEnabled() {
    return h.flags.donations;
  },
}));

import CandidateProfilePage from "./CandidateProfilePage";
import CandidatesPage from "./CandidatesPage";

const card = (slug: string, position: string, position_label: string, full_name: string) => ({
  slug, position, position_label, full_name, party: "NDC", election_year: 2027, state: "kano",
  area_display: "Kano State", photo: null, verified: true,
});
const POSITIONS = { election_year: 2027, election_years: [2027], positions: [
  { position: "president", label: "President", count: 1 }, { position: "governor", label: "Governor", count: 2 }] };

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/candidates/:slug" element={<CandidateProfilePage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

function listResponse(results: unknown[]) {
  return { count: results.length, next: null, previous: null, results, election_year: 2027 };
}

beforeEach(() => {
  h.api.mockReset();
  h.flags.donations = false;
});
afterEach(cleanup);

describe("/candidates", () => {
  it("groups candidates under office headings in order and links to profiles", async () => {
    h.api.mockImplementation(async (path: string) =>
      path.startsWith("/candidates/positions") ? POSITIONS
        : listResponse([card("pres-a", "president", "President", "Pres A"), card("gov-b", "governor", "Governor", "Gov B"), card("gov-c", "governor", "Governor", "Gov C")])
    );
    renderAt("/candidates");
    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.map((x) => x.textContent)).toEqual(["President · 1", "Governor · 2"]);
    expect(screen.getByRole("link", { name: "Gov B" }).getAttribute("href")).toBe("/candidates/gov-b");
    expect(h.api).toHaveBeenCalledWith("/candidates/", expect.objectContaining({ anonymous: true }));
  });

  it("puts filters in the URL and re-requests with them", async () => {
    h.api.mockImplementation(async (path: string) => (path.startsWith("/candidates/positions") ? POSITIONS : listResponse([])));
    renderAt("/candidates");
    await screen.findByText(/No candidates have been published yet/);
    fireEvent.change(screen.getByLabelText("Office"), { target: { value: "governor" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/candidates?position=governor"));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/candidates/?position=governor", expect.anything()));
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "lagos" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/candidates?position=governor&state=lagos"));
  });

  it("shows a filtered empty state with Clear filters", async () => {
    h.api.mockImplementation(async (path: string) => (path.startsWith("/candidates/positions") ? POSITIONS : listResponse([])));
    renderAt("/candidates?state=lagos");
    expect(await screen.findByText("No published candidates match these filters")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/candidates"));
  });

  it("shows an error banner with Try again", async () => {
    let fail = true;
    h.api.mockImplementation(async (path: string) => {
      if (path.startsWith("/candidates/positions")) return POSITIONS;
      if (fail) throw new ApiError({ status: 0, code: "network_error", message: "Couldn't reach NDCConnect." });
      return listResponse([card("pres-a", "president", "President", "Pres A")]);
    });
    renderAt("/candidates");
    expect(await screen.findByText("We couldn’t load candidates")).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Pres A" })).toBeTruthy();
  });
});

describe("/candidates/:slug", () => {
  const profile = {
    ...card("amina-bello", "senator", "Senator", "Amina Bello"),
    area_display: "Kano Central Senatorial District, Kano State",
    biography: "First paragraph.\n\nSecond paragraph.",
    campaign_summary: "Jobs and schools.",
    priorities: ["Youth jobs", "Primary schools"],
    links: [{ label: "Website", url: "https://amina.example" }],
    published_at: "2026-10-01T10:00:00Z",
  };

  it("renders the public profile", async () => {
    h.api.mockResolvedValue(profile);
    renderAt("/candidates/amina-bello");
    expect(await screen.findByRole("heading", { level: 1, name: /Amina Bello/ })).toBeTruthy();
    expect(screen.getByText("Senator")).toBeTruthy();
    expect(screen.getByText(/Kano Central Senatorial District, Kano State · NDC · 2027 elections/)).toBeTruthy();
    expect(screen.getByText("Second paragraph.")).toBeTruthy();
    expect(screen.getByText("Youth jobs")).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/candidates/amina-bello/", expect.objectContaining({ anonymous: true }));
    expect(document.title).toBe("Amina Bello — Senator | NDCConnect");
  });

  it("opens external links safely in a new tab", async () => {
    h.api.mockResolvedValue(profile);
    renderAt("/candidates/amina-bello");
    const link = await screen.findByRole("link", { name: /Website/ });
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("hides Donate while donations are disabled (FR-046)", async () => {
    h.api.mockResolvedValue(profile);
    renderAt("/candidates/amina-bello");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /Donate/ })).toBeNull();
  });

  it("shows Donate once donations are enabled", async () => {
    h.flags.donations = true;
    h.api.mockResolvedValue(profile);
    renderAt("/candidates/amina-bello");
    const donate = await screen.findByRole("link", { name: /Donate/ });
    expect(donate.getAttribute("href")).toBe("/donate?candidate=amina-bello");
  });

  it("shows the not-found page for unknown or unpublished candidates", async () => {
    h.api.mockRejectedValue(new ApiError({ status: 404, code: "not_found", message: "Not found." }));
    renderAt("/candidates/ghost");
    expect(await screen.findByText("Candidate not found")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all candidates" }).getAttribute("href")).toBe("/candidates");
  });
});
