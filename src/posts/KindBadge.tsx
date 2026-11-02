import type { PostKind } from "./types";
import "./posts.css";

export function KindBadge({ kind, label }: { kind: PostKind; label?: string }) {
  return <span className={`post-kind post-kind--${kind}`}>{label ?? (kind === "announcement" ? "Announcement" : "News")}</span>;
}
