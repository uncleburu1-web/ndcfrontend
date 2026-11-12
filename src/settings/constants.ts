/** Spec 20 §4, §6: the Settings sections and the five interface languages. */
import type { IconName } from "../components/ui/Icon";

export interface SectionDef {
  path: string;
  label: string;
  blurb: string;
  icon: IconName;
  /** Shown to guests too (§4: Language, Accessibility, About). */
  guest?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { path: "account", label: "My account", blurb: "Name, phone, email, photo, home state", icon: "user" },
  { path: "profile", label: "Profile", blurb: "Public profile and how your name shows", icon: "verified" },
  { path: "language", label: "Language", blurb: "The language NDCConnect uses", icon: "info", guest: true },
  { path: "notifications", label: "Notifications", blurb: "What you get notices about", icon: "bell" },
  { path: "privacy", label: "Privacy", blurb: "What’s public, consents and your data", icon: "lock" },
  { path: "security", label: "Security", blurb: "Sign-in, two-step verification, devices", icon: "shield" },
  { path: "accessibility", label: "Accessibility", blurb: "Theme, text size, contrast, motion", icon: "checkCircle", guest: true },
  { path: "connected", label: "Connected accounts", blurb: "Sign-in connections and campaign accounts", icon: "heart" },
  { path: "manage", label: "Account management", blurb: "Pause or delete your account", icon: "alert" },
  { path: "about", label: "About", blurb: "Version, policies and contact", icon: "info", guest: true },
];

/** Shown in their own language, with the English name beside it (§6). Only English until spec 21's translations ship. */
export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ha", label: "Hausa", native: "Hausa" },
  { code: "ig", label: "Igbo", native: "Igbo" },
  { code: "yo", label: "Yoruba", native: "Yorùbá" },
  { code: "pcm", label: "Nigerian Pidgin", native: "Naijá" },
];
/** Guests can't ask the server which languages are on; until spec 21 that's English only. */
export const GUEST_ENABLED = ["en"];

export function languageWords(native: string, label: string) {
  return native === label ? native : `${native} (${label})`;
}
