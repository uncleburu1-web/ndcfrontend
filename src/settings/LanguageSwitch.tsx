/**
 * Footer language switch on every page (spec 20 §6). "English" is always shown in English, so anyone can get back.
 * Languages whose translations aren't ready show as "coming soon" and can't be chosen.
 */
import { useId } from "react";
import { ApiError } from "../auth/api";
import { useToast } from "../components/ui";
import { languageWords } from "./constants";
import { useSetting } from "./PreferencesProvider";
import { useLanguageOptions } from "./sections/DisplaySections";
import "./settings.css";

export function LanguageSwitch() {
  const id = useId();
  const [language, setLanguage] = useSetting("language");
  const options = useLanguageOptions();
  const toast = useToast();
  const change = async (code: string) => {
    try {
      await setLanguage(code);
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t change the language. Try again." });
    }
  };
  return (
    <span className="lang-switch">
      <label htmlFor={id}>Language</label>
      <select id={id} value={language} onChange={(e) => void change(e.target.value)}>
        {options.map((o) => (
          <option key={o.code} value={o.code} disabled={!o.enabled} lang={o.code}>
            {o.code === "en" ? "English" : `${languageWords(o.native, o.label)}${o.enabled ? "" : " · coming soon"}`}
          </option>
        ))}
      </select>
    </span>
  );
}
