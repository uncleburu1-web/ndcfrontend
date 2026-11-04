/** API client — spec §7.5, §12. */
import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const envelope = (status: number, code: string, message = "x") => json(status, { error: { status, code, message, fields: {} } });

function setup(responses: Response[], tokens: (string | null)[] = ["tok-1", "tok-2"]) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift()!);
  const getToken = vi.fn(async () => tokens.shift() ?? null);
  const handlers = { onSessionEnded: vi.fn(), onDeactivated: vi.fn(), onAuthUnavailable: vi.fn() };
  const api = createApiClient({ baseUrl: "https://api.test/v1/", getToken, fetchImpl: fetchImpl as unknown as typeof fetch, retryDelayMs: 0,
    ...handlers });
  return { api, fetchImpl, getToken, ...handlers };
}

const authHeader = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

describe("createApiClient", () => {
  it("attaches the Clerk session token as a Bearer header", async () => {
    const { api, fetchImpl } = setup([json(200, { ok: true })]);
    await expect(api("/me/")).resolves.toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.test/v1/me/");
    expect(authHeader(fetchImpl.mock.calls[0])).toBe("Bearer tok-1");
  });

  it("sends JSON bodies for PATCH", async () => {
    const { api, fetchImpl } = setup([json(200, {})]);
    await api("/me/", { method: "PATCH", body: { full_name: "Ada Obi" } });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ full_name: "Ada Obi" }));
  });

  it("on 401 fetches a fresh token once and retries", async () => {
    const { api, fetchImpl, getToken, onSessionEnded } = setup([envelope(401, "not_authenticated"), json(200, { ok: 1 })]);
    await expect(api("/me/")).resolves.toEqual({ ok: 1 });
    expect(getToken).toHaveBeenNthCalledWith(2, { skipCache: true });
    expect(authHeader(fetchImpl.mock.calls[1])).toBe("Bearer tok-2");
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("gives up after one retry and reports the session as ended — no loop", async () => {
    const { api, fetchImpl, onSessionEnded } = setup([envelope(401, "not_authenticated"), envelope(401, "not_authenticated")]);
    await expect(api("/me/")).rejects.toMatchObject({ status: 401, code: "not_authenticated" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onSessionEnded).toHaveBeenCalledOnce();
  });

  it("reports the session ended when no fresh token can be minted", async () => {
    const { api, fetchImpl, onSessionEnded } = setup([envelope(401, "not_authenticated")], ["tok-1", null]);
    await expect(api("/me/")).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onSessionEnded).toHaveBeenCalledOnce();
  });

  it("handles 403 account_deactivated", async () => {
    const { api, onDeactivated } = setup([envelope(403, "account_deactivated")]);
    await expect(api("/me/")).rejects.toMatchObject({ code: "account_deactivated" });
    expect(onDeactivated).toHaveBeenCalledOnce();
  });

  it("handles 503 auth_unavailable", async () => {
    const { api, onAuthUnavailable } = setup([envelope(503, "auth_unavailable"), envelope(503, "auth_unavailable")]);  // a GET retries once
    await expect(api("/me/")).rejects.toMatchObject({ code: "auth_unavailable" });
    expect(onAuthUnavailable).toHaveBeenCalledOnce();
  });

  it("surfaces validation fields from the envelope", async () => {
    const { api } = setup([json(400, { error: { status: 400, code: "validation_error", message: "Fix it", fields: { phone_number: ["Bad"] } } })]);
    await expect(api("/me/", { method: "PATCH", body: {} })).rejects.toMatchObject({ fields: { phone_number: ["Bad"] } });
  });

  it("anonymous requests send no token and never retry", async () => {
    const { api, fetchImpl, getToken } = setup([envelope(401, "not_authenticated")]);
    await expect(api("/health/", { anonymous: true })).rejects.toBeInstanceOf(ApiError);
    expect(getToken).not.toHaveBeenCalled();
    expect(authHeader(fetchImpl.mock.calls[0])).toBeUndefined();
  });

  it("turns network failures into a readable ApiError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const api = createApiClient({ baseUrl: "https://api.test", getToken: async () => "t", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(api("/me/")).rejects.toMatchObject({ code: "network_error" });
  });
});

