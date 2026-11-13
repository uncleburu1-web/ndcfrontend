import { getLanguage, hasOwn, t } from "../i18n";
/**
 * API client — feature-specs/02-authentication.md §7.5.
 *
 * - Every request gets `Authorization: Bearer <Clerk session token>`.
 * - 401 → fetch a FRESH token once and retry. Still 401 → onSessionEnded (banner). No loop.
 * - 403 account_deactivated → onDeactivated (sign out + explanation page).
 * - 403 account_paused (spec 20 §12) → onPaused: the person paused their own account; the app shows the paused screen.
 * - 503 auth_unavailable → onAuthUnavailable (banner); public content keeps working.
 * - 403 reverification_required (spec 14 §4.6) → `withReverification` (Clerk's useReverification prompt), then retry
 *   with a fresh token. Cancelled → ApiError "reverification_cancelled"; nothing was done.
 * - 403 consent_required (spec 14 §4.2) → `onConsentRequired` (the consent dialog). Agreed → retry once; "Not now" →
 *   ApiError "consent_declined"; nothing was done.
 * Errors always surface as ApiError carrying the backend envelope.
 *
 * Transport (spec 15 §15.4):
 * - every request sends an `X-Request-ID`; the server keeps it, so a failure can be quoted as "Reference: 9f2c1a7e"
 *   even when no response arrived. `ApiError.requestId` holds it (the server's header wins when present);
 * - a per-request timeout: 20 s, or 120 s for uploads (FormData bodies) and downloads (`responseType: "blob"`);
 * - one automatic retry for GET on network errors, 502, 503 and 504 (never for writes);
 * - 429 messages say how long to wait, from `retry_after`.
 */

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  fields: Record<string, string[]>;
  request_id?: string;
}

export class ApiError extends Error implements ApiErrorBody {
  status: number;
  code: string;
  fields: Record<string, string[]>;
  /** The request's ID (spec 15 §4.10): quote its first 8 characters as the reference. */
  requestId: string;
  /** Anything else the envelope carried, e.g. `until` (paused) or `rule` (410 removed, spec 13 §4.5). */
  extra: Record<string, unknown>;

  constructor(body: Partial<ApiErrorBody> & Record<string, unknown>) {
    super(body.message ?? "Something went wrong. Please try again.");
    this.status = body.status ?? 0;
    this.code = body.code ?? "error";
    this.fields = body.fields ?? {};
    this.requestId = body.request_id ?? "";
    const { status: _s, code: _c, message: _m, fields: _f, request_id: _r, ...rest } = body;
    void _s; void _c; void _m; void _f; void _r;
    this.extra = rest;
  }

  /** "9f2c1a7e", or "" when there is none. */
  get reference(): string {
    return this.requestId.slice(0, 8);
  }
}

/** Server, timeout and network failures show the reference; other errors are about the request itself. */
export function showsReference(err: ApiError): boolean {
  return Boolean(err.requestId) && (err.status === 0 || err.status >= 500);
}

export const DEFAULT_TIMEOUT_MS = 20_000;
export const LONG_TIMEOUT_MS = 120_000;
const RETRY_STATUSES = new Set([502, 503, 504]);

export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

/** "40 seconds", "3 minutes", "2 hours". */
export function waitWords(seconds: number): string {
  if (seconds < 90) return t("auth.wait.seconds", { n: seconds });
  if (seconds < 90 * 60) return t("auth.wait.minutes", { n: Math.ceil(seconds / 60) });
  return t("auth.wait.hours", { n: Math.ceil(seconds / 3600) });
}

function withReference(message: string, requestId: string): string {
  const ref = requestId.slice(0, 8);
  return ref && !message.includes("Reference:") ? `${message.replace(/\s*$/, "")} Reference: ${ref}.` : message;
}

export type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: GetToken;
  onSessionEnded?: () => void;
  onDeactivated?: () => void;
  /** 403 account_paused (spec 20 §12). */
  onPaused?: () => void;
  onAuthUnavailable?: () => void;
  /** 403 mfa_required on an admin endpoint (spec 14 §4.6): the admin pages show the two-step gate. */
  onMfaRequired?: () => void;
  /** Runs `attempt`; when it resolves to Clerk's reverification hint, prompts and calls it again (useReverification). */
  withReverification?: <T>(attempt: () => Promise<T>) => Promise<T>;
  /** Shows the consent dialog for a `consent_required` error. Resolves true once consent is recorded. */
  onConsentRequired?: (err: ApiError) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  /** Pause before the one GET retry (ms). Tests pass 0. */
  retryDelayMs?: number;
}

export const CANCELLED_REVERIFICATION = "reverification_cancelled";
export const CONSENT_DECLINED = "consent_declined";

/** Clerk's reverification hint, as the backend returns it inside the error envelope. */
export function isReverificationHint(v: unknown): v is { clerk_error: { reason: string } } {
  const e = (v as { clerk_error?: { type?: string; reason?: string } } | null)?.clerk_error;
  return Boolean(e && e.type === "forbidden" && e.reason === "reverification-error");
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Public endpoints: send no token. */
  anonymous?: boolean;
  /** Cancel when the caller no longer needs the response (e.g. filters changed). */
  signal?: AbortSignal;
  /** "blob" for file downloads (e.g. the admin CSV export); default JSON. */
  responseType?: "json" | "blob";
  /** Override the timeout (ms). Defaults: 20 s; 120 s for uploads and downloads. */
  timeoutMs?: number;
}

function networkError(requestId: string) {
  return new ApiError({
    status: 0,
    code: "network_error",
    request_id: requestId,
    message: withReference(t("auth.couldn-t-reach-ndcconnect-check-your"), requestId),
  });
}

