/** Spec 15 §16 (frontend): uploads, error references, srcset, new notification kinds and /admin/integrations. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../auth/api";
import { Avatar, Banner, ToastProvider } from "../components/ui";

const h = vi.hoisted(() => ({ api: vi.fn(), me: null as null | Record<string, unknown> }));
vi.mock("@clerk/react", async () => (await import("../test/clerkMock")).clerkMockModule);
vi.mock("../auth/session", () => ({
  useApi: () => h.api,
  useMe: () => ({ me: h.me, status: h.me ? "ready" : "idle", error: null, setMe: vi.fn(), refresh: vi.fn() }),
  useSessionIssue: () => ({ issue: null, clearIssue: vi.fn() }),
}));

import { ArticleImage } from "../news/ArticleImage";
import AdminIntegrationsPage, { serviceWords } from "../pages/admin/integrations/AdminIntegrationsPage";
import { describe as describeNotification, type NotificationItem } from "../pages/news/NotificationsPage";
import { checkImage, uploadImage } from "./useImageUpload";

const file = (type = "image/jpeg", size = 1000, name = "p.jpg") => new File([new Uint8Array(size)], name, { type });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------- uploads
class FakeXHR {
  static last: FakeXHR | null = null;
  static respond: { status: number; body: unknown } = { status: 200, body: {} };
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  timeout = 0;
  status = 0;
  responseText = "";
  url = "";
  sent: FormData | null = null;
  open(_m: string, url: string) { this.url = url; }
  send(body: FormData) {
    FakeXHR.last = this;
    this.sent = body;
    this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    this.status = FakeXHR.respond.status;
    this.responseText = JSON.stringify(FakeXHR.respond.body);
    queueMicrotask(() => this.onload?.());
  }
}

const SIG = { mode: "direct", upload_url: "https://api.cloudinary.com/v1_1/ndc/image/upload", api_key: "123", timestamp: 1730000000,
  public_id: "ndcconnect/dev/post_image/abc", upload_preset: "ndcconnect_signed", allowed_formats: "jpg,png,webp", signature: "sig" };

describe("uploadImage", () => {
  beforeEach(() => {
    vi.stubGlobal("XMLHttpRequest", FakeXHR as unknown as typeof XMLHttpRequest);
    FakeXHR.last = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("checks type and size before anything is sent", async () => {
    expect(checkImage(file("application/pdf", 10, "x.jpg"))?.message).toContain("JPEG, PNG or WebP");
    expect(checkImage(file("image/png", 6 * 1024 * 1024))?.message).toContain("5 MB");
    expect(checkImage(file("image/webp"))).toBeNull();
    const api = vi.fn();
    await expect(uploadImage(api, "post_image", file("image/gif"), { targetId: "p1", url: "/x/", field: "image" })).rejects.toBeInstanceOf(ApiError);
    expect(api).not.toHaveBeenCalled();
  });

  it("server mode: multipart to the image endpoint, as before", async () => {
    const api = vi.fn().mockResolvedValueOnce({ mode: "server" }).mockResolvedValueOnce({ id: "p1" });
    const r = await uploadImage<{ id: string }>(api, "post_image", file(), { targetId: "p1", url: "/campaign/x/image/", field: "image" });
    expect(r).toEqual({ id: "p1" });
    expect(api.mock.calls[0]).toEqual(["/media/upload-signature/", { method: "POST", body: { purpose: "post_image", target_id: "p1" } }]);
    const [url, opts] = api.mock.calls[1];
    expect(url).toBe("/campaign/x/image/");
    expect((opts.body as FormData).get("image")).toBeInstanceOf(File);
    expect((opts.body as FormData).get("rights_confirmed")).toBe("true");
    expect(FakeXHR.last).toBeNull();
  });

  it("signed mode: straight to Cloudinary with progress, then the asset to Django", async () => {
    FakeXHR.respond = { status: 200, body: { public_id: SIG.public_id, version: 17, signature: "resp-sig", secure_url: "https://res/..." } };
    const api = vi.fn().mockResolvedValueOnce(SIG).mockResolvedValueOnce({ id: "p1" });
    const progress: number[] = [];
    await uploadImage(api, "post_image", file(), { targetId: "p1", url: "/campaign/x/image/", field: "image" }, (p) => progress.push(p));
    expect(FakeXHR.last?.url).toBe(SIG.upload_url);
    const sent = FakeXHR.last!.sent!;
    expect([sent.get("api_key"), sent.get("signature"), sent.get("public_id"), sent.get("upload_preset")]).toEqual(["123", "sig", SIG.public_id, "ndcconnect_signed"]);
    expect(sent.get("api_secret")).toBeNull();
    expect(progress).toEqual([50, 100]);
    expect(api.mock.calls[1]).toEqual(["/campaign/x/image/", { method: "PUT",
      body: { asset: { public_id: SIG.public_id, version: 17, signature: "resp-sig" }, rights_confirmed: true } }]);
  });

  it("a Cloudinary failure leaves the form usable, with a reference", async () => {
    FakeXHR.respond = { status: 500, body: {} };
    const api = vi.fn().mockResolvedValueOnce(SIG);
    const err = (await uploadImage(api, "post_image", file(), { targetId: "p1", url: "/x/", field: "image" }).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe("media_unavailable");
    expect(err.message).toMatch(/isn’t working right now\. Reference: [0-9a-f]{8}\./);
    expect(api).toHaveBeenCalledTimes(1); // nothing linked
  });
});

// ---------------------------------------------------------------- error references
describe("error references", () => {
  it("banners show the reference with a Copy button", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    render(<Banner tone="error">Something went wrong on our side. Reference: 9f2c1a7e.</Banner>);
    expect(screen.getByText(/Something went wrong on our side\./)).toBeTruthy();
    expect(screen.getByText("9f2c1a7e").tagName).toBe("CODE");
    fireEvent.click(screen.getByRole("button", { name: "Copy reference 9f2c1a7e" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("9f2c1a7e"));
    expect(await screen.findByText("Copied")).toBeTruthy();
  });

  it("ordinary messages are untouched", () => {
    render(<Banner tone="error">Check the highlighted fields.</Banner>);
    expect(screen.queryByRole("button", { name: /Copy reference/ })).toBeNull();
  });
});

// ---------------------------------------------------------------- srcset
describe("responsive images", () => {
  it("avatars and article images pass srcset and sizes", () => {
    const { container } = render(<>
      <Avatar name="Amina Bello" src="https://res/x_800" srcSet="https://res/a 200w, https://res/b 400w, https://res/c 800w" size="lg" />
      <ArticleImage image={{ url_thumb: "https://res/t", url: "https://res/f", width: 1200, height: 675, srcset: "https://res/w400 400w, https://res/w800 800w" }} />
    </>);
    const [avatar, article] = Array.from(container.querySelectorAll("img"));
    expect(avatar.getAttribute("srcset")).toContain("800w");
    expect(avatar.getAttribute("sizes")).toBe("96px");
    expect(article.getAttribute("srcset")).toContain("400w");
    expect(article.getAttribute("sizes")).toContain("100vw");
  });
});

// ---------------------------------------------------------------- notifications
describe("new notification kinds", () => {
  const base = { id: "n1", created_at: "2026-11-04T10:00:00Z", read_at: null, article: null } as const;
  it("membership decisions and donation receipts, in words, with links", () => {
    const m = describeNotification({ ...base, kind: "membership_decision", decision: "approved", membership: { status: "active" } } as NotificationItem);
    expect(m).toMatchObject({ text: "Your NDC membership was approved. Welcome!", href: "/membership/card" });
    const r = describeNotification({ ...base, kind: "membership_decision", decision: "rejected", membership: { status: "rejected" } } as NotificationItem);
    expect(r.href).toBe("/join");
    const d = describeNotification({ ...base, kind: "donation_receipt", decision: "received", donation: { reference: "NDC-ABC123" } } as NotificationItem);
    expect(d).toMatchObject({ href: "/donate/receipt/NDC-ABC123" });
    expect(d.text).toContain("NDC-ABC123");
    expect(d.text).not.toMatch(/₦|\d{3,},/);
  });
});

// ---------------------------------------------------------------- /admin/integrations
const OVERVIEW = {
  generated_at: "2026-11-04T13:05:00Z",
  services: [
    { key: "clerk", name: "Clerk", purpose: "Sign-in", settings: ["CLERK_SECRET_KEY"], timeouts: "connect 3 s, read 5 s", data_sent: "IDs",
      in_use: true, configured: true, state: "ok", last_success: new Date(Date.now() - 120_000).toISOString(), last_failure: null, last_reason: "", circuit_open: false },
    { key: "paystack", name: "Paystack", purpose: "Payments", settings: ["PAYSTACK_SECRET_KEY"], timeouts: "connect 3 s, read 10 s", data_sent: "Email",
      in_use: true, configured: true, state: "unavailable", last_success: null, last_failure: "2026-11-04T13:05:00Z", last_reason: "TimeoutError", circuit_open: true },
    { key: "cloudinary", name: "Cloudinary", purpose: "Images", settings: ["CLOUDINARY_API_SECRET"], timeouts: "connect 3 s", data_sent: "Images",
      in_use: false, configured: false, state: "not_in_use", last_success: null, last_failure: null, last_reason: "", circuit_open: false },
  ],
  webhooks: [{ provider: "paystack", processed: 4, ignored: 1, failed: 1, bad_signatures: 2 }],
  outbox: { pending: 2, failed: 1, oldest_due_at: null, oldest_due_age_s: 0, oldest_failed_at: null, failed_by_kind: { media_destroy: 1 }, stuck: false },
};
const JOB = { id: "j1", kind: "media_destroy", status: "failed", attempts: 6, max_attempts: 6, next_attempt_at: "2026-11-04T12:00:00Z",
  last_error: "ProviderUnavailable: cloudinary unavailable", request_id: "abcd1234ef", created_at: "2026-11-03T12:00:00Z",
  finished_at: "2026-11-04T12:00:00Z", stuck: false };

function routes(map: Record<string, unknown>) {
  h.api.mockImplementation(async (path: string, opts: Record<string, unknown> = {}) => {
    const key = `${(opts.method as string) ?? "GET"} ${path.split("?")[0]}`;
    const v = typeof map[key] === "function" ? (map[key] as (o: unknown, p: string) => unknown)(opts, path) : map[key];
    if (v === undefined) throw new ApiError({ status: 404, message: `unmocked ${key}` });
    if (v instanceof Error) throw v;
    return v;
  });
}

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/admin/integrations"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/admin/integrations" element={<AdminIntegrationsPage />} /></Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("/admin/integrations", () => {
  beforeEach(() => {
    h.me = { full_name: "Sam", is_system_admin: true, admin_areas: ["overview", "audit", "integrations"] };
  });

  it("states each service in words, never settings values", async () => {
    routes({
      "GET /admin/integrations/": OVERVIEW,
      "GET /admin/integrations/outbox/": { count: 1, next: null, previous: null, results: [JOB] },
      "GET /admin/integrations/webhooks/": { count: 0, next: null, previous: null, results: [] },
    });
    renderPage();
    expect(await screen.findByText(/working, last checked 2 min ago/)).toBeTruthy();
    expect(screen.getByText(/unavailable since/)).toBeTruthy();
    expect(screen.getByText(/not in use here/)).toBeTruthy();
    expect(screen.getByText("Some background tasks failed")).toBeTruthy();
    expect(screen.getByText(/4 processed · 1 ignored · 1 failed · 2 with a bad signature/)).toBeTruthy();
    expect(await screen.findByText("Image clean-up")).toBeTruthy();
    expect(screen.getByText(/reference abcd1234/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Integrations" }).getAttribute("aria-current")).toBe("page");
  });

  it("retry goes through the reverifying client and refreshes", async () => {
    let retried = 0;
    routes({
      "GET /admin/integrations/": OVERVIEW,
      "GET /admin/integrations/outbox/": () => ({ count: retried ? 0 : 1, next: null, previous: null, results: retried ? [] : [JOB] }),
      "GET /admin/integrations/webhooks/": { count: 0, next: null, previous: null, results: [] },
      "POST /admin/integrations/outbox/j1/retry/": () => { retried += 1; return { ...JOB, status: "pending", attempts: 0 }; },
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Image clean-up: queued to run again.")).toBeTruthy();
    expect(retried).toBe(1);
    expect(await screen.findByText("No failed tasks")).toBeTruthy();
  });

  it("a cancelled reverification changes nothing and says nothing", async () => {
    routes({
      "GET /admin/integrations/": OVERVIEW,
      "GET /admin/integrations/outbox/": { count: 1, next: null, previous: null, results: [JOB] },
      "GET /admin/integrations/webhooks/": { count: 0, next: null, previous: null, results: [] },
      "POST /admin/integrations/outbox/j1/retry/": new ApiError({ status: 403, code: "reverification_cancelled", message: "Cancelled. Nothing was done." }),
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(h.api).toHaveBeenCalledWith("/admin/integrations/outbox/j1/retry/", expect.objectContaining({ method: "POST" })));
    expect(screen.queryByText(/Cancelled/)).toBeNull();
  });

  it("serviceWords covers every state", () => {
    const s = OVERVIEW.services[0];
    expect(serviceWords({ ...s, state: "failing", last_failure: "2026-11-04T13:05:00Z", last_reason: "HTTP 503" }).text).toContain("HTTP 503");
    expect(serviceWords({ ...s, state: "not_configured" }).text).toContain("settings are missing");
  });
});
