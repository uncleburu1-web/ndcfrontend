import { ApiError } from "../auth/api";
import { t } from "../i18n";

/** Admins linked to a candidate can't moderate that candidate's posts (spec 09 §6). */
export function moderationError(err: unknown) {
  if (err instanceof ApiError && err.code === "self_moderation") return t("posts.you-re-linked-to-this-candidate");
  return err instanceof ApiError ? err.message : t("posts.that-didn-t-work");
}
