/**
 * API client — feature-specs/02-authentication.md §7.5.
 *
 * - Every request gets `Authorization: Bearer <Clerk session token>`.
 * - 401 → fetch a FRESH token once and retry. Still 401 → onSessionEnded (banner). No loop.
 * - 403 account_deactivated → onDeactivated (sign out + explanation page).
 * - 503 auth_unavailable → onAuthUnavailable (banner); public content keeps working.
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

  constructor(body: Partial<ApiErrorBody>) {
    super(body.message ?? "Something went wrong. Please try again.");
    this.status = body.status ?? 0;
    this.code = body.code ?? "error";
    this.fields = body.fields ?? {};
  }
}

export type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export interface ApiClientOptions {
  baseUrl: string;
  getToken: GetToken;
  onSessionEnded?: () => void;
  onDeactivated?: () => void;
  onAuthUnavailable?: () => void;
  fetchImpl?: typeof fetch;
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
  if (data && typeof data === "object" && "error" in data) return new ApiError(data.error as ApiErrorBody);
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

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let token = options.anonymous ? null : await opts.getToken();
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
      if (err.status === 503 && err.code === "auth_unavailable") opts.onAuthUnavailable?.();
      throw err;
    }
    if (res.status === 204) return undefined as T;
    return (options.responseType === "blob" ? await res.blob() : await res.json()) as T;
  };
}

export type ApiRequest = ReturnType<typeof createApiClient>;
