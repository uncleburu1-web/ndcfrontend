/**
 * Footer language switch on every page (spec 20 §6). "English" is always shown in English, so anyone can get back.
 * Languages whose translations aren't ready show as "coming soon" and can't be chosen. Spec 21: guests' list comes from
 * GET /languages/, and the new language's text is fetched before anything switches.
 */
import { useId } from "react";
import { ApiError } from "../auth/api";
import { useToast } from "../components/ui";
import { languageWords } from "./constants";
import { useSetting } from "./PreferencesProvider";
import { useChooseLanguage, useLanguageOptions } from "./sections/DisplaySections";
import "./settings.css";
import { t } from "../i18n";

export function LanguageSwitch() {
  const id = useId();
  const [language] = useSetting("language");
  const options = useLanguageOptions();
  const { choose, busy } = useChooseLanguage();
  const toast = useToast();
  const change = async (code: string) => {
    try {
      await choose(code); // spec 21 §5.4: the text loads first, then everything switches at once
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : t("settings.couldn-t-change-the-language-try") });
    }
  };
  return (
    <span className="lang-switch">
      <label htmlFor={id}>{t("settings.language")}</label>
      <select id={id} value={language} onChange={(e) => void change(e.target.value)} aria-busy={busy || undefined} disabled={busy}>
        {options.map((o) => (
          <option key={o.code} value={o.code} disabled={!o.enabled} lang={o.code}>
            {o.code === "en" ? t("settings.english") : o.enabled ? languageWords(o.native, o.label) : t("settings.language-coming-soon", { name: languageWords(o.native, o.label) })}
          </option>
        ))}
      </select>
    </span>
  );
}
