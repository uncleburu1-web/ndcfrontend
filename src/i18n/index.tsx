/**
 * Spec 21 §5: NDCConnect's own small translation layer (no dependency, §5.1).
 *
 * - `t(key, values?)` returns the message in the current language; `t.rich(key, components)` returns React nodes for
 *   messages with tags. Both read the current language at call time, so module-level labels written as getters
 *   (`get label() { return t("…") }`) stay current.
 * - English is bundled; Hausa, Igbo, Yoruba and Pidgin are separate chunks, fetched before a switch happens (§5.4), so
 *   nobody sees a half-switched page. The React tree re-renders from the root on a switch (`useLanguage()` in Root).
 * - A key missing in a language falls back to English, wrapped in lang="en" by `t.rich`/`<T>` (WCAG 3.1.2); a key
 *   missing everywhere shows the key (and check:i18n fails the build before that can ship).
 * - `qps` is a pseudo-language for development and the live check (§5.7): accented, about 40% longer.
 */
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
import en from "./messages/en.json";
import { parse, render, type Node, type Part, type Values } from "./message";
import { pseudo } from "./pseudo";

export type Lang = "en" | "ha" | "ig" | "yo" | "pcm" | "qps";
export const LANGUAGES = ["en", "ha", "ig", "yo", "pcm"] as const;
export const NATIVE: Record<string, string> = { en: "English", ha: "Hausa", ig: "Igbo", yo: "Yorùbá", pcm: "Naijá", und: "" };
export const ENGLISH_NAME: Record<string, string> = { en: "English", ha: "Hausa", ig: "Igbo", yo: "Yoruba", pcm: "Nigerian Pidgin" };

type Catalogue = Record<string, string>;
const EN = en as Catalogue;
const catalogues: Record<string, Catalogue> = { en: EN };
const loaders = import.meta.glob<{ default: Catalogue }>(["./messages/*.json", "!./messages/en.json", "!./messages/*.context.json"]);

let current: Lang = "en";
const listeners = new Set<() => void>();
const parsed = new Map<string, Node[]>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLanguage(): Lang {
  return current;
}

/** Fetch a language's catalogue (no switch yet). Throws if it can't be loaded. */
export async function loadLanguage(code: string): Promise<void> {
  if (code === "en" || code === "qps" || catalogues[code]) return;
  const loader = loaders[`./messages/${code}.json`];
  if (!loader) throw new Error(`No catalogue for ${code}`);
  catalogues[code] = (await loader()).default;
}

/** Load, then switch (§5.4). Unknown or unavailable languages fall back to English. */
export async function setLanguage(code: string): Promise<void> {
  const target = (["en", "ha", "ig", "yo", "pcm", "qps"].includes(code) ? code : "en") as Lang;
  try {
    await loadLanguage(target);
  } catch {
    if (current !== "en") {
      current = "en";
      apply();
    }
    return;
  }
  if (target === current) return;
  current = target;
  apply();
}

function apply() {
  if (typeof document !== "undefined") document.documentElement.lang = current === "qps" ? "en" : current;
  emit();
}

/** Tests: back to English, no listeners kept. */
export function resetLanguageForTests() {
  current = "en";
  if (typeof document !== "undefined") document.documentElement.lang = "en";
}

function lookup(key: string): { msg: string; lang: string } {
  if (current === "qps") return { msg: pseudo(EN[key] ?? key), lang: "en" };
  const own = catalogues[current]?.[key];
  if (own) return { msg: own, lang: current };
  return { msg: EN[key] ?? key, lang: "en" };
}

