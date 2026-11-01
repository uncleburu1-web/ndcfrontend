/** PVC verification and NDC membership — spec 06 §12 (frontend). */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { MaskedValue, ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({
  api: vi.fn(),
  me: null as null | Record<string, unknown>,
  redirect: vi.fn(),
}));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));
vi.mock("../donations/navigation", () => ({ redirectTo: h.redirect }));

import { RequireMembershipOfficer, RequireSignedIn } from "../auth/guards";
import AdminMembershipDetailPage from "../pages/admin/membership/AdminMembershipDetailPage";
import AdminMembershipPage from "../pages/admin/membership/AdminMembershipPage";
import AdminMembershipSettingsPage from "../pages/admin/membership/AdminMembershipSettingsPage";
import AdminPvcPage from "../pages/admin/pvc/AdminPvcPage";
import JoinCompletePage, { POLL_LIMIT_MS, POLL_MS } from "../pages/join/JoinCompletePage";
import JoinPage from "../pages/join/JoinPage";
import MembershipCardPage from "../pages/join/MembershipCardPage";
import PvcPage from "../pages/pvc/PvcPage";
import { clerkState } from "../test/clerkMock";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/pvc" element={<PvcPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/complete" element={<JoinCompletePage />} />
          <Route element={<RequireSignedIn />}>
            <Route path="/membership/card" element={<MembershipCardPage />} />
          </Route>
          <Route element={<RequireMembershipOfficer />}>
            <Route path="/admin/pvc" element={<AdminPvcPage />} />
            <Route path="/admin/membership" element={<AdminMembershipPage />} />
            <Route path="/admin/membership/settings" element={<AdminMembershipSettingsPage />} />
            <Route path="/admin/membership/:id" element={<AdminMembershipDetailPage />} />
          </Route>
        </Routes>
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

const CONFIG = { open: true, fee_kobo: 2_000_000, requires_approval: true, inec_pvc_url: "https://inec.example/pvc" };
const ME = { full_name: "Ada Obi", email: "ada@example.com", phone_number: "+2348031234567", profile_complete: true, is_system_admin: false, roles: [],
  pvc_status: "successful" };
const PVC_CONFIG = { inec_pvc_url: "https://inec.example/pvc", inec_voter_check_url: "https://cvr.inecnigeria.org/vvs", guidance_note: "",
  collection_note: "Collection began on 9 October 2026 at INEC local government offices." };
const COMPLETE = {
  status: "draft", display_status: "draft", full_name: "Ada Obi", sex: "female", date_of_birth: "1990-05-01", address: "12 Allen Avenue",
  state: "lagos", state_label: "Lagos", lga: "Ikeja", ward: "Ward 3", polling_unit: "PU 004", nin_masked: "•••• 8901", has_photo: true,
  declarations: { no_other_party: true, constitution: true, data_processing: true }, membership_number: null, latest_payment: null,
};

/** Route API calls by path; anything unlisted rejects so a stray call fails loudly. */
function routes(map: Record<string, unknown | ((opts: Record<string, unknown>) => unknown)>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const key = `${(opts.method as string) ?? "GET"} ${path.split("?")[0]}`;
    const hit = key in map ? map[key] : map[path.split("?")[0]];
    if (hit === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    const v = typeof hit === "function" ? (hit as (o: Record<string, unknown>) => unknown)(opts) : hit;
    if (v instanceof Error) throw v;
    return v;
  });
}

