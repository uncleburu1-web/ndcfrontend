/**
 * Spec 20 §13: one place that keeps this device's display and language settings in step with the account.
 *
 * - Signed out: the device's own choices (localStorage, applied by /prefs.js before paint).
 * - First sign-in on a device: if the account never saved display or language settings and the guest changed them
 *   here, they're copied to the account once ("We kept your display settings"). Otherwise the account's values win.
 * - Signed in: `/me/settings/` is fetched again when the tab regains focus and every 5 minutes while visible; newer
 *   values from another device are applied. No sockets.
 * - Each change PATCHes only what changed; the page changes at once and goes back if the save fails.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import type { Schema } from "../api/typed";
import { ApiError } from "../auth/api";
import { useApi, useMe } from "../auth/session";
import { useToast } from "../components/ui";
import { getPrefs, setPrefs, subscribe, type DevicePrefs, type DisplayPrefs } from "./prefsStore";

export type Settings = Schema<"Settings">;
const REFRESH_MS = 5 * 60 * 1000;

interface PreferencesValue {
  prefs: DevicePrefs;
  /** The full settings for the signed-in person (null until a settings page asks for it, or signed out). */
  settings: Settings | null;
  settingsError: ApiError | null;
  loadSettings: () => Promise<void>;
  /** Replace part of the settings after a section saved (the server's answer). */
  patchSettings: (part: Partial<Settings>) => void;
  setDisplay: (patch: Partial<DisplayPrefs>) => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  signedIn: boolean;
}

const Ctx = createContext<PreferencesValue | null>(null);

export function usePrefs(): DevicePrefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

function fromServer(p: { language: string; theme: string; text_size: string; contrast: string; motion: string }): Partial<DevicePrefs> {
  return { language: p.language, theme: p.theme, text_size: p.text_size, contrast: p.contrast, motion: p.motion, deviceSet: false } as Partial<DevicePrefs>;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const { me } = useMe();
  const api = useApi();
  const toast = useToast();
  const prefs = usePrefs();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsError, setSettingsError] = useState<ApiError | null>(null);
  const synced = useRef<string | null>(null); // the account id this device last synced with
  const lastUpdated = useRef<string | null>(null);
  const active = Boolean(isSignedIn && me && me.account_status !== "paused");

  // Sign-in: copy the guest's choices once, or take the account's.
  useEffect(() => {
    if (!active || !me?.preferences || synced.current === me.id) return;
    synced.current = me.id;
    const server = me.preferences;
    const device = getPrefs();
    lastUpdated.current = server.updated_at;
    if (!server.saved_at && device.deviceSet) {
      const body = { theme: device.theme, text_size: device.text_size, contrast: device.contrast, motion: device.motion, language: device.language };
      api<Schema<"SettingsDeviceImport">>("/me/settings/import-device/", { method: "POST", body })
        .then((r) => {
          setPrefs({ ...fromServer({ ...r.accessibility, language: r.language.language }) });
          toast.show({ tone: "success", message: "We kept your display settings." });
        })
        .catch(() => setPrefs(fromServer(server)));
    } else {
      setPrefs(fromServer(server));
    }
  }, [active, me, api, toast]);

  // Signed out: forget the account's settings in memory; the device keeps its display settings (§13).
  useEffect(() => {
    if (isSignedIn === false) {
      synced.current = null;
      setSettings(null);
    }
  }, [isSignedIn]);

  const loadSettings = useCallback(async () => {
    if (!active) return;
    try {
      const s = await api<Settings>("/me/settings/");
      setSettings(s);
      setSettingsError(null);
      if (s.updated_at !== lastUpdated.current) {
        lastUpdated.current = s.updated_at;
        setPrefs(fromServer({ ...s.accessibility, language: s.language.language }));
      }
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err : new ApiError({}));
    }
  }, [active, api]);

  // Other devices: refetch on focus and every 5 minutes while visible.
  useEffect(() => {
    if (!active) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") void loadSettings();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(onFocus, REFRESH_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [active, loadSettings]);

  const patchSettings = useCallback((part: Partial<Settings>) => {
    setSettings((s) => (s ? { ...s, ...part } : s));
  }, []);

  const setDisplay = useCallback(
    async (patch: Partial<DisplayPrefs>) => {
      const before = getPrefs();
      if (!active) {
        setPrefs({ ...patch, deviceSet: true });
        return;
      }
      setPrefs(patch);
      try {
        const r = await api<Schema<"SettingsAccessibility">>("/me/settings/accessibility/", { method: "PATCH", body: patch });
        setPrefs(r);
        setSettings((s) => (s ? { ...s, accessibility: r } : s));
      } catch (err) {
        setPrefs(before);
        throw err;
      }
    },
    [active, api]
  );

  const setLanguage = useCallback(
    async (code: string) => {
      const before = getPrefs();
      if (!active) {
        setPrefs({ language: code, deviceSet: true });
        return;
      }
      setPrefs({ language: code });
      try {
        const r = await api<Schema<"SettingsLanguage">>("/me/settings/language/", { method: "PATCH", body: { language: code } });
        setSettings((s) => (s ? { ...s, language: r } : s));
      } catch (err) {
        setPrefs(before);
        throw err;
      }
    },
    [active, api]
  );

  const value = useMemo<PreferencesValue>(
    () => ({ prefs, settings, settingsError, loadSettings, patchSettings, setDisplay, setLanguage, signedIn: active }),
    [prefs, settings, settingsError, loadSettings, patchSettings, setDisplay, setLanguage, active]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Outside the provider (isolated tests, the dev design-system page): this device's settings only, nothing synced. */
const deviceOnly: Omit<PreferencesValue, "prefs"> = {
  settings: null,
  settingsError: null,
  loadSettings: async () => undefined,
  patchSettings: () => undefined,
  setDisplay: async (patch) => setPrefs({ ...patch, deviceSet: true }),
  setLanguage: async (code) => setPrefs({ language: code, deviceSet: true }),
  signedIn: false,
};

export function usePreferences(): PreferencesValue {
  const v = useContext(Ctx);
  const prefs = usePrefs();
  return v ?? { ...deviceOnly, prefs };
}

/**
 * One display or language setting: `[value, save]`. Saving applies at once; signed-in people's choice is stored on
 * the account (and synced), guests' on this device.
 */
export function useSetting<K extends keyof DisplayPrefs | "language">(key: K): [DevicePrefs[K], (v: DevicePrefs[K]) => Promise<void>] {
  const { prefs, setDisplay, setLanguage } = usePreferences();
  const save = useCallback(
    (v: DevicePrefs[K]) => (key === "language" ? setLanguage(v as string) : setDisplay({ [key]: v } as Partial<DisplayPrefs>)),
    [key, setDisplay, setLanguage]
  );
  return [prefs[key], save];
}
