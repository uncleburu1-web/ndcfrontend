/**
 * API client — feature-specs/02-authentication.md §7.5.
 *
 * - Every request gets `Authorization: Bearer <Clerk session token>`.
 * - 401 → fetch a FRESH token once and retry. Still 401 → onSessionEnded (banner). No loop.
 * - 403 account_deactivated → onDeactivated (sign out + explanation page).
 * - 503 auth_unavailable → onAuthUnavailable (banner); public content keeps working.
 * - 403 reverification_required (spec 14 §4.6) → `withReverification` (Clerk's useReverification prompt), then retry
 *   with a fresh token. Cancelled → ApiError "reverification_cancelled"; nothing was done.
 * - 403 consent_required (spec 14 §4.2) → `onConsentRequired` (the consent dialog). Agreed → retry once; "Not now" →
 *   ApiError "consent_declined"; nothing was done.
 * Errors always surface as ApiError carrying the backend envelope.
 */

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  fields: Record<string, string[]>;
}

export class ApiError extends Error implements ApiErrorBody {
  status: number;
  code: string;
  fields: Record<string, string[]>;
  /** Anything else the envelope carried, e.g. `until` (paused) or `rule` (410 removed, spec 13 §4.5). */
  extra: Record<string, unknown>;

  constructor(body: Partial<ApiErrorBody> & Record<string, unknown>) {
    super(body.message ?? "Something went wrong. Please try again.");
    this.status = body.status ?? 0;
    this.code = body.code ?? "error";
    this.fields = body.fields ?? {};
    const { status: _s, code: _c, message: _m, fields: _f, ...rest } = body;
    void _s; void _c; void _m; void _f;
    this.extra = rest;
  }
}

export type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: GetToken;
  onSessionEnded?: () => void;
  onDeactivated?: () => void;
  onAuthUnavailable?: () => void;
  /** 403 mfa_required on an admin endpoint (spec 14 §4.6): the admin pages show the two-step gate. */
  onMfaRequired?: () => void;
  /** Runs `attempt`; when it resolves to Clerk's reverification hint, prompts and calls it again (useReverification). */
  withReverification?: <T>(attempt: () => Promise<T>) => Promise<T>;
  /** Shows the consent dialog for a `consent_required` error. Resolves true once consent is recorded. */
  onConsentRequired?: (err: ApiError) => Promise<boolean>;
  fetchImpl?: typeof fetch;
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
}

const NETWORK_ERROR = new ApiError({
  status: 0,
  code: "network_error",
  message: "Couldn't reach NDCConnect. Check your connection and try again.",
});

async function readError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  if (data && typeof data === "object" && "error" in data) return new ApiError(data.error as ApiErrorBody & Record<string, unknown>);
  return new ApiError({ status: res.status, code: "error", message: `Request failed (${res.status}).` });
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = opts.baseUrl.replace(/\/$/, "");

  async function send(path: string, { method = "GET", body, signal }: RequestOptions, token: string | null) {
    const headers: Record<string, string> = { Accept: "application/json" };
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      return await doFetch(`${base}${path}`, {
        method,
        headers,
        signal,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw NETWORK_ERROR;
    }
  }

  async function core<T>(path: string, options: RequestOptions, fresh: boolean): Promise<T> {
    let token = options.anonymous ? null : await opts.getToken(fresh ? { skipCache: true } : undefined);
    let res = await send(path, options, token);

    if (res.status === 401 && !options.anonymous) {
      // One retry with a freshly minted token (the cached one may have just expired).
      token = await opts.getToken({ skipCache: true });
      if (token) res = await send(path, options, token);
      if (res.status === 401 || !token) {
        opts.onSessionEnded?.();
        throw await readError(res);
      }
    }

    if (!res.ok) {
      const err = await readError(res);
      if (err.status === 403 && err.code === "account_deactivated") opts.onDeactivated?.();
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
      throw new ApiError({ status: 403, code: CANCELLED_REVERIFICATION, message: "Cancelled. Nothing was done." });
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
          throw new ApiError({ status: 403, code: CONSENT_DECLINED, message: "Nothing was changed." });
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
