/** Attribution + category for an article — official vs community, never by colour alone (01 §6.6). */
import { AttributionBadge } from "../components/ui";
import type { ArticleSummary } from "./types";
import { t } from "../i18n";

export function SourceBadges({ a }: { a: Pick<ArticleSummary, "source" | "category_label" | "pinned"> & { showPinned?: boolean } }) {
  return (
    <span className="article-badges">
      <AttributionBadge source={a.source === "official" ? "official" : "user"} />
      {a.source === "official" && a.category_label && <span className="article-category">{a.category_label}</span>}
      {a.pinned && <span className="article-pinned">{t("news.pinned")}</span>}
    </span>
  );
}
