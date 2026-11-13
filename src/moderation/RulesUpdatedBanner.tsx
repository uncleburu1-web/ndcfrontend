/** One-time "rules updated" banner for signed-in users, remembered per rules version (spec 13 §4.1, §8.1). */
import { Show } from "@clerk/react";
import { Link, useLocation } from "react-router-dom";
import { Banner } from "../components/ui";
import { formatDate } from "../lib/format";
import { useRules } from "./rules";
import { t } from "../i18n";

function Inner() {
  const { rules } = useRules();
  const path = useLocation().pathname;
  if (!rules || path === "/rules") return null;
  return (
    <div className="app-banner">
      <Banner tone="info" dismissKey={`rules-v${rules.version}`}>
        {t.rich("moderation.our-community-rules-were-updated-on", { formatDate: formatDate(rules.updated), link: (chunks) => <Link to="/rules">{chunks}</Link> })}</Banner>
    </div>
  );
}

export function RulesUpdatedBanner() {
  return (
    <Show when="signed-in">
      <Inner />
    </Show>
  );
}
