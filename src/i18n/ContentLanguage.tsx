/**
 * Spec 21 §9: the language of what people write.
 * - `<WrittenIn>`: the "Written in" choice on every writing form (default: the writer's interface language).
 * - `<InLanguage>`: shows someone's words with their own `lang` (WCAG 3.1.2) and, when that isn't the reader's
 *   language, a small "In Hausa" label. Never a translate button: people's words are never machine-translated.
 * - `<LanguageFilter>`: "All languages" or one, for feeds and review queues.
 */
import { createElement, useId, type ReactNode } from "react";
import { ENGLISH_NAME, NATIVE, t, useLanguage } from "./index";

export const CONTENT_LANGUAGES = ["en", "ha", "ig", "yo", "pcm", "und"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

/** "Yorùbá (Yoruba)" — each language in its own name, with the English name beside it (spec 20 §6). */
export function languageName(code: string): string {
  if (code === "und") return t("content.not-sure");
  const native = NATIVE[code] ?? code;
  const english = ENGLISH_NAME[code] ?? code;
  return native === english ? native : `${native} (${english})`;
}

/** The interface language as a writing default ("qps" in development counts as English). */
export function defaultWritingLanguage(lang: string): ContentLanguage {
  return (CONTENT_LANGUAGES as readonly string[]).includes(lang) ? (lang as ContentLanguage) : "en";
}

export function WrittenIn({ value, onChange, label }: { value: string; onChange: (v: ContentLanguage) => void; label?: string }) {
  const id = useId();
  useLanguage();
  return (
    <div className="ds-field">
      <label className="ds-field__label" htmlFor={id}>{label ?? t("content.written-in")}</label>
      <div className="ds-select">
        <select id={id} className="ds-input ds-select__control" aria-describedby={`${id}-hint`} value={value}
          onChange={(e) => onChange(e.target.value as ContentLanguage)}>
          {CONTENT_LANGUAGES.map((c) => (
            <option key={c} value={c} lang={c === "und" ? undefined : c}>{languageName(c)}</option>
          ))}
        </select>
      </div>
      <p id={`${id}-hint`} className="ds-field__hint">{t("content.written-in-hint")}</p>
    </div>
  );
}

export function InLanguage({ language, as = "div", className, children, label = true }: {
  language?: string | null; as?: string; className?: string; children: ReactNode; label?: boolean;
}) {
  const reader = useLanguage();
  const code = language && language !== "und" ? language : undefined;
  const other = code && code !== (reader === "qps" ? "en" : reader);
  return (
    <>
      {label && other && <p className="content-lang">{t("content.in-language", { name: ENGLISH_NAME[code] ?? code })}</p>}
      {createElement(as, { lang: code, className }, children)}
    </>
  );
}

export function LanguageFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  useLanguage();
  return (
    <span className="lang-filter">
      <label htmlFor={id}>{t("content.language-filter")}</label>
      <span className="ds-select">
        <select id={id} className="ds-input ds-select__control" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("content.all-languages")}</option>
          {CONTENT_LANGUAGES.filter((c) => c !== "und").map((c) => <option key={c} value={c} lang={c}>{languageName(c)}</option>)}
        </select>
      </span>
    </span>
  );
}
