/**
 * Content conventions — feature-specs/01-design-system.md §5.
 */

import { format, t } from "../i18n";

/** ₦20,000 — symbol, thousands separator, decimals only when non-zero (§5.1); in the current language's format (spec 21 §4). */
export function formatNaira(amount: number): string {
  return format.naira(amount);
}

/** Parse user-typed naira ("20,000", "₦5000", "1500.50") into a number, or null. */
export function parseNaira(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (cleaned === "" || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Group digits while typing: "20000" → "20,000" (keeps up to 2 decimal places). */
export function groupDigits(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${grouped}.${rest.join("").slice(0, 2)}` : grouped;
}

interface DateOptions {
  /** Include the time: "31 Oct 2026, 2:45 pm". */
  withTime?: boolean;
  /** Append the WAT zone where the reader could be ambiguous about time zone. */
  showZone?: boolean;
}

/** 31 Oct 2026 · or · 31 Oct 2026, 2:45 pm (WAT) — always in Africa/Lagos (§5.2), in the current language (spec 21 §4). */
export function formatDate(value: Date | string | number, opts: DateOptions = {}): string {
  return format.date(value, opts);
}

/** "3 min", "5 h", "2 days" — how long something has waited (spec 11 §8.1). */
export function formatAge(value: Date | string | number, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - new Date(value).getTime());
  const min = Math.floor(ms / 60_000);
  if (min < 60) return t("format.age.minutes", { n: Math.max(1, min) });
  const h = Math.floor(min / 60);
  if (h < 48) return t("format.age.hours", { n: h });
  return t("format.age.days", { n: Math.floor(h / 24) });
}

/** Working days between `from` and now (Mon–Fri): PVC and membership turnaround (specs 08 and 11). */
export function workingDaysSince(from: Date, now = new Date()) {
  let days = 0;
  const d = new Date(from);
  while (d < now) {
    d.setDate(d.getDate() + 1);
    if (d <= now && d.getDay() !== 0 && d.getDay() !== 6) days += 1;
  }
  return days;
}
