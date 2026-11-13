import type { PostKind } from "./types";
import "./posts.css";
import { t } from "../i18n";

export function KindBadge({ kind, label }: { kind: PostKind; label?: string }) {
  return <span className={`post-kind post-kind--${kind}`}>{label ?? (kind === "announcement" ? t("posts.announcement") : t("posts.news"))}</span>;
}
