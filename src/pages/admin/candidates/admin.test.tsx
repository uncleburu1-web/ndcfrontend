/** Admin candidate pages — spec 03 §8.3, §12. */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../auth/api";
import type { AdminCandidate } from "../../../candidates/types";
import { ToastProvider } from "../../../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | { is_system_admin: boolean } }));
vi.mock("../../../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "loading", error: null, setMe: vi.fn(), refresh: vi.fn() }),
}));

import { RequireSystemAdmin } from "../../../auth/guards";
import AdminCandidateEditPage from "./AdminCandidateEditPage";
import AdminCandidatesPage from "./AdminCandidatesPage";

const base: AdminCandidate = {
  id: "11111111-1111-1111-1111-111111111111", slug: "amina-bello", full_name: "Amina Bello", party: "NDC",
  position: "senator", position_label: "Senator", election_year: 2027, state: "kano", area_name: "Kano Central Senatorial District",
  ward_name: "", area_display: "Kano Central Senatorial District, Kano State", biography: "", campaign_summary: "", priorities: [],
  links: [], photo: null, status: "draft", is_verified: false, verified_at: null, verified_by_email: null,
  verification_notes: "", published_at: null, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-02T10:00:00Z",
};

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireSystemAdmin />}>
            <Route path="/admin/candidates" element={<AdminCandidatesPage />} />
            <Route path="/admin/candidates/new" element={<AdminCandidateEditPage />} />
            <Route path="/admin/candidates/:id" element={<AdminCandidateEditPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

beforeEach(() => {
  h.api.mockReset();
  h.me = { is_system_admin: true };
});
afterEach(cleanup);

describe("RequireSystemAdmin", () => {
  it("blocks non-admins (backend enforces it too)", () => {
    h.me = { is_system_admin: false };
    renderAt("/admin/candidates");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalled();
  });

  it("lets admins see the list with status and verification badges", async () => {
    h.api.mockResolvedValue({ count: 1, next: null, previous: null, results: [{ ...base, status: "published", is_verified: true }] });
    renderAt("/admin/candidates");
    expect(await screen.findByRole("link", { name: "Amina Bello" })).toBeTruthy();
    const row = screen.getByRole("link", { name: "Amina Bello" }).closest("tr")!;
    expect(within(row).getByText("Published")).toBeTruthy();
    expect(within(row).getByText("Verified")).toBeTruthy();
  });
});

describe("CandidateForm", () => {
  it("shows and hides area fields by office", () => {
    renderAt("/admin/candidates/new");
    const office = screen.getByLabelText(/Office sought/);
    fireEvent.change(office, { target: { value: "president" } });
    expect(screen.queryByLabelText(/^State/)).toBeNull();
    expect(screen.getByText(/represents the whole country/)).toBeTruthy();
    fireEvent.change(office, { target: { value: "senator" } });
    expect(screen.getByLabelText(/^State/)).toBeTruthy();
    expect(screen.getByLabelText(/Senatorial district/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Ward/)).toBeNull();
    fireEvent.change(office, { target: { value: "councillor" } });
    fireEvent.change(screen.getByLabelText(/^State/), { target: { value: "lagos" } });
    // Spec 19 §5.2: LGA and ward come from INEC's list
    expect(screen.getByLabelText(/^LGA/)).toBeTruthy();
    expect(screen.getByLabelText(/^Ward/)).toBeTruthy();
  });

  it("hides the FCT for offices that don't exist there", () => {
    renderAt("/admin/candidates/new");
    fireEvent.change(screen.getByLabelText(/Office sought/), { target: { value: "governor" } });
    const state = screen.getByLabelText(/^State/) as HTMLSelectElement;
    expect([...state.options].some((o) => o.value === "fct")).toBe(false);
  });

  it("shows API field errors inline and sends only the area fields the office uses", async () => {
    h.api.mockRejectedValue(new ApiError({ status: 400, code: "validation_error", message: "x", fields: { area_name: ["Enter the senatorial district."] } }));
    renderAt("/admin/candidates/new");
    fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: "Amina Bello" } });
    fireEvent.change(screen.getByLabelText(/Office sought/), { target: { value: "senator" } });
    fireEvent.change(screen.getByLabelText(/Election year/), { target: { value: "2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(await screen.findByText("Enter the senatorial district.")).toBeTruthy();
    const body = h.api.mock.calls[0][1].body;
    expect(body.ward_name).toBe("");
    expect(body.election_year).toBe(2027);
  });
});

describe("workflow actions", () => {
  it("confirms before publishing and explains the effect", async () => {
    h.api.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.endsWith("/accounts/")) return [];
      if (path.endsWith("/posts/")) return { results: [] };
      if (opts?.method === "POST") return { ...base, status: "published", is_verified: true };
      return { ...base, is_verified: true, verified_at: "2026-10-02T10:00:00Z", verification_notes: "Matched INEC list" };
    });
    renderAt(`/admin/candidates/${base.id}`);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(screen.getByRole("dialog", { name: "Publish Amina Bello?" })).toBeTruthy();
    expect(screen.getByText(/will appear on the public Candidates page/)).toBeTruthy();
    expect(h.api).not.toHaveBeenCalledWith(`/admin/candidates/${base.id}/publish/`, expect.anything());
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector(".ds-overlay__footer .ds-button--primary")!);
    await waitFor(() => expect(h.api).toHaveBeenCalledWith(`/admin/candidates/${base.id}/publish/`, { method: "POST", body: {} }));
  });

  it("offers only the actions allowed in each state", async () => {
    h.api.mockImplementation(async (path: string) => (path.endsWith("/accounts/") ? [] : path.endsWith("/posts/") ? { results: [] } : base));
    renderAt(`/admin/candidates/${base.id}`);
    expect(await screen.findByRole("button", { name: "Verify" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
  });

  it("asks for a reason when unpublishing", async () => {
    h.api.mockImplementation(async (path: string, opts?: { method?: string; body?: unknown }) => {
      if (path.endsWith("/accounts/")) return [];
      if (path.endsWith("/posts/")) return { results: [] };
      if (opts?.method === "POST") {
        if (!(opts.body as { reason?: string }).reason) throw new ApiError({ status: 400, code: "validation_error", message: "x", fields: { reason: ["Give a reason for unpublishing."] } });
        return { ...base, status: "unpublished", is_verified: true };
      }
      return { ...base, status: "published", is_verified: true };
    });
    renderAt(`/admin/candidates/${base.id}`);
    fireEvent.click(await screen.findByRole("button", { name: "Unpublish" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.querySelector(".ds-overlay__footer .ds-button--primary")!);
    expect(await screen.findByText("Give a reason for unpublishing.")).toBeTruthy();
  });
});

describe("followers (spec 04 §7.4)", () => {
  it("shows follower counts only — never who", async () => {
    h.api.mockImplementation(async (path: string) =>
      path.endsWith("/accounts/") ? [] : path.endsWith("/posts/") ? { results: [] } : { ...base, status: "published", is_verified: true, followers: { total: 1240, notify_on: 312 } }
    );
    renderAt(`/admin/candidates/${base.id}`);
    const panel = (await screen.findByRole("heading", { name: "Followers" })).closest("section")!;
    expect(panel.textContent).toContain("1,240 followers");
    expect(panel.textContent).toContain("312 with notifications on");
    expect(panel.querySelectorAll("li, a").length).toBe(0);
  });
});

describe("identity change on a published candidate", () => {
  it("warns before saving and only PATCHes after confirmation", async () => {
    h.api.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.endsWith("/accounts/")) return [];
      if (path.endsWith("/posts/")) return { results: [] };
      if (opts?.method === "PATCH") return { ...base, full_name: "Amina B. Bello", status: "unpublished", unpublished_by_edit: true };
      return { ...base, status: "published", is_verified: true };
    });
    renderAt(`/admin/candidates/${base.id}`);
    fireEvent.change(await screen.findByLabelText(/Full name/), { target: { value: "Amina B. Bello" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("dialog", { name: "This takes the candidate off the public page" })).toBeTruthy();
    expect(h.api.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save and unpublish" }));
    await waitFor(() => expect(h.api.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(true));
  });

  it("saves non-identity edits on a published candidate without warning", async () => {
    h.api.mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (path.endsWith("/accounts/")) return [];
      if (path.endsWith("/posts/")) return { results: [] };
      if (opts?.method === "PATCH") return { ...base, status: "published", is_verified: true, biography: "New bio" };
      return { ...base, status: "published", is_verified: true };
    });
    renderAt(`/admin/candidates/${base.id}`);
    fireEvent.change(await screen.findByLabelText(/Biography/), { target: { value: "New bio" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(h.api.mock.calls.some(([, o]) => o?.method === "PATCH")).toBe(true));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
