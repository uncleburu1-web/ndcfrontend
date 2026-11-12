/** /settings/language and /settings/accessibility (spec 20 §6, §10). Guests can use both; their choice stays on this device. */
import { useState } from "react";
import { ApiError } from "../../auth/api";
import { Button, RadioGroup, useToast } from "../../components/ui";
import { GUEST_ENABLED, LANGUAGES, languageWords } from "../constants";
import { usePreferences, useSetting } from "../PreferencesProvider";
import type { Contrast, Motion, TextSize, Theme } from "../prefsStore";
import { DEFAULT_PREFS } from "../prefsStore";
import { SectionShell, useSettingsData } from "../SettingsLayout";

/** The five languages with which ones can be chosen: from the server when signed in, English only for guests until 21. */
export function useLanguageOptions() {
  const { settings, signedIn } = usePreferences();
  const server = signedIn ? settings?.language.options : undefined;
  return LANGUAGES.map((l) => ({ ...l, enabled: server ? Boolean(server.find((o) => o.code === l.code)?.enabled) : GUEST_ENABLED.includes(l.code) }));
}

function useSaver() {
  const toast = useToast();
  return async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast.show({ tone: "success", message: done });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "Couldn’t save that. Try again." });
    }
  };
}

export function LanguageSection() {
  const [language, setLanguage] = useSetting("language");
  const options = useLanguageOptions();
  const { signedIn } = usePreferences();
  useSettingsData(); // signed in: which languages the server has turned on
  const run = useSaver();
  return (
    <SectionShell guestOk title="Language"
      intro={signedIn ? "Saved to your account and used on every device you sign in on." : "Saved on this device. Sign in to keep it on every device."}>
      <div className="set-card">
        <RadioGroup legend="Interface language" name="language" value={language}
          onChange={(code) => void run(() => setLanguage(code), "Language saved.")}
          options={options.map((o) => ({
            value: o.code,
            label: <span lang={o.code === "pcm" ? "pcm" : o.code}>{languageWords(o.native, o.label)}</span>,
            hint: o.enabled ? undefined : "Coming soon",
            disabled: !o.enabled,
          }))} />
        <p className="set-meta">Hausa, Igbo, Yorùbá and Naijá are being translated. Until then NDCConnect is in English, so nobody picks a language and still gets English without warning.</p>
      </div>
    </SectionShell>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System (follow this device)" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const SIZES: { value: TextSize; label: string }[] = [
  { value: "standard", label: "Standard (100%)" },
  { value: "large", label: "Large (112.5%)" },
  { value: "larger", label: "Larger (125%)" },
];
const CONTRASTS: { value: Contrast; label: string }[] = [
  { value: "system", label: "System (follow this device)" },
  { value: "standard", label: "Standard" },
  { value: "more", label: "More contrast" },
];
const MOTIONS: { value: Motion; label: string }[] = [
  { value: "system", label: "System (follow this device)" },
  { value: "reduce", label: "Reduce motion" },
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
    await run(() => setDisplay({ theme: t, text_size, contrast: c, motion: m }), "Display settings reset.");
    setResetting(false);
  };
  return (
    <SectionShell guestOk title="Accessibility"
      intro={`Changes apply at once${signedIn ? " and follow you to every device you sign in on" : " on this device"}. Browser zoom still works on top of these.`}>
      <div className="set-card">
        <RadioGroup legend="Theme" name="theme" value={theme} options={THEMES}
          onChange={(v) => void run(() => setTheme(v as Theme), "Theme saved.")} />
      </div>
      <div className="set-card">
        <RadioGroup legend="Text size" name="text_size" value={size} options={SIZES}
          onChange={(v) => void run(() => setSize(v as TextSize), "Text size saved.")} />
      </div>
      <div className="set-card">
        <RadioGroup legend="Contrast" name="contrast" value={contrast} options={CONTRASTS}
          hint="More contrast darkens secondary text and strengthens edges."
          onChange={(v) => void run(() => setContrast(v as Contrast), "Contrast saved.")} />
      </div>
      <div className="set-card">
        <RadioGroup legend="Motion" name="motion" value={motion} options={MOTIONS}
          hint="Reduce motion turns off animations and transitions, including the welcome animation."
          onChange={(v) => void run(() => setMotion(v as Motion), "Motion saved.")} />
      </div>
      <Button variant="secondary" onClick={() => void reset()} loading={resetting} loadingLabel="Resetting…">Reset to defaults</Button>
    </SectionShell>
  );
}