function timeoutError(requestId: string) {
  return new ApiError({
    status: 0,
    code: "timeout",
    request_id: requestId,
    message: withReference(t("auth.ndcconnect-is-taking-too-long-to"), requestId),
  });
}

async function readError(res: Response, requestId: string): Promise<ApiError> {
  const rid = res.headers?.get?.("X-Request-ID") || requestId;
  const data = await res.json().catch(() => null);
  let err: ApiError;
  if (data && typeof data === "object" && "error" in data) {
    err = new ApiError({ request_id: rid, ...(data.error as ApiErrorBody & Record<string, unknown>) });
  } else {
    err = new ApiError({ status: res.status, code: "error", request_id: rid,
      message: res.status >= 500 ? t("auth.something-went-wrong-on-our-side") : t("auth.request-failed", { status: res.status }) });
  }
  // Spec 21 §5.5: a translation of the error code wins over the server's words; the server's message (already in the
  // request's language, §6) is the fallback. English keeps the server's specific message.
  if (getLanguage() !== "en" && hasOwn(`errors.${err.code}`)) err.message = t(`errors.${err.code}`, err.extra as Record<string, unknown>);
  if (err.code === "throttled" && typeof err.extra.retry_after === "number") {
    err.message = t("auth.too-many-tries-try-again-in", { waitWords: waitWords(err.extra.retry_after) });
  }
  if (showsReference(err)) err.message = withReference(err.message, err.requestId);
  return err;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = opts.baseUrl.replace(/\/$/, "");
  const retryDelay = opts.retryDelayMs ?? 400;

  async function sendOnce(path: string, options: RequestOptions, token: string | null, requestId: string) {
    const { method = "GET", body, signal } = options;
    const headers: Record<string, string> = { Accept: "application/json", "X-Request-ID": requestId };
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const limit = options.timeoutMs ?? (isForm || options.responseType === "blob" ? LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
    // One controller for both: the caller's cancel (rethrown as AbortError) and our timeout (an ApiError).
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, limit);
    const forward = () => ctl.abort();
    if (signal?.aborted) {
      clearTimeout(timer);
      throw new DOMException("The request was cancelled.", "AbortError");
    }
    signal?.addEventListener("abort", forward, { once: true });
    try {
      return await doFetch(`${base}${path}`, {
        method,
        headers,
        signal: ctl.signal,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch (err) {
      if (timedOut) throw timeoutError(requestId);
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) throw err;
      throw networkError(requestId);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", forward);
    }
  }

  /** GETs get one more try on a network error, 502, 503 or 504; writes never do (spec 15 §15.4). */
  async function send(path: string, options: RequestOptions, token: string | null, requestId: string) {
    const canRetry = (options.method ?? "GET") === "GET";
    try {
      const res = await sendOnce(path, options, token, requestId);
      if (!canRetry || !RETRY_STATUSES.has(res.status)) return res;
    } catch (err) {
      if (!canRetry || !(err instanceof ApiError) || err.code !== "network_error") throw err;
    }
    if (retryDelay) await new Promise((r) => setTimeout(r, retryDelay));
    return sendOnce(path, options, token, requestId);
  }

  async function core<T>(path: string, options: RequestOptions, fresh: boolean): Promise<T> {
    const requestId = newRequestId();
    let token = options.anonymous ? null : await opts.getToken(fresh ? { skipCache: true } : undefined);
    let res = await send(path, options, token, requestId);

    if (res.status === 401 && !options.anonymous) {
      // One retry with a freshly minted token (the cached one may have just expired).
      token = await opts.getToken({ skipCache: true });
      if (token) res = await send(path, options, token, requestId);
      if (res.status === 401 || !token) {
        opts.onSessionEnded?.();
        throw await readError(res, requestId);
      }
    }

    if (!res.ok) {
      const err = await readError(res, requestId);
      if (err.status === 403 && err.code === "account_deactivated") opts.onDeactivated?.();
      if (err.status === 403 && err.code === "account_paused") opts.onPaused?.();
      if (err.status === 503 && err.code === "auth_unavailable" && !path.startsWith("/me/delete/")) opts.onAuthUnavailable?.();
      if (err.status === 403 && err.code === "mfa_required") opts.onMfaRequired?.();
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (options.responseType === "blob" ? await res.blob() : await res.json()) as T;
  }

  async function reverified<T>(path: string, options: RequestOptions, first: ApiError): Promise<T> {
    const attempt = async () => {
      try {
        return await core<T>(path, options, true);
      } catch (e) {
        if (e instanceof ApiError && e.code === "reverification_required") return e.extra as unknown as T; // the hint
        throw e;
      }
    };
    let result: T;
    try {
      result = await opts.withReverification!(attempt);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError({ status: 403, code: CANCELLED_REVERIFICATION, message: t("auth.cancelled-nothing-was-done") });
    }
    if (isReverificationHint(result)) throw first;
    return result;
  }

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await core<T>(path, options, false);
    } catch (err) {
      if (!(err instanceof ApiError) || options.anonymous) throw err;
      if (err.code === "reverification_required" && opts.withReverification) return reverified<T>(path, options, err);
      if (err.code === "consent_required" && opts.onConsentRequired) {
        if (!(await opts.onConsentRequired(err))) {
          throw new ApiError({ status: 403, code: CONSENT_DECLINED, message: t("auth.nothing-was-changed") });
        }
        try {
          return await core<T>(path, options, false);
        } catch (again) {
          if (again instanceof ApiError && again.code === "reverification_required" && opts.withReverification) {
            return reverified<T>(path, options, again);
          }
          throw again;
        }
      }
      throw err;
    }
  };
}

export type ApiRequest = ReturnType<typeof createApiClient>;
