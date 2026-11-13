/** /settings/language and /settings/accessibility (spec 20 §6, §10). Guests can use both; their choice stays on this device. */
import { useEffect, useState } from "react";
import { useApi } from "../../auth/session";
import { ApiError } from "../../auth/api";
import { Button, RadioGroup, useToast } from "../../components/ui";
import { GUEST_ENABLED, LANGUAGES, languageWords } from "../constants";
import { usePreferences, useSetting } from "../PreferencesProvider";
import type { Contrast, Motion, TextSize, Theme } from "../prefsStore";
import { DEFAULT_PREFS } from "../prefsStore";
import { SectionShell, useSettingsData } from "../SettingsLayout";
import { loadLanguage, t as tr } from "../../i18n";

/** The five languages with which ones can be chosen: from the server when signed in, English only for guests until 21. */
export function useLanguageOptions() {
  const { settings, signedIn } = usePreferences();
  const server = signedIn ? settings?.language.options : undefined;
  const publicList = usePublicLanguages();
  const guestOn = publicList ?? GUEST_ENABLED;
  return LANGUAGES.map((l) => ({ ...l, enabled: server ? Boolean(server.find((o) => o.code === l.code)?.enabled) : guestOn.includes(l.code) }));
}

/** Spec 21 §13: guests ask GET /languages/ which languages are on (public, cached). English until it answers. */
let publicLanguages: Promise<string[]> | null = null;
function usePublicLanguages(): string[] | null {
  const api = useApi();
  const [codes, setCodes] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    publicLanguages ??= api<{ languages: { code: string }[] }>("/languages/", { anonymous: true })
      .then((r) => (Array.isArray(r?.languages) ? r.languages.map((l) => l.code) : ["en"]))
      .catch(() => {
        publicLanguages = null;
        return ["en"];
      });
    void publicLanguages.then((c) => live && setCodes(c));
    return () => {
      live = false;
    };
  }, [api]);
  return codes;
}

/** Tests: forget the public list. */
export function resetPublicLanguages() {
  publicLanguages = null;
}

/**
 * §5.4: fetch the language's text first, then switch and save, so nobody sees a half-switched page. While it loads the
 * caller shows a spinner; if it fails, the old language stays and the error is in the old language.
 */
export function useChooseLanguage() {
  const [, setLanguage] = useSetting("language");
  const [busy, setBusy] = useState(false);
  const choose = async (code: string) => {
    setBusy(true);
    try {
      await loadLanguage(code);
      await setLanguage(code);
    } finally {
      setBusy(false);
    }
  };
  return { choose, busy };
}

function useSaver() {
  const toast = useToast();
  return async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : tr("settings.couldn-t-save-that-try-again") });
    }
  };
}

export function LanguageSection() {
  const [language] = useSetting("language");
  const { choose, busy } = useChooseLanguage();
  const options = useLanguageOptions();
  const { signedIn } = usePreferences();
  useSettingsData(); // signed in: which languages the server has turned on
  const run = useSaver();
  return (
    <SectionShell guestOk title={tr("settings.language")}
      intro={signedIn ? tr("settings.saved-to-your-account-and-used") : tr("settings.saved-on-this-device-sign-in")}>
      <div className="set-card">
        <RadioGroup legend={tr("settings.interface-language")} name="language" value={language}
          onChange={(code) => void run(() => choose(code), tr("settings.language-saved"))}
          options={options.map((o) => ({
            value: o.code,
            label: <span lang={o.code === "pcm" ? "pcm" : o.code}>{languageWords(o.native, o.label)}</span>,
            hint: o.enabled ? undefined : tr("settings.coming-soon-2"),
            disabled: !o.enabled,
          }))} />
        {busy && <p className="set-meta" role="status">{tr("settings.loading-the-language")}</p>}
        <p className="set-meta">{tr("settings.hausa-igbo-yoruba-and-naija-are")}</p>
      </div>
    </SectionShell>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", get label() { return tr("settings.system-follow-this-device"); } },
  { value: "light", get label() { return tr("settings.light"); } },
  { value: "dark", get label() { return tr("settings.dark"); } },
];
const SIZES: { value: TextSize; label: string }[] = [
  { value: "standard", get label() { return tr("settings.standard-100"); } },
  { value: "large", get label() { return tr("settings.large-112-5"); } },
  { value: "larger", get label() { return tr("settings.larger-125"); } },
];
const CONTRASTS: { value: Contrast; label: string }[] = [
  { value: "system", get label() { return tr("settings.system-follow-this-device"); } },
  { value: "standard", get label() { return tr("settings.standard"); } },
  { value: "more", get label() { return tr("settings.more-contrast"); } },
];
const MOTIONS: { value: Motion; label: string }[] = [
  { value: "system", get label() { return tr("settings.system-follow-this-device"); } },
  { value: "reduce", get label() { return tr("settings.reduce-motion"); } },
];

export function AccessibilitySection() {
  const [theme, setTheme] = useSetting("theme");
  const [size, setSize] = useSetting("text_size");
  const [contrast, setContrast] = useSetting("contrast");
  const [motion, setMotion] = useSetting("motion");
  const { setDisplay, signedIn } = usePreferences();
  const [resetting, setResetting] = useState(false);
  const run = useSaver();
  const reset = async () => {
    setResetting(true);
    const { theme: t, text_size, contrast: c, motion: m } = DEFAULT_PREFS;
    await run(() => setDisplay({ theme: t, text_size, contrast: c, motion: m }), tr("settings.display-settings-reset"));
    setResetting(false);
  };
  return (
    <SectionShell guestOk title={tr("settings.accessibility")}
      intro={tr("settings.changes-apply-at-once-browser-zoom", { v: signedIn ? tr("settings.and-follow-you-to-every-device") : tr("settings.on-this-device") })}>
      <div className="set-card">
        <RadioGroup legend={tr("settings.theme")} name="theme" value={theme} options={THEMES}
          onChange={(v) => void run(() => setTheme(v as Theme), tr("settings.theme-saved"))} />
      </div>
      <div className="set-card">
        <RadioGroup legend={tr("settings.text-size")} name="text_size" value={size} options={SIZES}
          onChange={(v) => void run(() => setSize(v as TextSize), tr("settings.text-size-saved"))} />
      </div>
      <div className="set-card">
        <RadioGroup legend={tr("settings.contrast")} name="contrast" value={contrast} options={CONTRASTS}
          hint={tr("settings.more-contrast-darkens-secondary-text-and")}
          onChange={(v) => void run(() => setContrast(v as Contrast), tr("settings.contrast-saved"))} />
      </div>
      <div className="set-card">
        <RadioGroup legend={tr("settings.motion")} name="motion" value={motion} options={MOTIONS}
          hint={tr("settings.reduce-motion-turns-off-animations-and")}
          onChange={(v) => void run(() => setMotion(v as Motion), tr("settings.motion-saved"))} />
      </div>
      <Button variant="secondary" onClick={() => void reset()} loading={resetting} loadingLabel={tr("settings.resetting")}>{tr("settings.reset-to-defaults")}</Button>
    </SectionShell>
  );
}