describe("transport (spec 15 §15.4)", () => {
  const mkApi = (fetchImpl: ReturnType<typeof vi.fn>, extra = {}) =>
    createApiClient({ baseUrl: "https://api.test", getToken: async () => "t", fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0, ...extra });

  it("sends an X-Request-ID and quotes it as the reference on network failures", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const err = (await mkApi(fetchImpl)("/me/", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;
    const sent = ((fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit).headers as Record<string, string>;
    expect(sent["X-Request-ID"]).toMatch(/^[0-9a-f]{32}$/);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.requestId).toBe(sent["X-Request-ID"]);
    expect(err.message).toContain(`Reference: ${sent["X-Request-ID"].slice(0, 8)}.`);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // POST: never retried
  });

  it("prefers the server's request ID and shows it on 5xx only", async () => {
    const res500 = new Response(JSON.stringify({ error: { status: 500, code: "server_error", message: "Something went wrong on our side.", fields: {} } }),
      { status: 500, headers: { "Content-Type": "application/json", "X-Request-ID": "abcdef1234567890" } });
    const err = (await mkApi(vi.fn(async () => res500))("/me/", { method: "PATCH", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err.reference).toBe("abcdef12");
    expect(err.message).toBe("Something went wrong on our side. Reference: abcdef12.");
    const err400 = (await mkApi(vi.fn(async () => envelope(400, "validation_error", "Fix it")))("/me/", { method: "PATCH", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(err400.message).toBe("Fix it");
  });

  it("retries a GET once on 503 but never a POST", async () => {
    const get = vi.fn().mockResolvedValueOnce(envelope(503, "media_unavailable")).mockResolvedValueOnce(json(200, { ok: 1 }));
    await expect(mkApi(get)("/x/")).resolves.toEqual({ ok: 1 });
    expect(get).toHaveBeenCalledTimes(2);
    const ids = get.mock.calls.map((c) => ((c[1] as RequestInit).headers as Record<string, string>)["X-Request-ID"]);
    expect(ids[0]).toBe(ids[1]); // the same reference for both tries
    const post = vi.fn().mockResolvedValue(envelope(503, "media_unavailable"));
    await expect(mkApi(post)("/x/", { method: "POST", body: {} })).rejects.toMatchObject({ code: "media_unavailable" });
    expect(post).toHaveBeenCalledTimes(1);
    const twice = vi.fn().mockResolvedValue(envelope(502, "error"));
    await expect(mkApi(twice)("/x/")).rejects.toMatchObject({ status: 502 });
    expect(twice).toHaveBeenCalledTimes(2); // only one retry
  });

  it("says how long to wait on 429", async () => {
    const r = json(429, { error: { status: 429, code: "throttled", message: "x", fields: {}, retry_after: 40 } });
    await expect(mkApi(vi.fn(async () => r))("/x/", { method: "POST", body: {} })).rejects.toMatchObject({
      message: "Too many tries. Try again in 40 seconds." });
    const r2 = json(429, { error: { status: 429, code: "throttled", message: "x", fields: {}, retry_after: 600 } });
    await expect(mkApi(vi.fn(async () => r2))("/x/", { method: "POST", body: {} })).rejects.toMatchObject({
      message: "Too many tries. Try again in 10 minutes." });
  });

  it("times out with a reference, and longer for uploads", async () => {
    vi.useFakeTimers();
    try {
      const hang = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
      const api = mkApi(hang);
      const p = api("/slow/", { method: "POST", body: {} }).catch((e: ApiError) => e);
      await vi.advanceTimersByTimeAsync(20_001);
      const err = (await p) as ApiError;
      expect(err).toMatchObject({ code: "timeout" });
      expect(err.message).toMatch(/taking too long.*Reference: [0-9a-f]{8}\./);
      const form = new FormData();
      const up = api("/upload/", { method: "PUT", body: form }).catch((e: ApiError) => e);
      await vi.advanceTimersByTimeAsync(20_001);
      let settled = false;
      void up.then(() => { settled = true; });
      await Promise.resolve();
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(100_000);
      expect(await up).toMatchObject({ code: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("a caller's cancel is still an AbortError", async () => {
    const hang = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const ctl = new AbortController();
    const p = mkApi(hang)("/x/", { signal: ctl.signal }).catch((e: ApiError) => e);
    ctl.abort();
    const err = await p;
    expect(err).toBeInstanceOf(DOMException);
    expect(hang.mock.calls.length).toBeLessThanOrEqual(1); // cancelled before or during the fetch; never retried
  });
});
