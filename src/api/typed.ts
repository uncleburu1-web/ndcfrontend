/**
 * Typed API calls from the generated OpenAPI types (spec 15 §14.3). New code uses these; hand-written types are
 * replaced area by area as each area is next changed.
 *
 *   const page = await apiGet(api, "/me/notifications/");              // typed as the NotificationPage schema
 *   const sig = await apiPost(api, "/media/upload-signature/", body);  // body and answer typed
 *   type N = Schema<"Notification">;
 */
import type { ApiRequest, RequestOptions } from "../auth/api";
import type { components, paths } from "./schema";

export type Schema<N extends keyof components["schemas"]> = components["schemas"][N];

type Strip<P> = P extends `/api/v1${infer R}` ? R : never;
type Full<P extends string> = `/api/v1${P}` & keyof paths;
type Json<T> = T extends { content: { "application/json": infer R } } ? R : never;
type Ok<Op> = Op extends { responses: infer R }
  ? Json<R extends { 200: infer A } ? A : R extends { 201: infer B } ? B : never>
  : never;
type Body<Op> = Op extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;

export type GetPath = { [P in keyof paths]: paths[P] extends { get: object } ? Strip<P> : never }[keyof paths];
export type PostPath = { [P in keyof paths]: paths[P] extends { post: object } ? Strip<P> : never }[keyof paths];
export type GetResponse<P extends GetPath> = Ok<paths[Full<P>]["get"]>;
export type PostResponse<P extends PostPath> = Ok<paths[Full<P>]["post"]>;
export type PostBody<P extends PostPath> = Body<paths[Full<P>]["post"]>;

/** Fill `{slug}`-style placeholders: fill("/candidates/{slug}/", { slug: "amina" }). */
export function fill(path: string, params: Record<string, string | number> = {}): string {
  return path.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(params[k] ?? "")));
}

export function apiGet<P extends GetPath>(api: ApiRequest, path: P, params?: Record<string, string | number>,
  options: Omit<RequestOptions, "method" | "body"> = {}): Promise<GetResponse<P>> {
  return api<GetResponse<P>>(fill(path, params), options);
}

export function apiPost<P extends PostPath>(api: ApiRequest, path: P, body?: PostBody<P>, params?: Record<string, string | number>,
  options: Omit<RequestOptions, "method" | "body"> = {}): Promise<PostResponse<P>> {
  return api<PostResponse<P>>(fill(path, params), { ...options, method: "POST", body });
}
