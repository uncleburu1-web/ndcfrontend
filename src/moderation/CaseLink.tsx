/** "Reports: open the case" — 07/09's admin detail pages point at the moderation case instead of listing reports (spec 13 §8.2). */
import { Link } from "react-router-dom";
import { Select, StatusBadge } from "../components/ui";
import { ruleOptions, useRules } from "./rules";
import type { CaseSummary } from "./types";
import { t } from "../i18n";

export function CaseLink({ c }: { c: CaseSummary | null | undefined }) {
  if (!c) return <p className="ds-field__hint">{t("moderation.no-reports")}</p>;
  return (
    <p>
      <StatusBadge set="case" status={c.status === "closed" && c.decision ? c.decision : c.status} />{" "}
      {c.open_reports ? t("moderation.open-of-reports", { open_reports: c.open_reports, reports: c.reports }) : t("moderation.report", { reports: c.reports, v: c.reports === 1 ? "" : "s" })}
      {" · "}<Link to={`/admin/moderation/${c.id}`}>{t("moderation.reports-open-the-case")}</Link>
    </p>
  );
}

/** The rule a removal cites, with titles (spec 13 §4.4). Required. */
export function RuleSelect({ value, onChange, label = "Rule it broke" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { rules } = useRules();
  return (
    <Select label={label} required value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("moderation.choose-a-rule")}
      options={ruleOptions(rules?.rules)} hint={t("moderation.shown-to-the-author-and-on")} />
  );
}
