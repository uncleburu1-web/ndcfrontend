/** Interim home page: no "being built" placeholder; the main ways in and the next events. */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({ useApi: () => h.api }));

import HomePage from "./HomePage";

afterEach(cleanup);

describe("home page", () => {
  it("shows the ways in and upcoming events, not a placeholder", async () => {
    h.api.mockResolvedValue({ results: [{ id: "e1", title: "Ikeja town hall", type: "town_hall", type_label: "Town hall",
      mode: "in_person", mode_label: "In person", status: "published", starts_at: "2026-11-14T09:00:00Z", ends_at: "2026-11-14T11:00:00Z",
      place: "Ikeja Grounds", lga: "Ikeja", state: "lagos", state_label: "Lagos", organiser: { label: "Amina’s campaign", candidate: null },
      going: "Fewer than 10", full: false, members_only: false, cover: null }], next: null, previous: null });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.queryByText(/being built/i)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    for (const [name, href] of [["Candidates", "/candidates"], ["Events", "/events"], ["Communities", "/communities"], ["States", "/states"]]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${name}`) }).getAttribute("href")).toBe(href);
    }
    expect(await screen.findByText("Ikeja town hall")).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/events/?", expect.objectContaining({ anonymous: true }));
  });

  it("hides the events strip when there are none", async () => {
    h.api.mockResolvedValue({ results: [], next: null, previous: null });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("region", { name: "Coming up" })).toBeNull();
  });
});
