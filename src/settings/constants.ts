/** Spec 20 §4, §6: the Settings sections and the five interface languages. */
import type { IconName } from "../components/ui/Icon";
import { t } from "../i18n";

export interface SectionDef {
  path: string;
  label: string;
  blurb: string;
  icon: IconName;
  /** Shown to guests too (§4: Language, Accessibility, About). */
  guest?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { path: "account", get label() { return t("settings.my-account"); }, get blurb() { return t("settings.name-phone-email-photo-home-state"); }, icon: "user" },
  { path: "profile", get label() { return t("settings.profile"); }, get blurb() { return t("settings.public-profile-and-how-your-name"); }, icon: "verified" },
  { path: "language", get label() { return t("settings.language"); }, get blurb() { return t("settings.the-language-ndcconnect-uses"); }, icon: "info", guest: true },
  { path: "notifications", get label() { return t("settings.notifications"); }, get blurb() { return t("settings.what-you-get-notices-about"); }, icon: "bell" },
  { path: "privacy", get label() { return t("settings.privacy"); }, get blurb() { return t("settings.what-s-public-consents-and-your"); }, icon: "lock" },
  { path: "security", get label() { return t("settings.security"); }, get blurb() { return t("settings.sign-in-two-step-verification-devices"); }, icon: "shield" },
  { path: "accessibility", get label() { return t("settings.accessibility"); }, get blurb() { return t("settings.theme-text-size-contrast-motion"); }, icon: "checkCircle", guest: true },
  { path: "connected", get label() { return t("settings.connected-accounts"); }, get blurb() { return t("settings.sign-in-connections-and-campaign-accounts"); }, icon: "heart" },
  { path: "manage", get label() { return t("settings.account-management"); }, get blurb() { return t("settings.pause-or-delete-your-account"); }, icon: "alert" },
  { path: "about", get label() { return t("settings.about"); }, get blurb() { return t("settings.version-policies-and-contact"); }, icon: "info", guest: true },
];

/** Shown in their own language, with the English name beside it (§6). Only English until spec 21's translations ship. */
export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: "en", get label() { return t("settings.english"); }, native: "English" },
  { code: "ha", get label() { return t("settings.hausa"); }, native: "Hausa" },
  { code: "ig", get label() { return t("settings.igbo"); }, native: "Igbo" },
  { code: "yo", get label() { return t("settings.yoruba"); }, native: "Yorùbá" },
  { code: "pcm", get label() { return t("settings.nigerian-pidgin"); }, native: "Naijá" },
];
/** Guests learn which languages are on from GET /languages/ (spec 21 §13); English until it answers. */
export const GUEST_ENABLED = ["en"];

export function languageWords(native: string, label: string) {
  return native === label ? native : `${native} (${label})`;
}
