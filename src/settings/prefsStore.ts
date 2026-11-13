/**
 * Display and language preferences on this device (spec 20 §10.2, §13).
 *
 * - `<html>` carries `data-theme`, `data-text-size`, `data-contrast`, `data-motion` and `lang`; tokens.css does the rest.
 * - Stored in localStorage under `ndc.prefs.v1` so `/prefs.js` can apply them before the app paints (no flash).
 * - `deviceSet` is true once someone changed them on this device while signed out: at the first sign-in the account
 *   gets a one-time copy (§13), and the person sees "We kept your display settings".
 * - Nothing personal is kept here: four display choices and a language code.
 */
export type Theme = "system" | "light" | "dark";
export type TextSize = "standard" | "large" | "larger";
export type Contrast = "system" | "standard" | "more";
export type Motion = "system" | "reduce";

export interface DisplayPrefs {
  theme: Theme;
  text_size: TextSize;
  contrast: Contrast;
  motion: Motion;
}

export interface DevicePrefs extends DisplayPrefs {
  language: string;
  /** Changed on this device while signed out (§13 guest → account copy). */
  deviceSet: boolean;
}

export const STORAGE_KEY = "ndc.prefs.v1";
export const DEFAULT_PREFS: DevicePrefs = { theme: "system", text_size: "standard", contrast: "system", motion: "system", language: "en", deviceSet: false };

const THEMES: Theme[] = ["system", "light", "dark"];
const SIZES: TextSize[] = ["standard", "large", "larger"];
const CONTRASTS: Contrast[] = ["system", "standard", "more"];
const MOTIONS: Motion[] = ["system", "reduce"];

function pick<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** Anything unknown or damaged falls back to the defaults (support: "the defaults apply when preferences can't load", §14). */
export function clean(raw: unknown): DevicePrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    theme: pick(r.theme, THEMES, "system"),
    text_size: pick(r.text_size, SIZES, "standard"),
    contrast: pick(r.contrast, CONTRASTS, "system"),
    motion: pick(r.motion, MOTIONS, "system"),
    language: typeof r.language === "string" && /^[a-z]{2,3}$/.test(r.language) ? r.language : "en",
    deviceSet: r.deviceSet === true,
  };
}

function load(): DevicePrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return clean(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let current: DevicePrefs = load();
const listeners = new Set<() => void>();

function prefers(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

/** "system" resolved against the device: what tokens.css keys its palettes on. */
export function resolved(p: DisplayPrefs): { scheme: "light" | "dark"; contrastLevel: "standard" | "more" } {
  const scheme = p.theme === "system" ? (prefers("(prefers-color-scheme: dark)") ? "dark" : "light") : p.theme;
  const contrastLevel = p.contrast === "system" ? (prefers("(prefers-contrast: more)") ? "more" : "standard") : p.contrast;
  return { scheme, contrastLevel };
}

/** Same attributes as /prefs.js. */
export function applyToDocument(p: DevicePrefs, doc: Document = document) {
  const html = doc.documentElement;
  const r = resolved(p);
  html.dataset.theme = p.theme;
  html.dataset.textSize = p.text_size;
  html.dataset.contrast = p.contrast;
  html.dataset.motion = p.motion;
  html.dataset.scheme = r.scheme;
  html.dataset.contrastLevel = r.contrastLevel;
  // <html lang> follows the language actually shown, set by src/i18n once its catalogue has loaded (spec 21 §5.4).
}

function persist(p: DevicePrefs) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode or storage full: the page still applies them for this visit */
  }
}

export function getPrefs(): DevicePrefs {
  return current;
}

export function setPrefs(next: Partial<DevicePrefs>) {
  const merged = clean({ ...current, ...next });
  if (JSON.stringify(merged) === JSON.stringify(current)) return;
  current = merged;
  persist(current);
  if (typeof document !== "undefined") {
  applyToDocument(current);
  // "System" follows the device live: switching the phone to dark mode switches the page too.
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    for (const q of ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"]) {
      const mq = window.matchMedia(q);
      const onChange = () => {
        applyToDocument(current);
        listeners.forEach((l) => l());
      };
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    }
  }
}
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tests only. */
export function resetPrefsForTests() {
  current = load();
  listeners.clear();
}

if (typeof document !== "undefined") {
  applyToDocument(current);
  // "System" follows the device live: switching the phone to dark mode switches the page too.
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    for (const q of ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"]) {
      const mq = window.matchMedia(q);
      const onChange = () => {
        applyToDocument(current);
        listeners.forEach((l) => l());
      };
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    }
  }
}
