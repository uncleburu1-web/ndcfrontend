/** The community rules (spec 13 §4.1), fetched once per page load from /rules/. */
import { useEffect, useState } from "react";
import { useApi } from "../auth/session";
import type { RulesPayload } from "./types";
import { getLanguage, t, useLanguage } from "../i18n";

/** One fetch per language: `?lang=` is part of the cached URL (spec 21 rule 7). */
const cache = new Map<string, Promise<RulesPayload>>();

/** Used where the rules list isn't loaded (e.g. tests); the server's list is the source of truth. */
export const RULE_TITLES: Record<string, string> = {
  get R1() { return t("moderation.no-threats-or-incitement-to-violence"); },
  get R2() { return t("moderation.no-abusive-or-hateful-language-about"); },
  get R3() { return t("moderation.election-results-only-from-inec-no"); },
  get R4() { return t("moderation.no-knowingly-false-or-misleading-information"); },
  get R5() { return t("moderation.no-one-s-private-information-without"); },
  get R6() { return t("moderation.no-intimate-images-shared-without-consent"); },
  get R7() { return t("moderation.respect-copyright"); },
  get R8() { return t("moderation.no-spam-scams-or-advertising"); },
  get R9() { return t("moderation.no-impersonation"); },
  get R10() { return t("moderation.stay-on-topic-and-follow-the"); },
};

export function useRules() {
  const api = useApi();
  const [rules, setRules] = useState<RulesPayload | null>(null);
  const [error, setError] = useState(false);
  const lang = useLanguage();
  useEffect(() => {
    let live = true;
    const code = getLanguage() === "qps" ? "en" : getLanguage();
    let p = cache.get(code);
    if (!p) {
      p = api<RulesPayload>(`/rules/?lang=${code}`, { anonymous: true });
      cache.set(code, p);
    }
    p.then((r) => live && setRules(r)).catch(() => {
      cache.delete(code);
      if (live) setError(true);
    });
    return () => {
      live = false;
    };
  }, [api, lang]);
  return { rules, error };
}

/** Test hook: forget the cached rules. */
export function resetRulesCache() {
  cache.clear();
}

export function ruleOptions(rules: { id: string; title: string }[] | null | undefined) {
  const list = rules?.length ? rules : Object.entries(RULE_TITLES).map(([id, title]) => ({ id, title }));
  return list.map((r) => ({ value: r.id, label: `${r.id}: ${r.title}` }));
}