beforeEach(() => {
  h.api.mockReset();
  h.redirect.mockReset();
  h.me = null;
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
  URL.createObjectURL = vi.fn(() => "blob:photo");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ------------------------------------------------------------------- /pvc
describe("/pvc", () => {
  it("is a real page for guests (no longer 404) with sign-in and the INEC link", async () => {
    routes({ "/pvc/config/": PVC_CONFIG });
    renderAt("/pvc");
    expect(screen.getByRole("heading", { name: "Your PVC" })).toBeTruthy();
    expect(screen.getByText(/never need one to browse, vote \(follow\) candidates, donate or read news/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/sign-in?redirect_url=%2Fpvc");
    const inec = await screen.findByRole("link", { name: /Go to INEC’s portal/ });
    expect(inec.getAttribute("href")).toBe("https://inec.example/pvc");
    expect(inec.getAttribute("target")).toBe("_blank");
  });

  it("hides the INEC portal button when no URL is configured, but keeps the voter checker and guidance", async () => {
    routes({ "/pvc/config/": { ...PVC_CONFIG, inec_pvc_url: null, guidance_note: "Registration is closed until INEC announces the next phase." } });
    renderAt("/pvc");
    expect(await screen.findByText(/Collection began on 9 October 2026/)).toBeTruthy();
    expect(screen.getByText("Registration is closed until INEC announces the next phase.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Check on INEC’s voter checker/ }).getAttribute("href")).toBe("https://cvr.inecnigeria.org/vvs");
    expect(screen.queryByRole("link", { name: /INEC’s portal/ })).toBeNull();
  });

  it("submits the form for an unverified user and then shows Pending with the masked VIN", async () => {
    clerkState.isSignedIn = true;
    routes({
      "/membership/config/": CONFIG,
      "GET /me/pvc/": { status: "unverified" },
      "PUT /me/pvc/": { status: "pending", vin_masked: "•••• 2345", surname: "Obi", state: "lagos", state_label: "Lagos", lga: "Ikeja" },
    });
    renderAt("/pvc");
    fireEvent.change(await screen.findByLabelText(/^VIN/), { target: { value: "90F5B0F8E0295612345" } });
    fireEvent.change(screen.getByLabelText(/^Surname/), { target: { value: "Obi" } });
    fireEvent.change(screen.getByLabelText(/^State of registration/), { target: { value: "lagos" } });
    fireEvent.change(screen.getByLabelText(/^LGA/), { target: { value: "Ikeja" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Send for checking" }));
    expect(await screen.findByText(/We’re checking your details/)).toBeTruthy();
    expect(screen.getByText("•••• 2345")).toBeTruthy();
    expect(screen.queryByText("90F5B0F8E0295612345")).toBeNull();
    expect(screen.getByText("These details are private and encrypted.")).toBeTruthy();
    const [, opts] = h.api.mock.calls.find(([p, o]) => p === "/me/pvc/" && o?.method === "PUT")!;
    expect(opts.body).toMatchObject({ vin: "90F5B0F8E0295612345", surname: "Obi", state: "lagos", lga: "Ikeja", consent: true });
  });

  it("shows inline API errors on the form", async () => {
    clerkState.isSignedIn = true;
    routes({
      "/membership/config/": CONFIG,
      "GET /me/pvc/": { status: "unverified" },
      "PUT /me/pvc/": new ApiError({ status: 400, code: "validation_error", message: "Check the details.", fields: { vin: ["A VIN is 19 characters."] } }),
    });
    renderAt("/pvc");
    fireEvent.click(await screen.findByRole("button", { name: "Send for checking" }));
    expect(await screen.findByText("A VIN is 19 characters.")).toBeTruthy();
  });

  it("successful → Continue to Join NDC; rejected → reason and Try again", async () => {
    clerkState.isSignedIn = true;
    routes({ "/pvc/config/": PVC_CONFIG, "GET /me/pvc/": { status: "successful", vin_masked: "•••• 2345", surname: "Obi", lga: "Ikeja", state_label: "Lagos" } });
    renderAt("/pvc");
    expect((await screen.findByRole("link", { name: "Continue to Join NDC" })).getAttribute("href")).toBe("/join");
    cleanup();
    routes({ "/pvc/config/": PVC_CONFIG, "GET /me/pvc/": { status: "rejected", reason: "The details don’t match INEC’s record.", vin_masked: "•••• 2345" } });
    renderAt("/pvc");
    expect(await screen.findByText("The details don’t match INEC’s record.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "Send for checking" })).toBeTruthy();
  });
});

// ------------------------------------------------------------------ /join
describe("/join", () => {
  it("shows the ₦20,000 fee from config, the four steps and the privacy line to guests", async () => {
    routes({ "/membership/config/": CONFIG });
    renderAt("/join");
    expect(await screen.findByText("₦20,000")).toBeTruthy();
    expect(screen.getByText(/Membership is private\. Joining doesn’t follow a candidate or count as a donation\./)).toBeTruthy();
    for (const step of ["Verify your PVC", "Your details", "Pay ₦20,000", "Approval"]) expect(screen.getByRole("heading", { name: new RegExp(step) })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to join" }).getAttribute("href")).toBe("/sign-in?redirect_url=%2Fjoin");
  });

  it("keeps Pay disabled until the PVC is verified, and links to /pvc", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, pvc_status: "pending" };
    routes({ "/membership/config/": CONFIG, "GET /me/membership/": COMPLETE, "/me/membership/photo/": new Blob() });
    renderAt("/join");
    const pay = await screen.findByRole("button", { name: "Pay ₦20,000 membership fee" });
    expect((pay as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "See status" }).getAttribute("href")).toBe("/pvc");
  });

  it("keeps Pay disabled while details are incomplete and when registration is closed", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/membership/config/": CONFIG, "GET /me/membership/": { status: null, display_status: "pvc_verified" }, "GET /me/pvc/": { status: "successful" } });
    renderAt("/join");
    expect(((await screen.findByRole("button", { name: "Pay ₦20,000 membership fee" })) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    routes({ "/membership/config/": { ...CONFIG, open: false }, "GET /me/membership/": COMPLETE, "GET /me/pvc/": { status: "successful" }, "/me/membership/photo/": new Blob() });
    renderAt("/join");
    expect(await screen.findByText(/Membership registration opens soon/)).toBeTruthy();
    expect(((await screen.findByRole("button", { name: "Pay ₦20,000 membership fee" })) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks for profile completion before the details form", async () => {
    clerkState.isSignedIn = true;
    h.me = { ...ME, profile_complete: false };
    routes({ "/membership/config/": CONFIG, "GET /me/membership/": { status: null, display_status: "pvc_required" }, "GET /me/pvc/": { status: "unverified" } });
    renderAt("/join");
    expect(await screen.findByText("Finish setting up your profile first")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save details" })).toBeNull();
  });

  it("saves details with declarations and shows inline API errors", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    let call = 0;
    routes({
      "/membership/config/": CONFIG,
      "GET /me/membership/": { status: null, display_status: "pvc_verified" },
      "GET /me/pvc/": { status: "successful" },
      "PUT /me/membership/": () => (call++ === 0
        ? new ApiError({ status: 400, code: "under_18", message: "You must be 18 or older to join." })
        : { ...COMPLETE, has_photo: false }),
    });
    renderAt("/join");
    fireEvent.change(await screen.findByLabelText(/^Full name/), { target: { value: "Ada Obi" } });
    fireEvent.click(screen.getByLabelText("Female"));
    fireEvent.change(screen.getByLabelText(/^NIN/), { target: { value: "12345678901" } });
    for (const label of [/not a member of any other political party/, /abide by the NDC constitution/, /may process these details/]) {
      fireEvent.click(screen.getByLabelText(label));
    }
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("You must be 18 or older to join.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));
    expect(await screen.findByText("Details saved.")).toBeTruthy();
    const [, opts] = h.api.mock.calls.filter(([p, o]) => p === "/me/membership/" && o?.method === "PUT")[1];
    expect(opts.body).toMatchObject({ full_name: "Ada Obi", sex: "female", nin: "12345678901",
      declarations: { no_other_party: true, constitution: true, data_processing: true } });
    expect(screen.getByText(/Saved: •••• 8901/)).toBeTruthy();
  });

  it("needs photo consent before choosing a photo", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/membership/config/": CONFIG, "GET /me/membership/": { status: null, display_status: "pvc_verified" }, "GET /me/pvc/": { status: "successful" } });
    renderAt("/join");
    expect(await screen.findByText(/at least 400 × 400 px/)).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/recent photo of me/));
    expect(input.disabled).toBe(false);
  });

  it("the Pay button goes to the provider's checkout", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({
      "/membership/config/": CONFIG, "GET /me/membership/": COMPLETE, "GET /me/pvc/": { status: "successful" }, "/me/membership/photo/": new Blob(),
      "POST /me/membership/pay/": { reference: "MEM-X", checkout_url: "https://checkout.example/MEM-X" },
    });
    renderAt("/join");
    const pay = await screen.findByRole("button", { name: "Pay ₦20,000 membership fee" });
    await waitFor(() => expect((pay as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(pay);
    await waitFor(() => expect(h.redirect).toHaveBeenCalledWith("https://checkout.example/MEM-X"));
  });

  it("active members see their number and the card link; rejected-and-paid see the refund line", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": PVC_CONFIG, "GET /me/pvc/": { status: "successful" },
      "GET /me/membership/": { ...COMPLETE, status: "active", display_status: "active", membership_number: "NDC-LA-2026-000001", activated_at: "2026-11-01T10:00:00Z" } });
    renderAt("/join");
    expect(await screen.findByText("You’re an NDC member")).toBeTruthy();
    expect(screen.getByText("NDC-LA-2026-000001")).toBeTruthy();
    expect(screen.getByRole("link", { name: "My membership card" }).getAttribute("href")).toBe("/membership/card");
    cleanup();
    routes({ "/pvc/config/": PVC_CONFIG, "GET /me/pvc/": { status: "successful" }, "/me/membership/photo/": new Blob(),
      "GET /me/membership/": { ...COMPLETE, status: "rejected", display_status: "rejected", decision_reason: "Duplicate application.",
        latest_payment: { reference: "MEM-X", status: "successful" } } });
    renderAt("/join");
    expect(await screen.findByText(/Duplicate application\./)).toBeTruthy();
    expect(screen.getByText(/will be refunded to your original payment method/)).toBeTruthy();
  });

  it("cancelling needs a reason and says the fee isn't refunded once active", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/pvc/config/": PVC_CONFIG, "GET /me/pvc/": { status: "successful" },
      "GET /me/membership/": { ...COMPLETE, status: "active", display_status: "active", membership_number: "NDC-LA-2026-000001" },
      "POST /me/membership/cancel/": { ...COMPLETE, status: "cancelled", display_status: "cancelled", cancel_reason: "Moving abroad." } });
    renderAt("/join");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel membership" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/isn’t refunded once you’re active/)).toBeTruthy();
    const confirm = within(dialog).getByRole("button", { name: "Cancel membership" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/^Reason/), { target: { value: "Moving abroad." } });
    fireEvent.click(confirm);
    expect(await screen.findByText("Your membership has been cancelled.")).toBeTruthy();
  });
});

// --------------------------------------------------------- /join/complete
describe("/join/complete", () => {
  const status = (s: string, m: string) => ({ reference: "MEM-X", status: s, amount_kobo: 2_000_000, membership_status: m });

  it("reports active, pending approval and failure from the backend", async () => {
    routes({ "/membership/payments/MEM-X/": status("successful", "active") });
    renderAt("/join/complete?reference=MEM-X");
    expect(await screen.findByText("Welcome to the NDC.")).toBeTruthy();
    cleanup();
    routes({ "/membership/payments/MEM-X/": status("successful", "pending_approval") });
    renderAt("/join/complete?reference=MEM-X");
    expect(await screen.findByText("Payment received.")).toBeTruthy();
    cleanup();
    routes({ "/membership/payments/MEM-X/": status("failed", "draft") });
    renderAt("/join/complete?reference=MEM-X");
    expect(await screen.findByText("Your payment didn’t go through.")).toBeTruthy();
  });

  it("polls while pending and stops after the limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    routes({ "/membership/payments/MEM-X/": status("pending", "payment_pending") });
    renderAt("/join/complete?reference=MEM-X");
    expect(await screen.findByText(/confirming your payment with the bank/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(POLL_LIMIT_MS + POLL_MS); });
    expect(await screen.findByText("This is taking longer than usual.")).toBeTruthy();
    expect(h.api.mock.calls.length).toBeGreaterThan(2);
  });
});

// ------------------------------------------------------- /membership/card
describe("/membership/card", () => {
  it("shows an active member's card and can print", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/membership/card/": { full_name: "Ada Obi", membership_number: "NDC-LA-2026-000001", state: "Lagos", lga: "Ikeja",
      ward: "Ward 3", member_since: "2026-11-01T10:00:00Z", has_photo: true }, "/me/membership/photo/": new Blob() });
    window.print = vi.fn();
    renderAt("/membership/card");
    expect(await screen.findByText("NDC-LA-2026-000001")).toBeTruthy();
    expect(screen.getByText("Status: Active")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Print card" }));
    expect(window.print).toHaveBeenCalled();
  });

  it("has no card for non-members", async () => {
    clerkState.isSignedIn = true;
    h.me = ME;
    routes({ "/me/membership/card/": new ApiError({ status: 404, message: "You don't have an active membership." }) });
    renderAt("/membership/card");
    expect(await screen.findByText("No active membership")).toBeTruthy();
  });
});

// ------------------------------------------------------------------ admin
describe("admin", () => {
  const OFFICER = { ...ME, roles: [{ role: "membership_officer" }] };
  const PVC_ROW = { id: "p1", status: "pending", vin_masked: "•••• 2345", surname: "Obi", state: "lagos", state_label: "Lagos", lga: "Ikeja",
    polling_unit: "", user_name: "Ada Obi", user_email: "ada@example.com", reviewed_by_email: null, created_at: "2026-11-01T09:00:00Z" };

  it("keeps finance officers and moderators out", () => {
    clerkState.isSignedIn = true;
    for (const role of ["finance_officer", "moderator"]) {
      h.me = { ...ME, roles: [{ role }] };
      renderAt("/admin/membership");
      expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
      cleanup();
    }
  });

  it("PVC queue: reveal (auto-hides), INEC link, verify and reject with reason", async () => {
    clerkState.isSignedIn = true;
    h.me = OFFICER;
    routes({
      "/admin/pvc/": { count: 1, results: [PVC_ROW], lookup_url: "https://cvr.inecnigeria.org/vvs", pending_count: 1 },
      "POST /admin/pvc/p1/reveal/": { vin: "90F5B0F8E0295612345" },
      "POST /admin/pvc/p1/verify/": { ...PVC_ROW, status: "successful" },
      "POST /admin/pvc/p1/reject/": { ...PVC_ROW, status: "rejected" },
    });
    renderAt("/admin/pvc");
    expect((await screen.findByRole("link", { name: "Open INEC voter checker" })).getAttribute("target")).toBe("_blank");
    fireEvent.click(screen.getByRole("button", { name: "Reveal VIN" }));
    expect(await screen.findByText("90F5B0F8E0295612345")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mark verified" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/pvc/p1/verify/", { method: "POST" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/^More detail/), { target: { value: "Surname differs." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject PVC" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/pvc/p1/reject/",
      { method: "POST", body: { reason: "The details don’t match INEC’s record. Surname differs." } }));
  });

  it("MaskedValue hides the revealed value after 30 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<MaskedValue masked="•••• 8901" label="NIN" onReveal={async () => "12345678901"} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal NIN" }));
    expect(await screen.findByText("12345678901")).toBeTruthy();
    expect(screen.getByText(/Viewing is recorded/)).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.queryByText("12345678901")).toBeNull();
    expect(screen.getByText("•••• 8901")).toBeTruthy();
  });

  it("applications list shows totals and links to the detail", async () => {
    clerkState.isSignedIn = true;
    h.me = OFFICER;
    routes({ "/admin/membership/": { count: 1, totals: { pending_approval: 1 }, results: [{ ...COMPLETE, id: "m1", status: "pending_approval",
      user_email: "ada@example.com", pvc_status: "successful", refund_due: false, created_at: "2026-11-01T09:00:00Z" }] } });
    renderAt("/admin/membership");
    expect(await screen.findByText("1 application waiting for approval")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ada Obi" }).getAttribute("href")).toBe("/admin/membership/m1");
  });

  it("detail: NIN reveal, approve, and reject needs a reason", async () => {
    clerkState.isSignedIn = true;
    h.me = OFFICER;
    const detail = { ...COMPLETE, id: "m1", status: "pending_approval", user_email: "ada@example.com", user_phone: "+234803", pvc_status: "successful",
      refund_due: false, created_at: "2026-11-01T09:00:00Z", events: [], pvc_history: [], audit: [],
      payments: [{ reference: "MEM-X", status: "successful", status_label: "Successful", amount_kobo: 2_000_000, refunded_kobo: 0, channel: "card",
        created_at: "2026-11-01T09:00:00Z", paid_at: null, provider_reference: "", review_reason: "", events: [] }] };
    routes({
      "/admin/membership/m1/": detail, "/admin/membership/settings/": CONFIG,
      "POST /admin/membership/m1/reveal-nin/": { nin: "12345678901" },
      "POST /admin/membership/m1/approve/": { ...detail, status: "active", membership_number: "NDC-LA-2026-000001" },
    });
    renderAt("/admin/membership/m1");
    fireEvent.click(await screen.findByRole("button", { name: "Reveal NIN" }));
    expect(await screen.findByText("12345678901")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Reject application" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Go back" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    expect(await screen.findByText("NDC-LA-2026-000001")).toBeTruthy();
  });

  it("settings: only a system admin can switch approval; register export downloads", async () => {
    clerkState.isSignedIn = true;
    h.me = OFFICER;
    routes({ "/admin/membership/settings/": CONFIG, "/admin/membership/register.csv": new Blob(["a,b"]) });
    renderAt("/admin/membership/settings");
    const sw = await screen.findByRole("switch", { name: /Require officer approval/ });
    expect((sw as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/This file contains NINs and photos\. Store it securely and delete it after submitting to INEC\./)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "lagos" } });
    fireEvent.click(screen.getByRole("button", { name: "Download register (CSV)" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/membership/register.csv?state=lagos", { responseType: "blob" }));
    expect(await screen.findByText(/recorded in the audit log/)).toBeTruthy();
    cleanup();
    h.me = { ...ME, is_system_admin: true };
    routes({ "/admin/membership/settings/": CONFIG, "PATCH /admin/membership/settings/": { ...CONFIG, requires_approval: false } });
    renderAt("/admin/membership/settings");
    fireEvent.click(await screen.findByRole("switch", { name: /Require officer approval/ }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/membership/settings/", { method: "PATCH", body: { requires_approval: false } }));
  });
});
