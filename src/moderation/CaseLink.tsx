/** "Reports: open the case" — 07/09's admin detail pages point at the moderation case instead of listing reports (spec 13 §8.2). */
import { Link } from "react-router-dom";
import { Select, StatusBadge } from "../components/ui";
import { ruleOptions, useRules } from "./rules";
import type { CaseSummary } from "./types";

export function CaseLink({ c }: { c: CaseSummary | null | undefined }) {
  if (!c) return <p className="ds-field__hint">No reports.</p>;
  return (
    <p>
      <StatusBadge set="case" status={c.status === "closed" && c.decision ? c.decision : c.status} />{" "}
      {c.open_reports ? `${c.open_reports} open of ${c.reports} reports` : `${c.reports} report${c.reports === 1 ? "" : "s"}`}
      {" · "}<Link to={`/admin/moderation/${c.id}`}>Reports: open the case</Link>
    </p>
  );
}

/** The rule a removal cites, with titles (spec 13 §4.4). Required. */
export function RuleSelect({ value, onChange, label = "Rule it broke" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const { rules } = useRules();
  return (
    <Select label={label} required value={value} onChange={(e) => onChange(e.target.value)} placeholder="Choose a rule"
      options={ruleOptions(rules?.rules)} hint="Shown to the author and on the public page." />
  );
}
