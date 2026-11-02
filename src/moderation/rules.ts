/** The community rules (spec 13 §4.1), fetched once per page load from /rules/. */
import { useEffect, useState } from "react";
import { useApi } from "../auth/session";
import type { RulesPayload } from "./types";

let cached: Promise<RulesPayload> | null = null;

/** Used where the rules list isn't loaded (e.g. tests); the server's list is the source of truth. */
export const RULE_TITLES: Record<string, string> = {
  R1: "No threats or incitement to violence",
  R2: "No abusive or hateful language about religion, ethnicity, tribe or section",
  R3: "Election results only from INEC; no false results",
  R4: "No knowingly false or misleading information",
  R5: "No one’s private information without consent",
  R6: "No intimate images shared without consent",
  R7: "Respect copyright",
  R8: "No spam, scams or advertising",
  R9: "No impersonation",
  R10: "Stay on topic and follow the news rules",
};

export function useRules() {
  const api = useApi();
  const [rules, setRules] = useState<RulesPayload | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    cached ??= api<RulesPayload>("/rules/", { anonymous: true });
    cached.then((r) => live && setRules(r)).catch(() => {
      cached = null;
      if (live) setError(true);
    });
    return () => {
      live = false;
    };
  }, [api]);
  return { rules, error };
}

/** Test hook: forget the cached rules. */
export function resetRulesCache() {
  cached = null;
}

export function ruleOptions(rules: { id: string; title: string }[] | null | undefined) {
  const list = rules?.length ? rules : Object.entries(RULE_TITLES).map(([id, title]) => ({ id, title }));
  return list.map((r) => ({ value: r.id, label: `${r.id}: ${r.title}` }));
}
