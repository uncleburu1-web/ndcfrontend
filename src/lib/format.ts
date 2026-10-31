/**
 * Content conventions — feature-specs/01-design-system.md §5.
 */

const LAGOS = "Africa/Lagos";

/** ₦20,000 — symbol, thousands separator, decimals only when non-zero (§5.1). */
export function formatNaira(amount: number): string {
  const hasKobo = !Number.isInteger(amount);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
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

/** 31 Oct 2026 · or · 31 Oct 2026, 2:45 pm (WAT) — always in Africa/Lagos (§5.2). */
export function formatDate(value: Date | string | number, { withTime = false, showZone = false }: DateOptions = {}): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: LAGOS,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  let text = `${get("day")} ${get("month")} ${get("year")}`;
  if (withTime) {
    text += `, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
    if (showZone) text += " WAT";
  }
  return text;
}
