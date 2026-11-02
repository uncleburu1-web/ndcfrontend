import { ApiError } from "../auth/api";

/** Admins linked to a candidate can't moderate that candidate's posts (spec 09 §6). */
export function moderationError(err: unknown) {
  if (err instanceof ApiError && err.code === "self_moderation") return "You’re linked to this candidate, so another admin has to act on this post.";
  return err instanceof ApiError ? err.message : "That didn’t work.";
}
