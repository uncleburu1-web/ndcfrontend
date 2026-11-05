/** Donations and public finance — spec 05 §12 (frontend). */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({
  api: vi.fn(),
  me: null as null | Record<string, unknown>,
  config: { open: true, min_kobo: 50000, max_per_payment_kobo: 500000000, presets_kobo: [100000, 500000, 1000000, 5000000] },
  redirect: vi.fn(),
}));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));
vi.mock("./DonationConfigProvider", () => ({
  useDonationConfig: () => ({ config: h.config, loading: false }),
  DonationConfigProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./navigation", () => ({ redirectTo: h.redirect }));

import { RequireFinanceViewer } from "../auth/guards";
import AdminDonationDetailPage from "../pages/admin/donations/AdminDonationDetailPage";
import AdminDonationsPage from "../pages/admin/donations/AdminDonationsPage";
import DonateCompletePage, { POLL_LIMIT_MS, POLL_MS } from "../pages/donate/DonateCompletePage";
import DonatePage from "../pages/donate/DonatePage";
import ReceiptPage from "../pages/donate/ReceiptPage";
import FinancePage from "../pages/finance/FinancePage";
import { clerkState } from "../test/clerkMock";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/donate/complete" element={<DonateCompletePage />} />
          <Route path="/donate/receipt/:reference" element={<ReceiptPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route element={<RequireFinanceViewer />}>
            <Route path="/admin/donations" element={<AdminDonationsPage />} />
            <Route path="/admin/donations/:id" element={<AdminDonationDetailPage />} />
          </Route>
        </Routes>
        <Where />
      </MemoryRouter>
    </ToastProvider>
  );
}

const receipt = (over: Record<string, unknown> = {}) => ({
  reference: "NDC-ABCDEFGHIJKLMNOPQRST", status: "successful", status_label: "Successful", amount_kobo: 500000, refunded_kobo: 0,
  net_kobo: 500000, currency: "NGN", designation: "candidate", candidate: { slug: "amina-bello", full_name: "Amina Bello", is_public: true },
  donor_name: "Ada Obi", display_choice: "name", public_label: "Ada Obi", channel: "card", created_at: "2026-11-01T09:00:00Z",
  paid_at: "2026-11-01T09:01:00Z", ...over,
});

const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function fillDonor() {
  fill(/^Full name/, "Ada Obi");
  fill(/^Email/, "ada@example.com");
  fill(/^Phone/, "0803 123 4567");
  fill(/^State/, "lagos");
  fill(/^Address/, "12 Allen Avenue, Ikeja");
}
function tickDeclarations() {
  for (const cb of screen.getAllByRole("checkbox")) fireEvent.click(cb);
}

beforeEach(() => {
  h.api.mockReset();
  h.redirect.mockReset();
  h.me = null;
  h.config = { open: true, min_kobo: 50000, max_per_payment_kobo: 500000000, presets_kobo: [100000, 500000, 1000000, 5000000] };
  clerkState.isLoaded = true;
  clerkState.isSignedIn = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------- /donate
describe("/donate", () => {
  it("says donations aren't open while the gate is closed", () => {
    h.config = { open: false, min_kobo: null as unknown as number, max_per_payment_kobo: null as unknown as number, presets_kobo: [] };
    renderAt("/donate");
    expect(screen.getByText("Donations aren’t open yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Donate/ })).toBeNull();
  });

  it("shows presets from the backend and says donating is optional", () => {
    h.api.mockResolvedValue({ count: 0, next: null, previous: null, results: [] });
    renderAt("/donate");
    for (const label of ["₦1,000", "₦5,000", "₦10,000", "₦50,000"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.getByText(/Between ₦500 and ₦5,000,000 per payment/)).toBeTruthy();
    expect(screen.getByText(/Donating is optional/)).toBeTruthy();
    expect(screen.getByText("You’ll appear as “Guest”.")).toBeTruthy();
    expect(screen.getByText(/We never show these publicly/)).toBeTruthy();
  });

  it("checks amount and declarations before calling the API", () => {
    renderAt("/donate");
    fireEvent.click(screen.getByRole("button", { name: "Donate" }));
    expect(screen.getByText("Choose or enter an amount.")).toBeTruthy();
    expect(screen.getAllByText("Tick this to continue.")).toHaveLength(3);
    expect(h.api).not.toHaveBeenCalledWith("/donations/", expect.anything());
  });

  it("sends a guest donation in kobo and goes to the provider's checkout", async () => {
    h.api.mockImplementation(async (path: string) => {
      if (path === "/donations/") return { reference: "NDC-X", checkout_url: "https://checkout.example/NDC-X" };
      return { count: 0, next: null, previous: null, results: [] };
    });
    renderAt("/donate");
    fireEvent.click(screen.getByRole("button", { name: "₦5,000" }));
    fillDonor();
    tickDeclarations();
    const submit = screen.getByRole("button", { name: "Donate ₦5,000" });
    expect(screen.getByText("to the NDC general fund")).toBeTruthy();
    fireEvent.click(submit);
    await waitFor(() => expect(h.redirect).toHaveBeenCalledWith("https://checkout.example/NDC-X"));
    const [, opts] = h.api.mock.calls.find(([p]) => p === "/donations/")!;
    expect(opts.anonymous).toBe(true);
    expect(opts.body).toMatchObject({
      amount_kobo: 500000, designation: "party", donor_name: "Ada Obi", donor_state: "lagos", display_choice: undefined,
      declarations: { own_funds: true, nigerian_source: true, voluntary: true },
    });
  });

  it("shows the over-limit message from the backend under the amount", async () => {
    h.api.mockImplementation(async (path: string) => {
      if (path === "/donations/") throw new ApiError({ status: 400, code: "over_limit", message: "You can give up to ₦4,000 more." });
      return { count: 0, next: null, previous: null, results: [] };
    });
    renderAt("/donate");
    fireEvent.click(screen.getByRole("button", { name: "₦5,000" }));
    fillDonor();
    tickDeclarations();
    fireEvent.click(screen.getByRole("button", { name: "Donate ₦5,000" }));
    expect(await screen.findByText("You can give up to ₦4,000 more.")).toBeTruthy();
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it("shows nested field errors from the API", async () => {
    h.api.mockImplementation(async (path: string) => {
      if (path === "/donations/") throw new ApiError({ status: 400, code: "validation_error", message: "x",
        fields: { donor_phone: ["Enter a valid Nigerian number."], declarations: { nigerian_source: ["Tick this to continue."] } } as never });
      return { count: 0, next: null, previous: null, results: [] };
    });
    renderAt("/donate");
    fireEvent.click(screen.getByRole("button", { name: "₦5,000" }));
    fillDonor();
    tickDeclarations();
    fireEvent.click(screen.getByRole("button", { name: "Donate ₦5,000" }));
    expect(await screen.findByText("Enter a valid Nigerian number.")).toBeTruthy();
    expect(screen.getByText("Tick this to continue.")).toBeTruthy();
  });

  it("preselects ?candidate= and falls back to the NDC fund when unavailable", async () => {
    h.api.mockImplementation(async (path: string) => {
      if (path === "/candidates/amina-bello/") return { slug: "amina-bello", full_name: "Amina Bello" };
      if (path === "/candidates/gone/") throw new ApiError({ status: 404 });
      return { count: 0, next: null, previous: null, results: [] };
    });
    renderAt("/donate?candidate=amina-bello&amount=10000");
    expect(await screen.findByText("Amina Bello")).toBeTruthy();
    expect(screen.getByText("to Amina Bello's campaign")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Donate ₦10,000" })).toBeTruthy();
    cleanup();
    renderAt("/donate?candidate=gone");
    expect(await screen.findByText(/That candidate isn’t available for donations/)).toBeTruthy();
    expect((screen.getByLabelText("NDC (general campaign fund)") as HTMLInputElement).checked).toBe(true);
  });

  it("prefills signed-in donors and sends their public-label choice", async () => {
    clerkState.isSignedIn = true;
    h.me = { full_name: "Ada Obi", email: "ada@example.com", phone_number: "+2348031234567", is_system_admin: false, roles: [] };
    h.api.mockImplementation(async (path: string) => (path === "/donations/" ? { reference: "R", checkout_url: "https://c/R" }
      : { count: 0, next: null, previous: null, results: [] }));
    renderAt("/donate");
    expect((screen.getByLabelText(/^Full name/) as HTMLInputElement).value).toBe("Ada Obi");
    expect((screen.getByLabelText(/^Phone/) as HTMLInputElement).value).toBe("08031234567");
    expect((screen.getByLabelText(/Show my name/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText(/Anonymous Donor/));
    fireEvent.click(screen.getByRole("button", { name: "₦1,000" }));
    fill(/^State/, "kano");
    fill(/^Address/, "1 Zoo Road");
    tickDeclarations();
    fireEvent.click(screen.getByRole("button", { name: "Donate ₦1,000" }));
    await waitFor(() => expect(h.redirect).toHaveBeenCalled());
    const [, opts] = h.api.mock.calls.find(([p]) => p === "/donations/")!;
    expect(opts.anonymous).toBe(false);
    expect(opts.body.display_choice).toBe("anonymous");
  });
});

// ------------------------------------------------------- completion & receipt
describe("/donate/complete", () => {
  it("thanks the donor on success", async () => {
    h.api.mockResolvedValue(receipt());
    renderAt("/donate/complete?reference=NDC-ABCDEFGHIJKLMNOPQRST");
    expect(await screen.findByText("Thank you, Ada.")).toBeTruthy();
    expect(screen.getByText("₦5,000 to Amina Bello's campaign.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View receipt" }).getAttribute("href")).toBe("/donate/receipt/NDC-ABCDEFGHIJKLMNOPQRST");
  });

  it("keeps checking while pending, then says it's taking longer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.api.mockResolvedValue(receipt({ status: "pending", status_label: "Pending" }));
    renderAt("/donate/complete?reference=NDC-ABCDEFGHIJKLMNOPQRST");
    expect(await screen.findByText("We’re confirming your payment with the bank…")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_LIMIT_MS + POLL_MS);
    });
    expect(await screen.findByText("This is taking longer than usual.")).toBeTruthy();
    expect(h.api.mock.calls.length).toBeGreaterThan(5);
  });

  it("offers Try again (prefilled) after a failure", async () => {
    h.api.mockResolvedValue(receipt({ status: "failed", status_label: "Failed" }));
    renderAt("/donate/complete?reference=NDC-ABCDEFGHIJKLMNOPQRST");
    expect(await screen.findByText("No money was taken.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/donate?candidate=amina-bello&amount=5000");
  });
});

describe("receipt", () => {
  it("shows a confirmed receipt with the public label and a privacy note", async () => {
    h.api.mockResolvedValue(receipt());
    renderAt("/donate/receipt/NDC-ABCDEFGHIJKLMNOPQRST");
    expect(await screen.findByRole("heading", { name: "Donation receipt" })).toBeTruthy();
    expect(screen.getByText("Keep this link private; it shows your name.")).toBeTruthy();
    expect(screen.getAllByText("Ada Obi", { selector: "dd" })).toHaveLength(2); // donor + public label
    expect(screen.getByText("Card")).toBeTruthy();
  });

  it("is honest that a pending payment isn't a receipt yet", async () => {
    h.api.mockResolvedValue(receipt({ status: "pending", status_label: "Pending" }));
    renderAt("/donate/receipt/NDC-ABCDEFGHIJKLMNOPQRST");
    expect(await screen.findByText(/This isn’t a receipt yet/)).toBeTruthy();
    expect(screen.queryByText("On the public Finance page as")).toBeNull();
  });
});

// -------------------------------------------------------------------- finance
describe("/finance", () => {
  const rows = [
    { public_label: "Ada Obi", amount_kobo: 500000, designation: "candidate", candidate: { slug: "amina-bello", full_name: "Amina Bello", is_public: true }, paid_on: "2026-11-01" },
    { public_label: "Anonymous Donor", amount_kobo: 100000, designation: "party", candidate: null, paid_on: "2026-10-31" },
    { public_label: "Guest", amount_kobo: 200000, designation: "candidate", candidate: { slug: "old", full_name: "Old Person", is_public: false }, paid_on: "2026-10-30" },
  ];
  const summary = { overall: { total_kobo: 800000, count: 3 }, filtered: { total_kobo: 800000, count: 3 }, party: { total_kobo: 100000, count: 1 },
    candidates: [{ slug: "amina-bello", full_name: "Amina Bello", total_kobo: 500000, count: 1 }] };

  it("lists successful donations with labels, totals and former candidates", async () => {
    h.api.mockImplementation(async (path: string) => (path.startsWith("/finance/summary") ? summary : { count: 3, next: null, previous: null, results: rows }));
    renderAt("/finance");
    expect(await screen.findByText("₦8,000")).toBeTruthy();
    const table = screen.getByRole("table");
    for (const label of ["Ada Obi", "Anonymous Donor", "Guest"]) expect(within(table).getByText(label)).toBeTruthy();
    expect(within(table).getByRole("link", { name: "Amina Bello" }).getAttribute("href")).toBe("/candidates/amina-bello");
    expect(within(table).getByText("NDC general fund")).toBeTruthy();
    expect(within(table).getByText("Former candidate: Old Person")).toBeTruthy();
    expect(screen.getByText(/pending, failed and\s+refunded payments aren’t shown/)).toBeTruthy();
    expect(h.api).toHaveBeenCalledWith("/finance/donations/", expect.objectContaining({ anonymous: true }));
  });

  it("filters by designation in the URL and says when donations are closed", async () => {
    h.config = { ...h.config, open: false };
    h.api.mockImplementation(async (path: string) => (path.startsWith("/finance/summary") ? summary : { count: 0, next: null, previous: null, results: [] }));
    renderAt("/finance");
    expect(screen.getByText("Donations aren’t open yet.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "party" } });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/finance?designation=party"));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/finance/donations/?designation=party", expect.anything()));
  });
});

// ---------------------------------------------------------------------- admin
describe("admin donations", () => {
  const admin = (over = {}) => ({ ...receipt(), id: "11111111-1111-1111-1111-111111111111", provider: "fake", provider_reference: "fake_1",
    review_reason: "", election_year: 2027, donor_email: "ada@example.com", donor_phone: "+2348031234567", donor_state: "lagos",
    donor_address: "12 Allen Avenue", declarations: { own_funds: true, nigerian_source: true, voluntary: true, accepted_at: "2026-11-01T09:00:00Z" },
    donor_user_email: null, refunded_at: null, last_verified_at: null, events: [], ...over });

  it("blocks people without the finance role", () => {
    h.me = { is_system_admin: false, roles: [{ role: "moderator" }] };
    renderAt("/admin/donations");
    expect(screen.getByText("You don’t have access to this page")).toBeTruthy();
    expect(h.api).not.toHaveBeenCalled();
  });

  it("lets a finance officer list, filter and export (as a file download)", async () => {
    h.me = { is_system_admin: false, roles: [{ role: "finance_officer" }] };
    h.api.mockImplementation(async (_path: string, opts?: { responseType?: string }) => {
      if (opts?.responseType === "blob") return new Blob(["reference\n"], { type: "text/csv" });
      return { count: 1, next: null, previous: null, results: [admin()], totals: { successful: { total_kobo: 500000, count: 1 }, review: 2 } };
    });
    const createURL = vi.fn(() => "blob:x");
    Object.assign(URL, { createObjectURL: createURL, revokeObjectURL: vi.fn() });
    renderAt("/admin/donations?status=successful");
    expect(await screen.findByRole("link", { name: "NDC-ABCDEFGHIJKLMNOPQRST" })).toBeTruthy();
    expect(screen.getByText("2 donations need review")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/donations/export.csv?status=successful", { responseType: "blob" }));
    await waitFor(() => expect(createURL).toHaveBeenCalled());
  });

  it("shows the full record, has no manual-success control, and re-checks with the provider", async () => {
    h.me = { is_system_admin: true, roles: [] };
    h.api.mockImplementation(async (_path: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? admin({ status: "successful", status_label: "Successful" }) : admin({ status: "review", status_label: "Under review", review_reason: "amount_or_currency_mismatch" }));
    renderAt("/admin/donations/11111111-1111-1111-1111-111111111111");
    expect(await screen.findByText("The provider reported a different amount or currency.")).toBeTruthy();
    expect(screen.getByText("12 Allen Avenue, lagos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /mark.*successful/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Re-check with provider" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/donations/11111111-1111-1111-1111-111111111111/recheck/", { method: "POST" }));
    expect(await screen.findByText("Checked with the provider: Successful.")).toBeTruthy();
  });
});

describe("Donate in the header (spec 05 §4.7)", () => {
  it("appears in the header and the mobile bar only when given a link", async () => {
    const { SiteHeader } = await import("../components/ui");
    const { rerender } = render(<SiteHeader links={[]} joinHref="/join" donateHref="/donate" />);
    expect(screen.getAllByRole("link", { name: /Donate/ })).toHaveLength(2);
    rerender(<SiteHeader links={[]} joinHref="/join" />);
    expect(screen.queryByRole("link", { name: /Donate/ })).toBeNull();
    expect(screen.getAllByRole("link", { name: "Join NDC" }).length).toBeGreaterThan(0);
  });
});