function nodes(msg: string): Node[] {
  let n = parsed.get(msg);
  if (!n) {
    try {
      n = parse(msg);
    } catch {
      n = [{ k: "text", v: msg }];
    }
    parsed.set(msg, n);
  }
  return n;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
export function formatNumber(n: number): string {
  const loc = locale();
  let f = numberFormats.get(loc);
  if (!f) {
    f = new Intl.NumberFormat(loc);
    numberFormats.set(loc, f);
  }
  return f.format(n);
}

function flat(parts: Part[]): string {
  return parts.map((p) => (typeof p === "string" ? p : p.children ? flat(p.children) : "")).join("");
}

type RichValue = ReactNode | ((children: ReactNode) => ReactNode);
type RichValues = Record<string, RichValue>;

interface TFunction {
  (key: string, values?: Values): string;
  /** Messages with tags: `t.rich("k", { link: (c) => <Link to="/rules">{c}</Link>, icon: <Icon name="x" /> })`. */
  rich(key: string, values?: RichValues): ReactNode;
}

function toReact(parts: Part[], values: Record<string, unknown>, keyBase = ""): ReactNode[] {
  return parts.map((p, i) => {
    if (typeof p === "string") return p;
    const v = values[p.tag] as RichValue;
    const inner = p.children ? toReact(p.children, values, `${keyBase}${i}.`) : null;
    const node = typeof v === "function" ? (v as (c: ReactNode) => ReactNode)(inner) : (v ?? inner);
    return <Fragment key={`${keyBase}${i}`}>{node}</Fragment>;
  });
}

export const t: TFunction = Object.assign(
  (key: string, values: Values = {}): string => {
    const { msg, lang } = lookup(key);
    return flat(render(nodes(msg), values, lang, formatNumber));
  },
  {
    rich(key: string, values: RichValues = {}): ReactNode {
      const { msg, lang } = lookup(key);
      const out = toReact(render(nodes(msg), values as Values, lang, formatNumber), values);
      const body = out.length === 1 ? out[0] : <>{out}</>;
      return lang !== current && current !== "qps" ? <span lang="en">{body}</span> : body;
    },
  },
);

/** Is there a translation of `key` in the current language (or is it English)? */
export function hasOwn(key: string): boolean {
  return current === "en" || current === "qps" || Boolean(catalogues[current]?.[key]);
}

/** Subscribe a component to language changes (Root uses it, so the whole tree re-renders on a switch). */
export function useLanguage(): Lang {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

export function useI18n() {
  const lang = useLanguage();
  return { t, lang, format };
}

/** `<T k="nav.home" />` — plain text where a hook is awkward. */
export function T({ k, values }: { k: string; values?: Values }) {
  useLanguage();
  const { lang } = lookup(k);
  const text = t(k, values);
  return lang !== current && current !== "qps" ? <span lang="en">{text}</span> : <>{text}</>;
}

// ---------------------------------------------------------------- formatting (§4, §5.4)
const LAGOS = "Africa/Lagos";
const supported = new Map<string, string>();

/** The best locale the browser can format for the current language: `<code>-NG`, `<code>`, else `en-NG`. */
export function locale(lang: string = current): string {
  if (lang === "en" || lang === "qps") return "en-NG";
  let hit = supported.get(lang);
  if (!hit) {
    try {
      hit = Intl.DateTimeFormat.supportedLocalesOf([`${lang}-NG`, lang])[0] ?? "";
    } catch {
      hit = "";
    }
    supported.set(lang, hit);
  }
  return hit || "en-NG";
}

function dateParts(d: Date, opts: Intl.DateTimeFormatOptions) {
  const loc = current === "en" || current === "qps" || locale() === "en-NG" ? "en-GB" : locale();
  const parts = new Intl.DateTimeFormat(loc, { ...opts, timeZone: LAGOS }).formatToParts(d);
  const g = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  // No runtime data for the language: English layout, the language's own month and weekday names (§4).
  const ownNames = current !== "en" && current !== "qps" && locale() === "en-NG";
  const month = ownNames && opts.month ? t(`date.month.${d.toLocaleString("en-GB", { month: "numeric", timeZone: LAGOS })}`) : g("month");
  const weekday = ownNames && opts.weekday
    ? t(`date.weekday.${new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: LAGOS }).format(d).toLowerCase()}`)
    : g("weekday");
  return { g, month, weekday, native: !ownNames && current !== "en" && current !== "qps", loc };
}

export const format = {
  /** "31 Oct 2026" · "31 Oct 2026, 2:45 pm (WAT)" — English exactly as 01 §5.2; other languages per their locale. */
  date(value: Date | string | number, { withTime = false, showZone = false } = {}): string {
    const d = value instanceof Date ? value : new Date(value);
    const p = dateParts(d, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    if (p.native) {
      const s = new Intl.DateTimeFormat(p.loc, { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: LAGOS }).format(d);
      return withTime && showZone ? `${s} (WAT)` : s;
    }
    let text = `${p.g("day")} ${p.month} ${p.g("year")}`;
    if (withTime) {
      text += `, ${p.g("hour")}:${p.g("minute")} ${p.g("dayPeriod").toLowerCase()}`;
      if (showZone) text += " WAT";
    }
    return text;
  },
  /** "Sat 14 Nov, 10:00 (WAT)". */
  when(iso: string, withDay = true): string {
    const d = new Date(iso);
    const p = dateParts(d, { weekday: withDay ? "short" : undefined, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    if (p.native) {
      const s = new Intl.DateTimeFormat(p.loc, { weekday: withDay ? "short" : undefined, day: "numeric", month: "short", hour: "2-digit",
        minute: "2-digit", hour12: false, timeZone: LAGOS }).format(d);
      return `${s} (WAT)`;
    }
    return `${withDay ? `${p.weekday} ` : ""}${p.g("day")} ${p.month}, ${p.g("hour")}:${p.g("minute")} (WAT)`;
  },
  naira(amount: number): string {
    const hasKobo = !Number.isInteger(amount);
    return new Intl.NumberFormat(locale(), { style: "currency", currency: "NGN", minimumFractionDigits: hasKobo ? 2 : 0,
      maximumFractionDigits: 2 }).format(amount);
  },
  number: formatNumber,
  list(items: string[]): string {
    try {
      const LF = (Intl as unknown as { ListFormat: new (l: string, o: object) => { format(i: string[]): string } }).ListFormat;
      return new LF(locale(), { type: "conjunction" }).format(items);
    } catch {
      return items.join(", ");
    }
  },
};

/** Lets `<html lang>` and `document.title` follow the language (§5.5). */
export function setTitle(title: string) {
  if (typeof document !== "undefined") document.title = title;
}



/**
 * §7: Clerk's in-app screens in the current language, built from our catalogue's `clerk.*` keys (Clerk ships none of
 * Hausa, Igbo, Yoruba or Pidgin). English: undefined, so Clerk uses its own English.
 */
export function clerkLocalization(): Record<string, unknown> | undefined {
  if (current === "en" || current === "qps") return undefined;
  const cat = catalogues[current] ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cat)) {
    if (!k.startsWith("clerk.") || !v) continue;
    const path = k.slice(6).split(".");
    let node = out as Record<string, unknown>;
    path.slice(0, -1).forEach((p) => {
      node[p] = (node[p] as Record<string, unknown>) ?? {};
      node = node[p] as Record<string, unknown>;
    });
    node[path[path.length - 1]] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A module-level list whose words must follow the language: `export const STEPS = lazy(() => [t("…"), t("…")])`.
 * Every read rebuilds the list, so it is never frozen in the language that was current when the module loaded.
 */
export function lazy<T extends object>(make: () => T): T {
  const sample = make();
  return new Proxy((Array.isArray(sample) ? [] : {}) as T, {
    get: (_t, p) => {
      const v = make();
      const r = Reflect.get(v, p, v);
      return typeof r === "function" ? r.bind(v) : r;
    },
    has: (_t, p) => Reflect.has(make(), p),
    ownKeys: () => Reflect.ownKeys(make()),
    getOwnPropertyDescriptor: (_t, p) => {
      const d = Reflect.getOwnPropertyDescriptor(make(), p);
      if (d && p !== "length") d.configurable = true;
      return d;
    },
  });
}
