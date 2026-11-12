#!/usr/bin/env node
/**
 * Spec 20 §10.3: every text/background token pair meets WCAG 2.1 AA in every theme × contrast combination.
 * Text needs 4.5:1; large headings on brand fills and UI parts (control outlines, focus rings) need 3:1.
 * Reads src/styles/tokens.css directly: the base `:root` block plus the dark, more-contrast and dark + more-contrast
 * overrides (`[data-scheme]`, `[data-contrast-level]`, set by /prefs.js and src/settings/prefsStore.ts).
 *
 *   npm run check:contrast
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { dirname, join } from "node:path";

// Run as a script, or imported by the frontend tests (jsdom replaces URL, so work from the path string).
const root = import.meta.url.startsWith("file:") ? dirname(dirname(fileURLToPath(String(import.meta.url)))) : process.cwd();
const css = readFileSync(join(root, "src", "styles", "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

export const MODES = {
  "light · standard": [":root"],
  "light · more": [":root", ':root[data-scheme="light"][data-contrast-level="more"]'],
  "dark · standard": [":root", ':root[data-scheme="dark"]'],
  "dark · more": [":root", ':root[data-scheme="dark"]', ':root[data-scheme="dark"][data-contrast-level="more"]'],
};

/** [foreground, background, minimum ratio, what it is] */
export const PAIRS = [
  ["--text", "--surface", 4.5, "body text on cards"],
  ["--text", "--surface-page", 4.5, "body text on the page"],
  ["--text-muted", "--surface", 4.5, "secondary text on cards"],
  ["--text-muted", "--surface-page", 4.5, "secondary text on the page"],
  ["--text-link", "--surface", 4.5, "links on cards"],
  ["--text-link", "--surface-page", 4.5, "links on the page"],
  ["--text-brand", "--surface", 4.5, "brand text"],
  ["--text-brand", "--surface-brand-tint", 4.5, "brand text on brand tint"],
  ["--text", "--surface-brand-tint", 4.5, "text on brand tint"],
  ["--text", "--surface-accent-tint", 4.5, "text on accent tint"],
  ["--text-action", "--surface", 4.5, "action text (Vote, selected amount)"],
  ["--text-action", "--surface-accent-tint", 4.5, "action text on accent tint"],
  ["--action-primary-fg", "--action-primary-bg", 4.5, "primary button"],
  ["--action-primary-fg", "--action-primary-bg-hover", 4.5, "primary button, hover"],
  ["--action-secondary-fg", "--action-secondary-bg", 4.5, "secondary button"],
  ["--action-secondary-fg", "--action-secondary-bg-hover", 4.5, "secondary button, hover"],
  ["--action-danger-fg", "--action-danger-bg", 4.5, "danger button"],
  ["--brand-fg", "--brand-bg", 4.5, "header text"],
  ["--brand-fg", "--brand-bg-hover", 4.5, "header text, hover"],
  ["--brand-fg-muted", "--brand-bg", 4.5, "secondary header text"],
  ["--text-on-brand", "--brand-bg", 4.5, "text on brand fill"],
  ["--text-on-brand", "--action-primary-bg", 4.5, "text on red fill"],
  ["--highlight-fg", "--highlight-bg", 4.5, "search match"],
  ["--tone-success-fg", "--tone-success-bg", 4.5, "success badge"],
  ["--tone-warning-fg", "--tone-warning-bg", 4.5, "warning badge"],
  ["--tone-error-fg", "--tone-error-bg", 4.5, "error badge"],
  ["--tone-info-fg", "--tone-info-bg", 4.5, "info badge"],
  ["--tone-neutral-fg", "--tone-neutral-bg", 4.5, "neutral badge"],
  ["--tone-success-fg", "--surface", 4.5, "success text"],
  ["--tone-warning-fg", "--surface", 4.5, "warning text"],
  ["--tone-error-fg", "--surface", 4.5, "error text"],
  ["--tone-info-fg", "--surface", 4.5, "info text"],
  ["--border-control", "--surface", 3, "control outline"],
  ["--border-control", "--surface-page", 3, "control outline on the page"],
  ["--focus-ring", "--surface", 3, "focus ring"],
  ["--focus-ring", "--surface-page", 3, "focus ring on the page"],
  ["--focus-ring-on-brand", "--brand-bg", 3, "focus ring on the header"],
];

function blocks(selector) {
  const out = {};
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[}\\s])${esc}\\s*\\{([^}]*)\\}`, "g");
  for (const m of css.matchAll(re)) {
    for (const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

export function tokensFor(mode) {
  return Object.assign({}, ...MODES[mode].map(blocks));
}

function resolve(vars, name, depth = 0) {
  const v = vars[name];
  if (v === undefined) throw new Error(`${name} is not defined`);
  const m = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (m) return depth > 10 ? v : resolve(vars, m[1], depth + 1);
  return v;
}

function rgb(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  throw new Error(`Not an opaque #rrggbb colour: ${value}`);
}

function lum([r, g, b]) {
  const ch = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function ratio(fg, bg) {
  const [hi, lo] = [lum(rgb(fg)), lum(rgb(bg))].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export function check() {
  const problems = [];
  const rows = [];
  for (const mode of Object.keys(MODES)) {
    const vars = tokensFor(mode);
    for (const [fg, bg, min, what] of PAIRS) {
      const r = ratio(resolve(vars, fg), resolve(vars, bg));
      rows.push({ mode, fg, bg, ratio: r, min, what });
      if (r < min) problems.push(`${mode}: ${what} (${fg} on ${bg}) is ${r.toFixed(2)}:1, needs ${min}:1`);
    }
  }
  return { problems, rows };
}

if (process.argv[1] && import.meta.url.startsWith("file:") && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { problems, rows } = check();
  if (process.argv.includes("--table")) for (const r of rows) console.log(`${r.mode.padEnd(18)} ${r.ratio.toFixed(2).padStart(6)}  ${r.what}`);
  if (problems.length) {
    console.error(`✗ ${problems.length} pair(s) below WCAG AA:\n` + problems.join("\n"));
    process.exit(1);
  }
  console.log(`✓ ${rows.length} colour pairs meet WCAG AA in ${Object.keys(MODES).length} theme × contrast combinations.`);
}
