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
  const api = createApiClient({ baseUrl: "https://api.test/v1/", getToken, fetchImpl: fetchImpl as unknown as typeof fetch, ...handlers });
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
    const { api, onAuthUnavailable } = setup([envelope(503, "auth_unavailable")]);
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
